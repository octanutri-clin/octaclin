import { analisarCoberturaDietetica } from './cobertura-dietetica';
import { calcularNutrientesCombinados, type EntradaPlanoCombinado } from './calculo-combinado';
import { criarSnapshotMicronutrientes, CODIGOS_MICRONUTRIENTES } from './micronutrientes';
const item = (calcio?: number) => ({ micronutrientes: criarSnapshotMicronutrientes(calcio === undefined ? {} : { calcioMg: { estado: 'conhecido', valor: calcio } }, 100, 100) });
const plano = (itens: unknown[]): EntradaPlanoCombinado => ({ planoId: 'plano-sintetico', ativo: true, selecionado: true, refeicoes: [{ identidadeId: 'refeicao-sintetica', ativa: true, selecionada: true, itens }] });

describe('FOOD06 Onda A1 cobertura aditiva sobre PA06', () => {
  it('preserva zero conhecido e desconhecido por nutriente', () => {
    const r = analisarCoberturaDietetica([plano([item(0), item()])]);
    expect(r.nutrientes.calcioMg).toMatchObject({ estado: 'PARCIAL', quantidadeConhecida: 0, contagens: { incluidos: 2, conhecidos: 1, semComposicao: 1, incompativeis: 0, naoResolvidos: 0 }, causas: [{ codigo: 'ausente', quantidade: 1 }] });
    expect(r.nutrientes.calcioMg).not.toHaveProperty('total');
    expect(r.nutrientes.ferroMg).toMatchObject({ estado: 'DESCONHECIDO' });
    expect(r.nutrientes.ferroMg).not.toHaveProperty('quantidadeConhecida');
  });
  it('total completo reconcilia com a PA06 sem recalcular quantidade da porção', () => {
    const p = plano([item(0.1), item(0.2)]);
    const original = JSON.stringify(p);
    const base = calcularNutrientesCombinados([p]);
    expect(analisarCoberturaDietetica([p]).nutrientes.calcioMg).toMatchObject({ estado: 'COMPLETO', total: base.nutrientes.calcioMg.total, causas: [] });
    expect(JSON.stringify(p)).toBe(original);
  });
  it.each(['traco', 'nao_analisado', 'abaixo_loq', 'em_reavaliacao', 'duplicado', 'invalido', 'unidade_incompativel', 'definicao_incompativel', 'estado-futuro'])('preserva causa %s sem convertê-la em zero', estado => {
    const desconhecido = item();
    desconhecido.micronutrientes.nutrientes.calcioMg = { estado: estado as never };
    const r = analisarCoberturaDietetica([plano([item(5), desconhecido])]).nutrientes.calcioMg;
    const incompat = ['unidade_incompativel', 'definicao_incompativel'].includes(estado);
    expect(r.estado).toBe(incompat ? 'INCOMPATIVEL' : 'PARCIAL');
    expect(r.quantidadeConhecida).toBe(5);
    expect(r.causas).toEqual([{ codigo: estado === 'estado-futuro' ? 'estado_nao_suportado' : estado, quantidade: 1 }]);
    expect(r).not.toHaveProperty('total');
    expect(r.contagens.conhecidos + r.contagens.semComposicao + r.contagens.incompativeis + r.contagens.naoResolvidos).toBe(2);
  });
  it.each([null, 7, [], false])('campo de nutriente malformado %s não é ausência', valor => {
    const errado = item();
    Object.assign(errado.micronutrientes.nutrientes, { calcioMg: valor });
    const r = analisarCoberturaDietetica([plano([item(5), errado])]).nutrientes.calcioMg;
    expect(r).toMatchObject({ estado: 'PARCIAL', quantidadeConhecida: 5,
      contagens: { conhecidos: 1, semComposicao: 0, naoResolvidos: 1 }, causas: [{ codigo: 'invalido', quantidade: 1 }] });
    expect(r).not.toHaveProperty('total');
  });
  it('registros legados não viram falha técnica nem zero', () => {
    const r = analisarCoberturaDietetica([plano([{}])]).nutrientes.calcioMg;
    expect(r).toMatchObject({ estado: 'DESCONHECIDO', causas: [{ codigo: 'legado_sem_composicao', quantidade: 1 }] });
    expect(r).not.toHaveProperty('total');
  });
  it.each([null, { micronutrientes: { schemaVersao: 99 } }])('formato não interpretável tem impedimento técnico, preservando subtotal independente', registro => {
    const r = analisarCoberturaDietetica([plano([item(7), registro])]).nutrientes.calcioMg;
    expect(r.estado).toBe('INDISPONIVEL');
    expect(r.quantidadeConhecida).toBe(7);
  });
  it.each([-1, NaN, Infinity, '7'])('valor conhecido inválido %s é não resolvido', porcao => {
    const errado = item(1); Object.assign(errado.micronutrientes.nutrientes.calcioMg, { porcao });
    const r = analisarCoberturaDietetica([plano([errado])]).nutrientes.calcioMg;
    expect(r).toMatchObject({ estado: 'DESCONHECIDO', contagens: { conhecidos: 0, naoResolvidos: 1 } });
    expect(r).not.toHaveProperty('total');
  });
  it('seleção vazia não inventa total zero', () => {
    const r = analisarCoberturaDietetica([]);
    expect(Object.keys(r.nutrientes)).toEqual(CODIGOS_MICRONUTRIENTES);
    expect(r.nutrientes.calcioMg).toMatchObject({ estado: 'INDISPONIVEL', causas: [{ codigo: 'sem_componentes', quantidade: 0 }] });
    expect(r.nutrientes.calcioMg).not.toHaveProperty('total');
  });
  it('exclui OFF, não conta alternativas disponíveis e não deduplica alimento repetido legítimo', () => {
    const p = plano([{ ...item(2), substituicoes: [item(100)] }, item(2)]);
    expect(analisarCoberturaDietetica([p]).nutrientes.calcioMg.total).toBe(4);
    p.refeicoes.push({ identidadeId: 'outra', ativa: false, selecionada: true, itens: [null] });
    expect(analisarCoberturaDietetica([p]).nutrientes.calcioMg.estado).toBe('COMPLETO');
    p.ativo = false;
    expect(analisarCoberturaDietetica([p]).nutrientes.calcioMg.contagens.incluidos).toBe(0);
  });
  it('projeção não carrega descrições ou campos clínicos arbitrários', () => {
    const r = analisarCoberturaDietetica([plano([{ ...item(3), descricao: 'canario-sintetico', contextoInterno: 'canario-sintetico' }])]);
    expect(JSON.stringify(r)).not.toContain('canario-sintetico');
  });
});
