import { selecionarRefeicoesCombinadas, type EntradaPlanoCombinado } from './calculo-combinado';
import { analisarCoberturaDietetica, type CoberturaNutrienteDietetica } from './cobertura-dietetica';
import { CODIGOS_MICRONUTRIENTES, decimalParaEscala8, numeroDaEscala8, type CodigoMicronutriente } from './micronutrientes';

export interface ContribuicaoItemDietetica {
  /** Posição interna nesta leitura; não é identidade persistente nem capability. */
  indiceItem: number;
  posicaoSelecao?: number;
  cobertura: CoberturaNutrienteDietetica;
  participacaoSelecaoPercentual?: number;
  participacaoRefeicaoPercentual?: number;
}
export interface ContribuicaoRefeicaoDietetica {
  planoId: string;
  identidadeRefeicao: string;
  cobertura: CoberturaNutrienteDietetica;
  participacaoSelecaoPercentual?: number;
  itens: ContribuicaoItemDietetica[];
}
export interface ContribuicoesDieteticas {
  schemaVersao: 1;
  codigo: CodigoMicronutriente;
  cobertura: CoberturaNutrienteDietetica;
  refeicoes: ContribuicaoRefeicaoDietetica[];
}
/** Participação factual; oito casas, half-up, não percentual de RDA/AI/UL. */
function participacao(parcela: CoberturaNutrienteDietetica, denominador: CoberturaNutrienteDietetica): number | undefined {
  if (parcela.estado !== 'COMPLETO' || denominador.estado !== 'COMPLETO' ||
      parcela.total === undefined || denominador.total === undefined) return undefined;
  const total = decimalParaEscala8(denominador.total);
  if (total === 0n) return undefined;
  const valor = decimalParaEscala8(parcela.total) * 100n * 100_000_000n;
  return numeroDaEscala8((valor + total / 2n) / total);
}
function coberturaItens(itens: unknown[], codigo: CodigoMicronutriente): CoberturaNutrienteDietetica {
  // Mesmo classificador/somador de porções congeladas; nenhuma resolução de catálogo.
  return analisarCoberturaDietetica([{
    planoId: '', ativo: true, selecionado: true,
    refeicoes: [{ identidadeId: '', ativa: true, selecionada: true, itens }]
  }]).nutrientes[codigo];
}
/**
 * Decomposição interna, não DTO público nem camada de autorização.
 * Ordem original preservada para junção server-side com identidades autorizadas.
 * Não interpreta a seleção como um dia sem confirmação do profissional.
 */
export function decomporContribuicoesDieteticas(planos: EntradaPlanoCombinado[], codigo: CodigoMicronutriente, janela?: { inicio: number; limite: number; ordem?: 'plano' | 'contribuicao' }): ContribuicoesDieteticas {
  if (!CODIGOS_MICRONUTRIENTES.includes(codigo)) throw new Error('Micronutriente inválido.');
  if (janela && (!Number.isInteger(janela.inicio) || janela.inicio < 0 || !Number.isInteger(janela.limite) || janela.limite < 1 || janela.limite > 100)) throw new Error('Janela inválida.');
  if(janela?.ordem!==undefined && janela.ordem!=='plano' && janela.ordem!=='contribuicao') throw new Error('Ordem inválida.');
  if(janela?.ordem==='contribuicao') {
    // Reutiliza o classificador e a mesma porção congelada, sem segundo motor.
    const completa=decomporContribuicoesDieteticas(planos,codigo);
    const todos=completa.refeicoes.flatMap((m,refeicao)=>m.itens.map(i=>({refeicao,item:i})));
    todos.sort((a,b)=>{
      const av=a.item.cobertura.total, bv=b.item.cobertura.total;
      if(av===undefined || bv===undefined) return Number(av===undefined)-Number(bv===undefined);
      const x=decimalParaEscala8(av),y=decimalParaEscala8(bv);
      return x===y?0:x>y?-1:1;
    });
    const grupos=new Map<number,ContribuicaoRefeicaoDietetica>();
    todos.slice(janela.inicio,janela.inicio+janela.limite).forEach((v,indice)=>{
      if(!grupos.has(v.refeicao))grupos.set(v.refeicao,{...completa.refeicoes[v.refeicao],itens:[]});
      grupos.get(v.refeicao)!.itens.push({...v.item,posicaoSelecao:janela.inicio+indice+1});
    });
    return {...completa,refeicoes:[...grupos.values()]};
  }
  const { refeicoes } = selecionarRefeicoesCombinadas(planos);
  let deslocamento = 0;
  const cobertura = analisarCoberturaDietetica(planos).nutrientes[codigo];
  return {
    schemaVersao: 1, codigo, cobertura,
    refeicoes: refeicoes.flatMap(refeicao => {
      const inicio = janela ? Math.max(0, janela.inicio - deslocamento) : 0;
      const fim = janela ? Math.min(refeicao.itens.length, janela.inicio + janela.limite - deslocamento) : refeicao.itens.length;
      deslocamento += refeicao.itens.length;
      if (janela && inicio >= fim) return [];
      const coberturaRefeicao = coberturaItens(refeicao.itens, codigo);
      const percentual = participacao(coberturaRefeicao, cobertura);
      return [{
        planoId: refeicao.planoId, identidadeRefeicao: refeicao.identidadeRefeicao,
        cobertura: coberturaRefeicao,
        ...(percentual !== undefined ? { participacaoSelecaoPercentual: percentual } : {}),
        itens: Array.from(refeicao.itens.slice(inicio, fim), (item, posicao) => {
          const indiceItem = inicio + posicao;
          const coberturaItem = coberturaItens([item], codigo);
          const percentualSelecao = participacao(coberturaItem, cobertura);
          const percentualRefeicao = participacao(coberturaItem, coberturaRefeicao);
          return {
            indiceItem, cobertura: coberturaItem,
            ...(percentualSelecao !== undefined ? { participacaoSelecaoPercentual: percentualSelecao } : {}),
            ...(percentualRefeicao !== undefined ? { participacaoRefeicaoPercentual: percentualRefeicao } : {})
          };
        })
      }];
    })
  };
}
