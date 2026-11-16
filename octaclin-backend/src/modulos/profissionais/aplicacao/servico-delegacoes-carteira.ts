import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { IsNull, type EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { linhasDeUpdateReturning } from '../../../infraestrutura/banco-dados/linhas-update-returning';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../infraestrutura/profissional.orm';
import { DelegacaoCarteiraProfissionalOrm } from '../infraestrutura/delegacao-carteira-profissional.orm';

export interface DelegacaoCarteiraResposta { id: string; colaboradorUsuarioId: string; concedidaEm: Date }

const negar = () => new ForbiddenException('Operação não autorizada.');
/** Máximo de delegações vigentes por titular; `listar` devolve todas. */
export const LIMITE_DELEGACOES_VIGENTES = 100;

/** Ordem global de locks: usuários (por id) → delegação → profissional → paciente. */
async function exigirReadCommitted(g: EntityManager): Promise<void> {
  const isolamento: Array<{ transaction_isolation?: string }> = await g.query('show transaction_isolation');
  if (isolamento.length !== 1 || isolamento[0].transaction_isolation !== 'read committed') throw new ConflictException('Operação indisponível.');
}

/** Lê e trava (FOR SHARE) os usuários em ordem de id, para não inverter a ordem de quem os desativa. */
export async function travarUsuariosAtivos(g: EntityManager, tenantId: string, ids: string[]): Promise<Map<string, UsuarioOrm>> {
  const ordenados = [...new Set(ids)].sort();
  const mapa = new Map<string, UsuarioOrm>();
  for (const id of ordenados) {
    const u = await g.getRepository(UsuarioOrm).findOne({ where: { id, tenantId }, select: { id: true, role: true, ativo: true },
      lock: { mode: 'pessimistic_read' } });
    if (u?.ativo) mapa.set(id, u);
  }
  return mapa;
}

function falharDelegacao(erro: unknown): never {
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

/**
 * Revogação em cascata (padrão Auth-2): ao desativar, mudar o papel ou arquivar uma conta, caem as delegações em que ela
 * é colaboradora ou titular. `revogadorUsuarioId` precisa ser usuário do mesmo tenant (FK); sem ator do tenant, quem
 * revoga é a própria conta afetada e a auditoria registra o motivo. Leitura sob lock continua sendo a garantia real.
 */
export async function revogarDelegacoesPorAlteracaoAcesso(g: EntityManager, tenantId: string, usuarioId: string,
  revogadorUsuarioId: string): Promise<void> {
  const revogadas = linhasDeUpdateReturning(await g.query(`update delegacoes_carteira_profissional d
      set revogada_por = $3, revogada_em = clock_timestamp()
    where d.tenant_id = $1 and d.revogada_em is null and (d.colaborador_usuario_id = $2 or d.profissional_id in
      (select p.id from profissionais p where p.tenant_id = $1 and p.usuario_id = $2))
    returning d.id`, [tenantId, usuarioId, revogadorUsuarioId]));
  for (const linha of revogadas) {
    await registrarAuditoriaNaTransacao(g, { tenantId, usuarioId: revogadorUsuarioId, acao: 'carteira.delegacao.revogar_por_alteracao_acesso',
      recursoTipo: 'delegacao_carteira_profissional', recursoId: linha.id, metadados: {} });
  }
}

/**
 * FOOD06 P2d-2: o titular Professional ativo delega a carteira INTEIRA (atual) a um colaborador ativo do mesmo tenant.
 * Sem prazo; vale até revogar. Nunca dá confirmação clínica. SuperAdmin e o próprio titular nunca são alvo.
 */
@Injectable()
export class ServicoDelegacoesCarteira {
  constructor(private readonly executor: ExecutorTenant) {}

  private normalizar(u: UsuarioAutenticado): UsuarioAutenticado {
    if (!u || !isUUID(u.tenantId) || !isUUID(u.usuarioId)) throw new BadRequestException('Solicitação inválida.');
    return { ...u, tenantId: u.tenantId.toLowerCase(), usuarioId: u.usuarioId.toLowerCase() };
  }

  /** Titular ativo, papel Professional no banco e no token, perfil não arquivado (FOR SHARE). */
  private async titular(g: EntityManager, u: UsuarioAutenticado, outros: string[] = []): Promise<{ profissional: ProfissionalOrm; usuarios: Map<string, UsuarioOrm> }> {
    if (u.papel !== 'Professional') throw negar();
    const usuarios = await travarUsuariosAtivos(g, u.tenantId, [u.usuarioId, ...outros]);
    if (usuarios.get(u.usuarioId)?.role !== 'Professional') throw negar();
    const profissional = await g.getRepository(ProfissionalOrm).findOne({ where: { tenantId: u.tenantId, usuarioId: u.usuarioId, arquivadoEm: IsNull() },
      select: { id: true, usuarioId: true }, lock: { mode: 'pessimistic_read' } });
    if (!profissional) throw negar();
    return { profissional, usuarios };
  }

  async listar(usuario: UsuarioAutenticado): Promise<DelegacaoCarteiraResposta[]> {
    const u = this.normalizar(usuario);
    try {
      return await this.executor.executar(u.tenantId, async g => {
        await exigirReadCommitted(g);
        const { profissional } = await this.titular(g, u);
        const linhas = await g.getRepository(DelegacaoCarteiraProfissionalOrm).find({
          where: { tenantId: u.tenantId, profissionalId: profissional.id, revogadaEm: IsNull() },
          select: { id: true, colaboradorUsuarioId: true, concedidaEm: true }, order: { concedidaEm: 'DESC' }, take: LIMITE_DELEGACOES_VIGENTES });
        return linhas.map(l => ({ id: l.id, colaboradorUsuarioId: l.colaboradorUsuarioId, concedidaEm: l.concedidaEm }));
      });
    } catch (erro) { return falharDelegacao(erro); }
  }

  async conceder(usuario: UsuarioAutenticado, colaboradorUsuarioId: string): Promise<DelegacaoCarteiraResposta> {
    const u = this.normalizar(usuario);
    if (!isUUID(colaboradorUsuarioId)) throw new BadRequestException('Solicitação inválida.');
    const colaborador = colaboradorUsuarioId.toLowerCase();
    if (colaborador === u.usuarioId) throw negar();
    try {
      return await this.executor.executar(u.tenantId, async g => {
        await exigirReadCommitted(g);
        const { profissional, usuarios } = await this.titular(g, u, [colaborador]);
        if (usuarios.get(colaborador)?.role !== 'Collaborator') throw negar();
        const repo = g.getRepository(DelegacaoCarteiraProfissionalOrm);
        const existente = await repo.findOne({ where: { tenantId: u.tenantId, profissionalId: profissional.id, colaboradorUsuarioId: colaborador, revogadaEm: IsNull() },
          select: { id: true, colaboradorUsuarioId: true, concedidaEm: true }, lock: { mode: 'pessimistic_read' } });
        if (existente) return { id: existente.id, colaboradorUsuarioId: existente.colaboradorUsuarioId, concedidaEm: existente.concedidaEm };
        // Limite de vigentes por titular (a lista devolve até 100 e nunca corta sem aviso). Serializa por titular.
        await g.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`delegacoes:${u.tenantId}:${profissional.id}`]);
        const vigentes: Array<{ total: number }> = await g.query(`select count(*)::int as total from delegacoes_carteira_profissional
          where tenant_id = $1 and profissional_id = $2 and revogada_em is null`, [u.tenantId, profissional.id]);
        if ((vigentes[0]?.total ?? LIMITE_DELEGACOES_VIGENTES) >= LIMITE_DELEGACOES_VIGENTES) throw new ConflictException('Operação indisponível ou concorrente.');
        const linhas: Array<{ id: string; concedida_em: Date }> = await g.query(`insert into delegacoes_carteira_profissional
          (tenant_id, profissional_id, colaborador_usuario_id, concedida_por) values ($1, $2, $3, $4) returning id, concedida_em`,
          [u.tenantId, profissional.id, colaborador, u.usuarioId]);
        if (linhas.length !== 1) throw new InternalServerErrorException('Operação indisponível.');
        await registrarAuditoriaNaTransacao(g, { tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'carteira.delegacao.conceder',
          recursoTipo: 'delegacao_carteira_profissional', recursoId: linhas[0].id, metadados: {} });
        return { id: linhas[0].id, colaboradorUsuarioId: colaborador, concedidaEm: linhas[0].concedida_em };
      });
    } catch (erro) { return falharDelegacao(erro); }
  }

  async revogar(usuario: UsuarioAutenticado, delegacaoId: string): Promise<{ id: string; revogada: true }> {
    const u = this.normalizar(usuario);
    if (!isUUID(delegacaoId)) throw new BadRequestException('Solicitação inválida.');
    const id = delegacaoId.toLowerCase();
    try {
      return await this.executor.executar(u.tenantId, async g => {
        await exigirReadCommitted(g);
        const { profissional } = await this.titular(g, u);
        const repo = g.getRepository(DelegacaoCarteiraProfissionalOrm);
        const linha = await repo.findOne({ where: { id, tenantId: u.tenantId, profissionalId: profissional.id },
          select: { id: true, revogadaEm: true }, lock: { mode: 'pessimistic_write' } });
        if (!linha) throw negar();
        if (linha.revogadaEm) return { id, revogada: true as const };
        const r = await repo.update({ id, tenantId: u.tenantId, profissionalId: profissional.id, revogadaEm: IsNull() },
          { revogadaPor: u.usuarioId, revogadaEm: () => 'clock_timestamp()' });
        if (r.affected !== 1) throw new ConflictException('Operação indisponível ou concorrente.');
        await registrarAuditoriaNaTransacao(g, { tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'carteira.delegacao.revogar',
          recursoTipo: 'delegacao_carteira_profissional', recursoId: id, metadados: {} });
        return { id, revogada: true as const };
      });
    } catch (erro) { return falharDelegacao(erro); }
  }
}

