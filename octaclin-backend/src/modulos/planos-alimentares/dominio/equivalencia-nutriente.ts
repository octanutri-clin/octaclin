import { objetoGrupo, porcaoGrupoValida, UUID_GRUPO } from './grupos-substituicoes';
export const NUTRIENTES_EQUIVALENCIA = ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG'] as const;
export type NutrienteEquivalencia = typeof NUTRIENTES_EQUIVALENCIA[number];
export interface PoliticaEquivalencia { passoPorcaoGramas: '1' | '0.1' | '0.01' | '0.001' }
export interface ReferenciaEquivalencia { aplicacaoId: string }
export interface ComandoEquivalencia extends ReferenciaEquivalencia {
  acao: 'calcular' | 'recalcular' | 'desvincular'; anteriorAplicacaoId?: string;
  fingerprintEsperado: string; nutriente?: NutrienteEquivalencia;
  politica?: PoliticaEquivalencia; porcaoEfetiva?: string;
}
export type IntencaoEquivalencia = ReferenciaEquivalencia | ComandoEquivalencia;
export function nutrienteEquivalenciaValido(v: unknown): v is NutrienteEquivalencia {
  return typeof v === 'string' && (NUTRIENTES_EQUIVALENCIA as readonly string[]).includes(v);
}
export function validarPoliticaEquivalencia(v: unknown): PoliticaEquivalencia {
  const p = objetoGrupo(v, ['passoPorcaoGramas']);
  if (!['1', '0.1', '0.01', '0.001'].includes(p.passoPorcaoGramas as string)) throw new Error('Política de porção inválida.');
  return { passoPorcaoGramas: p.passoPorcaoGramas as PoliticaEquivalencia['passoPorcaoGramas'] };
}
export function validarIntencaoEquivalencia(v: unknown): IntencaoEquivalencia {
  const c = objetoGrupo(v, ['aplicacaoId', 'acao', 'anteriorAplicacaoId', 'fingerprintEsperado', 'nutriente', 'politica', 'porcaoEfetiva']);
  if (typeof c.aplicacaoId !== 'string' || !UUID_GRUPO.test(c.aplicacaoId)) throw new Error('Referência de equivalência inválida.');
  if (c.acao === undefined) {
    if (Object.keys(c).length !== 1) throw new Error('Referência de equivalência inválida.');
    return { aplicacaoId: c.aplicacaoId.toLowerCase() };
  }
  if (!['calcular', 'recalcular', 'desvincular'].includes(c.acao as string) || typeof c.fingerprintEsperado !== 'string' || !/^[a-f0-9]{64}$/.test(c.fingerprintEsperado)) throw new Error('Comando de equivalência inválido.');
  const anterior = c.anteriorAplicacaoId;
  if (c.acao === 'calcular' ? anterior !== undefined : typeof anterior !== 'string' || !UUID_GRUPO.test(anterior) || anterior.toLowerCase() === c.aplicacaoId.toLowerCase()) throw new Error('Vínculo anterior inválido.');
  const base: ComandoEquivalencia = { acao: c.acao as ComandoEquivalencia['acao'], aplicacaoId: c.aplicacaoId.toLowerCase(), fingerprintEsperado: c.fingerprintEsperado, ...(typeof anterior === 'string' ? { anteriorAplicacaoId: anterior.toLowerCase() } : {}) };
  if (c.acao === 'desvincular') {
    if (c.nutriente !== undefined || c.politica !== undefined || c.porcaoEfetiva !== undefined) throw new Error('Desvinculação inválida.');
    return base;
  }
  const q = typeof c.porcaoEfetiva === 'string' && /^\d{1,5}(?:\.\d{1,3})?$/.test(c.porcaoEfetiva) ? Number(c.porcaoEfetiva) : NaN;
  if (!nutrienteEquivalenciaValido(c.nutriente) || !porcaoGrupoValida(q)) throw new Error('Parâmetros de equivalência inválidos.');
  return { ...base, nutriente: c.nutriente, politica: validarPoliticaEquivalencia(c.politica), porcaoEfetiva: c.porcaoEfetiva as string };
}

