import { MICRONUTRIENTES, criarSnapshotMicronutrientes, decimalComoRazao, type CodigoMicronutriente, type EstadoMicronutriente } from '../dominio/micronutrientes';
import { extrairMicronutrientesFonte } from '../dados/micronutrientes-fonte';
export interface CandidatoTeorCatalogo {
    id: string;
    nome: string;
    preparacao?: string;
    baseGramas: number | string;
    micronutrientes: unknown;
    fonte: {
        id: string;
        codigo: string;
        versao: string;
        baseCodigo: string;
        esquemaVersao: string;
        situacao: string;
        direitoUsoStatus: string;
    };
}
export interface ItemTeorCatalogo {
    alimento: {
        id: string;
        nome: string;
        preparacao?: string;
    };
    fonte: {
        id: string;
        codigo: string;
        versao: string;
        baseCodigo: string;
        esquemaVersao: string;
    };
    baseGramas: number;
    porcaoGramas: number;
    nutriente: {
        codigo: CodigoMicronutriente;
        rotulo: string;
        unidade: string;
        qualificador?: string;
        estado: EstadoMicronutriente;
        valorPor100g?: number;
        valorPorcao?: number;
        arredondadoParaZero?: {
            por100g: boolean;
            porcao: boolean;
        };
    };
}
export interface ConsultaTeorCatalogo {
    schemaVersao: 1;
    motorVersao: 'food06-consulta-teor-v1';
    codigo: CodigoMicronutriente;
    porcaoGramas: number;
    itens: ItemTeorCatalogo[];
    cobertura: {
        recebidos: number;
        considerados: number;
        comValor: number;
        semValor: number;
    };
    exclusoes: {
        fonteInativa: number;
        direitoNaoAprovado: number;
        dadosInvalidos: number;
    };
    ordenacao: {
        escopo: 'lote_consultado';
        criterio: 'teor_apresentado_na_porcao_decrescente';
        precisaoDecimal: 8;
        desempate: 'identificador_ascendente';
        desconhecidos: 'ao_final';
    };
    individualizacao: {
        estado: 'bloqueada';
        motivo: 'contrato_restricoes_nao_validado';
    };
}
export class ConsultaTeorInvalidaError extends Error {
    constructor() { super('Consulta factual inválida.'); }
}
/** Fundamento interno; candidatos devem vir de fontes autorizadas pelo servidor, nunca do body HTTP. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function objeto(v: unknown): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Object.getOwnPropertySymbols(v).length || Object.values(Object.getOwnPropertyDescriptors(v)).some(d => !d.enumerable || !Object.hasOwn(d, 'value')))
        throw new ConsultaTeorInvalidaError();
    return v as Record<string, unknown>;
}
function texto(v: unknown, max: number): v is string { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
export function prepararConsultaTeorCatalogo(consulta: unknown, candidatos: readonly CandidatoTeorCatalogo[]): ConsultaTeorCatalogo {
    const q = objeto(consulta);
    if (Object.keys(q).length !== 2 || Object.keys(q).some(k => !['codigo', 'porcaoGramas'].includes(k)) || typeof q.codigo !== 'string' || !Object.hasOwn(MICRONUTRIENTES, q.codigo) || typeof q.porcaoGramas !== 'number' || !Number.isFinite(q.porcaoGramas) || q.porcaoGramas < 0.001 || q.porcaoGramas > 10000 || decimalComoRazao(q.porcaoGramas).denominador > 1000n)
        throw new ConsultaTeorInvalidaError();
    if (!Array.isArray(candidatos) || Object.getPrototypeOf(candidatos) !== Array.prototype || candidatos.length > 100 || Object.getOwnPropertySymbols(candidatos).length || Object.keys(candidatos).length !== candidatos.length || Object.entries(Object.getOwnPropertyDescriptors(candidatos)).some(([k, d]) => k !== 'length' && (!/^(0|[1-9]\d*)$/.test(k) || Number(k) >= candidatos.length || !d.enumerable || !Object.hasOwn(d, 'value'))))
        throw new ConsultaTeorInvalidaError();
    const codigo = q.codigo as CodigoMicronutriente, porcaoGramas = q.porcaoGramas, definicao = MICRONUTRIENTES[codigo];
    const itens: ItemTeorCatalogo[] = [], ids = new Set<string>(), exclusoes = { fonteInativa: 0, direitoNaoAprovado: 0, dadosInvalidos: 0 };
    for (const candidato of candidatos) {
        let c: Record<string, unknown>, f: Record<string, unknown>;
        try {
            c = objeto(candidato);
            f = objeto(c.fonte);
        }
        catch {
            exclusoes.dadosInvalidos++;
            continue;
        }
        if (f.situacao !== 'ativa') {
            exclusoes.fonteInativa++;
            continue;
        }
        if (f.direitoUsoStatus !== 'aprovado') {
            exclusoes.direitoNaoAprovado++;
            continue;
        }
        if (!texto(c.id, 36) || !UUID.test(c.id) || !texto(f.id, 36) || !UUID.test(f.id) || !texto(c.nome, 300) || (c.preparacao !== undefined && !texto(c.preparacao, 180)) || !texto(f.codigo, 80) || !texto(f.versao, 80) || !texto(f.baseCodigo, 80) || !texto(f.esquemaVersao, 40)) {
            exclusoes.dadosInvalidos++;
            continue;
        }
        const id = c.id.toLowerCase();
        if (ids.has(id))
            throw new ConsultaTeorInvalidaError();
        ids.add(id);
        try {
            // Mesmos adaptadores e cálculo já usados na materialização do catálogo PA06.
            const base = decimalComoRazao(c.baseGramas);
            if (!base.numerador)
                throw new ConsultaTeorInvalidaError();
            const baseGramas = Number(c.baseGramas), origens = extrairMicronutrientesFonte(f.codigo, f.esquemaVersao, c.micronutrientes);
            const valor = criarSnapshotMicronutrientes(origens, baseGramas, porcaoGramas).nutrientes[codigo];
            const conhecido = valor.estado === 'conhecido';
            if (conhecido && (!Number.isFinite(valor.porcao) || !Number.isFinite(valor.por100g)))
                throw new ConsultaTeorInvalidaError();
            itens.push({ alimento: { id, nome: c.nome, ...(c.preparacao === undefined ? {} : { preparacao: c.preparacao as string }) },
                fonte: { id: f.id.toLowerCase(), codigo: f.codigo, versao: f.versao, baseCodigo: f.baseCodigo, esquemaVersao: f.esquemaVersao }, baseGramas, porcaoGramas,
                nutriente: { codigo, rotulo: definicao.rotulo, unidade: definicao.unidade, ...('qualificador' in definicao ? { qualificador: definicao.qualificador } : {}), estado: valor.estado,
                    ...(conhecido ? { valorPor100g: valor.por100g, valorPorcao: valor.porcao, arredondadoParaZero: { por100g: (valor.valorOrigem ?? 0) > 0 && valor.por100g === 0, porcao: (valor.valorOrigem ?? 0) > 0 && valor.porcao === 0 } } : {}) } });
        }
        catch {
            exclusoes.dadosInvalidos++;
        }
    }
    const temValor = (i: ItemTeorCatalogo) => i.nutriente.estado === 'conhecido' && i.nutriente.valorPorcao !== undefined;
    itens.sort((a, b) => { const ac = temValor(a), bc = temValor(b); if (ac !== bc)
        return ac ? -1 : 1; if (ac && bc && a.nutriente.valorPorcao !== b.nutriente.valorPorcao)
        return b.nutriente.valorPorcao! - a.nutriente.valorPorcao!; return a.alimento.id < b.alimento.id ? -1 : a.alimento.id > b.alimento.id ? 1 : 0; });
    const comValor = itens.filter(temValor).length;
    return { schemaVersao: 1, motorVersao: 'food06-consulta-teor-v1', codigo, porcaoGramas, itens, cobertura: { recebidos: candidatos.length, considerados: itens.length, comValor, semValor: itens.length - comValor }, exclusoes,
        ordenacao: { escopo: 'lote_consultado', criterio: 'teor_apresentado_na_porcao_decrescente', precisaoDecimal: 8, desempate: 'identificador_ascendente', desconhecidos: 'ao_final' },
        individualizacao: { estado: 'bloqueada', motivo: 'contrato_restricoes_nao_validado' } };
}
