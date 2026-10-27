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

describe('FOOD04 proveniência interna',()=>{
  it.each(['catalogo','manual','custom'])('omite origemGrupo de snapshot %s sem alterar os nutrientes',origem=>{
    const r=projetarComposicao({origem,descricao:'Alimento',origemGrupo:{grupoId:'privado'},nutrientesPor100g:{energiaKcal:100},nutrientesPorcao:{energiaKcal:50}}as any);
    expect(r).not.toHaveProperty('origemGrupo');expect(r.nutrientesPorcao.energiaKcal).toBe(50);
  });
});

describe('FOOD05 cálculo interno não é dado do portal/PDF',()=>{
 it.each(['catalogo','manual','custom'])('omite contexto e campos privados aninhados em %s',origem=>{
  const r=projetarComposicao({origem,descricao:'Alimento',equivalencia:{ator:'PRIVADO_FOOD05'},snapshotAlternativa:{segredo:'PRIVADO_FOOD05'},origemGrupo:{grupoId:'PRIVADO_FOOD05'},fonte:{codigo:'sintetica',versao:'1',interno:'PRIVADO_FOOD05'},nutrientesPor100g:{energiaKcal:100,equivalencia:'PRIVADO_FOOD05'},nutrientesPorcao:{energiaKcal:50,segredo:'PRIVADO_FOOD05'}}as any);
  expect(JSON.stringify(r)).not.toContain('PRIVADO_FOOD05');expect(r.nutrientesPorcao.energiaKcal).toBe(50);
 });
});
