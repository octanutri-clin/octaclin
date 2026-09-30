import { EntityManager, In, MoreThanOrEqual } from 'typeorm';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';

export const EVENTO_RETORNO = 'paciente.recall.inatividade';
export const INTERVALO_CONTATO_RETORNO_DIAS = 30;

export async function impedimentoRetorno(
  gerenciador: EntityManager,
  tenantId: string,
  pacienteId: string,
  agora = new Date()
): Promise<'consulta_futura' | 'contato_recente' | undefined> {
  const consulta = await gerenciador.getRepository(AgendaConsultaOrm).findOne({
    select: { id: true },
    where: { tenantId, pacienteId, status: In(['agendada', 'reagendada']), inicioEm: MoreThanOrEqual(agora) }
  });
  if (consulta) return 'consulta_futura';
  const recente = await gerenciador.getRepository(MensagemNotificacaoOrm).createQueryBuilder('mensagem')
    .select('mensagem.id')
    .where('mensagem.tenant_id = :tenantId AND mensagem.paciente_id = :pacienteId', { tenantId, pacienteId })
    .andWhere("mensagem.payload->>'evento' = :evento", { evento: EVENTO_RETORNO })
    .andWhere(`(mensagem.status IN ('pendente', 'processando') OR
      (mensagem.status IN ('enviado', 'recebido') AND COALESCE(mensagem.enviado_em, mensagem.criado_em) >= :desde) OR
      (mensagem.status = 'falhou' AND mensagem.tentativa_externa_em >= :desde))`,
      { desde: new Date(agora.getTime() - INTERVALO_CONTATO_RETORNO_DIAS * 86_400_000) })
    .getOne();
  return recente ? 'contato_recente' : undefined;
}
