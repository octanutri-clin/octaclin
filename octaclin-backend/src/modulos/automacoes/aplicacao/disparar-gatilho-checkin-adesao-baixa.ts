import { EntityManager, JsonContains } from 'typeorm';
import {
  GATILHO_CHECKIN_ADESAO_BAIXA,
  checkinTemAdesaoBaixa,
  normalizarConfiguracaoCheckinAdesaoBaixa
} from '../dominio/checkin-adesao-baixa';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';
import { DisparoGatilhoAutomacao, dispararParaRegra } from './disparar-gatilho-automacao';

export interface EventoCheckinAdesaoBaixa {
  pacienteId: string;
  /** Responsavel pelo paciente no momento do check-in -- ja resolvido pelo chamador. */
  profissionalId: string;
  /** Adesao declarada NESTE check-in (0-100). Nunca copiada para o contexto duravel. */
  adesaoPlano: number;
  /** Identidade do registro de check-in, usada como origem da idempotencia. */
  checkinId: string;
}

/**
 * Dispara `checkin.adesao_baixa` para cada regra ativa do profissional cujo
 * limiar a adesao declarada NESTE check-in nao alcanca. Elegibilidade
 * depende do `limiarAdesao` proprio de cada regra, entao usa `dispararParaRegra`
 * diretamente (mesmo motivo de `checkin.atrasado`, ver `disparar-gatilho-automacao.ts`)
 * em vez do casamento generico de `dispararGatilhoAutomacao`.
 *
 * `origemId` e o proprio check-in: cada check-in e um fato distinto (no
 * maximo um por chamada de `registrarCheckinRapido`), entao repetir a mesma
 * origem so pode acontecer em retry da mesma requisicao -- o `orIgnore` de
 * `dispararParaRegra` cobre isso sem precisar de um intervalo minimo
 * adicional como o de `checkin.atrasado`.
 */
export async function dispararGatilhoCheckinAdesaoBaixa(
  gerenciador: EntityManager,
  tenantId: string,
  evento: EventoCheckinAdesaoBaixa
): Promise<DisparoGatilhoAutomacao[]> {
  if (!evento.profissionalId) return [];

  const regras = await gerenciador.getRepository(RegraAutomacaoOrm).find({
    where: {
      tenantId,
      ativa: true,
      profissionalId: evento.profissionalId,
      gatilho: JsonContains({ tipo: GATILHO_CHECKIN_ADESAO_BAIXA })
    }
  });
  if (!regras.length) return [];

  const disparos: DisparoGatilhoAutomacao[] = [];
  for (const regra of regras) {
    const configuracao = normalizarConfiguracaoCheckinAdesaoBaixa(regra.gatilho);
    if (!checkinTemAdesaoBaixa(evento.adesaoPlano, configuracao)) continue;

    disparos.push(
      await dispararParaRegra(gerenciador, tenantId, regra, {
        tipo: GATILHO_CHECKIN_ADESAO_BAIXA,
        pacienteId: evento.pacienteId,
        origemTipo: 'checkin_rapido',
        origemId: evento.checkinId,
        contexto: { evento: GATILHO_CHECKIN_ADESAO_BAIXA }
      })
    );
  }
  return disparos;
}
