import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { In, IsNull, type EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { linhasDeUpdateReturning } from '../../../infraestrutura/banco-dados/linhas-update-returning';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoProtecaoAbuso, type PoliticaProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { mascararEmail } from '../../usuarios/dominio/mascarar-email';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { autorizarPendenciaRestricao } from '../../planos-alimentares/aplicacao/autorizacao-pendencia-restricao';
import { travarUsuariosAtivos } from '../../profissionais/aplicacao/servico-delegacoes-carteira';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { TIPOS_VERIFICACAO_REPRESENTACAO, VinculoRepresentacaoPacienteOrm } from '../infraestrutura/vinculo-representacao-paciente.orm';

export type TipoVerificacaoRepresentacao = typeof TIPOS_VERIFICACAO_REPRESENTACAO[number];
/**
 * Como a equipe enxerga a conta representante (P3-0b, decisão do proprietário): o nome da ficha só quando a conta tem
 * ficha na carteira do paciente atual (mesmo profissional responsável); nos outros casos, o e-mail mascarado.
 */
export type IdentificacaoRepresentante = { tipo: 'nome_ficha'; nome: string } | { tipo: 'email_mascarado'; email: string };
export interface VinculoRepresentacaoResposta { id: string; representanteUsuarioId: string; tipoVerificacao: TipoVerificacaoRepresentacao; verificadoEm: Date;
  identificacao: IdentificacaoRepresentante }
export interface CandidatoRepresentante { usuarioId: string; identificacao: IdentificacaoRepresentante }

/** Cota por usuário da busca por e-mail exato (anti-enumeração). A chave nunca leva o e-mail. */
export const POLITICA_BUSCA_REPRESENTANTE: PoliticaProtecaoAbuso = {
  maxTentativas: 10,
  janelaMs: 15 * 60 * 1000,
  bloqueioMs: 15 * 60 * 1000,
  mensagemBloqueio: 'Muitas buscas. Tente novamente em alguns minutos.'
};
/**
 * Cota agregada por tenant (revisão R4, MÉDIA): limita varredura feita com várias contas da mesma equipe. Também sem e-mail.
 */
export const POLITICA_BUSCA_REPRESENTANTE_TENANT: PoliticaProtecaoAbuso = {
  maxTentativas: 60,
  janelaMs: 15 * 60 * 1000,
  bloqueioMs: 15 * 60 * 1000,
  mensagemBloqueio: 'Muitas buscas. Tente novamente em alguns minutos.'
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const negar = () => new ForbiddenException('Operação não autorizada.');
/** Máximo de representantes vigentes por paciente e de representados por conta; as listas devolvem todos. */
export const LIMITE_VINCULOS_VIGENTES = 100;

async function exigirReadCommitted(g: EntityManager): Promise<void> {
  const isolamento: Array<{ transaction_isolation?: string }> = await g.query('show transaction_isolation');
  if (isolamento.length !== 1 || isolamento[0].transaction_isolation !== 'read committed') throw new ConflictException('Operação indisponível.');
}

function falharVinculo(erro: unknown): never {
  if (erro instanceof HttpException) {
    const status = erro.getStatus();
    if (status === 400) throw new BadRequestException('Solicitação inválida.');
    if (status === 403) throw negar();
    if (status === 409) throw new ConflictException('Operação indisponível ou concorrente.');
    throw new InternalServerErrorException('Operação indisponível.');
  }
  const falha = erro as { code?: string; driverError?: { code?: string } } | null;
  const code = falha?.code ?? falha?.driverError?.code;
  if (code === '23505' || code === '55P03' || code === '40P01' || code === '40001') throw new ConflictException('Operação indisponível ou concorrente.');
  throw new InternalServerErrorException('Operação indisponível.');
}

async function revogarEmLote(g: EntityManager, tenantId: string, filtroSql: string, parametro: string, revogador: string, acao: string): Promise<void> {
  const revogados = linhasDeUpdateReturning(await g.query(`update vinculos_representacao_paciente v
      set revogado_por = $3, revogado_em = clock_timestamp()
    where v.tenant_id = $1 and v.revogado_em is null and ${filtroSql} returning v.id`, [tenantId, parametro, revogador]));
  for (const linha of revogados) {
    await registrarAuditoriaNaTransacao(g, { tenantId, usuarioId: revogador, acao, recursoTipo: 'vinculo_representacao_paciente',
      recursoId: linha.id, metadados: {} });
  }
}

/** Cascata (padrão Auth-2): a conta representante desativada perde todas as representações. */
export async function revogarVinculosPorAlteracaoAcesso(g: EntityManager, tenantId: string, usuarioId: string, revogadorUsuarioId: string): Promise<void> {
  await revogarEmLote(g, tenantId, 'v.representante_usuario_id = $2', usuarioId, revogadorUsuarioId, 'representacao.vinculo.revogar_por_alteracao_acesso');
}

export type MotivoRevogacaoVinculosPaciente = 'arquivamento' | 'eliminacao' | 'desativacao_conta';

/** Arquivar, eliminar (LGPD) ou desativar a conta do paciente encerra quem o representa; nada disso revive depois. */
export async function revogarVinculosDoPaciente(g: EntityManager, tenantId: string, pacienteId: string, revogadorUsuarioId: string,
  motivo: MotivoRevogacaoVinculosPaciente): Promise<void> {
  await revogarEmLote(g, tenantId, 'v.paciente_id = $2', pacienteId, revogadorUsuarioId, `representacao.vinculo.revogar_por_${motivo}`);
}

/**
 * FOOD06 P2d-3a: a equipe (Professional responsável ou Collaborator com a carteira delegada) registra, lista e revoga quem
 * representa o paciente no portal. Uma conta pode representar vários pacientes. A verificação fica só registrada (tipo,
 * quem, quando), sem documento. O representante é conta `Patient` ativa do tenant, diferente de quem verifica e da conta
 * do próprio paciente (que acessa sem vínculo). Ordem de locks: usuários → delegação → profissional → paciente → vínculo.
 */
@Injectable()
export class ServicoVinculosRepresentacao {
  constructor(private readonly executor: ExecutorTenant, private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly protecao: ServicoProtecaoAbuso) {}

  private abrir(cifrado: Buffer): string {
    try { return this.criptografia.descriptografar(cifrado); } catch { throw new InternalServerErrorException('Operação indisponível.'); }
  }

  /** Identificação das contas para a equipe já autorizada no paciente; só leitura, na mesma transação. */
  private async identificar(g: EntityManager, tenantId: string, profissionalResponsavelId: string, ids: string[]): Promise<Map<string, IdentificacaoRepresentante>> {
    const mapa = new Map<string, IdentificacaoRepresentante>();
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return mapa;
    const fichas = await g.getRepository(PacienteOrm).find({ where: { tenantId, usuarioId: In(unicos), profissionalResponsavelId, arquivadoEm: IsNull() },
      select: { id: true, usuarioId: true, nomeCriptografado: true }, order: { id: 'ASC' } });
    for (const ficha of fichas) {
      if (ficha.usuarioId && !mapa.has(ficha.usuarioId)) mapa.set(ficha.usuarioId, { tipo: 'nome_ficha', nome: this.abrir(ficha.nomeCriptografado) });
    }
    const semFicha = unicos.filter(id => !mapa.has(id));
    if (semFicha.length > 0) {
      const contas = await g.getRepository(UsuarioOrm).find({ where: { tenantId, id: In(semFicha) }, select: { id: true, emailCriptografado: true } });
      for (const conta of contas) mapa.set(conta.id, { tipo: 'email_mascarado', email: mascararEmail(this.abrir(conta.emailCriptografado)) });
    }
    for (const id of unicos) if (!mapa.has(id)) throw new InternalServerErrorException('Operação indisponível.');
    return mapa;
  }

  private async pacienteDaEquipe(g: EntityManager, u: UsuarioAutenticado, paciente: string): Promise<PacienteOrm> {
    const equipe = await autorizarPendenciaRestricao(g, u, paciente);
    if (equipe !== 'profissional' && equipe !== 'colaborador') throw negar();
    // A autorização já travou esta linha; aqui só se lê o responsável e a conta do próprio paciente.
    const linha = await g.getRepository(PacienteOrm).findOne({ where: { id: paciente, tenantId: u.tenantId },
      select: { id: true, usuarioId: true, profissionalResponsavelId: true }, lock: { mode: 'pessimistic_write' } });
    if (!linha) throw negar();
    return linha;
  }

  /**
   * P3-0b: a equipe acha a conta do representante pelo e-mail EXATO. "Não existe" e "não elegível" têm a mesma resposta
   * (`candidato: null`); não há listagem de contas. O e-mail não vai para URL, log, chave de cota nem auditoria. A cota
   * por usuário é consumida antes do banco; `registrar` reconfere tudo sob lock.
   */
  async buscarCandidato(usuario: UsuarioAutenticado, pacienteId: string, email: string): Promise<{ candidato: CandidatoRepresentante | null }> {
    const { u, ids: [paciente] } = this.normalizar(usuario, pacienteId);
    const normalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (normalizado.length < 3 || normalizado.length > 254 || !EMAIL.test(normalizado)) throw new BadRequestException('Solicitação inválida.');
    await this.protecao.consumirTentativa(`representante.candidato:${u.tenantId}:${u.usuarioId}`, POLITICA_BUSCA_REPRESENTANTE);
    await this.protecao.consumirTentativa(`representante.candidato:${u.tenantId}`, POLITICA_BUSCA_REPRESENTANTE_TENANT);
    try {
      return await this.executor.executar(u.tenantId, async g => {
        await exigirReadCommitted(g);
        const linhaPaciente = await this.pacienteDaEquipe(g, u, paciente);
        await registrarAuditoriaNaTransacao(g, { tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'representacao.candidato.buscar',
          recursoTipo: 'paciente', recursoId: paciente, metadados: {} });
        const conta = await g.getRepository(UsuarioOrm).findOne({ where: { tenantId: u.tenantId, emailHash: this.criptografia.gerarHashBusca(normalizado) },
          select: { id: true, role: true, ativo: true } });
        if (!conta || !conta.ativo || conta.role !== 'Patient' || conta.id === u.usuarioId || conta.id === linhaPaciente.usuarioId) return { candidato: null };
        const identificacao = (await this.identificar(g, u.tenantId, linhaPaciente.profissionalResponsavelId, [conta.id])).get(conta.id)!;
        return { candidato: { usuarioId: conta.id, identificacao } };
      });
    } catch (erro) { return falharVinculo(erro); }
  }

  private normalizar(u: UsuarioAutenticado, ...ids: unknown[]): { u: UsuarioAutenticado; ids: string[] } {
    if (!u || !isUUID(u.tenantId) || !isUUID(u.usuarioId) || ids.some(id => !isUUID(id))) throw new BadRequestException('Solicitação inválida.');
    if (u.papel !== 'Professional' && u.papel !== 'Collaborator') throw negar();
    return { u: { ...u, tenantId: u.tenantId.toLowerCase(), usuarioId: u.usuarioId.toLowerCase() }, ids: ids.map(id => (id as string).toLowerCase()) };
  }

  async listar(usuario: UsuarioAutenticado, pacienteId: string): Promise<VinculoRepresentacaoResposta[]> {
    const { u, ids: [paciente] } = this.normalizar(usuario, pacienteId);
    try {
      return await this.executor.executar(u.tenantId, async g => {
        await exigirReadCommitted(g);
        const linhaPaciente = await this.pacienteDaEquipe(g, u, paciente);
        const linhas = await g.getRepository(VinculoRepresentacaoPacienteOrm).find({
          where: { tenantId: u.tenantId, pacienteId: paciente, revogadoEm: IsNull() },
          select: { id: true, representanteUsuarioId: true, tipoVerificacao: true, verificadoEm: true }, order: { verificadoEm: 'DESC' }, take: LIMITE_VINCULOS_VIGENTES });
        const ids = await this.identificar(g, u.tenantId, linhaPaciente.profissionalResponsavelId, linhas.map(l => l.representanteUsuarioId));
        return linhas.map(l => ({ id: l.id, representanteUsuarioId: l.representanteUsuarioId,
          tipoVerificacao: l.tipoVerificacao as TipoVerificacaoRepresentacao, verificadoEm: l.verificadoEm, identificacao: ids.get(l.representanteUsuarioId)! }));
      });
    } catch (erro) { return falharVinculo(erro); }
  }

  async registrar(usuario: UsuarioAutenticado, pacienteId: string, representanteUsuarioId: string, tipoVerificacao: string): Promise<VinculoRepresentacaoResposta> {
    const { u, ids: [paciente, representante] } = this.normalizar(usuario, pacienteId, representanteUsuarioId);
    if (!(TIPOS_VERIFICACAO_REPRESENTACAO as readonly string[]).includes(tipoVerificacao)) throw new BadRequestException('Solicitação inválida.');
    if (representante === u.usuarioId) throw negar();
    try {
      return await this.executor.executar(u.tenantId, async g => {
        await exigirReadCommitted(g);
        // Usuários primeiro (ordem global). Só travas compartilhadas; a conta do ator é relida pela autorização.
        const usuarios = await travarUsuariosAtivos(g, u.tenantId, [representante]);
        if (usuarios.get(representante)?.role !== 'Patient') throw negar();
        const equipe = await autorizarPendenciaRestricao(g, u, paciente);
        if (equipe !== 'profissional' && equipe !== 'colaborador') throw negar();
        // Trava explícita (a autorização já trava a mesma linha; não depender disso em silêncio).
        const linhaPaciente = await g.getRepository(PacienteOrm).findOne({ where: { id: paciente, tenantId: u.tenantId },
          select: { id: true, usuarioId: true, profissionalResponsavelId: true }, lock: { mode: 'pessimistic_write' } });
        if (!linhaPaciente || linhaPaciente.usuarioId === representante) throw negar();
        const identificar = async () => (await this.identificar(g, u.tenantId, linhaPaciente.profissionalResponsavelId, [representante])).get(representante)!;
        const repo = g.getRepository(VinculoRepresentacaoPacienteOrm);
        const existente = await repo.findOne({ where: { tenantId: u.tenantId, pacienteId: paciente, representanteUsuarioId: representante, revogadoEm: IsNull() },
          select: { id: true, representanteUsuarioId: true, tipoVerificacao: true, verificadoEm: true }, lock: { mode: 'pessimistic_read' } });
        // Repetição com outro tipo de verificação não reescreve o registro: conflito explícito.
        if (existente && existente.tipoVerificacao !== tipoVerificacao) throw new ConflictException('Operação indisponível ou concorrente.');
        if (existente) return { id: existente.id, representanteUsuarioId: existente.representanteUsuarioId,
          tipoVerificacao: existente.tipoVerificacao as TipoVerificacaoRepresentacao, verificadoEm: existente.verificadoEm, identificacao: await identificar() };
        // Limites: por paciente (serializado pela trava do paciente) e por representante (trava consultiva própria).
        await g.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`representante:${u.tenantId}:${representante}`]);
        const contagem: Array<{ do_paciente: number; do_representante: number }> = await g.query(`select
            count(*) filter (where paciente_id = $2)::int as do_paciente, count(*) filter (where representante_usuario_id = $3)::int as do_representante
          from vinculos_representacao_paciente where tenant_id = $1 and revogado_em is null and (paciente_id = $2 or representante_usuario_id = $3)`,
          [u.tenantId, paciente, representante]);
        if (contagem.length !== 1 || contagem[0].do_paciente >= LIMITE_VINCULOS_VIGENTES || contagem[0].do_representante >= LIMITE_VINCULOS_VIGENTES) {
          throw new ConflictException('Operação indisponível ou concorrente.');
        }
        const linhas: Array<{ id: string; verificado_em: Date }> = await g.query(`insert into vinculos_representacao_paciente
          (tenant_id, paciente_id, representante_usuario_id, verificado_por, tipo_verificacao) values ($1, $2, $3, $4, $5) returning id, verificado_em`,
          [u.tenantId, paciente, representante, u.usuarioId, tipoVerificacao]);
        if (linhas.length !== 1) throw new InternalServerErrorException('Operação indisponível.');
        await registrarAuditoriaNaTransacao(g, { tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'representacao.vinculo.registrar',
          recursoTipo: 'vinculo_representacao_paciente', recursoId: linhas[0].id, metadados: {} });
        return { id: linhas[0].id, representanteUsuarioId: representante, tipoVerificacao: tipoVerificacao as TipoVerificacaoRepresentacao,
          verificadoEm: linhas[0].verificado_em, identificacao: await identificar() };
      });
    } catch (erro) { return falharVinculo(erro); }
  }

  async revogar(usuario: UsuarioAutenticado, pacienteId: string, vinculoId: string): Promise<{ id: string; revogado: true }> {
    const { u, ids: [paciente, id] } = this.normalizar(usuario, pacienteId, vinculoId);
    try {
      return await this.executor.executar(u.tenantId, async g => {
        await exigirReadCommitted(g);
        const equipe = await autorizarPendenciaRestricao(g, u, paciente);
        if (equipe !== 'profissional' && equipe !== 'colaborador') throw negar();
        const repo = g.getRepository(VinculoRepresentacaoPacienteOrm);
        const linha = await repo.findOne({ where: { id, tenantId: u.tenantId, pacienteId: paciente }, select: { id: true, revogadoEm: true },
          lock: { mode: 'pessimistic_write' } });
        if (!linha) throw negar();
        if (linha.revogadoEm) return { id, revogado: true as const };
        const r = await repo.update({ id, tenantId: u.tenantId, pacienteId: paciente, revogadoEm: IsNull() },
          { revogadoPor: u.usuarioId, revogadoEm: () => 'clock_timestamp()' });
        if (r.affected !== 1) throw new ConflictException('Operação indisponível ou concorrente.');
        await registrarAuditoriaNaTransacao(g, { tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'representacao.vinculo.revogar',
          recursoTipo: 'vinculo_representacao_paciente', recursoId: id, metadados: {} });
        return { id, revogado: true as const };
      });
    } catch (erro) { return falharVinculo(erro); }
  }
}
