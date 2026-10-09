import { proximoResumoNotificacao, validarTimezoneNotificacao } from './calendario-resumo';
import {
  MODO_ENTREGA_PADRAO,
  TIMEZONE_NOTIFICACAO_PADRAO,
  obterModoEntregaNotificacao,
  type ModoEntregaNotificacao
} from './politica-notificacoes';
import type { TipoNotificacao } from './tipo-notificacao';

export interface PreferenciasNotificacaoSnapshot {
  modoFormularioRespondido?: ModoEntregaNotificacao | null;
  modoTarefaConcluida?: ModoEntregaNotificacao | null;
  modoAutomacaoExecutada?: ModoEntregaNotificacao | null;
  timezone?: string | null;
  emailResumo?: boolean | null;
}

export interface SnapshotEntregaNotificacao {
  modoEntrega: ModoEntregaNotificacao;
  timezoneResumo: string | null;
  resumoPrevistoEm: Date | null;
  emailResumo: boolean;
  emailCanceladoEm: null;
}

function preferenciaDoTipo(tipo: TipoNotificacao, preferencias?: PreferenciasNotificacaoSnapshot | null) {
  switch (tipo) {
    case 'formulario_respondido': return preferencias?.modoFormularioRespondido;
    case 'tarefa_concluida': return preferencias?.modoTarefaConcluida;
    case 'automacao_executada': return preferencias?.modoAutomacaoExecutada;
    default: return MODO_ENTREGA_PADRAO;
  }
}

export function criarSnapshotEntregaNotificacao(
  tipo: TipoNotificacao,
  preferencias: PreferenciasNotificacaoSnapshot | null | undefined,
  eventoEm: Date
): SnapshotEntregaNotificacao {
  const modoEntrega = obterModoEntregaNotificacao(tipo, preferenciaDoTipo(tipo, preferencias));
  if (modoEntrega !== 'diario' && modoEntrega !== 'semanal') {
    return {
      modoEntrega,
      timezoneResumo: null,
      resumoPrevistoEm: null,
      emailResumo: false,
      emailCanceladoEm: null
    };
  }

  try {
    const timezoneResumo = validarTimezoneNotificacao(preferencias?.timezone ?? TIMEZONE_NOTIFICACAO_PADRAO);
    return {
      modoEntrega,
      timezoneResumo,
      resumoPrevistoEm: proximoResumoNotificacao(modoEntrega, eventoEm, timezoneResumo),
      emailResumo: preferencias?.emailResumo === true,
      emailCanceladoEm: null
    };
  } catch {
    // Preferencia legada corrupta degrada para aviso imediato, nunca para silencio.
    return {
      modoEntrega: MODO_ENTREGA_PADRAO,
      timezoneResumo: null,
      resumoPrevistoEm: null,
      emailResumo: false,
      emailCanceladoEm: null
    };
  }
}
