export type ModalidadeConsulta = 'presencial' | 'online';

export const MODALIDADES_CONSULTA: ModalidadeConsulta[] = ['presencial', 'online'];
export const MODALIDADE_CONSULTA_PADRAO: ModalidadeConsulta = 'presencial';

/** Sala aberta 1h antes: paciente que chega cedo nao fica sem link. */
export const MINUTOS_ANTES_ABERTURA_SALA = 60;
/** Link some 30 min depois do fim: consulta que estende um pouco nao derruba o paciente. */
export const MINUTOS_DEPOIS_FECHAMENTO_SALA = 30;

const PROTOCOLOS_PERMITIDOS = new Set(['https:']);
const TAMANHO_MAXIMO_LINK = 500;

export function normalizarModalidadeConsulta(valor: unknown): ModalidadeConsulta {
  return valor === 'online' ? 'online' : MODALIDADE_CONSULTA_PADRAO;
}

/**
 * Aceita apenas https. Link de sala e clicado por paciente leigo: http abre espaco
 * para downgrade, e javascript:/data: viram execucao de script no portal.
 */
export function linkTeleconsultaValido(valor: string): boolean {
  const texto = valor.trim();
  if (!texto || texto.length > TAMANHO_MAXIMO_LINK) return false;
  try {
    return PROTOCOLOS_PERMITIDOS.has(new URL(texto).protocol);
  } catch {
    return false;
  }
}

export function normalizarLinkTeleconsulta(valor?: string | null): string | undefined {
  const texto = valor?.trim();
  if (!texto) return undefined;
  return linkTeleconsultaValido(texto) ? texto : undefined;
}

export interface ConsultaComTeleconsulta {
  modalidade?: string | null;
  linkTeleconsulta?: string | null;
  inicioEm: Date;
  fimEm: Date;
  status: string;
}

/**
 * Janela de exibicao do link para o paciente. Fora dela o link nem sai do backend:
 * e endereco de sessao clinica, nao dado de agenda.
 */
export function linkTeleconsultaDisponivel(consulta: ConsultaComTeleconsulta, agora = new Date()): boolean {
  if (normalizarModalidadeConsulta(consulta.modalidade) !== 'online') return false;
  if (!normalizarLinkTeleconsulta(consulta.linkTeleconsulta)) return false;
  if (consulta.status !== 'agendada' && consulta.status !== 'reagendada') return false;

  const abertura = consulta.inicioEm.getTime() - MINUTOS_ANTES_ABERTURA_SALA * 60_000;
  const fechamento = consulta.fimEm.getTime() + MINUTOS_DEPOIS_FECHAMENTO_SALA * 60_000;
  const instante = agora.getTime();
  return instante >= abertura && instante <= fechamento;
}

/** Link visivel para o paciente, ou undefined fora da janela. */
export function linkTeleconsultaParaPaciente(
  consulta: ConsultaComTeleconsulta,
  agora = new Date()
): string | undefined {
  return linkTeleconsultaDisponivel(consulta, agora) ? normalizarLinkTeleconsulta(consulta.linkTeleconsulta) : undefined;
}
