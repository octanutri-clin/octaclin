export const CHAVE_KIT_INICIAL_CLINICA = 'kit_inicial_clinica';
export const VERSAO_KIT_INICIAL_CLINICA = 2;

export const CHAVES_KIT_INICIAL_CLINICA = [
  'material:plano-no-portal',
  'material:registro-habitos',
  'material:duvidas-consulta',
  'estrutura:tres-refeicoes',
  'estrutura:cinco-refeicoes'
] as const;

export type ChaveKitInicialClinica = (typeof CHAVES_KIT_INICIAL_CLINICA)[number];
export type EstadoKitInicialClinica =
  | 'nao_instalado'
  | 'parcial'
  | 'completo'
  | 'incompativel'
  | 'inconsistente';

export interface InterpretacaoMarcadorKitInicial {
  estado: EstadoKitInicialClinica;
  versao?: number;
  itensInstalados: ChaveKitInicialClinica[];
}

const CHAVES_ORDENADAS = new Set<string>(CHAVES_KIT_INICIAL_CLINICA);
const ORIGENS_VALIDAS = new Set(['opt_in_cliente', 'opt_in_superadmin', 'provisionamento_assistido']);

function dataIsoValida(valor: unknown): boolean {
  if (typeof valor !== 'string') return false;
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(valor);
  if (!partes) return false;
  const [ano, mes, dia, hora, minuto, segundo, , fusoHora, fusoMinuto] = partes.slice(1).map((parte) => parte === undefined ? undefined : Number(parte));
  const data = new Date(0);
  data.setUTCFullYear(ano!, mes! - 1, dia!);
  data.setUTCHours(0, 0, 0, 0);
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes! - 1 && data.getUTCDate() === dia &&
    hora! <= 23 && minuto! <= 59 && segundo! <= 59 &&
    (fusoHora === undefined || (fusoHora <= 14 && fusoMinuto! <= 59 && (fusoHora < 14 || fusoMinuto === 0))) &&
    Number.isFinite(Date.parse(valor));
}

/** Interpreta marcadores persistidos sem tratar formatos desconhecidos como ausência. */
export function interpretarMarcadorKitInicial(valor: unknown): InterpretacaoMarcadorKitInicial {
  if (valor === undefined) return { estado: 'nao_instalado', versao: undefined, itensInstalados: [] };
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    return { estado: 'inconsistente', itensInstalados: [] };
  }

  const marcador = valor as Record<string, unknown>;
  if (!Number.isInteger(marcador.versao) || typeof marcador.versao !== 'number') {
    return { estado: 'inconsistente', itensInstalados: [] };
  }
  if (marcador.versao !== 1 && marcador.versao !== VERSAO_KIT_INICIAL_CLINICA) {
    return { estado: 'incompativel', versao: marcador.versao, itensInstalados: [] };
  }
  if (marcador.versao === 1) {
    return {
      estado: 'completo',
      versao: 1,
      itensInstalados: [...CHAVES_KIT_INICIAL_CLINICA]
    };
  }

  if (!Array.isArray(marcador.itens) || marcador.itens.length < 1 || marcador.itens.length > CHAVES_KIT_INICIAL_CLINICA.length) {
    return { estado: 'inconsistente', versao: VERSAO_KIT_INICIAL_CLINICA, itensInstalados: [] };
  }
  if ((marcador.instaladoEm !== undefined && !dataIsoValida(marcador.instaladoEm)) ||
      (marcador.atualizadoEm !== undefined && !dataIsoValida(marcador.atualizadoEm)) ||
      (marcador.origem !== undefined && (typeof marcador.origem !== 'string' || !ORIGENS_VALIDAS.has(marcador.origem)))) {
    return { estado: 'inconsistente', versao: VERSAO_KIT_INICIAL_CLINICA, itensInstalados: [] };
  }
  const itens = marcador.itens;
  if (itens.some((item) => typeof item !== 'string' || !CHAVES_ORDENADAS.has(item)) || new Set(itens).size !== itens.length) {
    return { estado: 'inconsistente', versao: VERSAO_KIT_INICIAL_CLINICA, itensInstalados: [] };
  }
  const selecionados = new Set(itens as ChaveKitInicialClinica[]);
  const itensInstalados = CHAVES_KIT_INICIAL_CLINICA.filter((chave) => selecionados.has(chave));
  return {
    estado: itensInstalados.length === CHAVES_KIT_INICIAL_CLINICA.length ? 'completo' : 'parcial',
    versao: VERSAO_KIT_INICIAL_CLINICA,
    itensInstalados: [...itensInstalados]
  };
}
