import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';

/**
 * PB-24 (Fase 275): valida o vinculo opcional "consulta de origem" nas
 * quatro entidades clinicas (evolucao, avaliacao antropometrica, versao de
 * conduta terapeutica, coleta de exame laboratorial).
 *
 * Sem `consultaId`, retorna `undefined` -- o registro fica sem vinculo,
 * como antes desta fase. Com `consultaId`, a consulta precisa existir para
 * o mesmo tenant e o mesmo paciente do registro sendo criado; caso
 * contrario, 404 (nao 403), mesmo padrao ja usado em
 * `ServicoDocumentosClinicos.resolverConsultaDeOrigem` para nao confirmar a
 * quem nao tem escopo que a consulta existe.
 */
export async function resolverConsultaOpcional(
  gerenciador: EntityManager,
  tenantId: string,
  pacienteId: string,
  consultaId: string | undefined
): Promise<string | undefined> {
  if (!consultaId) return undefined;

  const consulta = await gerenciador
    .getRepository(AgendaConsultaOrm)
    .findOne({ where: { id: consultaId, tenantId, pacienteId } });
  if (!consulta) throw new NotFoundException('Consulta nao encontrada para este paciente.');

  return consulta.id;
}
