import type { CodigoNutrienteCombinado, ResultadoNutrienteCombinado } from './calculo-combinado';
import { compararNutrientePlanejado, type ComparacaoDietetica, type ContextoComparacaoDietetica } from './comparacao-dietetica';
import type { ContextoDieteticoResolvido, MotivoContextoDietetico } from './contexto-dietetico';
import { CODIGOS_MICRONUTRIENTES, MICRONUTRIENTES, type CodigoMicronutriente } from './micronutrientes';
import { VERSAO_REFERENCIAS_DRI_ADULTO, referenciaDriAdulto } from './referencias-dri';

/**
 * Comparador em lote (FOOD06, T2). Dominio puro: recebe os totais ja calculados
 * pela analise e o contexto ja resolvido, escolhe a referencia DRI da T1 e delega
 * a aritmetica e as regras por nutriente ao comparador existente
 * (`compararNutrientePlanejado`). Nada aqui duplica regra de unidade, cobertura,
 * UL restrito ou tabagismo.
 *
 * Contrato ratificado (CL01-CL08):
 * - so compara com contexto elegivel e o mesmo dia planejado confirmado;
 * - so compara com cobertura completa e unidade compativel;
 * - sem diagnostico: devolve percentual, diferenca e, no UL, a posicao factual
 *   (`abaixo`, `igual`, `acima`), sem cor, semaforo, deficiencia ou toxicidade;
 * - zero conhecido e valor valido; ausencia nunca vira zero.
 *
 * Sem tabela, rota ou persistencia. O servico que o usar deve resolver o contexto
 * no servidor, apos autorizacao, e nunca aceitar `ContextoDieteticoResolvido` do
 * cliente.
 */
export interface ComparacaoReferenciasNutriente {
  codigo: CodigoMicronutriente;
  referencia: ComparacaoDietetica;
  ul: ComparacaoDietetica;
}

export interface ResultadoComparacaoReferencias {
  versaoReferencias: typeof VERSAO_REFERENCIAS_DRI_ADULTO;
  contextoElegivel: boolean;
  /** Motivos do contexto quando nao elegivel; lista vazia quando elegivel. */
  motivosContexto: MotivoContextoDietetico[];
  /** Os 22 codigos PA06, na ordem canonica. Nutrientes legados nao entram. */
  nutrientes: ComparacaoReferenciasNutriente[];
}

type TotaisAnalise = Partial<Record<CodigoNutrienteCombinado, ResultadoNutrienteCombinado>>;

const NAO_ELEGIVEL: ContextoComparacaoDietetica = Object.freeze({ elegivel: false, mesmoDiaPlanejado: false, tabagismo: 'nao_informado' });

function objetoSimples(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === 'object' && !Array.isArray(valor);
}

/**
 * `elegivel` sozinho nao basta: o contexto precisa ser coerente com o que a
 * referencia usa (sem motivos, populacao confirmada e idade adulta). Contexto
 * adulterado ou incompleto nunca e tratado como elegivel.
 */
function contextoCoerente(contexto: unknown): contexto is ContextoDieteticoResolvido & { idadeAnos: number; populacaoReferencia: 'masculina' | 'feminina' } {
  if (!objetoSimples(contexto) || !objetoSimples(contexto.contexto)) return false;
  const c = contexto as unknown as ContextoDieteticoResolvido;
  return c.contexto.elegivel === true && Array.isArray(c.motivos) && c.motivos.length === 0 &&
    (c.populacaoReferencia === 'masculina' || c.populacaoReferencia === 'feminina') &&
    typeof c.idadeAnos === 'number' && Number.isSafeInteger(c.idadeAnos) && c.idadeAnos >= 19;
}

function indisponivelDe(motivo: 'dados_incompletos' | 'definicao_incompativel'): ComparacaoDietetica {
  return { estado: 'indisponivel', motivo };
}

export function compararAnaliseComReferencias(
  totais: TotaisAnalise, contexto: ContextoDieteticoResolvido
): ResultadoComparacaoReferencias {
  const coerente = contextoCoerente(contexto);
  const motivosContexto: MotivoContextoDietetico[] = coerente
    ? []
    : objetoSimples(contexto) && Array.isArray(contexto.motivos) && contexto.motivos.length > 0
      ? [...contexto.motivos]
      : ['confirmacao_invalida'];
  const contextoParaComparar: ContextoComparacaoDietetica = coerente ? contexto.contexto : NAO_ELEGIVEL;
  const fonte = objetoSimples(totais) ? totais : {};

  const nutrientes = CODIGOS_MICRONUTRIENTES.map((codigo): ComparacaoReferenciasNutriente => {
    const total = Object.hasOwn(fonte, codigo) ? fonte[codigo] : undefined;
    if (total === undefined) {
      return { codigo, referencia: indisponivelDe('dados_incompletos'), ul: indisponivelDe('dados_incompletos') };
    }
    // O total precisa ser exatamente o do codigo pedido; chave trocada nao compara.
    if (!objetoSimples(total) || total.codigo !== codigo || !Object.hasOwn(MICRONUTRIENTES, codigo)) {
      return { codigo, referencia: indisponivelDe('definicao_incompativel'), ul: indisponivelDe('definicao_incompativel') };
    }
    const referencia = coerente
      ? referenciaDriAdulto(codigo, { populacaoReferencia: contexto.populacaoReferencia, idadeAnos: contexto.idadeAnos })
      : undefined;
    const confronto = compararNutrientePlanejado(total, referencia, contextoParaComparar);
    return { codigo, referencia: confronto.referencia, ul: confronto.ul };
  });

  return { versaoReferencias: VERSAO_REFERENCIAS_DRI_ADULTO, contextoElegivel: coerente, motivosContexto, nutrientes };
}
