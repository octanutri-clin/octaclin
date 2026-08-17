/**
 * Previa nutricional do editor de planos alimentares.
 *
 * O backend continua sendo a autoridade: ele recalcula tudo ao salvar o
 * rascunho e bloqueia a publicacao quando os totais divergem das metas. Este
 * modulo existe apenas para o profissional enxergar o efeito do que digita
 * antes de salvar, e por isso espelha exatamente o arredondamento e as regras
 * de `calculo-nutricional.ts` e `plano-alimentar.ts` do backend. Divergir aqui
 * significaria mostrar um numero que nao e o que sera gravado.
 */

export interface NutrientesPor100g {
  energiaKcal: number;
  proteinasG: number;
  carboidratosG: number;
  gordurasG: number;
  fibrasG?: number;
  sodioMg?: number;
}

export type NutrientesPorcao = NutrientesPor100g;

export interface ItemPrevisto {
  porcaoGramas: number;
  nutrientesPor100g: NutrientesPor100g;
}

export interface RefeicaoPrevista {
  itens: ItemPrevisto[];
}

export interface MetasPrevistas {
  metaEnergeticaKcal: number;
  metasMacronutrientes: {
    carboidratosG: number;
    proteinasG: number;
    gordurasG: number;
  };
}

export interface DesvioMeta {
  rotulo: string;
  meta: number;
  total: number;
  /** Fracao assinada: negativa abaixo da meta, positiva acima. */
  divergencia: number;
  excedeLimiar: boolean;
  /** Meta ou total zerado: o backend trata como impeditivo, nao como desvio. */
  zerado: boolean;
}

/** Mesmo valor de `LIMIAR_DIVERGENCIA_NUTRICIONAL` no servico do backend. */
export const LIMIAR_DIVERGENCIA_NUTRICIONAL = 0.3;

// O epsilon replica `arredondar4` do backend: sem ele, valores como 1.0005
// caem para baixo por representacao binaria e a previa diverge do gravado.
function arredondar4(valor: number): number {
  return Math.round((valor + 1e-10) * 10_000) / 10_000;
}

/**
 * O backend valida a entrada e lanca excecao em valor invalido. Aqui a entrada
 * e um formulario a meio caminho de ser preenchido: um campo apagado vira NaN
 * ou undefined por um instante e nao pode derrubar o painel. Trata-se como zero
 * ate o profissional terminar de digitar; a validacao real acontece ao salvar.
 */
function numero(valor: number | undefined): number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : 0;
}

export function nutrientesDaPorcao(
  nutrientes: NutrientesPor100g,
  porcaoGramas: number
): NutrientesPorcao {
  const fator = numero(porcaoGramas) / 100;
  return {
    energiaKcal: arredondar4(numero(nutrientes.energiaKcal) * fator),
    proteinasG: arredondar4(numero(nutrientes.proteinasG) * fator),
    carboidratosG: arredondar4(numero(nutrientes.carboidratosG) * fator),
    gordurasG: arredondar4(numero(nutrientes.gordurasG) * fator),
    ...(nutrientes.fibrasG !== undefined ? { fibrasG: arredondar4(numero(nutrientes.fibrasG) * fator) } : {}),
    ...(nutrientes.sodioMg !== undefined ? { sodioMg: arredondar4(numero(nutrientes.sodioMg) * fator) } : {})
  };
}

export function totaisPrevistos(refeicoes: RefeicaoPrevista[]): NutrientesPorcao {
  const porcoes = refeicoes
    .flatMap((refeicao) => refeicao.itens)
    .map((item) => nutrientesDaPorcao(item.nutrientesPor100g, item.porcaoGramas));

  // Igual a `calcularTotaisPlano`: um item sem o nutriente torna o total
  // desconhecido em vez de virar zero, para nao afirmar um dado que a fonte
  // nao tem.
  const somar = (campo: keyof NutrientesPorcao): number | undefined => {
    const valores = porcoes.map((porcao) => porcao[campo]);
    if (valores.some((valor) => valor === undefined)) return undefined;
    return arredondar4((valores as number[]).reduce((soma, valor) => soma + valor, 0));
  };

  return {
    energiaKcal: somar('energiaKcal') ?? 0,
    proteinasG: somar('proteinasG') ?? 0,
    carboidratosG: somar('carboidratosG') ?? 0,
    gordurasG: somar('gordurasG') ?? 0,
    fibrasG: somar('fibrasG'),
    sodioMg: somar('sodioMg')
  };
}

export function desviosDasMetas(totais: NutrientesPorcao, metas: MetasPrevistas): DesvioMeta[] {
  const pares: Array<[string, number, number]> = [
    ['Energia', metas.metaEnergeticaKcal, totais.energiaKcal],
    ['Carboidratos', metas.metasMacronutrientes.carboidratosG, totais.carboidratosG],
    ['Proteinas', metas.metasMacronutrientes.proteinasG, totais.proteinasG],
    ['Gorduras', metas.metasMacronutrientes.gordurasG, totais.gordurasG]
  ];

  return pares.map(([rotulo, meta, total]) => {
    const zerado = meta <= 0 || total <= 0;
    const divergencia = zerado ? 0 : (total - meta) / meta;
    return {
      rotulo,
      meta,
      total,
      divergencia,
      // `>` e nao `>=`: o backend libera a publicacao exatamente no limiar.
      excedeLimiar: zerado || Math.abs(divergencia) > LIMIAR_DIVERGENCIA_NUTRICIONAL,
      zerado
    };
  });
}
