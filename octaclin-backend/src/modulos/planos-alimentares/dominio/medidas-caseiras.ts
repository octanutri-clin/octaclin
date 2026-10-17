import { DocumentoEdicaoPlano, numeroEdicao } from './edicao-plano';
import { decimalParaEscala8 } from './micronutrientes';
function milesimos(valor: unknown): bigint {
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0.001 || valor > 10000) {
        throw new Error('Quantidade de medida inválida.');
    }
    const escalado = decimalParaEscala8(valor);
    const inteiro = escalado / 100000n;
    // Comparar também o decimal original: escala8 não autoriza aceitar precisão extra.
    if (Number(inteiro) / 1000 !== valor)
        throw new Error('Medidas aceitam até três casas decimais.');
    return inteiro;
}
/** Quantidades decimais exatas; único arredondamento half-up, no peso final. */
export function calcularPesoMedida(quantidade: unknown, pesoGramas: unknown, quantidadeReferencia: unknown): number {
    const q = milesimos(quantidade);
    const p = milesimos(pesoGramas);
    const r = milesimos(quantidadeReferencia);
    const produto = q * p;
    if (produto < r || produto > 10000000n * r)
        throw new Error('Porção fora do limite de 0,001 a 10.000 gramas.');
    const arredondado = (produto * 2n + r) / (2n * r);
    return Number(arredondado) / 1000;
}
export type OrigemAlimentoMedida = 'catalogo' | 'custom';
export interface ContextoMedidaSalvo {
    origemAlimento?: 'custom';
    aplicacaoId: string;
    alimentoId: string;
    referencia: {
        id: string;
        revisao: number;
        nome: string;
        quantidadeReferencia: number;
        pesoReferenciaGramas: number;
    };
    quantidade?: number;
    porcaoGramas?: number;
}
export type ContextosMedidas = Record<string, ContextoMedidaSalvo>;
/** O mapa vem exclusivamente do cipher da versão; nunca do corpo HTTP. */
export async function resolverMedidasDocumento(documento: DocumentoEdicaoPlano, anteriores: ContextosMedidas, resolver: (alimentoId: string, ref: {
    id: string;
    revisao: number;
}, quantidade?: number, origem?: OrigemAlimentoMedida) => Promise<{
    referencia: ContextoMedidaSalvo['referencia'];
}>): Promise<ContextosMedidas> {
    const atuais: ContextosMedidas = Object.create(null);
    for (const refeicao of documento.refeicoes)
        for (const item of refeicao.itens)
            for (const a of [item, ...(item.substituicoes ?? [])]) {
                const anterior = Object.hasOwn(anteriores, a.chaveCliente) ? anteriores[a.chaveCliente] : undefined;
                const quantidade = numeroEdicao(a.quantidade);
                const origem: OrigemAlimentoMedida = a.alimentoPersonalizado ? 'custom' : 'catalogo';
                const alimentoId = a.alimentoPersonalizado?.id ?? a.alimentoComposicaoId;
                if (a.alimentoPersonalizado && a.alimentoComposicaoId) throw new Error('Origem de alimento ambígua.');
                // Writer legado que omite o novo campo não destrói proveniência por omissão.
                if (a.medidaCaseira === undefined && anterior && alimentoId === anterior.alimentoId && (anterior.origemAlimento ?? 'catalogo') === origem && quantidade === anterior.quantidade &&
                    a.unidade === anterior.referencia.nome && numeroEdicao(a.porcaoGramas) === anterior.porcaoGramas) {
                    a.medidaCaseira = { id: anterior.referencia.id, revisao: anterior.referencia.revisao, aplicacaoId: anterior.aplicacaoId };
                }
                const m = a.medidaCaseira;
                if (!m)
                    continue;
                if (!alimentoId)
                    throw new Error('Medida exige alimento do catálogo.');
                const preservar = anterior && anterior.aplicacaoId === m.aplicacaoId && anterior.alimentoId === alimentoId && (anterior.origemAlimento ?? 'catalogo') === origem && anterior.referencia.id === m.id && anterior.referencia.revisao === m.revisao;
                const referencia = preservar ? anterior.referencia : (await resolver(alimentoId, m, quantidade, origem)).referencia;
                // Incompletude editorial é preservada; valor preenchido inválido continua pendente.
                let porcaoGramas: number | undefined;
                if (quantidade !== undefined) {
                    try {
                        porcaoGramas = calcularPesoMedida(quantidade, referencia.pesoReferenciaGramas, referencia.quantidadeReferencia);
                    }
                    catch {
                        porcaoGramas = undefined;
                    }
                }
                a.unidade = referencia.nome;
                a.porcaoGramas = porcaoGramas;
                atuais[a.chaveCliente] = { aplicacaoId: m.aplicacaoId, alimentoId, ...(origem === 'custom' ? { origemAlimento: 'custom' as const } : {}), referencia, quantidade, porcaoGramas };
            }
    return atuais;
}