/**
 * Prova, sob lock e na transação fornecida, que o colaborador tem delegação vigente do responsável ATUAL do paciente.
 * Leitura prévia sem lock só descobre os ids; depois trava usuários (por id) → delegação → profissional → paciente e
 * reconfere tudo. Troca de responsável no meio falha fechado. Deixa o paciente travado para escrita.
 */
export async function autorizarColaboradorDelegado(g: EntityManager, tenantId: string, colaboradorUsuarioId: string,
  pacienteId: string): Promise<void> {
  const previo: Array<{ profissional_id: string; usuario_id: string }> = await g.query(`select p.id as profissional_id, p.usuario_id
    from pacientes pa join profissionais p on p.tenant_id = pa.tenant_id and p.id = pa.profissional_responsavel_id
    where pa.tenant_id = $1 and pa.id = $2`, [tenantId, pacienteId]);
  if (previo.length !== 1) throw negar();
  const { profissional_id: profissionalId, usuario_id: titularUsuarioId } = previo[0];
  if (titularUsuarioId === colaboradorUsuarioId) throw negar();
  const usuarios = await travarUsuariosAtivos(g, tenantId, [colaboradorUsuarioId, titularUsuarioId]);
  if (usuarios.get(colaboradorUsuarioId)?.role !== 'Collaborator' || usuarios.get(titularUsuarioId)?.role !== 'Professional') throw negar();
  const delegacao = await g.getRepository(DelegacaoCarteiraProfissionalOrm).findOne({ where: { tenantId, profissionalId,
    colaboradorUsuarioId, revogadaEm: IsNull() }, select: { id: true }, lock: { mode: 'pessimistic_read' } });
  if (!delegacao) throw negar();
  const profissional = await g.getRepository(ProfissionalOrm).findOne({ where: { id: profissionalId, tenantId, usuarioId: titularUsuarioId,
    arquivadoEm: IsNull() }, select: { id: true }, lock: { mode: 'pessimistic_read' } });
  if (!profissional) throw negar();
  const paciente = await g.getRepository(PacienteOrm).findOne({ where: { id: pacienteId, tenantId, arquivadoEm: IsNull(),
    profissionalResponsavelId: profissionalId }, select: { id: true }, lock: { mode: 'pessimistic_write' } });
  if (!paciente) throw negar();
}
