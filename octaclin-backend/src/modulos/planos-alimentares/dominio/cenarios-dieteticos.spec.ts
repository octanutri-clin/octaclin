import { compararCenarios, CenariosInvalidosError, LIMITE_ALTERNATIVAS_CENARIO, type CenarioDietetico } from './cenarios-dieteticos';
import { compararCenariosFactuais } from './previa-dietetica';
import { calcularNutrientesCombinados, type EntradaPlanoCombinado } from './calculo-combinado';
import { analisarCoberturaDietetica } from './cobertura-dietetica';
import { compararAnaliseComReferencias } from './comparacao-referencias';
import { resolverContextoDietetico } from './contexto-dietetico';
import { criarSnapshotMicronutrientes } from './micronutrientes';

// Dados sintéticos. O item tem só o que a PA06 lê; nada de paciente, plano real ou contexto clínico.
const item = (ferro?: number, calcio?: number, energia = 100) => ({
  contextoClinico: 'CANARIO_NAO_PROJETAR', nutrientesPorcao: { energiaKcal: energia, proteinasG: 10, carboidratosG: 20, gordurasG: 2 },
  micronutrientes: criarSnapshotMicronutrientes({
    ...(ferro === undefined ? {} : { ferroMg: { estado: 'conhecido' as const, valor: ferro } }),
    ...(calcio === undefined ? {} : { calcioMg: { estado: 'conhecido' as const, valor: calcio } })
  }, 100, 100)
});
const estado = (itens: unknown[], planoId = 'sintetico'): EntradaPlanoCombinado[] =>
  [{ planoId, ativo: true, selecionado: true, refeicoes: [{ identidadeId: 'refeicao', ativa: true, selecionada: true, itens }] }];
const cenario = (id: string, itens: unknown[], escopo: CenarioDietetico['escopo'] = 'refeicao', rotulo = id): CenarioDietetico => ({ id, rotulo, escopo, estado: estado(itens) });
const contexto = () => resolverContextoDietetico({
  nascimento: '1985-06-15', dataAnalise: '2026-11-03', populacaoReferencia: 'feminina', populacaoConfirmada: true, gestacao: 'nao', lactacao: 'nao',
  aplicabilidade: 'confirmada', mesmoDiaPlanejado: true, tabagismo: 'nao'
});
const original = () => cenario('original', [item(2, 500)]);
const trocaA = () => cenario('troca-a', [item(3, 400)]);
const trocaB = () => cenario('troca-b', [item(1, 900)]);

