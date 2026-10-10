import { faixaGestacional, SOURCE_ID_GESTACIONAL, ALGORITHM_VERSION_GESTACIONAL, GrupoImcGestacional } from '../dominio/referencia-gestacional-ms';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { GestacaoPacienteOrm } from '../infraestrutura/gestacao-paciente.orm';
import { ReferenciaGestacaoOrm } from '../infraestrutura/referencia-gestacao.orm';
import { ConsentimentoGestacaoOrm } from '../infraestrutura/consentimento-gestacao.orm';
import { AvaliacaoAntropometricaOrm } from '../infraestrutura/avaliacao-antropometrica.orm';
import { ReferenciaGestacional, TERMO_GESTACAO, TEXTO_TERMO_GESTACAO } from '../dominio/contexto-gestacional';
import { CompartilharGestacaoDto, ConfirmarGestacaoDto, ConsentimentoGestacaoDto, CriarGestacaoDto, NovaReferenciaGestacaoDto, PaginaGestacoesDto } from './dtos-gestacoes';
import { garantirEscopoPaciente } from './escopo-paciente';

export function dataGestacionalValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const d = new Date(`${data}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}
function normalizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(normalizar);
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,normalizar(v)]));
  return valor;
}
export function fingerprintGestacional(valor: unknown): string {
  return createHash('sha256').update(JSON.stringify(normalizar(valor))).digest('hex');
}

@Injectable()
export class ServicoGestacoesPaciente {
  constructor(private readonly executor: ExecutorTenant, private readonly cripto: CriptografiaDadosSensiveis) {}

  private autorizar(u: UsuarioAutenticado, tenantId: string, escrever = false) {
    if (u.tenantId !== tenantId || !['SuperAdmin','Professional','Collaborator'].includes(u.papel) || !u.permissoes.includes(escrever ? 'pacientes.gerenciar' : 'pacientes.ler')) throw new ForbiddenException('Acesso nao autorizado.');
  }
  private cifrar(v: unknown) { return this.cripto.criptografar(JSON.stringify(v)); }
  private ler<T>(b: Buffer): T {
    try { return JSON.parse(this.cripto.descriptografar(b)) as T; }
    catch { throw new ConflictException('Registro gestacional ilegivel.'); }
  }
  async episodio(m: EntityManager, tenantId: string, pacienteId: string, id: string, bloquear = false) {
    const g = await m.getRepository(GestacaoPacienteOrm).findOne({ where: { id, tenantId, pacienteId }, ...(bloquear ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!g) throw new NotFoundException('Gestacao nao encontrada.');
    return g;
  }
  async referenciaAtual(m: EntityManager, g: GestacaoPacienteOrm) {
    const r = await m.getRepository(ReferenciaGestacaoOrm).findOne({ where: { tenantId: g.tenantId, pacienteId: g.pacienteId, gestacaoId: g.id }, order: { numero: 'DESC' } });
    if (!r) throw new ConflictException('Referencia gestacional indisponivel.');
    return { numero: r.numero, referencia: this.projetarReferencia(this.ler<ReferenciaGestacional>(r.contextoCriptografado)) };
  }
  private projetarReferencia(r: ReferenciaGestacional): ReferenciaGestacional {
    return { pesoKg: r.pesoKg, alturaCm: r.alturaCm, origem: r.origem, dataPeso: r.dataPeso, semanasMedida: r.semanasMedida, diasMedida: r.diasMedida, pesoHabitualAnteriorConfirmado: r.pesoHabitualAnteriorConfirmado };
  }
  private validarReferencia(r: ReferenciaGestacional) {
    if (!r || (r.dataPeso && !dataGestacionalValida(r.dataPeso)) || (r.diasMedida !== undefined && r.semanasMedida === undefined)) throw new BadRequestException('Referencia gestacional invalida.');
    return this.projetarReferencia(r);
  }
  private projetar(g: GestacaoPacienteOrm) {
    return { id: g.id, status: g.status, versao: g.versao, compartilhada: g.compartilhada, geracaoCompartilhamento: g.geracaoCompartilhamento, criadoEm: g.criadoEm };
  }
  private confirmar(g: GestacaoPacienteOrm, d: ConfirmarGestacaoDto) {
    if (d.confirmar !== true) throw new BadRequestException('Confirmacao obrigatoria.');
    if (g.versao !== d.versao) throw new ConflictException('Gestacao mudou. Atualize e confira novamente.');
  }
  async listar(tenantId: string, pacienteId: string, u: UsuarioAutenticado, pagina: PaginaGestacoesDto = {}) {
    this.autorizar(u, tenantId);
    return this.executor.executar(tenantId, async m => {
      await garantirEscopoPaciente(m,tenantId,pacienteId,u);
      const paginaDados = await this.paginaEpisodios(m,tenantId,pacienteId,pagina,false);
      const itens = await Promise.all(paginaDados.itens.map(async g => ({ ...this.projetar(g),...await this.referenciaAtual(m,g) })));
      return { itens,proximoCursor: paginaDados.proximoCursor };
    });
  }
  private async paginaEpisodios(m: EntityManager, tenantId: string, pacienteId: string, pagina: PaginaGestacoesDto, portal: boolean) {
    const limite = Math.min(pagina.limite ?? 20,50);
    const qb = m.getRepository(GestacaoPacienteOrm).createQueryBuilder('g').where('g.tenant_id = :tenantId and g.paciente_id = :pacienteId', { tenantId,pacienteId });
    if (portal) qb.andWhere('g.compartilhada = true');
    if (pagina.cursor) {
      await this.episodio(m,tenantId,pacienteId,pagina.cursor);
      // Keep timestamp precision in PostgreSQL; JS Date truncates microseconds.
      qb.andWhere(`(g.criado_em,g.id) < (select c.criado_em,c.id from gestacoes_pacientes c
        where c.tenant_id = :tenantId and c.paciente_id = :pacienteId and c.id = :cursor)`, { cursor: pagina.cursor });
    }
    const rows = await qb.orderBy('g.criado_em','DESC').addOrderBy('g.id','DESC').take(limite+1).getMany();
    const itens = rows.slice(0,limite);
    return { itens, proximoCursor: rows.length > limite ? itens[itens.length-1].id : null };
  }
  async criar(tenantId: string, pacienteId: string, u: UsuarioAutenticado, d: CriarGestacaoDto) {
    this.autorizar(u,tenantId,true);
    if (d.confirmar !== true) throw new BadRequestException('Confirmacao obrigatoria.');
    const referencia = this.validarReferencia(d.referencia);
    const fingerprint = fingerprintGestacional({ pacienteId,referencia });
    return this.executor.executar(tenantId,async m => {
      await garantirEscopoPaciente(m,tenantId,pacienteId,u,true);
      // Serialize keys across patients as the uniqueness is per tenant/author.
      await m.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${tenantId}:${u.usuarioId}:${d.chaveCriacao}`]);
      const repo = m.getRepository(GestacaoPacienteOrm);
      const anterior = await repo.findOne({ where: { tenantId,autorUsuarioId: u.usuarioId,chaveCriacao: d.chaveCriacao } });
      if (anterior) {
        if (anterior.pacienteId !== pacienteId || this.ler<{ fingerprint: string }>(anterior.criacaoCriptografada).fingerprint !== fingerprint) throw new ConflictException('Chave usada para outro pedido.');
        return { ...this.projetar(anterior), ...await this.referenciaAtual(m,anterior) };
      }
      const now = new Date();
      const g = await repo.save(repo.create({ tenantId,pacienteId,autorUsuarioId: u.usuarioId,chaveCriacao: d.chaveCriacao,criacaoCriptografada: this.cifrar({ fingerprint }),status: 'ativa',versao: 1,compartilhada: false,geracaoCompartilhamento: 0,criadoEm: now,atualizadoEm: now }));
      await m.getRepository(ReferenciaGestacaoOrm).save({ tenantId,pacienteId,gestacaoId: g.id,numero: 1,autorUsuarioId: u.usuarioId,contextoCriptografado: this.cifrar(referencia),criadoEm: now });
      return { ...this.projetar(g),numero: 1,referencia };
    });
  }
  async mudar(tenantId: string, pacienteId: string, id: string, u: UsuarioAutenticado, d: ConfirmarGestacaoDto, acao: 'encerrar'|'reabrir'|'referencia'|'compartilhar') {
    this.autorizar(u,tenantId,true);
    return this.executor.executar(tenantId,async m => {
      await garantirEscopoPaciente(m,tenantId,pacienteId,u,true);
      const g = await this.episodio(m,tenantId,pacienteId,id,true);
      this.confirmar(g,d);
      if (acao === 'encerrar') g.status = 'encerrada';
      if (acao === 'reabrir') g.status = 'ativa';
      if (acao === 'referencia') {
        if (g.status !== 'ativa') throw new ConflictException('Reabra a gestacao antes de registrar.');
        const referencia = this.validarReferencia((d as NovaReferenciaGestacaoDto).referencia);
        const atual = await this.referenciaAtual(m,g);
        await m.getRepository(ReferenciaGestacaoOrm).save({ tenantId,pacienteId,gestacaoId: id,numero: atual.numero+1,autorUsuarioId: u.usuarioId,contextoCriptografado: this.cifrar(referencia),criadoEm: new Date() });
      }
      if (acao === 'compartilhar') {
        const ativar = (d as CompartilharGestacaoDto).compartilhada;
        if (ativar && !g.compartilhada) {
          g.geracaoCompartilhamento++;
          g.compartilhadaEm = new Date(); g.compartilhadaPorUsuarioId = u.usuarioId;
        }
        g.compartilhada = ativar;
      }
      g.versao++; g.atualizadoEm = new Date();
      await m.getRepository(GestacaoPacienteOrm).save(g);
      return { ...this.projetar(g),...await this.referenciaAtual(m,g) };
    });
  }
  async detalhe(tenantId: string, pacienteId: string, id: string, u: UsuarioAutenticado, cursor?: string) {
    this.autorizar(u,tenantId);
    return this.executor.executar(tenantId,async m => {
      await garantirEscopoPaciente(m,tenantId,pacienteId,u);
      const g = await this.episodio(m,tenantId,pacienteId,id);
      return { ...this.projetar(g),...await this.referenciaAtual(m,g),...await this.avaliacoes(m,g,cursor) };
    });
  }
  private async avaliacoes(m: EntityManager, g: GestacaoPacienteOrm, cursor?: string) {
    const repo = m.getRepository(AvaliacaoAntropometricaOrm);
    const qb = repo.createQueryBuilder('a').where('a.tenant_id = :tenantId and a.paciente_id = :pacienteId and a.gestacao_id = :id and a.excluida_em is null',{ tenantId: g.tenantId,pacienteId: g.pacienteId,id: g.id });
    if (cursor) {
      const a = await repo.findOne({ where: { id: cursor,tenantId: g.tenantId,pacienteId: g.pacienteId,gestacaoId: g.id } });
      if (!a) throw new BadRequestException('Cursor invalido.');
      qb.andWhere(`(a.avaliada_em,a.criado_em,a.id) < (select c.avaliada_em,c.criado_em,c.id
        from avaliacoes_antropometricas c where c.tenant_id = :tenantId
        and c.paciente_id = :pacienteId and c.gestacao_id = :id and c.id = :cursor)`, { cursor });
    }
    const rows = await qb.orderBy('a.avaliada_em','DESC').addOrderBy('a.criado_em','DESC').addOrderBy('a.id','DESC').take(101).getMany();
    const itens = rows.slice(0,100).map(a => {
      try {
        const medidas = this.ler<{ pesoKg?: number; alturaCm?: number }>(a.medidasCriptografadas);
        const resultado = this.ler<{ gestacional?: Record<string,unknown> }>(a.resultadoCriptografado).gestacional;
        const permitidos = ['unidades','precisao','source_id','algorithm_version','condicao','origemCondicao','gestacaoId','referenciaNumero','imcReferencia','grupo','ganhoKg','semanaCurva','faixa','classificacao','motivos'];
        const gestacional = resultado ? Object.fromEntries(permitidos.filter(k => Object.hasOwn(resultado,k)).map(k => [k,resultado[k]])) : undefined;
        if (gestacional && resultado) {
          const selecionar = (v: unknown,keys: string[]) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(keys.filter(k => Object.hasOwn(v,k)).map(k => [k,(v as Record<string,unknown>)[k]])) : undefined;
          gestacional.referencia = selecionar(resultado.referencia,['pesoKg','alturaCm','origem','dataPeso','semanasMedida','diasMedida','pesoHabitualAnteriorConfirmado']);
          gestacional.contexto = selecionar(resultado.contexto,['gestacaoId','referenciaNumero','semanas','dias','tipo','risco','origemIdadeGestacional','dataFonteIdadeGestacional','idadeGestacionalInconsistente']);
          gestacional.faixa = selecionar(resultado.faixa,['minimo','maximo']);
          gestacional.unidades = selecionar(resultado.unidades,['peso','altura']);
          gestacional.precisao = selecionar(resultado.precisao,['peso','pesoReferencia','alturaReferencia']);
        }
        return { id: a.id,avaliadaEm: a.avaliadaEm,referenciaNumero: a.gestacaoReferenciaNumero,pesoKg: medidas.pesoKg,alturaCm: medidas.alturaCm,gestacional,ilegivel: !resultado };
      } catch { return { id: a.id,avaliadaEm: a.avaliadaEm,referenciaNumero: a.gestacaoReferenciaNumero,ilegivel: true }; }
    });
    const grupos = new Map<number, { numero: number; source_id: string; faixas: Array<{ semana: number; minimo: number; maximo: number }> }>();
    for (const a of itens) {
      const g = 'gestacional' in a ? a.gestacional : undefined;
      if (!g || g.source_id !== SOURCE_ID_GESTACIONAL || g.algorithm_version !== ALGORITHM_VERSION_GESTACIONAL || !g.classificacao || typeof g.grupo !== 'string' || !['baixo_peso','eutrofia','sobrepeso','obesidade'].includes(g.grupo) || !a.referenciaNumero) continue;
      if (!grupos.has(a.referenciaNumero)) grupos.set(a.referenciaNumero,{ numero: a.referenciaNumero,source_id: SOURCE_ID_GESTACIONAL,faixas: Array.from({ length: 31 },(_,i) => ({ semana: i+10,...faixaGestacional(i+10,g.grupo as GrupoImcGestacional)! })) });
    }
    return { seriesReferencia: [...grupos.values()],avaliacoes: itens,proximoCursor: rows.length > 100 ? rows[99].id : null };
  }
  private async pacientePortal(m: EntityManager, tenantId: string, u: UsuarioAutenticado, bloquear = false) {
    if (u.papel !== 'Patient' || u.tenantId !== tenantId) throw new ForbiddenException('Acesso nao autorizado.');
    const consulta = m.getRepository(PacienteOrm).createQueryBuilder('p')
      .where('p.tenant_id = :tenantId and p.usuario_id = :usuarioId and p.arquivado_em is null',{ tenantId,usuarioId: u.usuarioId })
      .orderBy('p.id','ASC').take(2);
    if (bloquear) consulta.setLock('pessimistic_write');
    const pacientes = await consulta.getMany();
    if (pacientes.length !== 1) throw new ForbiddenException('Vinculo do paciente indisponivel.');
    return pacientes[0];
  }
  private async consentimento(m: EntityManager,g: GestacaoPacienteOrm,u: UsuarioAutenticado) {
    return m.getRepository(ConsentimentoGestacaoOrm).findOne({ where: { tenantId: g.tenantId,pacienteId: g.pacienteId,gestacaoId: g.id,usuarioId: u.usuarioId,geracao: g.geracaoCompartilhamento } });
  }
  async listarPortal(tenantId: string,u: UsuarioAutenticado,pagina: PaginaGestacoesDto = {}) {
    return this.executor.executar(tenantId,async m => {
      const p = await this.pacientePortal(m,tenantId,u,true);
      const paginaDados = await this.paginaEpisodios(m,tenantId,p.id,pagina,true);
      const itens = [];
      for (const item of paginaDados.itens) {
        const g = await this.episodio(m,tenantId,p.id,item.id,true);
        if (!g.compartilhada) continue;
        const c = await this.consentimento(m,g,u);
        itens.push({ id: g.id,geracao: g.geracaoCompartilhamento,termoVersao: TERMO_GESTACAO,termo: TEXTO_TERMO_GESTACAO,consentimentoVersao: c?.versao ?? 0,aceito: !!c && !c.revogadoEm && c.termoVersao === TERMO_GESTACAO });
      }
      return { itens,proximoCursor: paginaDados.proximoCursor };
    });
  }
  async detalhePortal(tenantId: string,id: string,u: UsuarioAutenticado,cursor?: string) {
    return this.executor.executar(tenantId,async m => {
      const p = await this.pacientePortal(m,tenantId,u,true);
      const g = await this.episodio(m,tenantId,p.id,id,true);
      const c = await this.consentimento(m,g,u);
      if (!g.compartilhada || !c || c.revogadoEm || c.termoVersao !== TERMO_GESTACAO) throw new ForbiddenException('Acompanhamento nao autorizado.');
      // Current baseline is not exposed before an assessment has actually used it.
      return { id: g.id,status: g.status,...await this.avaliacoes(m,g,cursor) };
    });
  }
  async consentir(tenantId: string,id: string,u: UsuarioAutenticado,d: ConsentimentoGestacaoDto) {
    if (d.confirmar !== true || d.termoVersao !== TERMO_GESTACAO) throw new BadRequestException('Confira o termo de consentimento.');
    return this.executor.executar(tenantId,async m => {
      const p = await this.pacientePortal(m,tenantId,u,true);
      const g = await this.episodio(m,tenantId,p.id,id,true);
      if (!g.compartilhada || d.geracao !== g.geracaoCompartilhamento) throw new ConflictException('Compartilhamento mudou. Confira novamente.');
      const repo = m.getRepository(ConsentimentoGestacaoOrm);
      let c = await this.consentimento(m,g,u);
      if ((c?.versao ?? 0) !== d.versao) throw new ConflictException('Consentimento mudou. Confira novamente.');
      if (!c && !d.aceitar) return { aceito: false,versao: 0 };
      if (!c) c = repo.create({ tenantId,pacienteId: p.id,gestacaoId: id,usuarioId: u.usuarioId,geracao: d.geracao,termoVersao: TERMO_GESTACAO,aceitoEm: new Date(),versao: 0 });
      c.versao++; c.revogadoEm = d.aceitar ? null : new Date();
      if (d.aceitar) c.aceitoEm = new Date();
      await repo.save(c);
      return { aceito: d.aceitar,versao: c.versao };
    });
  }
}
