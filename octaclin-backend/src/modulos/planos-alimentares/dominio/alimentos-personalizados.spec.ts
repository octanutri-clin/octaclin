import { normalizarComposicaoPersonalizada } from './alimentos-personalizados';
import { LimitePrecisaoNutricionalError } from './micronutrientes';
const normalizar = (v: unknown) => normalizarComposicaoPersonalizada(v);
const entrada = () => ({ nome: 'Produto sintético', base: { tipo: 'porcao', pesoGramas: 30 }, nutrientes: { energiaKcal: 90, proteinasG: 3, carboidratosG: 12, gordurasG: 3 }, micronutrientes: { ferroMg: 0.6 } });
describe('FOOD02 composição informada', () => {
  it('normaliza macros e micros pela mesma base e preserva entrada original', () => {
    const v = entrada(), r = normalizar(v);
    expect(r.nutrientesPor100g).toEqual({ energiaKcal: 300, proteinasG: 10, carboidratosG: 40, gordurasG: 10 });
    expect(r.micronutrientesPor100g).toEqual({ ferroMg: 2 });
    expect(r.composicaoOrigem).toEqual({ nutrientes: v.nutrientes, micronutrientes: v.micronutrientes });
    expect(r.baseOrigem).toEqual(v.base);
    expect(r.disponivelParaCalculo).toBe(true);
    expect(r.normalizacaoVersao).toBe('octaclin-custom-v1');
    v.nutrientes.energiaKcal = 999;
    expect(r.composicaoOrigem.nutrientes.energiaKcal).toBe(90);
  });
  it('não infere faltantes nem energia a partir de macros; preserva zero', () => {
    const r = normalizar({ nome: 'Parcial', base: { tipo: 'por100g' }, nutrientes: { proteinasG: 0 }, micronutrientes: {} });
    expect(r.nutrientesPor100g).toEqual({ proteinasG: 0 });
    expect(r.micronutrientesPor100g).toEqual({});
    expect(r.baseOrigem).toEqual({ tipo: 'por100g', pesoGramas: 100 });
    expect(r.disponivelParaCalculo).toBe(false);
  });
  it('normaliza uma única vez sem arredondar a razão intermediária', () => {
    expect(normalizar({ nome: 'Razão', base: { tipo: 'porcao', pesoGramas: 3 }, nutrientes: { energiaKcal: 1 } }).nutrientesPor100g.energiaKcal).toBe(33.33333333);
    expect(normalizar({ nome: 'Razão pequena', base: { tipo: 'porcao', pesoGramas: 0.001 }, nutrientes: { energiaKcal: 0.000000001 } }).nutrientesPor100g.energiaKcal).toBe(0.0001);
  });
  it('recusa overflow em vez de truncar a normalização', () => expect(() => normalizar({ ...entrada(), base: { tipo: 'porcao', pesoGramas: 0.001 }, nutrientes: { energiaKcal: 1e8 } })).toThrow(LimitePrecisaoNutricionalError));
  it.each([
    { nome: ' ' }, { nome: 'a'.repeat(241) }, { preparacao: 'a'.repeat(181) }, { referenciaComposicao: 'a'.repeat(241) },
    { base: { tipo: 'ml', pesoGramas: 100 } }, { base: { tipo: 'por100g', pesoGramas: 50 } },
    { base: { tipo: 'porcao' } }, { base: { tipo: 'porcao', pesoGramas: 0 } },
    { base: { tipo: 'porcao', pesoGramas: 10000.001 } }, { base: { tipo: 'porcao', pesoGramas: 0.0001 } },
    { base: { tipo: 'porcao', pesoGramas: '30' } }, { base: { tipo: 'porcao', pesoGramas: 30, unidade: 'ml' } },
    { nutrientes: { energiaKcal: NaN } }, { nutrientes: { energiaKcal: -1 } }, { nutrientes: { energiaKcal: '90' } },
    { nutrientes: { energiaKcal: null } }, { nutrientes: [] }, { nutrientes: { lipidiosG: 3 } },
    { micronutrientes: { vitaminaA: 2 } }, { micronutrientes: { ferroMg: null } }, { micronutrientes: { ferroMg: -1 } },
    { tenantId: 'forjado' }, { fonte: { codigo: 'taco' } }
  ])('recusa entrada inválida/ambígua %#', v => expect(() => normalizar({ ...entrada(), ...v })).toThrow(/inválid|inválida|ambígua/));
});
