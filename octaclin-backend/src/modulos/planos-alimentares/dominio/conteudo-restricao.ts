import type { AlvoTipo, GravidadeRestricao, NaturezaRestricao, SubtipoClinico } from './restricoes-alimentares';

/**
 * FOOD06 D2 (#531): validação ÚNICA do objeto clínico de uma restrição, antes de cifrar e persistir
 * (`restricoes_pacientes.conteudo_criptografado` e o snapshot de `restricoes_pacientes_revisoes`). Domínio puro.
 * O banco não enxerga estes campos (estão cifrados); estes invariantes são garantidos SÓ pela aplicação.
 * Não há campo `razao` (Q4). Texto livre nunca altera alvo, gravidade nem resultado do motor.
 */
export const ESQUEMA_CONTEUDO_RESTRICAO = 1 as const;

export interface ConteudoRestricaoV1 {
  readonly schemaVersao: typeof ESQUEMA_CONTEUDO_RESTRICAO;
  readonly natureza: NaturezaRestricao;
  readonly subtipoClinico?: SubtipoClinico;
  readonly alvo: Readonly<{ tipo: AlvoTipo; id?: string }>;
  readonly alvoDeclarado?: string;
  readonly gravidade?: GravidadeRestricao;
  readonly observacao?: string;
}

export class ConteudoRestricaoInvalidoError extends Error {
  constructor() { super('Conteúdo de restrição inválido.'); this.name = 'ConteudoRestricaoInvalidoError'; }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
const TEXTO_CURTO = /^[^\p{C}]{1,200}$/u;
const TEXTO_LONGO = /^[^\p{C}]{0,1000}$/u;
const NATUREZAS: readonly string[] = ['clinica', 'escolha', 'preferencia'];
const SUBTIPOS: readonly string[] = ['alergia_alimentar', 'intolerancia_alimentar', 'doenca_ou_condicao_com_restricao', 'outra_restricao_clinica'];
const ALVO_TIPOS: readonly string[] = ['alergeno', 'constituinte', 'grupo', 'alimento', 'categoria_escolha', 'nao_catalogado'];
const GRAVIDADES: readonly string[] = ['leve', 'moderada', 'grave', 'nao_informada'];

function invalido(): never { throw new ConteudoRestricaoInvalidoError(); }
function simples(v: unknown, permitidas: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) ||
    Reflect.ownKeys(v).some(k => typeof k !== 'string' || !permitidas.includes(k))) return invalido();
  return v as Record<string, unknown>;
}
function opcional(v: unknown, validas: readonly string[]): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === 'string' && validas.includes(v) ? v : invalido();
}

export function validarConteudoRestricao(entrada: unknown): ConteudoRestricaoV1 {
  const o = simples(entrada, ['schemaVersao', 'natureza', 'subtipoClinico', 'alvo', 'alvoDeclarado', 'gravidade', 'observacao']);
  if (o.schemaVersao !== ESQUEMA_CONTEUDO_RESTRICAO) return invalido();
  const natureza = opcional(o.natureza, NATUREZAS) as NaturezaRestricao | undefined;
  if (!natureza) return invalido();
  const subtipoClinico = opcional(o.subtipoClinico, SUBTIPOS) as SubtipoClinico | undefined;
  const gravidade = opcional(o.gravidade, GRAVIDADES) as GravidadeRestricao | undefined;
  const a = simples(o.alvo, ['tipo', 'id']);
  const tipo = opcional(a.tipo, ALVO_TIPOS) as AlvoTipo | undefined;
  if (!tipo) return invalido();

  // Combinações: subtipo ⇔ clínica; gravidade só em clínica; categoria de escolha só em escolha;
  // não catalogado ⇔ sem id e com texto declarado; texto declarado só em não catalogado.
  if ((natureza === 'clinica') !== (subtipoClinico !== undefined)) return invalido();
  if (natureza !== 'clinica' && gravidade !== undefined) return invalido();
  if (tipo === 'categoria_escolha' && natureza !== 'escolha') return invalido();
  const naoCatalogado = tipo === 'nao_catalogado';
  if (naoCatalogado !== (a.id === undefined)) return invalido();
  if (!naoCatalogado && (typeof a.id !== 'string' || !ID.test(a.id))) return invalido();
  if (naoCatalogado !== (o.alvoDeclarado !== undefined)) return invalido();
  if (o.alvoDeclarado !== undefined && (typeof o.alvoDeclarado !== 'string' || !TEXTO_CURTO.test(o.alvoDeclarado))) return invalido();
  if (o.observacao !== undefined && (typeof o.observacao !== 'string' || !TEXTO_LONGO.test(o.observacao))) return invalido();

  return Object.freeze({
    schemaVersao: ESQUEMA_CONTEUDO_RESTRICAO, natureza, ...(subtipoClinico ? { subtipoClinico } : {}),
    alvo: Object.freeze(naoCatalogado ? { tipo } : { tipo, id: a.id as string }),
    ...(o.alvoDeclarado !== undefined ? { alvoDeclarado: o.alvoDeclarado as string } : {}),
    ...(gravidade ? { gravidade } : {}), ...(o.observacao !== undefined ? { observacao: o.observacao as string } : {})
  });
}
