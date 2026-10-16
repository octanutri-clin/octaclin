import { calcularNutrientesCombinados, EntradaPlanoCombinado } from './calculo-combinado';
import { criarSnapshotMicronutrientes } from './micronutrientes';
const refeicao = (identidadeId: string, energia: number, ferro?: number, calcio = 0) => ({
  identidadeId, ativa: true, selecionada: true,
  itens: [{ nutrientesPorcao: { energiaKcal: energia, proteinasG: energia / 10, carboidratosG: energia / 5, gordurasG: energia / 20 },
    micronutrientes: criarSnapshotMicronutrientes({ calcioMg: { estado: 'conhecido' as const, valor: calcio }, ...(ferro === undefined ? {} : { ferroMg: { estado: 'conhecido' as const, valor: ferro } }) }, 100, 100) }]
});
const plano = (): EntradaPlanoCombinado => ({ planoId: 'plano', ativo: true, selecionado: true, refeicoes: [refeicao('A', 100, 1), refeicao('B', 200, undefined, 20)] });

describe('cálculo combinado sobre snapshots de porção', () => {
  it('confere oráculo sintético e cobertura por nutriente sem substituir ausências por zero', () => {
    const r = calcularNutrientesCombinados([plano()]);
    expect(r.estado).toBe('calculado');
    expect(r.itensIncluidos).toBe(2);
    expect(r.nutrientes.energiaKcal).toMatchObject({ estado: 'completo', total: 300, itensComValor: 2, itensIncluidos: 2 });
    expect(r.nutrientes.proteinasG.total).toBe(30);
    expect(r.nutrientes.carboidratosG.total).toBe(60);
    expect(r.nutrientes.gordurasG.total).toBe(15);
    expect(r.nutrientes.calcioMg).toMatchObject({ estado: 'completo', total: 20, itensComValor: 2 });
    expect(r.nutrientes.ferroMg).toMatchObject({ estado: 'parcial', quantidadeConhecida: 1, itensComValor: 1, itensIncluidos: 2 });
    expect(r.nutrientes.ferroMg).not.toHaveProperty('total');
    expect(r.nutrientes.selenioMcg.estado).toBe('indisponivel');
  });
  it('OFF exclui contribuição sem perder a seleção e ON reinclui', () => {
    const p = plano(); p.refeicoes[1].ativa = false;
    expect(calcularNutrientesCombinados([p]).nutrientes.ferroMg).toMatchObject({ estado: 'completo', total: 1 });
    expect(calcularNutrientesCombinados([p]).nutrientes.calcioMg.total).toBe(0);
    p.refeicoes[1].ativa = true;
    expect(calcularNutrientesCombinados([p]).nutrientes.energiaKcal.total).toBe(300);
  });
  for (const ativo of [false, true]) for (const selecionado of [false, true]) for (const ativa of [false, true]) for (const selecionada of [false, true]) {
    it(`aplica quatro predicados ${ativo}/${selecionado}/${ativa}/${selecionada}`, () => {
      const p = plano(); Object.assign(p, { ativo, selecionado });
      p.refeicoes = [{ ...p.refeicoes[0], ativa, selecionada }];
      const r = calcularNutrientesCombinados([p]);
      expect(r.itensIncluidos).toBe(ativo && selecionado && ativa && selecionada ? 1 : 0);
      if (!r.itensIncluidos) expect(r.nutrientes.energiaKcal).not.toHaveProperty('total');
    });
  }
  it('distingue seleção vazia e seleção sem itens efetivos', () => {
    expect(calcularNutrientesCombinados([]).estado).toBe('sem_selecao');
    const p = plano(); p.ativo = false;
    expect(calcularNutrientesCombinados([p]).estado).toBe('sem_itens_incluidos');
  });
  it('conta snapshot ilegível na cobertura e não lê itens excluídos', () => {
    const p = plano(); p.refeicoes[0].itens.push(null);
    expect(calcularNutrientesCombinados([p]).nutrientes.energiaKcal).toMatchObject({ estado: 'parcial', quantidadeConhecida: 300, itensComValor: 2, itensIncluidos: 3 });
    p.ativo = false;
    Object.defineProperty(p.refeicoes[0], 'itens', { get: () => { throw new Error('Não ler OFF'); } });
    expect(() => calcularNutrientesCombinados([p])).not.toThrow();
  });
  it('não recalcula legados, não conta substituições e não aceita schema/valores inválidos', () => {
    const p = plano();
    p.refeicoes[0].itens = [{ nutrientesPorcao: { energiaKcal: 10 }, substituicoes: [{ nutrientesPorcao: { energiaKcal: 999 } }] }];
    p.refeicoes[1].itens = [{ nutrientesPorcao: { energiaKcal: NaN }, micronutrientes: { schemaVersao: 99 } }];
    const r = calcularNutrientesCombinados([p]);
    expect(r.nutrientes.energiaKcal).toMatchObject({ estado: 'parcial', quantidadeConhecida: 10 });
    expect(r.nutrientes.calcioMg.estado).toBe('indisponivel');
    expect(JSON.stringify(r)).not.toContain('substituicoes');
  });
  it('recusa overflow em vez de devolver total truncado', () => {
    const p = plano(); p.refeicoes[0].itens = [{ nutrientesPorcao: { energiaKcal: 90071992 } }, { nutrientesPorcao: { energiaKcal: 90071992 } }];
    expect(() => calcularNutrientesCombinados([p])).toThrow('Limite');
  });
});
