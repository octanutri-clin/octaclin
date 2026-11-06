import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { IsNull } from 'typeorm';
import { dataIsoNoTimezoneClinico, obterTimezoneClinicoDoTenant } from '../../../infraestrutura/tempo/timezone-clinico';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import type { EntradaContextoDietetico } from '../dominio/contexto-dietetico';
export type ConfirmacoesContextoRegistro = Omit<EntradaContextoDietetico, 'nascimento' | 'dataAnalise'>;
const CAMPOS = ['populacaoReferencia','populacaoConfirmada','gestacao','lactacao','aplicabilidade','mesmoDiaPlanejado','tabagismo'] as const;
/** Só confirmações explícitas; nunca aceitar nascimento, idade, data ou elegibilidade do navegador. */
export function validarConfirmacoesContexto(entrada: unknown): ConfirmacoesContextoRegistro {
  const falhar = (): never => { throw new BadRequestException('Confirmações inválidas.'); };
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(entrada))) return falhar();
  const descritores = Object.getOwnPropertyDescriptors(entrada);
  if (Reflect.ownKeys(entrada).length !== CAMPOS.length ||
      Reflect.ownKeys(entrada).some(c => typeof c !== 'string' || !CAMPOS.includes(c as typeof CAMPOS[number])) ||
      CAMPOS.some(c => !descritores[c]?.enumerable || !Object.hasOwn(descritores[c], 'value'))) return falhar();
  const e = entrada as Record<typeof CAMPOS[number],unknown>;
  if (!['masculina','feminina','nao_informada'].includes(e.populacaoReferencia as string) ||
      typeof e.populacaoConfirmada !== 'boolean' || typeof e.mesmoDiaPlanejado !== 'boolean' ||
      !['sim','nao','nao_informada'].includes(e.gestacao as string) ||
      !['sim','nao','nao_informada'].includes(e.lactacao as string) ||
      !['confirmada','nao_aplicavel','nao_informada'].includes(e.aplicabilidade as string) ||
      !['sim','nao','nao_informado'].includes(e.tabagismo as string)) return falhar();
  return Object.fromEntries(CAMPOS.map(c => [c,e[c]])) as unknown as ConfirmacoesContextoRegistro;
}
/** Infraestrutura interna. Chamador deve autorizar e bloquear a carteira na MESMA transação.
 * Não é endpoint, DTO, capability ou alternativa à autorização do serviço.
 */
export async function carregarContextoConfirmado(g: EntityManager, tenantId: string, pacienteId: string,
  confirmacoes: ConfirmacoesContextoRegistro): Promise<EntradaContextoDietetico> {
  const confirmadas = validarConfirmacoesContexto(confirmacoes);
  const paciente = await g.getRepository(PacienteOrm).findOne({select:{dataNascimento:true},
    where:{id:pacienteId,tenantId,arquivadoEm:IsNull()},lock:{mode:'pessimistic_read'}});
  if (!paciente) throw new NotFoundException('Paciente indisponível.');
  const timezone = await obterTimezoneClinicoDoTenant(g,tenantId);
  return {...confirmadas,dataAnalise:dataIsoNoTimezoneClinico(timezone),
    ...(paciente.dataNascimento == null ? {} : {nascimento:paciente.dataNascimento})};
}
