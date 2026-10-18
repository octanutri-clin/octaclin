import { randomUUID } from 'crypto';
import { normalizarComposicaoPersonalizada } from './alimentos-personalizados';
import { resolverAlimentosPersonalizados, capturarFatosCustom, validarContextosCustom } from './aplicacao-alimentos-personalizados';
import { validarDocumentoEdicaoPlano } from './edicao-plano';
const id = randomUUID(), nonce = randomUUID();
const comp = () => normalizarComposicaoPersonalizada({ nome: 'Arroz', base: { tipo: 'porcao', pesoGramas: 30 }, nutrientes: { energiaKcal: 90, proteinasG: 3, carboidratosG: 12, gordurasG: 3 } });
const doc = (): any => ({ schemaVersao: 1, refeicoes: [{ chaveCliente: 'r', itens: [{ chaveCliente: 'i', alimentoPersonalizado: { id, revisao: 1, aplicacaoId: nonce }, descricao: 'forjado', nutrientesPor100g: { energiaKcal: 999 }, quantidade: 2, unidade: 'porção', porcaoGramas: 60 }] }] });
const obter = async () => ({ id, revisao: 1, composicao: comp() });
describe('FOOD02 intenção editorial e snapshot autoritativo', () => {
  it('aceita descriptor mínimo ou null e recusa catálogo simultâneo/metadados extras', () => {
    expect(validarDocumentoEdicaoPlano(doc()).refeicoes[0].itens[0]).toHaveProperty('alimentoPersonalizado', { id, revisao: 1, aplicacaoId: nonce });
    const manual = doc(); manual.refeicoes[0].itens[0].alimentoPersonalizado = null;
    expect(validarDocumentoEdicaoPlano(manual)).toBeDefined();
    for (const v of [{ id: 'x', revisao: 1, aplicacaoId: nonce }, { id, revisao: 0, aplicacaoId: nonce }, { id, revisao: 1, aplicacaoId: nonce, composicao: comp() }]) {
      const d = doc(); d.refeicoes[0].itens[0].alimentoPersonalizado = v;
      expect(() => validarDocumentoEdicaoPlano(d)).toThrow();
    }
    const d = doc(); d.refeicoes[0].itens[0].alimentoComposicaoId = randomUUID();
    expect(() => validarDocumentoEdicaoPlano(d)).toThrow();
  });
  it('substitui composição do cliente e preserva revisão sem reler biblioteca', async () => {
    const d = doc(), ctx = await resolverAlimentosPersonalizados(d, {}, obter);
    expect(d.refeicoes[0].itens[0]).toMatchObject({ descricao: 'Arroz', nutrientesPor100g: { energiaKcal: 300 } });
    capturarFatosCustom(d, ctx);
    const outro = doc(); outro.refeicoes[0].itens[0].quantidade = 3;
    const r = await resolverAlimentosPersonalizados(outro, ctx, async () => { throw new Error('Biblioteca inacessível'); });
    expect(r.i.composicao.nutrientesPor100g.energiaKcal).toBe(300);
    expect(outro.refeicoes[0].itens[0].nutrientesPor100g.energiaKcal).toBe(300);
  });
  it('omissão legada só preserva com fatos iguais, null desvincula e remoção limpa', async () => {
    const d = doc(), ctx = await resolverAlimentosPersonalizados(d, {}, obter); capturarFatosCustom(d, ctx);
    delete d.refeicoes[0].itens[0].alimentoPersonalizado;
    expect((await resolverAlimentosPersonalizados(d, ctx, obter)).i.aplicacaoId).toBe(nonce);
    delete d.refeicoes[0].itens[0].alimentoPersonalizado;
    d.refeicoes[0].itens[0].nutrientesPor100g.energiaKcal = 100;
    await expect(resolverAlimentosPersonalizados(d, ctx, obter)).rejects.toThrow(/confer|alterad/i);
    d.refeicoes[0].itens[0].alimentoPersonalizado = null;
    expect(await resolverAlimentosPersonalizados(d, ctx, obter)).toEqual({});
    d.refeicoes[0].itens = [];
    expect(await resolverAlimentosPersonalizados(d, ctx, obter)).toEqual({});
  });
  it('nova linha ou nonce exige autorização atual e não aceita snapshot reaproveitado', async () => {
    const d = doc(), ctx = await resolverAlimentosPersonalizados(d, {}, obter);
    const outra = doc(); outra.refeicoes[0].itens[0].chaveCliente = 'outra';
    await expect(resolverAlimentosPersonalizados(outra, ctx, async () => { throw new Error('negado'); })).rejects.toThrow('negado');
    const novo = doc(); novo.refeicoes[0].itens[0].alimentoPersonalizado.aplicacaoId = randomUUID();
    await expect(resolverAlimentosPersonalizados(novo, ctx, async () => { throw new Error('negado'); })).rejects.toThrow('negado');
  });
  it('valida o schema e a composição do mapa cifrado antes de preservar', async () => {
    const ctx = await resolverAlimentosPersonalizados(doc(), {}, obter);
    expect(validarContextosCustom({ schemaVersao: 1, contextos: ctx })).toEqual(ctx);
    for (const v of [{ schemaVersao: 2, contextos: ctx }, { schemaVersao: 1, contextos: [] }, { schemaVersao: 1, contextos: { i: { ...ctx.i, composicao: {} } } }]) expect(() => validarContextosCustom(v)).toThrow();
  });
});
