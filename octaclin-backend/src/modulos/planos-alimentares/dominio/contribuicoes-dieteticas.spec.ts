import { decomporContribuicoesDieteticas } from './contribuicoes-dieteticas';
import { analisarCoberturaDietetica } from './cobertura-dietetica';
import { type EntradaPlanoCombinado } from './calculo-combinado';
import { criarSnapshotMicronutrientes, somarEscala8, CODIGOS_MICRONUTRIENTES } from './micronutrientes';
const item = (calcio?: number) => ({ quantidade: 250, micronutrientes: criarSnapshotMicronutrientes(calcio === undefined ? {} : { calcioMg: { estado: 'conhecido', valor: calcio } }, 100, 100) });
const refeicao = (identidadeId: string, itens: unknown[]) => ({ identidadeId, ativa: true, selecionada: true, itens });
const plano = (refeicoes: EntradaPlanoCombinado['refeicoes'], planoId = 'plano-sintetico'): EntradaPlanoCombinado => ({ planoId, ativo: true, selecionado: true, refeicoes });

describe('FOOD06 M02 contribuições internas sobre a PA06', () => {
  it('reconcilia seleção, refeições e itens sem multiplicar novamente a porção congelada', () => {
    const entrada = [plano([refeicao('a', [item(0.1), item(0.2)]), refeicao('b', [item(0.7)])])];
    const r = decomporContribuicoesDieteticas(entrada, 'calcioMg');
    expect(r.cobertura).toEqual(analisarCoberturaDietetica(entrada).nutrientes.calcioMg);
    expect(r.cobertura.total).toBe(1);
    expect(r.refeicoes.map(m => m.cobertura.total)).toEqual([0.3, 0.7]);
    expect(r.refeicoes[0].itens.map(i => [i.indiceItem, i.cobertura.total])).toEqual([[0, 0.1], [1, 0.2]]);
    expect(r.refeicoes[0].participacaoSelecaoPercentual).toBe(30);
    expect(r.refeicoes[0].itens[0].participacaoSelecaoPercentual).toBe(10);
    expect(r.refeicoes[0].itens[0].participacaoRefeicaoPercentual).toBe(33.33333333);
  });
  it('não chama subtotal parcial de total nem calcula sua participação no total real', () => {
    const r = decomporContribuicoesDieteticas([plano([refeicao('a', [item(4)]), refeicao('b', [item(3), item()])])], 'calcioMg');
    expect(r.cobertura).toMatchObject({ estado: 'PARCIAL', quantidadeConhecida: 7 });
    expect(r.cobertura).not.toHaveProperty('total');
    for (const m of r.refeicoes) {
      expect(m).not.toHaveProperty('participacaoSelecaoPercentual');
      for (const i of m.itens) expect(i).not.toHaveProperty('participacaoSelecaoPercentual');
    }
    expect(r.refeicoes[0].itens[0].participacaoRefeicaoPercentual).toBe(100);
    expect(r.refeicoes[1].itens[0]).not.toHaveProperty('participacaoRefeicaoPercentual');
    expect(r.refeicoes[1].itens[1].cobertura.estado).toBe('DESCONHECIDO');
  });
  it('preserva zero conhecido, mas não divide por denominador zero', () => {
    const r = decomporContribuicoesDieteticas([plano([refeicao('a', [item(0), item(0)])])], 'calcioMg');
    expect(r.cobertura).toMatchObject({ estado: 'COMPLETO', total: 0 });
    expect(r.refeicoes[0]).not.toHaveProperty('participacaoSelecaoPercentual');
    expect(r.refeicoes[0].itens[0]).not.toHaveProperty('participacaoRefeicaoPercentual');
    const positivo = decomporContribuicoesDieteticas([plano([refeicao('a', [item(0), item(1)])])], 'calcioMg');
    expect(positivo.refeicoes[0].itens[0].participacaoSelecaoPercentual).toBe(0);
  });
  it('não acessa itens de plano/refeição OFF ou não selecionados', () => {
    const proibida = { ...refeicao('off', []), get itens(): unknown[] { throw new Error('não ler'); } };
    const entrada = [plano([])];
    // Descritores mantêm a armadilha; spread executaria o getter no próprio setup.
    const off = Object.create(null); Object.defineProperties(off, Object.getOwnPropertyDescriptors(proibida)); off.ativa = false;
    entrada[0].refeicoes = [refeicao('on', [item(2)]), off];
    const fora = plano([], 'fora'); fora.ativo = false;
    Object.defineProperty(fora, 'refeicoes', { get() { throw new Error('não ler plano'); } });
    const naoSelecionado = plano([], 'não-selecionado'); naoSelecionado.selecionado = false;
    Object.defineProperty(naoSelecionado, 'refeicoes', { get() { throw new Error('não ler plano'); } });
    const r = decomporContribuicoesDieteticas([...entrada, fora, naoSelecionado], 'calcioMg');
    expect(r.cobertura.total).toBe(2);
    expect(r.refeicoes.map(m => m.identidadeRefeicao)).toEqual(['on']);
  });
  it('preserva repetições legítimas e ignora alternativas apenas disponíveis', () => {
    const principal = { ...item(2), substituicoes: [item(100)], nutrientesPor100g: { calcioMg: 999 } };
    const r = decomporContribuicoesDieteticas([plano([refeicao('a', [principal]), refeicao('b', [principal])])], 'calcioMg');
    expect(r.cobertura.total).toBe(4);
    expect(r.refeicoes).toHaveLength(2);
    expect(r.refeicoes.map(m => m.itens.length)).toEqual([1, 1]);
  });
  it('não colide identidades de refeição iguais em planos distintos', () => {
    const r = decomporContribuicoesDieteticas([plano([refeicao('a', [item(1)])], 'p1'), plano([refeicao('a', [item(2)])], 'p2')], 'calcioMg');
    expect(r.refeicoes.map(m => [m.planoId, m.identidadeRefeicao, m.cobertura.total])).toEqual([['p1', 'a', 1], ['p2', 'a', 2]]);
  });
  it.each([null, { micronutrientes: { schemaVersao: 99 } }, { micronutrientes: criarSnapshotMicronutrientes({}, 100, 100) }])('preserva cobertura/cause por componente %j', desconhecido => {
    const r = decomporContribuicoesDieteticas([plano([refeicao('a', [item(3), desconhecido])])], 'calcioMg');
    expect(r.refeicoes[0].cobertura).toEqual(r.cobertura);
    expect(r.refeicoes[0].itens[1].cobertura).toEqual(analisarCoberturaDietetica([plano([refeicao('x', [desconhecido])])]).nutrientes.calcioMg);
    expect(r.refeicoes[0].itens[1]).not.toHaveProperty('participacaoRefeicaoPercentual');
  });
  it('preserva incompatibilidades sem inventar percentual para o subtotal', () => {
    const invalido = { micronutrientes: criarSnapshotMicronutrientes({}, 100, 100) };
    Object.assign(invalido.micronutrientes.nutrientes, { calcioMg: { estado: 'unidade_incompativel' } });
    const r = decomporContribuicoesDieteticas([plano([refeicao('a', [item(2), invalido])])], 'calcioMg');
    expect(r.cobertura.estado).toBe('INCOMPATIVEL');
    expect(r.refeicoes[0].itens[1].cobertura.estado).toBe('INCOMPATIVEL');
    expect(r.refeicoes[0].itens[0]).not.toHaveProperty('participacaoRefeicaoPercentual');
  });
  it('mantém refeição ativa vazia identificável sem inventar total zero', () => {
    const r = decomporContribuicoesDieteticas([plano([refeicao('vazia', [])])], 'calcioMg');
    expect(r.refeicoes).toHaveLength(1);
    expect(r.refeicoes[0].cobertura).toMatchObject({ estado: 'INDISPONIVEL', causas: [{ codigo: 'sem_componentes', quantidade: 0 }] });
    expect(r.refeicoes[0].itens).toEqual([]);
  });
  it('trata posições vazias de array interno como snapshots desconhecidos, sem falsa completude', () => {
    const itens: unknown[] = [item(1)]; itens.length = 2;
    const entrada = [plano([refeicao('a', itens)])];
    const r = decomporContribuicoesDieteticas(entrada, 'calcioMg');
    expect(r.cobertura).toMatchObject({ estado: 'INDISPONIVEL', quantidadeConhecida: 1,
      contagens: { incluidos: 2, conhecidos: 1, naoResolvidos: 1 } });
    expect(r.refeicoes[0].itens).toHaveLength(2);
    expect(r.refeicoes[0].itens[1]).toMatchObject({ indiceItem: 1,
      cobertura: { estado: 'INDISPONIVEL', causas: [{ codigo: 'snapshot_indisponivel', quantidade: 1 }] } });
    expect(JSON.parse(JSON.stringify(r.refeicoes[0].itens))[1]).not.toBeNull();
  });
  it('rejeita código desconhecido inclusive propriedades de protótipo', () => {
    for (const codigo of ['inventado', '__proto__', 'constructor', null]) {
      expect(() => decomporContribuicoesDieteticas([], codigo as never)).toThrow('Micronutriente inválido.');
    }
  });
  it('rejeita excesso de itens e overflow como a PA06', () => {
    expect(() => decomporContribuicoesDieteticas([plano([refeicao('a', Array(10001).fill(item(1)))])], 'calcioMg')).toThrow('Limite de itens');
    const excesso = item(1); Object.assign(excesso.micronutrientes.nutrientes.calcioMg, { porcao: 1e100 });
    expect(() => decomporContribuicoesDieteticas([plano([refeicao('a', [excesso])])], 'calcioMg')).toThrow();
  });
  it('projeta somente números/causas/identificadores internos e não altera a entrada', () => {
    const p = [plano([refeicao('a', [{ ...item(1), contextoClinico: 'canario-sintetico', descricao: 'canario-sintetico' }])])];
    const antes = JSON.stringify(p);
    const r = decomporContribuicoesDieteticas(p, 'calcioMg');
    expect(r.refeicoes).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain('canario-sintetico');
    expect(JSON.stringify(p)).toBe(antes);
  });
  it('conserva somas/contagens para todos os nutrientes e parcelas decimais sintéticas', () => {
    const p = [plano([refeicao('a', [item(0.12345678), item(0.00000001)]), refeicao('b', [item(0.2)])])];
    for (const codigo of CODIGOS_MICRONUTRIENTES) {
      const r = decomporContribuicoesDieteticas(p, codigo);
      expect(r.cobertura).toEqual(analisarCoberturaDietetica(p).nutrientes[codigo]);
      expect(r.refeicoes.reduce((n, m) => n + m.cobertura.contagens.incluidos, 0)).toBe(3);
      if (r.cobertura.total !== undefined) {
        expect(somarEscala8(r.refeicoes.map(m => m.cobertura.total!))).toBe(r.cobertura.total);
        expect(somarEscala8(r.refeicoes.flatMap(m => m.itens.map(i => i.cobertura.total!)))).toBe(r.cobertura.total);
      }
    }
  });
});
