export type OrigemFiltroSalvo = 'pessoal' | 'clinica';

export interface CriteriosFiltroSalvo {
  risco?: 'alto' | 'medio' | 'baixo';
  status?: string;
  profissionalId?: string;
  semProximaConsulta?: boolean;
}

/** Teto por profissional e, separadamente, de filtros de clinica por tenant. */
export const TETO_FILTROS_SALVOS = 20;

const RISCOS = ['alto', 'medio', 'baixo'];
const STATUS = ['novo', 'aderente', 'em_acompanhamento', 'risco', 'inativo'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Allowlist estrita. Chave desconhecida e erro e nao omissao silenciosa: o
 * texto da busca livre aceita nome e CPF, e ignorar em silencio deixaria o
 * chamador achar que salvou algo que nao salvou.
 */
export function validarCriteriosFiltroSalvo(entrada: unknown): CriteriosFiltroSalvo {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw new Error('Criterios de filtro salvo invalidos.');
  }

  const criterios: CriteriosFiltroSalvo = {};
  for (const [chave, valor] of Object.entries(entrada as Record<string, unknown>)) {
    if (valor === undefined || valor === null) continue;
    switch (chave) {
      case 'risco':
        if (typeof valor !== 'string' || !RISCOS.includes(valor)) throw invalido(chave);
        criterios.risco = valor as CriteriosFiltroSalvo['risco'];
        break;
      case 'status':
        if (typeof valor !== 'string' || !STATUS.includes(valor)) throw invalido(chave);
        criterios.status = valor;
        break;
      case 'profissionalId':
        if (typeof valor !== 'string' || !UUID.test(valor)) throw invalido(chave);
        criterios.profissionalId = valor;
        break;
      case 'semProximaConsulta':
        if (typeof valor !== 'boolean') throw invalido(chave);
        criterios.semProximaConsulta = valor;
        break;
      default:
        throw new Error(`Criterio nao suportado em filtro salvo: ${chave}.`);
    }
  }
  return criterios;
}

function invalido(chave: string) {
  return new Error(`Criterio invalido em filtro salvo: ${chave}.`);
}
