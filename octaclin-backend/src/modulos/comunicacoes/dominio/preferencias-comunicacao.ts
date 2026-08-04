import { TipoCanalNotificacao } from './canal-notificacao';

export type TipoCanalDireto = Extract<TipoCanalNotificacao, 'email' | 'whatsapp'>;
export type CanalPreferidoPaciente = TipoCanalDireto | 'qualquer';

export interface HorarioPermitidoComunicacao {
  inicio: string;
  fim: string;
  timezone: string;
}

export interface PreferenciasComunicacaoPaciente {
  email: boolean;
  whatsapp: boolean;
  canalPreferido: CanalPreferidoPaciente;
  horarioPermitido: HorarioPermitidoComunicacao;
  contatos: {
    email?: string;
    whatsapp?: string;
  };
}

export const PREFERENCIAS_COMUNICACAO_PADRAO: PreferenciasComunicacaoPaciente = {
  email: true,
  whatsapp: true,
  canalPreferido: 'qualquer',
  horarioPermitido: {
    inicio: '08:00',
    fim: '20:00',
    timezone: 'America/Sao_Paulo'
  },
  contatos: {}
};

export function preferenciasComunicacaoPadrao(): PreferenciasComunicacaoPaciente {
  return {
    ...PREFERENCIAS_COMUNICACAO_PADRAO,
    horarioPermitido: { ...PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido },
    contatos: {}
  };
}

/**
 * Interpreta o contato ja descriptografado do paciente. Formato atual e JSON; cadastros
 * antigos guardavam apenas um email ou telefone em texto puro, entao o fallback trata
 * a string solta como contato unico em vez de descartar o paciente.
 */
export function interpretarPreferenciasComunicacao(contato: string | null | undefined): PreferenciasComunicacaoPaciente {
  if (!contato) return preferenciasComunicacaoPadrao();

  try {
    const parseado = JSON.parse(contato) as {
      email?: unknown;
      whatsapp?: unknown;
      preferencias?: {
        email?: unknown;
        whatsapp?: unknown;
        canalPreferido?: unknown;
        horarioPermitido?: unknown;
      };
    };
    return {
      email: typeof parseado.preferencias?.email === 'boolean' ? parseado.preferencias.email : true,
      whatsapp: typeof parseado.preferencias?.whatsapp === 'boolean' ? parseado.preferencias.whatsapp : true,
      canalPreferido: normalizarCanalPreferido(parseado.preferencias?.canalPreferido),
      horarioPermitido: normalizarHorarioPermitido(parseado.preferencias?.horarioPermitido),
      contatos: {
        email: typeof parseado.email === 'string' ? normalizarEmail(parseado.email) : undefined,
        whatsapp: typeof parseado.whatsapp === 'string' ? normalizarWhatsapp(parseado.whatsapp) : undefined
      }
    };
  } catch {
    return contato.includes('@')
      ? { ...preferenciasComunicacaoPadrao(), contatos: { email: normalizarEmail(contato) } }
      : { ...preferenciasComunicacaoPadrao(), contatos: { whatsapp: normalizarWhatsapp(contato) } };
  }
}

/** Canal autorizado pelo paciente, independente de haver destino cadastrado. */
export function canalAutorizado(preferencias: PreferenciasComunicacaoPaciente, tipo: TipoCanalDireto): boolean {
  if (!preferencias[tipo]) return false;
  return preferencias.canalPreferido === 'qualquer' || preferencias.canalPreferido === tipo;
}

/** Canal utilizavel = autorizado pelo paciente e com destino cadastrado. */
export function canalPermitido(preferencias: PreferenciasComunicacaoPaciente, tipo: TipoCanalDireto): boolean {
  return canalAutorizado(preferencias, tipo) && Boolean(preferencias.contatos[tipo]);
}

/**
 * Opt-in: o paciente autorizou algum canal. Nao considera destino de proposito — "ele
 * pediu para nao receber" e "nao temos o contato dele" sao problemas diferentes e
 * precisam aparecer separados para quem opera a automacao.
 */
export function aceitaAlgumCanal(preferencias: PreferenciasComunicacaoPaciente): boolean {
  return canalAutorizado(preferencias, 'email') || canalAutorizado(preferencias, 'whatsapp');
}

export function normalizarCanalPreferido(valor: unknown): CanalPreferidoPaciente {
  return valor === 'email' || valor === 'whatsapp' || valor === 'qualquer' ? valor : 'qualquer';
}

export function normalizarHorarioPermitido(valor: unknown): HorarioPermitidoComunicacao {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    return { ...PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido };
  }
  const horario = valor as Record<string, unknown>;
  return {
    inicio:
      typeof horario.inicio === 'string' && horarioValido(horario.inicio)
        ? horario.inicio
        : PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido.inicio,
    fim:
      typeof horario.fim === 'string' && horarioValido(horario.fim)
        ? horario.fim
        : PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido.fim,
    timezone:
      typeof horario.timezone === 'string' && horario.timezone.trim()
        ? horario.timezone.trim().slice(0, 80)
        : PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido.timezone
  };
}

export function dentroHorarioPermitido(agora: Date, horario: HorarioPermitidoComunicacao): boolean {
  const atual = minutosDoDia(formatarHoraPreferencia(agora, horario.timezone));
  const inicio = minutosDoDia(horario.inicio);
  const fim = minutosDoDia(horario.fim);
  if (inicio <= fim) return atual >= inicio && atual <= fim;
  return atual >= inicio || atual <= fim;
}

export function normalizarEmail(email?: string): string | undefined {
  const normalizado = email?.trim().toLowerCase();
  return normalizado || undefined;
}

export function normalizarWhatsapp(whatsapp?: string): string | undefined {
  const normalizado = whatsapp?.replace(/\D/g, '');
  return normalizado || undefined;
}

function formatarHoraPreferencia(data: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(data);
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: PREFERENCIAS_COMUNICACAO_PADRAO.horarioPermitido.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(data);
  }
}

function minutosDoDia(horario: string): number {
  const [horas, minutos] = horario.split(':').map((parte) => Number(parte));
  return horas * 60 + minutos;
}

function horarioValido(valor: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}
