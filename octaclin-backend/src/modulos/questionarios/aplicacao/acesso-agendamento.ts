import { resolverProximaExecucao } from '../dominio/proxima-execucao';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { possuiPermissao } from '../../auth/dominio/permissoes';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { SessaoUsuarioOrm } from '../../auth/infraestrutura/sessao-usuario.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { QuestionarioOrm } from '../infraestrutura/questionario.orm';
import { AgendamentoQuestionarioOrm } from '../infraestrutura/agendamento-questionario.orm';
import { estadoAgendamento } from '../dominio/estado-agendamento';

/** Ordem compartilhada: questionário → identidade → sessão (HTTP) → profissional → paciente → agenda.
 * Cada transação processa uma agenda; não acumular locks entre candidatos do worker.
 * Identificadores candidatos não concedem acesso. Conteúdo só é lido depois desta validação.
 */
export async function autorizarContextoAgendamento(
  m: EntityManager, tenantId: string, questionarioId: string, pacienteId: string,
  atorId: string, usuario?: UsuarioAutenticado,
): Promise<void> {
  const q = await m.getRepository(QuestionarioOrm).findOne({where:{id:questionarioId,tenantId},select:{id:true,profissionalId:true},lock:{mode:'pessimistic_read'}});
  if (!q) throw new NotFoundException('Agendamento não disponível.');
  const identidade = await m.getRepository(UsuarioOrm).findOne({where:{id:atorId,tenantId,ativo:true},select:{id:true,role:true},lock:{mode:'pessimistic_read'}});
  if (!identidade || (usuario && (usuario.tenantId !== tenantId || identidade.role !== usuario.papel))) {
    throw new UnauthorizedException('Acesso alterado. Confira sua autorização.');
  }
  if (!['SuperAdmin','Professional','Collaborator','Patient','Client'].includes(identidade.role)
    || !possuiPermissao(identidade.role,'questionarios.gerenciar')) throw new ForbiddenException('Sem permissão para gerenciar agendamentos.');
  // A única concessão dinâmica vigente é restricoes.confirmar; não amplia esta permissão.
  let sessaoExpiraEm: Date | undefined;
  if (usuario) {
    if (!usuario.sessaoId) throw new UnauthorizedException('Sessão não disponível.');
    const sessao = await m.getRepository(SessaoUsuarioOrm).findOne({where:{id:usuario.sessaoId,tenantId,usuarioId:atorId,revogadoEm:IsNull()},select:{id:true,expiraEm:true},lock:{mode:'pessimistic_read'}});
    if (!sessao || sessao.expiraEm.getTime() <= Date.now()) throw new UnauthorizedException('Sessão encerrada.');
    sessaoExpiraEm=sessao.expiraEm;
  }
  let profissionalId: string | undefined;
  if (identidade.role === 'Professional') {
    const p = await m.getRepository(ProfissionalOrm).findOne({where:{tenantId,usuarioId:atorId,arquivadoEm:IsNull()},select:{id:true},lock:{mode:'pessimistic_read'}});
    if (!p || p.id !== q.profissionalId) throw new NotFoundException('Agendamento não disponível.');
    profissionalId = p.id;
  }
  const paciente = await m.getRepository(PacienteOrm).findOne({
    where:{id:pacienteId,tenantId,arquivadoEm:IsNull(),...(profissionalId ? {profissionalResponsavelId:profissionalId} : {})},
    select:{id:true,statusCicloVida:true},lock:{mode:'pessimistic_read'},
  });
  if (!paciente || ['DELETED','DELETION_PENDING'].includes(paciente.statusCicloVida ?? '')) throw new NotFoundException('Agendamento não disponível.');
  if (sessaoExpiraEm && sessaoExpiraEm.getTime() <= Date.now()) throw new UnauthorizedException('Sessão encerrada.');
}

/** Allowlist: sem identidade interna do autorizador, sessão, paciente cifrado ou tokens. */
export function projetarAgendamento(a: AgendamentoQuestionarioOrm) {
  const estado=estadoAgendamento(a);
  let proximaOcorrenciaFutura: Date | null=null;
  if(estado==='ativo'||estado==='pausado'){
    try{
      const agora=new Date();const d=resolverProximaExecucao(a.regraCron??undefined,a.dataFixa?.toISOString(),a.timezone,agora);
      if(Number.isFinite(d.getTime())&&d>agora)proximaOcorrenciaFutura=d;
    }catch{ /* Agenda legada inválida não recebe data presumida. */ }
  }
  return {id:a.id,questionarioId:a.questionarioId,pacienteId:a.pacienteId,regraCron:a.regraCron??null,
    dataFixa:a.dataFixa??null,timezone:a.timezone,ativo:a.ativo,estado,proximaOcorrenciaFutura,
    revisao:a.revisao,pausadoEm:a.pausadoEm??null,ultimaExecucaoEm:a.ultimaExecucaoEm??null,
    proximaExecucaoEm:a.proximaExecucaoEm??null,reconfirmacaoNecessaria:!a.autorizadoPorUsuarioId};
}