describe('FOOD06 M12 núcleo de cenários em memória', () => {
  it('compara original × alternativa pelos mesmos totais, cobertura e diferenças da prévia M04', () => {
    const r = compararCenarios({ original: original(), alternativas: [trocaA()] });
    const previa = compararCenariosFactuais(original().estado, trocaA().estado);
    expect(r.original.calculo).toEqual(calcularNutrientesCombinados(original().estado));
    expect(r.original.cobertura).toEqual(analisarCoberturaDietetica(original().estado));
    expect(r.alternativas[0].calculo).toEqual(previa.depois.calculo);
    expect(r.comparacoes[0].diferencas).toEqual(previa.diferencas);
    expect(r.comparacoes[0].diferencas.ferroMg.delta).toMatchObject({ estado: 'calculavel', diferenca: 1 });
    expect(r.comparacoes[0].diferencas.calcioMg.delta).toMatchObject({ estado: 'calculavel', diferenca: -100 });
  });

  it('é uma simulação: declara que nada é gravado e mantém a ordem de entrada', () => {
    const r = compararCenarios({ original: original(), alternativas: [trocaB(), trocaA()] });
    expect(r).toMatchObject({ schemaVersao: 1, motorVersao: 'food06-cenarios-v1', natureza: 'simulacao_nao_gravada' });
    expect(r.alternativas.map(a => a.id)).toEqual(['troca-b', 'troca-a']);
    expect(r.comparacoes.map(c => c.alternativaId)).toEqual(['troca-b', 'troca-a']);
  });

  it('nunca soma alternativas excludentes: cada total é só o do próprio cenário', () => {
    const sozinha = compararCenarios({ original: original(), alternativas: [trocaA()] });
    const juntas = compararCenarios({ original: original(), alternativas: [trocaA(), trocaB()] });
    expect(juntas.alternativas[0]).toEqual(sozinha.alternativas[0]);
    expect(juntas.original).toEqual(sozinha.original);
    expect(juntas.comparacoes[0]).toEqual(sozinha.comparacoes[0]);
    // O total da alternativa B não carrega o ferro do original nem o da A.
    expect(juntas.alternativas[1].calculo.nutrientes.ferroMg.total).toBe(1);
    expect(juntas.alternativas[1].calculo.itensIncluidos).toBe(1);
  });

  it('não altera a entrada nem retém referência a ela', () => {
    const entrada = { original: original(), alternativas: [trocaA()] };
    const antes = JSON.stringify(entrada);
    const r = compararCenarios(entrada);
    expect(JSON.stringify(entrada)).toBe(antes);
    expect(JSON.stringify(r)).not.toContain('CANARIO_NAO_PROJETAR');
    expect(JSON.stringify(r)).not.toContain('contextoClinico');
  });

  it('sinaliza escopos diferentes, cenário sem itens e cobertura incompleta, sem esconder a diferença', () => {
    const r = compararCenarios({ original: original(), alternativas: [
      cenario('dia', [item(3, 400)], 'dia'), cenario('vazio', []), cenario('sem-ferro', [item(undefined, 400)])
    ] });
    expect(r.comparacoes[0].incompatibilidades).toEqual(['escopo_diferente']);
    expect(r.comparacoes[1].incompatibilidades).toContain('cenario_sem_itens');
    expect(r.comparacoes[2].incompatibilidades).toEqual(['cobertura_incompleta']);
    // Desconhecido nos dois lados (os 20 micronutrientes que ninguém informou) não é incompatibilidade.
    expect(compararCenarios({ original: original(), alternativas: [trocaA()] }).comparacoes[0].incompatibilidades).toEqual([]);
    // Ausente não vira zero: ferro sem composição fica indisponível, não "−2 mg".
    expect(r.comparacoes[2].diferencas.ferroMg.delta).toEqual({ estado: 'indisponivel', motivo: 'composicao_incompleta' });
    expect(r.comparacoes[0].incompatibilidades).not.toContain('cobertura_incompleta');
  });

  it('sem contexto, as referências ficam indisponíveis com motivo; com contexto, usa o comparador em lote da T2', () => {
    const sem = compararCenarios({ original: original(), alternativas: [trocaA()] });
    expect(sem.original.referencias).toEqual({ estado: 'indisponivel', motivo: 'contexto_nao_informado' });
    const com = compararCenarios({ original: original(), alternativas: [trocaA()], contexto: contexto() });
    expect(com.original.referencias).toEqual({ estado: 'calculado', ...compararAnaliseComReferencias(calcularNutrientesCombinados(original().estado).nutrientes, contexto()) });
    expect(com.alternativas[0].referencias).toMatchObject({ estado: 'calculado', contextoElegivel: true });
  });

  it('contexto inelegível nunca vira comparação, nos cenários e na lista', () => {
    const inelegivel = resolverContextoDietetico({
      nascimento: '1985-06-15', dataAnalise: '2026-11-03', populacaoReferencia: 'feminina', populacaoConfirmada: true, gestacao: 'sim', lactacao: 'nao',
      aplicabilidade: 'confirmada', mesmoDiaPlanejado: true, tabagismo: 'nao'
    });
    const r = compararCenarios({ original: original(), alternativas: [trocaA()], contexto: inelegivel });
    for (const c of [r.original, ...r.alternativas]) {
      expect(c.referencias).toMatchObject({ estado: 'calculado', contextoElegivel: false });
      expect(JSON.stringify(c.referencias)).not.toContain('"comparavel"');
    }
  });

  describe('validação fechada da entrada', () => {
    const base = () => ({ original: original(), alternativas: [trocaA()] });
    it.each([
      ['sem original', (e: any) => { delete e.original; }],
      ['sem alternativas', (e: any) => { e.alternativas = []; }],
      ['alternativas não é lista', (e: any) => { e.alternativas = 'x'; }],
      ['mais alternativas que o limite', (e: any) => { e.alternativas = Array.from({ length: LIMITE_ALTERNATIVAS_CENARIO + 1 }, (_, i) => cenario(`alt-${i}`, [item(1)])); }],
      ['id repetido entre original e alternativa', (e: any) => { e.alternativas[0].id = 'original'; }],
      ['id repetido entre alternativas', (e: any) => { e.alternativas = [trocaA(), trocaA()]; }],
      ['id fora do formato', (e: any) => { e.alternativas[0].id = 'Troca A!'; }],
      ['rótulo vazio', (e: any) => { e.alternativas[0].rotulo = ''; }],
      ['rótulo longo', (e: any) => { e.alternativas[0].rotulo = 'x'.repeat(81); }],
      ['rótulo com controle', (e: any) => { e.alternativas[0].rotulo = 'a\u0000b'; }],
      ['escopo desconhecido', (e: any) => { e.alternativas[0].escopo = 'semana'; }],
      ['estado não é lista', (e: any) => { e.alternativas[0].estado = {}; }],
      ['chave extra na entrada', (e: any) => { e.totais = {}; }],
      ['chave extra no cenário', (e: any) => { e.alternativas[0].totais = {}; }]
    ])('recusa %s', (_n, alterar) => {
      const e: any = base(); alterar(e);
      expect(() => compararCenarios(e)).toThrow(CenariosInvalidosError);
    });
    it('a mensagem de erro não vaza conteúdo da entrada', () => {
      const e: any = base(); e.alternativas[0].rotulo = 'CANARIO_NAO_ECOAR\u0000';
      try { compararCenarios(e); fail('deveria recusar'); } catch (erro) { expect(String((erro as Error).message)).not.toContain('CANARIO_NAO_ECOAR'); }
    });
    it('aceita exatamente o limite de alternativas', () => {
      const e = { original: original(), alternativas: Array.from({ length: LIMITE_ALTERNATIVAS_CENARIO }, (_, i) => cenario(`alt-${i}`, [item(i + 1)])) };
      expect(compararCenarios(e).alternativas).toHaveLength(LIMITE_ALTERNATIVAS_CENARIO);
    });
  });
});
