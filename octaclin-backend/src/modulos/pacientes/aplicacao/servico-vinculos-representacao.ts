import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { IsNull, type EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { autorizarPendenciaRestricao } from '../../planos-alimentares/aplicacao/autorizacao-pendencia-restricao';
import { travarUsuariosAtivos } from '../../profissionais/aplicacao/servico-delegacoes-carteira';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { TIPOS_VERIFICACAO_REPRESENTACAO, VinculoRepresentacaoPacienteOrm } from '../infraestrutura/vinculo-representacao-paciente.orm';

export type TipoVerificacaoRepresentacao = typeof TIPOS_VERIFICACAO_REPRESENTACAO[number];
export interface VinculoRepresentacaoResposta { id: string; representanteUsuarioId: string; tipoVerificacao: TipoVerificacaoRepresentacao; verificadoEm: Date }

const negar = () => new ForbiddenException('Operação não autorizada.');

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
  const revogados: Array<{ id: string }> = await g.query(`update vinculos_representacao_paciente v
      set revogado_por = $3, revogado_em = clock_timestamp()
    where v.tenant_id = $1 and v.revogado_em is null and ${filtroSql} returning v.id`, [tenantId, parametro, revogador]);
  for (const linha of revogados) {
    await registrarAuditoriaNaTransacao(g, { tenantId, usuarioId: revogador, acao, recursoTipo: 'vinculo_representacao_paciente',
      recursoId: linha.id, metadados: {} });
  }
}

/** Cascata (padrão Auth-2): a conta representante desativada perde todas as representações. */
export async function revogarVinculosPorAlteracaoAcesso(g: EntityManager, tenantId: string, usuarioId: string, revogadorUsuarioId: string): Promise<void> {
  await revogarEmLote(g, tenantId, 'v.representante_usuario_id = $2', usuarioId, revogadorUsuarioId, 'representacao.vinculo.revogar_por_alteracao_acesso');
}

/** Arquivar o paciente encerra as representações; restaurar não as revive. */
export async function revogarVinculosDoPaciente(g: EntityManager, tenantId: string, pacienteId: string, revogadorUsuarioId: string): Promise<void> {
  await revogarEmLote(g, tenantId, 'v.paciente_id = $2', pacienteId, revogadorUsuarioId, 'representacao.vinculo.revogar_por_arquivamento');
}

/**
 * FOOD06 P2d-3a: a equipe (Professional responsável ou Collaborator com a carteira delegada) registra, lista e revoga quem
 * representa o paciente no portal. Uma conta pode representar vários pacientes. A verificação fica só registrada (tipo,
 * quem, quando), sem documento. O representante é conta `Patient` ativa do tenant, diferente de quem verifica e da conta
 * do próprio paciente (que acessa sem vínculo). Ordem de locks: usuários → delegação → profissional → paciente → vínculo.
 */
@Injectable()
export class ServicoVinculosRepresentacao {
  constructor(private readonly executor: ExecutorTenant) {}

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
        await autorizarPendenciaRestricao(g, u, paciente);
        const linhas = await g.getRepository(VinculoRepresentacaoPacienteOrm).find({
          where: { tenantId: u.tenantId, pacienteId: paciente, revogadoEm: IsNull() },
          select: { id: true, representanteUsuarioId: true, tipoVerificacao: true, verificadoEm: true }, order: { verificadoEm: 'DESC' }, take: 100 });
        return linhas.map(l => ({ id: l.id, representanteUsuarioId: l.representanteUsuarioId,
          tipoVerificacao: l.tipoVerificacao as TipoVerificacaoRepresentacao, verificadoEm: l.verificadoEm }));
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
        const linhaPaciente = await g.getRepository(PacienteOrm).findOne({ where: { id: paciente, tenantId: u.tenantId }, select: { id: true, usuarioId: true },
          lock: { mode: 'pessimistic_write' } });
        if (!linhaPaciente || linhaPaciente.usuarioId === representante) throw negar();
        const repo = g.getRepository(VinculoRepresentacaoPacienteOrm);
        const existente = await repo.findOne({ where: { tenantId: u.tenantId, pacienteId: paciente, representanteUsuarioId: representante, revogadoEm: IsNull() },
          select: { id: true, representanteUsuarioId: true, tipoVerificacao: true, verificadoEm: true }, lock: { mode: 'pessimistic_read' } });
        // Repetição com outro tipo de verificação não reescreve o registro: conflito explícito.
        if (existente && existente.tipoVerificacao !== tipoVerificacao) throw new ConflictException('Operação indisponível ou concorrente.');
        if (existente) return { id: existente.id, representanteUsuarioId: existente.representanteUsuarioId,
          tipoVerificacao: existente.tipoVerificacao as TipoVerificacaoRepresentacao, verificadoEm: existente.verificadoEm };
        const linhas: Array<{ id: string; verificado_em: Date }> = await g.query(`insert into vinculos_representacao_paciente
          (tenant_id, paciente_id, representante_usuario_id, verificado_por, tipo_verificacao) values ($1, $2, $3, $4, $5) returning id, verificado_em`,
          [u.tenantId, paciente, representante, u.usuarioId, tipoVerificacao]);
        if (linhas.length !== 1) throw new InternalServerErrorException('Operação indisponível.');
        await registrarAuditoriaNaTransacao(g, { tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'representacao.vinculo.registrar',
          recursoTipo: 'vinculo_representacao_paciente', recursoId: linhas[0].id, metadados: {} });
        return { id: linhas[0].id, representanteUsuarioId: representante, tipoVerificacao: tipoVerificacao as TipoVerificacaoRepresentacao, verificadoEm: linhas[0].verificado_em };
      });
    } catch (erro) { return falharVinculo(erro); }
  }

  async revogar(usuario: UsuarioAutenticado, pacienteId: string, vinculoId: string): Promise<{ id: string; revogado: true }> {
    const { u, ids: [paciente, id] } = this.normalizar(usuario, pacienteId, vinculoId);
    try {
      return await this.executor.executar(u.tenantId, async g => {
        await exigirReadCommitted(g);
        await autorizarPendenciaRestricao(g, u, paciente);
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
