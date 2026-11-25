import { revalidarAtorQuestionarios } from './acesso-questionarios';
import { resolverProximaExecucao } from '../dominio/proxima-execucao';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
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
  const {papel,sessaoExpiraEm}=await revalidarAtorQuestionarios(m,tenantId,atorId,'questionarios.gerenciar',usuario);
  let profissionalId: string | undefined;
  if (papel === 'Professional') {
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
