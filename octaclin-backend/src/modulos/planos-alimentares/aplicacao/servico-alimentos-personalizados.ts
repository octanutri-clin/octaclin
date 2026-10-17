import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ArrayContains, EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AlimentoPersonalizadoOrm } from '../infraestrutura/alimento-personalizado.orm';
import { ComposicaoPersonalizada, NORMALIZACAO_CUSTOM, normalizarComposicaoPersonalizada, selecionarConteudoPersonalizado } from '../dominio/alimentos-personalizados';
import { LimitePrecisaoNutricionalError } from '../dominio/micronutrientes';
import { AtualizarAlimentoPersonalizadoDto, BuscarAlimentosPersonalizadosDto, CriarAlimentoPersonalizadoDto, ListarAlimentosPersonalizadosDto } from './dtos-alimentos-personalizados';
import { identidadeBiblioteca } from './identidade-biblioteca-alimentos';
export interface ReferenciaAlimentoPersonalizado { id: string; revisao: number }
@Injectable()
export class ServicoAlimentosPersonalizados {
  constructor(private readonly executor: ExecutorTenant, private readonly crypto: CriptografiaDadosSensiveis) {}
  private normalizar(v: unknown): ComposicaoPersonalizada {
    try { return normalizarComposicaoPersonalizada(v); }
    catch (erro) { if (erro instanceof LimitePrecisaoNutricionalError) throw new UnprocessableEntityException('Limite técnico de precisão nutricional excedido.'); throw new BadRequestException('Composição informada inválida.'); }
  }
  private ler(m: AlimentoPersonalizadoOrm): ComposicaoPersonalizada {
    try {
      const s = JSON.parse(this.crypto.descriptografar(m.conteudoCriptografado));
      const c = s.composicao;
      if (s.schemaVersao !== 1 || c?.normalizacaoVersao !== NORMALIZACAO_CUSTOM) throw new Error();
      const r = normalizarComposicaoPersonalizada({ nome: c.nome, ...(c.preparacao ? { preparacao: c.preparacao } : {}), ...(c.referenciaComposicao ? { referenciaComposicao: c.referenciaComposicao } : {}), base: c.baseOrigem, ...c.composicaoOrigem });
      if (JSON.stringify(r) !== JSON.stringify(c)) throw new Error();
      return r;
    } catch { throw new ServiceUnavailableException('Alimento personalizado indisponível.'); }
  }
  private projetar(m: AlimentoPersonalizadoOrm, profissionalId: string, detalhe = false) {
    const c = this.ler(m);
    return { id: m.id, nome: c.nome, preparacao: c.preparacao, referenciaComposicao: c.referenciaComposicao, escopo: m.escopo,
      revisao: m.revisao, ativo: m.ativo, baseOrigem: c.baseOrigem, nutrientesPor100g: c.nutrientesPor100g, micronutrientesPor100g: c.micronutrientesPor100g,
      disponivelParaCalculo: c.disponivelParaCalculo, podeEditar: m.profissionalId === profissionalId, ...(detalhe ? { composicaoOrigem: c.composicaoOrigem } : {}) };
  }
  private async obterAutorizado(g: EntityManager, tenantId: string, profissionalId: string, id: string) {
    const m = await g.getRepository(AlimentoPersonalizadoOrm).findOne({ where: { tenantId, id }, lock: { mode: 'pessimistic_read' } });
    if (!m || (m.escopo !== 'clinica' && m.profissionalId !== profissionalId)) throw new NotFoundException('Alimento personalizado não encontrado.');
    return m;
  }
  private async consultar(tenantId: string, usuario: UsuarioAutenticado, q: ListarAlimentosPersonalizadosDto, busca?: string) {
    return this.executor.executar(tenantId, async g => {
      const profissionalId = await identidadeBiblioteca(g, tenantId, usuario, false);
      const pagina = q.pagina ?? 1, limite = q.limite ?? 25;
      if (!Number.isInteger(pagina) || pagina < 1 || pagina > 10000 || !Number.isInteger(limite) || limite < 1 || limite > 100 || (q.escopo !== undefined && !['pessoal', 'clinica'].includes(q.escopo))) throw new BadRequestException('Consulta inválida.');
      let hashes: string[] | undefined;
      if (busca !== undefined) {
        if (typeof busca !== 'string' || busca.length > 240) throw new BadRequestException('Busca inválida.');
        const termos = busca.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
        hashes = this.crypto.gerarHashesConsultaPii(tenantId, busca);
        if (!hashes.length || termos.some(t => t.length > 32)) throw new BadRequestException('Use palavras com 3 a 32 caracteres para buscar.');
      }
      const base = { tenantId, ativo: true, ...(hashes ? { buscaHashes: ArrayContains(hashes) } : {}) };
      const where = [ ...(q.escopo !== 'pessoal' ? [{ ...base, escopo: 'clinica' as const }] : []), ...(q.escopo !== 'clinica' ? [{ ...base, escopo: 'pessoal' as const, profissionalId }] : []) ];
      const [itens, total] = await g.getRepository(AlimentoPersonalizadoOrm).findAndCount({ where, order: { criadoEm: 'DESC', id: 'DESC' }, skip: (pagina - 1) * limite, take: limite });
      return { itens: itens.map(m => this.projetar(m, profissionalId)), total, pagina, limite };
    });
  }
  listar(tenantId: string, usuario: UsuarioAutenticado, q: ListarAlimentosPersonalizadosDto) { return this.consultar(tenantId, usuario, q); }
  buscar(tenantId: string, usuario: UsuarioAutenticado, q: BuscarAlimentosPersonalizadosDto) { return this.consultar(tenantId, usuario, q, q.busca); }
  async obter(tenantId: string, usuario: UsuarioAutenticado, id: string) {
    return this.executor.executar(tenantId, async g => {
      const p = await identidadeBiblioteca(g, tenantId, usuario, false);
      return this.projetar(await this.obterAutorizado(g, tenantId, p, id), p, true);
    });
  }
  async criar(tenantId: string, usuario: UsuarioAutenticado, dados: CriarAlimentoPersonalizadoDto) {
    return this.executor.executar(tenantId, async g => {
      const p = await identidadeBiblioteca(g, tenantId, usuario, true);
      const c = this.normalizar(selecionarConteudoPersonalizado(dados as unknown as Record<string, unknown>));
      const escopo = dados.escopo ?? 'pessoal';
      if (!['pessoal', 'clinica'].includes(escopo) || !/^[0-9a-f-]{36}$/i.test(dados.chaveIdempotencia ?? '')) throw new BadRequestException('Criação inválida.');
      const original = JSON.stringify({ escopo, composicao: c });
      await g.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`food02:${tenantId}:${p}:${dados.chaveIdempotencia}`]);
      const repo = g.getRepository(AlimentoPersonalizadoOrm);
      const anterior = await repo.findOne({ where: { tenantId, profissionalId: p, chaveIdempotencia: dados.chaveIdempotencia } });
      if (anterior) {
        let pedido: string;
        try { pedido = this.crypto.descriptografar(anterior.criacaoSnapshotCriptografado); } catch { throw new ServiceUnavailableException('Criação indisponível.'); }
        if (pedido !== original) throw new ConflictException('Chave de criação já utilizada com outros dados.');
        return this.projetar(anterior, p);
      }
      const m = await repo.save(repo.create({ tenantId, profissionalId: p, chaveIdempotencia: dados.chaveIdempotencia, escopo,
        conteudoCriptografado: this.crypto.criptografar(JSON.stringify({ schemaVersao: 1, composicao: c })),
        criacaoSnapshotCriptografado: this.crypto.criptografar(original), buscaHashes: this.crypto.gerarHashesBuscaPii(tenantId, [c.nome]), revisao: 1, ativo: true }));
      return this.projetar(m, p);
    });
  }
  async atualizar(tenantId: string, usuario: UsuarioAutenticado, id: string, dados: AtualizarAlimentoPersonalizadoDto) {
    return this.executor.executar(tenantId, async g => {
      const p = await identidadeBiblioteca(g, tenantId, usuario, true), repo = g.getRepository(AlimentoPersonalizadoOrm);
      const m = await repo.findOne({ where: { id, tenantId, profissionalId: p }, lock: { mode: 'pessimistic_write' } });
      if (!m) throw new NotFoundException('Alimento personalizado não encontrado.');
      if (!m.ativo || m.revisao !== dados.revisaoEsperada || m.revisao >= 2147483647) throw new ConflictException('Alimento alterado ou desativado. Atualize a lista.');
      const conteudo = selecionarConteudoPersonalizado(dados as unknown as Record<string, unknown>);
      if (dados.ativo === false) {
        if (Object.keys(conteudo).length) throw new BadRequestException('Desativação não aceita composição.');
        m.ativo = false;
      } else {
        const c = this.normalizar(conteudo);
        m.conteudoCriptografado = this.crypto.criptografar(JSON.stringify({ schemaVersao: 1, composicao: c }));
        m.buscaHashes = this.crypto.gerarHashesBuscaPii(tenantId, [c.nome]);
      }
      m.revisao++;
      return this.projetar(await repo.save(m), p);
    });
  }
  async resolverAplicacao(g: EntityManager, tenantId: string, usuario: UsuarioAutenticado, ref: ReferenciaAlimentoPersonalizado) {
    const p = await identidadeBiblioteca(g, tenantId, usuario, true);
    const m = await this.obterAutorizado(g, tenantId, p, ref.id);
    if (!m.ativo || m.revisao !== ref.revisao) throw new ConflictException('Alimento alterado ou desativado. Atualize a lista.');
    return { id: m.id, revisao: m.revisao, composicao: this.ler(m) };
  }
  /** Uso interno de medidas; não projetar proprietário ao cliente. */
  async autorizarPaiMedida(g: EntityManager, tenantId: string, usuario: UsuarioAutenticado, id: string, escrita = true) {
    const p = await identidadeBiblioteca(g, tenantId, usuario, escrita);
    const m = await this.obterAutorizado(g, tenantId, p, id);
    if (!m.ativo) throw new ConflictException('Alimento desativado.');
    return { escopo: m.escopo, profissionalId: m.profissionalId };
  }
}
