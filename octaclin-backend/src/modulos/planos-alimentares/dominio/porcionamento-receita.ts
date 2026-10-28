import type { ItemModeloPlanoAlimentar } from './modelos-plano-alimentar';
import type { BaseQuantidadesReceita } from './metadados-receita';
import { lerConteudoReceita, milesimosReceita } from './conteudo-receita';

interface LocalIngrediente { item: number; substituicao?: number }
export interface AvisoPorcionamentoReceita extends LocalIngrediente {
  codigo: 'ARREDONDAMENTO'; campo: 'quantidade' | 'porcaoGramas';
}
export type ResultadoPorcionamento = {
  estado: 'calculavel'; itens: ItemModeloPlanoAlimentar[]; baseQuantidades: BaseQuantidadesReceita;
  rendimentoOriginalPorcoes?: number; porcoesDesejadas: number;
  fatorExato: { numerador: string; denominador: string }; avisos: AvisoPorcionamentoReceita[];
} | {
  estado: 'indisponivel'; motivos: ({ codigo: 'CONTEUDO_INVALIDO' | 'PORCOES_INVALIDAS' | 'BASE_NAO_INFORMADA' | 'RENDIMENTO_NAO_INFORMADO' | 'QUANTIDADE_FORA_DO_LIMITE' } & Partial<LocalIngrediente>)[];
};
function mdc(a: bigint, b: bigint): bigint {
  while (b) { const resto = a % b; a = b; b = resto; }
  return a;
}

/** Sem IO ou fonte global: cada chamada lê a receita original fornecida, nunca uma prévia anterior. */
export function porcionarReceita(entrada: unknown, porcoesDesejadas: unknown): ResultadoPorcionamento {
  let porcoes: bigint;
  try { porcoes = milesimosReceita(porcoesDesejadas, 1000); }
  catch { return { estado: 'indisponivel', motivos: [{ codigo: 'PORCOES_INVALIDAS' }] }; }
  let conteudo: ReturnType<typeof lerConteudoReceita>;
  try { conteudo = lerConteudoReceita(entrada); }
  catch { return { estado: 'indisponivel', motivos: [{ codigo: 'CONTEUDO_INVALIDO' }] }; }
  const meta = conteudo.metadados;
  if (!meta?.baseQuantidades) return { estado: 'indisponivel', motivos: [{ codigo: 'BASE_NAO_INFORMADA' }] };
  if (meta.baseQuantidades === 'receita_inteira' && meta.rendimentoPorcoes === undefined) {
    return { estado: 'indisponivel', motivos: [{ codigo: 'RENDIMENTO_NAO_INFORMADO' }] };
  }
  const denominadorBase = 1000n * BigInt(meta.baseQuantidades === 'receita_inteira' ? meta.rendimentoPorcoes! : 1);
  const divisor = mdc(porcoes, denominadorBase), numerador = porcoes / divisor, denominador = denominadorBase / divisor;
  const avisos: AvisoPorcionamentoReceita[] = [];
  const motivos: Extract<ResultadoPorcionamento, { estado: 'indisponivel' }>['motivos'] = [];
  function ajustar(alimento: ItemModeloPlanoAlimentar, local: LocalIngrediente): ItemModeloPlanoAlimentar {
    const copia = { ...alimento };
    for (const campo of ['quantidade', 'porcaoGramas'] as const) {
      const produto = milesimosReceita(alimento[campo]) * numerador;
      // Verificar o valor exato antes do arredondamento, inclusive nas bordas.
      if (produto < denominador || produto > 10000000n * denominador) {
        motivos.push({ codigo: 'QUANTIDADE_FORA_DO_LIMITE', ...local });
        continue;
      }
      const arredondado = (produto * 2n + denominador) / (2n * denominador);
      copia[campo] = Number(arredondado) / 1000;
      if (produto % denominador !== 0n) avisos.push({ codigo: 'ARREDONDAMENTO', ...local, campo });
    }
    return copia;
  }
  const itens = conteudo.itens.map((item, indice) => ({
    ...ajustar(item, { item: indice }),
    ...(item.substituicoes === undefined ? {} : { substituicoes: item.substituicoes.map((sub, s) => ajustar(sub, { item: indice, substituicao: s })) })
  }));
  // Nenhum valor parcial pode ser aplicado se uma só linha/alternativa falhar.
  if (motivos.length) return { estado: 'indisponivel', motivos };
  return { estado: 'calculavel', itens, baseQuantidades: meta.baseQuantidades,
    ...(meta.rendimentoPorcoes === undefined ? {} : { rendimentoOriginalPorcoes: meta.rendimentoPorcoes }),
    porcoesDesejadas: Number(porcoes) / 1000,
    fatorExato: { numerador: numerador.toString(), denominador: denominador.toString() }, avisos };
}
