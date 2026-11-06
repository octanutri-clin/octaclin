import { prepararConsultaTeorCatalogo, ConsultaTeorInvalidaError, type CandidatoTeorCatalogo } from './consulta-teor-catalogo';
import { MAPEAMENTO_MICRONUTRIENTES } from '../dominio/micronutrientes';
const fonte = { id: '10000000-0000-4000-8000-000000000001', codigo: 'taco_nepa_unicamp', versao: '4a-micros1', baseCodigo: 'TACO', esquemaVersao: 'octaclin-composicao-v2-micros1', situacao: 'ativa', direitoUsoStatus: 'aprovado' };
const alimento = (n: number, estado = 'conhecido', valor = 2, base: number | string = 100): CandidatoTeorCatalogo => ({ id: `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome: 'Alimento sintético', preparacao: 'Cozido', baseGramas: base, fonte: { ...fonte }, micronutrientes: { mapeamentoVersao: MAPEAMENTO_MICRONUTRIENTES, nutrientes: { ferroMg: { estado, valor } } } });
const consultar = (itens: CandidatoTeorCatalogo[], porcao = 50) => prepararConsultaTeorCatalogo({ codigo: 'ferroMg', porcaoGramas: porcao }, itens);
describe('M11 fundamento factual do catálogo, sem individualização', () => {
    it('normaliza base/porção pelo motor existente sem duplicar composição', () => { const r = consultar([alimento(1, 'conhecido', 3, 50)], 25); expect(r.itens[0].nutriente).toMatchObject({ codigo: 'ferroMg', unidade: 'mg', estado: 'conhecido', valorPor100g: 6, valorPorcao: 1.5 }); expect(r.porcaoGramas).toBe(25); });
    it('distingue zero, ausente e traço; desconhecidos ficam depois dos conhecidos', () => {
        const r = consultar([alimento(4, 'traco'), alimento(3, 'ausente'), alimento(2, 'conhecido', 0), alimento(1, 'conhecido', 4)]);
        expect(r.itens.map(i => i.alimento.id)).toEqual([1, 2, 3, 4].map(i => alimento(i).id));
        expect(r.itens[1].nutriente.valorPorcao).toBe(0);
        expect(r.itens[2].nutriente).not.toHaveProperty('valorPorcao');
        expect(r.itens[3].nutriente.estado).toBe('traco');
        expect(r.cobertura).toEqual({ recebidos: 4, considerados: 4, comValor: 2, semValor: 2 });
    });
    it('preserva identidade, preparo e desempate determinístico sem ranking global', () => {
        const a = alimento(2), b = { ...alimento(1), preparacao: 'Cru' }, r = consultar([a, b]);
        expect(r.itens[0].alimento).toEqual({ id: b.id, nome: b.nome, preparacao: 'Cru' });
        expect(r.itens[1].alimento.preparacao).toBe('Cozido');
        expect(r.ordenacao).toMatchObject({ escopo: 'lote_consultado', precisaoDecimal: 8, desempate: 'identificador_ascendente' });
        expect(r.individualizacao).toEqual({ estado: 'bloqueada', motivo: 'contrato_restricoes_nao_validado' });
    });
    it.each(['suspensa', 'revogada', 'em_validacao'])('exclui fonte %s sem transportar alimento ou metadados', situacao => {
        const a = alimento(1);
        a.nome = 'CANARIO_NAO_AUTORIZADO';
        a.fonte.situacao = situacao;
        const r = consultar([a]);
        expect(r.itens).toEqual([]);
        expect(r.exclusoes.fonteInativa).toBe(1);
        expect(JSON.stringify(r)).not.toContain('CANARIO');
    });
    it.each(['pendente', 'negado', 'expirado'])('não presume direitos %s', direitoUsoStatus => { const a = alimento(1); a.fonte.direitoUsoStatus = direitoUsoStatus; const r = consultar([a]); expect(r.itens).toEqual([]); expect(r.exclusoes.direitoNaoAprovado).toBe(1); });
    it.each([null, {}, [], { codigo: 'ferro', porcaoGramas: 50 }, { codigo: 'ferroMg', porcaoGramas: '50' }, { codigo: 'ferroMg', porcaoGramas: 0 }, { codigo: 'ferroMg', porcaoGramas: 10001 }, { codigo: 'ferroMg', porcaoGramas: 0.0001 }, { codigo: 'ferroMg', porcaoGramas: 1.2345 }, { codigo: 'ferroMg', porcaoGramas: NaN }, { codigo: 'ferroMg', porcaoGramas: Infinity }, { codigo: 'ferroMg', porcaoGramas: 50, pacienteId: 'CANARIO' }, { codigo: 'ferroMg', porcaoGramas: 50, personalizar: true }])('recusa consulta inválida ou individualizada %#', c => { expect(() => prepararConsultaTeorCatalogo(c, [])).toThrow(ConsultaTeorInvalidaError); });
    it('recusa lote excessivo, esparso e identificadores duplicados', () => { expect(() => consultar(Array.from({ length: 101 }, (_, i) => alimento(i + 1)))).toThrow(); expect(() => consultar(Array(1))).toThrow(); expect(() => consultar([alimento(1), alimento(1)])).toThrow(); });
    it('não deixa base inválida impedir os itens independentes', () => { const r = consultar([alimento(1), alimento(2, 'conhecido', 2, 0)]); expect(r.itens).toHaveLength(1); expect(r.exclusoes.dadosInvalidos).toBe(1); });
    it.each([[1, 3, 1, 0.33333333], [0.1, 100, 1.5, 0.0015], [3.7, 100, 0.5, 0.0185], [1, 100, 0.001, 0.00001]])('confere oráculo sintético explícito %s/%s × %s', (valor, base, porcao, esperado) => { expect(consultar([alimento(1, 'conhecido', valor, base)], porcao).itens[0].nutriente.valorPorcao).toBe(esperado); });
    it('sinaliza quantidade positiva arredondada para zero, sem confundir com zero conhecido', () => { const r = consultar([alimento(1, 'conhecido', 1e-12), alimento(2, 'conhecido', 0)], 100); expect(r.itens[0].nutriente.arredondadoParaZero).toEqual({ por100g: true, porcao: true }); expect(r.itens[1].nutriente.arredondadoParaZero).toEqual({ por100g: false, porcao: false }); });
    it('reutiliza unidades e formas USDA sem converter RE em RAE', () => {
        const a = alimento(1);
        a.fonte = { ...fonte, codigo: 'usda_fdc_sr_legacy', esquemaVersao: 'octaclin-composicao-v1' };
        a.micronutrientes = { metadadosOrigem: { nutrientsOriginal: [{ nutrient: { id: 1106, unitName: 'UG' }, amount: 20 }, { nutrient: { id: 1089, unitName: 'UG' }, amount: 2 }] } };
        expect(consultar([a]).itens[0].nutriente.estado).toBe('unidade_incompativel');
        const r = prepararConsultaTeorCatalogo({ codigo: 'vitaminaAReMcg', porcaoGramas: 50 }, [a]);
        expect(r.itens[0].nutriente.estado).toBe('ausente');
        expect(r.itens[0].nutriente.qualificador).toBe('RE');
    });
    it('projeta campos conhecidos sem modificar entradas ou transportar dados livres', () => {
        const a = { ...alimento(1), segredo: 'CANARIO_INTERNO', fonte: { ...fonte, responsavelAprovacao: 'CANARIO_APROVACAO' } };
        const antes = JSON.stringify(a), r = consultar([a]);
        expect(JSON.stringify(r)).not.toContain('CANARIO');
        expect(JSON.stringify(a)).toBe(antes);
        a.nome = 'Outro';
        expect(r.itens[0].alimento.nome).toBe('Alimento sintético');
    });
});
