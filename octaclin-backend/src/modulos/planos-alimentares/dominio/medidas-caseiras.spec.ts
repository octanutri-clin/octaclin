import * as contrato from './medidas-caseiras';
const calcular = (q: unknown, p: unknown, r?: unknown): number => {
    const fn = (contrato as unknown as {
        calcularPesoMedida?: (q: unknown, p: unknown, r: unknown) => number;
    }).calcularPesoMedida;
    return fn!(q, p, r);
};
describe('FOOD01: equivalência explícita para gramas', () => {
    beforeAll(() => expect(typeof (contrato as Record<string, unknown>).calcularPesoMedida).toBe('function'));
    it.each([[1, 25, 1, 25], [0.5, 25, 1, 12.5], [2.5, 25, 1, 62.5], [3, 25, 2, 37.5], [1, 1, 3, 0.333], [1, 1.001, 2, 0.501], [0.1, 0.2, 1, 0.02], [10000, 1, 1, 10000]])('converte %s × %s / %s', (q, p, r, result) => expect(calcular(q, p, r)).toBe(result));
    it.each([0, -1, NaN, Infinity, -Infinity, undefined, null, '', '2', 0.0001, 10000.001, 1.0001])('rejeita entrada não contratual: %s', value => {
        expect(() => calcular(value, 25)).toThrow();
        expect(() => calcular(1, value)).toThrow();
        expect(() => calcular(1, 25, value)).toThrow();
    });
    it('não eleva porção abaixo do mínimo nem reduz acima do máximo', () => {
        expect(() => calcular(0.001, 0.001, 10000)).toThrow();
        expect(() => calcular(10000, 10000, 0.001)).toThrow();
        expect(() => calcular(0.001, 0.999, 1)).toThrow();
    });
});
const id = '10000000-0000-4000-8000-000000000001';
const app = '10000000-0000-4000-8000-000000000002';
const doc = (extra: any = {}) => ({ schemaVersao: 1, refeicoes: [{ chaveCliente: 'r', nome: 'Almoço', itens: [{ chaveCliente: 'i', alimentoComposicaoId: id, quantidade: 2.5, unidade: 'não confiável', porcaoGramas: 999, medidaCaseira: { id, revisao: 1, aplicacaoId: app }, ...extra }] }] });
describe('FOOD01 materialização separada da biblioteca', () => {
    const fn = () => (contrato as any).resolverMedidasDocumento;
    beforeAll(() => expect(typeof fn()).toBe('function'));
    const resolver = () => jest.fn(async () => ({ referencia: { id, revisao: 1, nome: 'colher', quantidadeReferencia: 1, pesoReferenciaGramas: 25 } }));
    it('usa somente referência resolvida pelo servidor e não peso/nome do cliente', async () => {
        const d = doc(), r = resolver();
        const mapa = await fn()(d, {}, r);
        expect(d.refeicoes[0].itens[0]).toMatchObject({ unidade: 'colher', porcaoGramas: 62.5 });
        expect(mapa.i).toMatchObject({ alimentoId: id, aplicacaoId: app });
        expect(r).toHaveBeenCalledTimes(1);
    });
    it('save posterior mantém referência confiável após editar/desativar biblioteca', async () => {
        const primeiro = doc();
        const mapa = await fn()(primeiro, {}, resolver());
        const segundo = doc({ quantidade: 3 });
        const semBiblioteca = jest.fn(() => { throw new Error('Não consultar biblioteca'); });
        await fn()(segundo, mapa, semBiblioteca);
        expect(segundo.refeicoes[0].itens[0].porcaoGramas).toBe(75);
        expect(semBiblioteca).not.toHaveBeenCalled();
    });
    it('novo nonce, alimento ou chave nunca herda autorização antiga', async () => {
        const mapa = await fn()(doc(), {}, resolver());
        for (const mudanca of [{ chaveCliente: 'novo' }, { alimentoComposicaoId: '10000000-0000-4000-8000-000000000003' }, { medidaCaseira: { id, revisao: 1, aplicacaoId: '10000000-0000-4000-8000-000000000004' } }]) {
            const r = jest.fn(async () => { throw new Error('Acesso revogado'); });
            await expect(fn()(doc(mudanca), mapa, r)).rejects.toThrow('Acesso revogado');
        }
    });
    it('ausência legada preserva referência só se identidade e fatos forem iguais', async () => {
        const original = doc();
        const mapa = await fn()(original, {}, resolver());
        const item = original.refeicoes[0].itens[0];
        delete (item as any).medidaCaseira;
        const r = resolver();
        await fn()(original, mapa, r);
        expect((item as any).medidaCaseira).toEqual({ id, revisao: 1, aplicacaoId: app });
        const manual = doc({ medidaCaseira: undefined, unidade: 'g', porcaoGramas: 20 });
        expect(await fn()(manual, mapa, r)).toEqual({});
        expect(manual.refeicoes[0].itens[0].porcaoGramas).toBe(20);
    });
    it('linha incompleta mantém intenção e ausência de peso, sem inventar zero', async () => {
        const d = doc({ quantidade: '' });
        await fn()(d, {}, resolver());
        expect(d.refeicoes[0].itens[0].porcaoGramas).toBeUndefined();
    });
    it('null desliga referência mantendo os mesmos fatos e não a restaura depois', async () => {
        const original = doc();
        const mapa = await fn()(original, {}, resolver());
        const item = original.refeicoes[0].itens[0];
        (item as any).medidaCaseira = null;
        expect(await fn()(original, mapa, resolver())).toEqual({});
        expect((item as any).medidaCaseira).toBeNull();
        expect(item.porcaoGramas).toBe(62.5);
    });
    it('remoção de item limpa contexto, impedindo replay posterior', async () => {
        const mapa = await fn()(doc(), {}, resolver());
        expect(await fn()({ schemaVersao: 1, refeicoes: [] }, mapa, resolver())).toEqual({});
    });
});
describe('FOOD02 medidas com pai personalizado', () => {
  it('converte e preserva snapshot custom sem fingir FK de catálogo', async () => {
    const d: any = doc({ alimentoComposicaoId: undefined, alimentoPersonalizado: { id, revisao: 1, aplicacaoId: app } });
    const resolver = jest.fn(async () => ({ referencia: { id, revisao: 1, nome: 'colher', quantidadeReferencia: 1, pesoReferenciaGramas: 25 } }));
    const mapa = await contrato.resolverMedidasDocumento(d, {}, resolver);
    expect(d.refeicoes[0].itens[0].porcaoGramas).toBe(62.5);
    expect(mapa.i).toHaveProperty('origemAlimento', 'custom');
    const proximo: any = JSON.parse(JSON.stringify(d)); proximo.refeicoes[0].itens[0].quantidade = 3;
    await contrato.resolverMedidasDocumento(proximo, mapa, async () => { throw new Error('Não reler biblioteca'); });
    expect(proximo.refeicoes[0].itens[0].porcaoGramas).toBe(75);
  });
  it('não reaproveita referência de catálogo em pai custom com mesmo UUID', async () => {
    const resolver = async () => ({ referencia: { id, revisao: 1, nome: 'colher', quantidadeReferencia: 1, pesoReferenciaGramas: 25 } });
    const anterior = await contrato.resolverMedidasDocumento(doc() as any, {}, resolver);
    const d: any = doc({ alimentoComposicaoId: undefined, alimentoPersonalizado: { id, revisao: 1, aplicacaoId: app } });
    await expect(contrato.resolverMedidasDocumento(d, anterior, async () => { throw new Error('Acesso atual negado'); })).rejects.toThrow('Acesso atual negado');
  });
});