export interface FatosComposicaoEquivalencia {
  identidade: string; descricao: string; preparacao?: string; baseGramas: string;
  nutrientes: Partial<Record<NutrienteEquivalencia, string>>;
  fonte?: { codigo: string; versao?: string; hashConteudo?: string; revisao?: number };
}
export interface EntradaEquivalencia {
  principal: FatosComposicaoEquivalencia; alternativa: FatosComposicaoEquivalencia;
  porcaoPrincipalGramas: string; nutriente: NutrienteEquivalencia; politica: PoliticaEquivalencia; porcaoEfetiva?: string;
}
import { calcularNutrientesDaPorcaoDecimal } from './calculo-nutricional';
import { razaoDecimal, RazaoNutricional, RazaoNutricionalSnapshot, multiplicarRazoes, dividirRazoes, subtrairRazoes, compararRazoes, valorAbsolutoRazao, serializarRazao, formatarRazao, arredondarAoPasso } from './decimal-nutricional';
export type ResultadoEquivalencia = { estado: 'indisponivel'; motivo: string; nutriente: NutrienteEquivalencia } | {
  estado: 'calculavel'; nutriente: NutrienteEquivalencia; aplicavel: boolean; motivosAplicacao: string[];
  porcaoMatematica: RazaoNutricionalSnapshot; porcaoMatematicaGramas: string; porcaoMatematicaAproximada: boolean;
  porcaoSugeridaGramas: string; porcaoEfetivaGramas: string; nutrienteAlvo: string; obtido: string;
  delta: string; diferencaAbsoluta: string; deltaPercentual: string;
  nutrientesPorcao: Partial<Record<NutrienteEquivalencia, string>>; avisos: string[];
  exatos: { alvo: RazaoNutricionalSnapshot; obtido: RazaoNutricionalSnapshot; delta: RazaoNutricionalSnapshot; percentual: RazaoNutricionalSnapshot };
};
function compararDecimal(a: RazaoNutricional,b: string) { return compararRazoes(a,razaoDecimal(b)); }
/** Não transforma um resíduo conhecido em igualdade só porque arredondou na apresentação. */
export function formatarRazaoComparacao(a: RazaoNutricional,casas=8):string {
  const texto=formatarRazao(a,casas);
  if(texto!=='0'||!a.numerador)return texto;
  return (a.numerador<0n?'-':'')+'<'+(casas?'0.'+'0'.repeat(casas-1)+'1':'1');
}
export function calcularEquivalencia(entrada: EntradaEquivalencia): ResultadoEquivalencia {
  const indisponivel=(motivo:string):ResultadoEquivalencia=>({estado:'indisponivel',motivo,nutriente:entrada.nutriente});
  try {
    if(!nutrienteEquivalenciaValido(entrada.nutriente))return indisponivel('nutriente_invalido');
    const politica=validarPoliticaEquivalencia(entrada.politica);
    if(!porcaoGrupoValida(Number(entrada.porcaoPrincipalGramas)))return indisponivel('principal_invalido');
    const bp=razaoDecimal(entrada.principal.baseGramas),ba=razaoDecimal(entrada.alternativa.baseGramas);
    if(!bp.numerador||!ba.numerador)return indisponivel('base_invalida');
    const vp=entrada.principal.nutrientes[entrada.nutriente],va=entrada.alternativa.nutrientes[entrada.nutriente];
    if(vp===undefined)return indisponivel('alvo_ausente');if(va===undefined)return indisponivel('concentracao_ausente');
    const alvo=dividirRazoes(multiplicarRazoes(razaoDecimal(entrada.porcaoPrincipalGramas),razaoDecimal(vp)),bp),densidade=razaoDecimal(va);
    if(!alvo.numerador)return indisponivel(densidade.numerador?'alvo_zero_sem_porcao_positiva':'alvo_zero_indeterminado');
    if(!densidade.numerador)return indisponivel('concentracao_zero');
    const matematica=dividirRazoes(multiplicarRazoes(alvo,ba),densidade),passo=razaoDecimal(politica.passoPorcaoGramas);
    const sugerida=arredondarAoPasso(matematica,passo),sugeridaTexto=formatarRazao(sugerida,3);
    if(entrada.porcaoEfetiva!==undefined && (!/^\d{1,5}(?:\.\d{1,3})?$/.test(entrada.porcaoEfetiva)||!porcaoGrupoValida(Number(entrada.porcaoEfetiva))))return indisponivel('porcao_efetiva_invalida');
    const efetivaTexto=entrada.porcaoEfetiva??sugeridaTexto,efetiva=razaoDecimal(efetivaTexto);
    const obtido=dividirRazoes(multiplicarRazoes(efetiva,densidade),ba),delta=subtrairRazoes(obtido,alvo),percentual=dividirRazoes(multiplicarRazoes(delta,razaoDecimal('100')),alvo);
    const motivosAplicacao:string[]=[];
    if(!porcaoGrupoValida(Number(efetivaTexto)))motivosAplicacao.push('porcao_fora_dominio');
    if(NUTRIENTES_EQUIVALENCIA.some(n=>entrada.alternativa.nutrientes[n]===undefined))motivosAplicacao.push('composicao_incompleta');
    const nutrientesPorcao=calcularNutrientesDaPorcaoDecimal(entrada.alternativa.nutrientes,entrada.alternativa.baseGramas,efetivaTexto);
    const avisos:string[]=[];
    if(compararRazoes(matematica,passo)<0)avisos.push('menor_que_passo');
    const relacao=dividirRazoes(matematica,razaoDecimal(entrada.porcaoPrincipalGramas));
    if(compararDecimal(relacao,'10')>=0||compararDecimal(relacao,'0.1')<=0)avisos.push('relacao_porcoes_extrema');
    if(compararDecimal(matematica,'0.001')<0||compararDecimal(matematica,'10000')>0)avisos.push('porcao_matematica_fora_dominio');
    const matematicaTexto=formatarRazao(matematica,8);
    return {estado:'calculavel',nutriente:entrada.nutriente,aplicavel:!motivosAplicacao.length,motivosAplicacao,
      porcaoMatematica:serializarRazao(matematica),porcaoMatematicaGramas:formatarRazaoComparacao(matematica),porcaoMatematicaAproximada:compararRazoes(razaoDecimal(matematicaTexto),matematica)!==0,
      porcaoSugeridaGramas:sugeridaTexto,porcaoEfetivaGramas:efetivaTexto,nutrienteAlvo:formatarRazaoComparacao(alvo),obtido:formatarRazaoComparacao(obtido),delta:formatarRazaoComparacao(delta),diferencaAbsoluta:formatarRazaoComparacao(valorAbsolutoRazao(delta)),deltaPercentual:formatarRazaoComparacao(percentual),nutrientesPorcao,avisos,
      exatos:{alvo:serializarRazao(alvo),obtido:serializarRazao(obtido),delta:serializarRazao(delta),percentual:serializarRazao(percentual)}};
  }catch{return indisponivel('dados_invalidos_ou_limite_precisao');}
}
