import { projetarComposicao } from './projecao-composicao';
describe('FOOD02 projeção factual explícita', () => {
  it('não confia em tipos para ocultar campos privados em níveis aninhados', () => {
    const r = projetarComposicao({ origem: 'custom', descricao: 'Produto', profissionalId: 'privado', aplicacaoId: 'privado',
      nutrientesPor100g: { energiaKcal: 100, tenantId: 'privado' }, nutrientesPorcao: { energiaKcal: 50 },
      composicaoInformada: { baseGramas: 100, normalizacaoVersao: 'v1', referencia: 'Informada', id: 'privado', nutrientes: { energiaKcal: 100, owner: 'privado' }, micronutrientes: { ferroMg: 1, chave: 'privado' } },
      micronutrientes: { schemaVersao: 1, mapeamentoVersao: 'v1', baseGramasOrigem: 100, porcaoGramas: 50, segredo: 'privado', nutrientes: { ferroMg: { estado: 'conhecido', porcao: 0.5, owner: 'privado' }, privado: 'privado' } } } as any);
    expect(JSON.stringify(r)).not.toContain('privado');
    expect(r.nutrientesPor100g).toEqual({ energiaKcal: 100 });
    expect(r.composicaoInformada?.micronutrientes).toEqual({ ferroMg: 1 });
    expect(r.micronutrientes?.nutrientes.ferroMg.porcao).toBe(0.5);
  });
  it('preserva ordem/valores do snapshot legado para não mudar seu hash', () => {
    const legado = { origem: 'manual', descricao: 'Manual', nutrientesPor100g: { energiaKcal: 100 }, nutrientesPorcao: { energiaKcal: 50 } };
    expect(JSON.stringify(projetarComposicao(legado as any))).toBe(JSON.stringify(legado));
  });
});
