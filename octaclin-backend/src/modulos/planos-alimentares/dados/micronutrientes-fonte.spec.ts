import { extrairMicronutrientesFonte, interpretarMicronutrienteCelula } from './micronutrientes-fonte';

const usda = (nutrientsOriginal: unknown[], codigo = 'usda_fdc_sr_legacy', esquema = 'octaclin-composicao-v1') =>
  extrairMicronutrientesFonte(codigo, esquema, { metadadosOrigem: { nutrientsOriginal } });
const item = (id: number, amount: unknown, unitName = 'MG', loq?: number) => ({ nutrient: { id, unitName }, amount, loq });

describe('adapters versionados de micronutrientes', () => {
  it('aceita notação científica numérica da planilha sem converter marcadores em zero', () => {
    expect(interpretarMicronutrienteCelula('2.0333333333333332E-2')).toEqual({estado:'conhecido',valor:0.02033333333333333});
    expect(interpretarMicronutrienteCelula('Tr')).toEqual({estado:'traco'});
  });
  it.each(['usda_fdc_sr_legacy', 'usda_fdc_foundation'])('usa IDs e unidades exatos em %s', codigo => {
    const valores = usda([item(1089, 2), item(1106, 30, 'UG'), item(1105, 5, 'UG'), item(1103, 0, 'UG')], codigo);
    expect(valores.ferroMg).toEqual({ estado: 'conhecido', valor: 2 });
    expect(valores.vitaminaARaeMcg).toEqual({ estado: 'conhecido', valor: 30 });
    expect(valores.retinolMcg).toEqual({ estado: 'conhecido', valor: 5 });
    expect(valores.selenioMcg).toEqual({ estado: 'conhecido', valor: 0 });
    expect(valores.vitaminaAReMcg).toBeUndefined();
  });
  it('não escolhe duplicatas e não converte unidade incompatível', () => {
    const valores = usda([item(1089, 1), item(1089, 2), item(1103, 4, 'MG'), item(1095, 3)]);
    expect(valores.ferroMg?.estado).toBe('duplicado');
    expect(valores.selenioMcg?.estado).toBe('unidade_incompativel');
    expect(valores.zincoMg?.valor).toBe(3);
  });
  it('diferencia zero conhecido, ausência, LOQ e valores inválidos', () => {
    const valores = usda([item(1089, 0, 'MG', 1), item(1087, 0), item(1090, -1), item(1091, null), item(1092, '5'), item(1098, 1, 'MG', NaN)]);
    expect(valores.ferroMg?.estado).toBe('abaixo_loq');
    expect(valores.calcioMg?.valor).toBe(0);
    expect(valores.magnesioMg?.estado).toBe('invalido');
    expect(valores.fosforoMg?.estado).toBe('ausente');
    expect(valores.potassioMg?.estado).toBe('invalido');
    expect(valores.cobreMg?.estado).toBe('invalido');
  });
  it('IBGE aceita cabeçalho oficial e alias sem acento, sem equivalências inferidas', () => {
    const valores = extrairMicronutrientesFonte('ibge_pof_2008_2009', 'octaclin-composicao-v1', { metadadosOrigem: { nutrientesOriginais: {
      ' CALCIO (mg) ': '12,3', 'FERRO (mg)': 0, 'SELÊNIO (mcg)': '-', 'VITAMINA D (calciferol) (mcg)': 5,
      'FOLATO (EQUIVALENTE DIETÉTICO DE FOLATO) (mcg)': 2
    } } });
    expect(valores.calcioMg?.valor).toBe(12.3);
    expect(valores.ferroMg?.valor).toBe(0);
    expect(valores.selenioMcg?.estado).toBe('ausente');
    expect(valores.vitaminaDMcg?.estado).toBe('definicao_incompativel');
    expect(valores.folatoDfeMcg?.valor).toBe(2);
  });
  it('usa somente bloco TACO novo conhecido, validando cada estado/valor', () => {
    const valores = extrairMicronutrientesFonte('taco_nepa_unicamp', 'octaclin-composicao-v2-micros1', { mapeamentoVersao: 'octaclin-micronutrientes-v1', nutrientes: { ferroMg: { estado: 'traco' }, calcioMg: { estado: 'conhecido', valor: 0 }, zincoMg: { estado: 'conhecido', valor: -1 }, desconhecido: { estado: 'conhecido', valor: 2 } } });
    expect(valores.ferroMg?.estado).toBe('traco');
    expect(valores.calcioMg?.valor).toBe(0);
    expect(valores.zincoMg?.estado).toBe('invalido');
    expect(valores).not.toHaveProperty('desconhecido');
  });
  it('recusa aliases IBGE ambíguos e mantém os demais campos', () => {
    const valores = extrairMicronutrientesFonte('ibge_pof_2008_2009', 'octaclin-composicao-v1', { metadadosOrigem: { nutrientesOriginais: { 'CÁLCIO (mg)': 1, 'CALCIO (mg)': 1, 'FERRO (mg)': 2 } } });
    expect(valores.calcioMg?.estado).toBe('duplicado');
    expect(valores.ferroMg?.valor).toBe(2);
  });
  it.each([
    ['fonte_desconhecida', 'octaclin-composicao-v1'], ['usda_fdc_sr_legacy', 'futuro'], ['taco_nepa_unicamp', 'taco-4a-cmvcol-taco3-v1']
  ])('não enriquece fonte/esquema não suportado %s %s', (codigo, esquema) => {
    expect(extrairMicronutrientesFonte(codigo, esquema, { metadadosOrigem: { nutrientsOriginal: [item(1089, 2)] } })).toEqual({});
  });
});
