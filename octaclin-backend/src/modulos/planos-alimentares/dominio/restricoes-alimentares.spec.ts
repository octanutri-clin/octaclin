import {
  avaliarItem, avaliarReceita, compararPreviaComAplicacao, RestricoesInvalidasError,
  type AcaoAplicar, type AvaliacaoEntrada, type EntradaAvaliacao, type ItemEntrada, type MapeamentoEntrada,
  type RegraEntrada, type RelacaoMapeamento, type RestricaoEntrada, type ResultadoRestricao
} from './restricoes-alimentares';

/**
 * FOOD06 P1a (T8, contrato v2): motor de avaliação de restrições em domínio puro. Só dados sintéticos.
 * A matriz de decisão da seção 5.1 do contrato é a tabela de casos; as propriedades de segurança são
 * conferidas contra um predicado escrito à parte, sobre o produto cartesiano dos estados.
 */
const AGORA = '2026-11-12T12:00:00.000Z';
const VALIDA = '2027-05-01T00:00:00.000Z';
const VENCIDA = '2026-10-01T00:00:00.000Z';
const CANARIO = 'CANARIO_RESTRICAO_NAO_VAZAR';

const alvo = (id = 'alvo-a') => ({ tipo: 'alergeno' as const, id });
const restricao = (extra: Partial<RestricaoEntrada> = {}): RestricaoEntrada => ({
  id: 'r1', revisao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: alvo(), estado: 'ativa', confirmacao: 'confirmada', ...extra
});
const avaliacao = (extra: Partial<AvaliacaoEntrada> = {}): AvaliacaoEntrada => ({ situacao: 'restricoes_registradas', revisao: 1, venceEm: VALIDA, ...extra });
const mapeamento = (relacao: RelacaoMapeamento, extra: Partial<MapeamentoEntrada> = {}): MapeamentoEntrada => ({
  alvoId: 'alvo-a', relacao, versaoMapeamento: 'map-v1', cobertura: 'suficiente', ...(relacao === 'nao_contem_confirmado' ? { evidenciaReferencia: 'evid-1' } : {}), ...extra
});
const regra = (extra: Partial<RegraEntrada> = {}): RegraEntrada => ({
  subtipo: 'alergia_alimentar', acaoContem: 'impedir', acaoPodeConter: 'exigir_esclarecimento', versaoRegra: 'regra-v1', validadaPor: 'responsavel-1', validadaEm: '2026-11-01', ...extra
});
const item = (mapeamentos: MapeamentoEntrada[] = [], extra: Partial<ItemEntrada> = {}): ItemEntrada => ({ id: 'item-1', composicaoHash: 'hash-1', mapeamentos, ...extra });
function entrada(extra: Partial<EntradaAvaliacao> = {}): EntradaAvaliacao {
  return { agora: AGORA, restricoes: [restricao()], avaliacao: avaliacao(), regras: [regra()], item: item(), ...extra };
}
const individuo = (e: EntradaAvaliacao, id = 'r1') => avaliarItem(e).individuais.find(i => i.restricaoId === id)!;

describe('FOOD06 P1a: matriz de decisão do contrato v2 (seção 5.1)', () => {
  type Linha = { n: number; nome: string; e: EntradaAvaliacao; resultado: ResultadoRestricao; motivo?: string; acao: AcaoAplicar };
  const celiaca = (extra: Partial<RestricaoEntrada> = {}) => restricao({ subtipoClinico: 'doenca_ou_condicao_com_restricao', ...extra });
  const regraCeliaca = regra({ subtipo: 'doenca_ou_condicao_com_restricao' });
  const linhas: Linha[] = [
    { n: 1, nome: 'alergia confirmada, contém, regra validada', e: entrada({ item: item([mapeamento('contem')]) }), resultado: 'conflita', acao: 'impedido' },
    { n: 2, nome: 'alergia confirmada, contém, sem regra validada', e: entrada({ regras: [], item: item([mapeamento('contem')]) }), resultado: 'indeterminado', motivo: 'regra_nao_validada', acao: 'exige_revisao' },
    { n: 3, nome: 'doença celíaca confirmada, contém glúten, regra validada', e: entrada({ restricoes: [celiaca()], regras: [regraCeliaca], item: item([mapeamento('contem')]) }), resultado: 'conflita', acao: 'impedido' },
    { n: 4, nome: 'alergia confirmada, pode conter, regra validada', e: entrada({ item: item([mapeamento('pode_conter')]) }), resultado: 'pode_conflitar', acao: 'exige_esclarecimento' },
    { n: 5, nome: 'intolerância confirmada, contém, tolerância validada', e: entrada({ restricoes: [restricao({ subtipoClinico: 'intolerancia_alimentar' })], regras: [regra({ subtipo: 'intolerancia_alimentar', acaoContem: 'exigir_confirmacao' })], item: item([mapeamento('contem')]) }), resultado: 'conflita', acao: 'exige_confirmacao' },
    { n: 6, nome: 'intolerância confirmada, contém, tolerância não validada', e: entrada({ restricoes: [restricao({ subtipoClinico: 'intolerancia_alimentar' })], regras: [], item: item([mapeamento('contem')]) }), resultado: 'indeterminado', motivo: 'regra_nao_validada', acao: 'exige_revisao' },
    { n: 7, nome: 'não contém confirmado, avaliação válida', e: entrada({ item: item([mapeamento('nao_contem_confirmado')]) }), resultado: 'sem_conflito_registrado', acao: 'permitido' },
    { n: 8, nome: 'não contém confirmado, avaliação vencida', e: entrada({ avaliacao: avaliacao({ venceEm: VENCIDA }), item: item([mapeamento('nao_contem_confirmado')]) }), resultado: 'indeterminado', motivo: 'avaliacao_vencida', acao: 'exige_revisao' },
    { n: 8, nome: 'não contém confirmado, avaliação não informada', e: entrada({ avaliacao: avaliacao({ situacao: 'nao_informado', venceEm: undefined }), item: item([mapeamento('nao_contem_confirmado')]) }), resultado: 'indeterminado', motivo: 'avaliacao_nao_informada', acao: 'exige_revisao' },
    { n: 9, nome: 'restrição confirmada, item sem classificação', e: entrada({ item: item([]) }), resultado: 'indeterminado', motivo: 'alimento_sem_classificacao', acao: 'exige_revisao' },
    { n: 10, nome: 'declaração pendente, item contém o alvo', e: entrada({ restricoes: [restricao({ confirmacao: 'pendente' })], item: item([mapeamento('contem')]) }), resultado: 'indeterminado', motivo: 'declaracao_pendente', acao: 'exige_revisao' },
    { n: 11, nome: 'declaração pendente, sem relação com o item', e: entrada({ restricoes: [restricao({ confirmacao: 'pendente' })], item: item([]) }), resultado: 'indeterminado', motivo: 'declaracao_pendente', acao: 'permitido' },
    { n: 12, nome: 'em reavaliação continua valendo', e: entrada({ restricoes: [restricao({ estado: 'em_reavaliacao' })], item: item([mapeamento('contem')]) }), resultado: 'conflita', acao: 'impedido' },
    { n: 13, nome: 'escolha confirmada, item contém o alvo', e: entrada({ restricoes: [restricao({ natureza: 'escolha', subtipoClinico: undefined, alvo: { tipo: 'categoria_escolha', id: 'alvo-a' } })], regras: [], item: item([mapeamento('contem')]) }), resultado: 'incompatibilidade_escolha', acao: 'exige_confirmacao' },
    { n: 14, nome: 'preferência, mesmo com o alvo presente', e: entrada({ restricoes: [restricao({ natureza: 'preferencia', subtipoClinico: undefined })], regras: [], item: item([mapeamento('contem')]) }), resultado: 'sem_efeito_clinico', acao: 'permitido' },
    { n: 15, nome: 'alvo não catalogado, clínica confirmada', e: entrada({ restricoes: [restricao({ alvo: { tipo: 'nao_catalogado' } })], item: item([mapeamento('contem')]) }), resultado: 'indeterminado', motivo: 'alvo_nao_catalogado', acao: 'exige_revisao' },
    { n: 16, nome: 'nenhuma restrição, avaliação não informada', e: entrada({ restricoes: [], avaliacao: avaliacao({ situacao: 'nao_informado', venceEm: undefined }) }), resultado: 'indeterminado', motivo: 'avaliacao_nao_informada', acao: 'permitido' }
  ];
  it.each(linhas)('linha $n: $nome', ({ e, resultado, motivo, acao }) => {
    const r = avaliarItem(e);
    const alvoDaLinha = r.individuais[0];
    if (alvoDaLinha) {
      expect(alvoDaLinha.resultado).toBe(resultado);
      expect(alvoDaLinha.motivo).toBe(motivo);
      expect(alvoDaLinha.acaoAplicar).toBe(acao);
    }
    expect(r.agregado.resultado).toBe(resultado);
    expect(r.agregado.acaoAplicar).toBe(acao);
    if (motivo) expect(r.agregado.motivos).toContain(motivo);
  });
});

describe('FOOD06 P1a: propriedades de segurança sobre o produto cartesiano', () => {
  const naturezas: [RestricaoEntrada['natureza'], RestricaoEntrada['subtipoClinico']][] = [
    ['clinica', 'alergia_alimentar'], ['clinica', 'intolerancia_alimentar'], ['clinica', 'doenca_ou_condicao_com_restricao'],
    ['clinica', 'outra_restricao_clinica'], ['escolha', undefined], ['preferencia', undefined]
  ];
  const confirmacoes: RestricaoEntrada['confirmacao'][] = ['pendente', 'confirmada', 'rejeitada'];
  const estados: RestricaoEntrada['estado'][] = ['ativa', 'em_reavaliacao', 'inativa'];
  const mapeamentos: (MapeamentoEntrada | undefined)[] = [
    undefined, mapeamento('contem'), mapeamento('pode_conter'), mapeamento('nao_contem_confirmado'),
    mapeamento('nao_contem_confirmado', { evidenciaReferencia: undefined }), mapeamento('nao_contem_confirmado', { cobertura: 'insuficiente' })
  ];
  const avaliacoes: AvaliacaoEntrada[] = [
    avaliacao(), avaliacao({ venceEm: VENCIDA }), avaliacao({ situacao: 'nao_informado', venceEm: undefined }),
    avaliacao({ situacao: 'sem_restricoes_confirmadas' }), avaliacao({ venceEm: undefined })
  ];
  const regrasPossiveis: RegraEntrada[][] = [[], [regra(), regra({ subtipo: 'intolerancia_alimentar', acaoContem: 'exigir_confirmacao' }), regra({ subtipo: 'doenca_ou_condicao_com_restricao' })]];

  const todos: { e: EntradaAvaliacao; rotulo: string }[] = [];
  for (const [natureza, subtipoClinico] of naturezas) for (const confirmacao of confirmacoes) for (const estado of estados)
    for (const m of mapeamentos) for (const [ia, av] of avaliacoes.entries()) for (const [ir, regras] of regrasPossiveis.entries()) {
      const r = restricao({ natureza, subtipoClinico, confirmacao, estado });
      todos.push({ e: entrada({ restricoes: [r], avaliacao: av, regras, item: item(m ? [m] : []) }), rotulo: `${natureza}/${subtipoClinico}/${confirmacao}/${estado}/m${mapeamentos.indexOf(m)}/a${ia}/r${ir}` });
    }

  /** Predicado escrito à parte: quando `sem_conflito_registrado` é permitido. */
  function podeSerSemConflito(e: EntradaAvaliacao): boolean {
    const r = e.restricoes[0], m = e.item.mapeamentos[0], av = e.avaliacao;
    if (r.estado === 'inativa' || r.confirmacao === 'rejeitada') return false; // ignorada: o agregado vem da avaliação global
    if (r.natureza === 'preferencia') return false;
    if (r.confirmacao !== 'confirmada') return false;
    if (!m || m.relacao !== 'nao_contem_confirmado' || !m.evidenciaReferencia || m.cobertura !== 'suficiente') return false;
    return av.situacao === 'restricoes_registradas' && av.venceEm !== undefined && av.venceEm > AGORA;
  }

  it(`${todos.length} combinações: sem_conflito_registrado só quando o predicado independente permite`, () => {
    const violacoes: string[] = [];
    for (const { e, rotulo } of todos) {
      const r = avaliarItem(e);
      const semConflito = r.individuais.some(i => i.resultado === 'sem_conflito_registrado') || r.agregado.resultado === 'sem_conflito_registrado';
      const ignorada = e.restricoes[0].estado === 'inativa' || e.restricoes[0].confirmacao === 'rejeitada';
      if (!ignorada && semConflito && !podeSerSemConflito(e)) violacoes.push(`indevido ${rotulo}`);
      if (!ignorada && !semConflito && podeSerSemConflito(e)) violacoes.push(`faltou ${rotulo}`);
    }
    expect(violacoes.slice(0, 5)).toEqual([]);
  });

  it('motor inerte: sem regra validada, nunca conflita nem impede', () => {
    for (const { e, rotulo } of todos.filter(t => t.e.regras.length === 0)) {
      const r = avaliarItem(e);
      expect([rotulo, r.agregado.resultado === 'conflita', r.agregado.resultado === 'pode_conflitar', r.agregado.acaoAplicar === 'impedido', r.agregado.acaoAplicar === 'exige_esclarecimento'])
        .toEqual([rotulo, false, false, false, false]);
    }
  });

  it('preferência nunca produz conflito, bloqueio ou revisão', () => {
    for (const { e, rotulo } of todos.filter(t => t.e.restricoes[0].natureza === 'preferencia' && t.e.restricoes[0].confirmacao !== 'rejeitada' && t.e.restricoes[0].estado !== 'inativa')) {
      const i = avaliarItem(e).individuais[0];
      expect([rotulo, i.resultado === 'sem_efeito_clinico' || i.resultado === 'indeterminado', i.acaoAplicar === 'permitido']).toEqual([rotulo, true, true]);
      expect(['conflita', 'pode_conflitar', 'incompatibilidade_escolha']).not.toContain(i.resultado);
    }
  });

  it('restrição inativa ou rejeitada não entra na avaliação individual', () => {
    for (const { e } of todos.filter(t => t.e.restricoes[0].estado === 'inativa' || t.e.restricoes[0].confirmacao === 'rejeitada')) {
      expect(avaliarItem(e).individuais).toEqual([]);
    }
  });

  it('em_reavaliacao e ativa produzem exatamente o mesmo resultado', () => {
    for (const { e } of todos.filter(t => t.e.restricoes[0].estado === 'ativa')) {
      const igual = avaliarItem(entrada({ ...e, restricoes: [{ ...e.restricoes[0], estado: 'em_reavaliacao' }] }));
      expect(igual.individuais).toEqual(avaliarItem(e).individuais);
      expect(igual.agregado).toEqual(avaliarItem(e).agregado);
    }
  });

  it('gravidade nunca altera resultado nem ação', () => {
    const base = entrada({ item: item([mapeamento('contem')]) });
    const resultados = (['leve', 'moderada', 'grave', 'nao_informada', undefined] as const)
      .map(gravidade => avaliarItem({ ...base, restricoes: [restricao({ gravidade })] }).agregado);
    for (const r of resultados) expect(r).toEqual(resultados[0]);
    expect(resultados[0].acaoAplicar).toBe('impedido');
  });
});

describe('FOOD06 P1a: várias restrições, agregação e precedência', () => {
  const duas = (relacaoA: RelacaoMapeamento, relacaoB: RelacaoMapeamento) => entrada({
    restricoes: [restricao({ id: 'rA', alvo: alvo('alvo-a') }), restricao({ id: 'rB', alvo: alvo('alvo-b') })],
    item: item([mapeamento(relacaoA, { alvoId: 'alvo-a' }), mapeamento(relacaoB, { alvoId: 'alvo-b' })])
  });
  it('o sem conflito de um alvo nunca esconde o conflito de outro', () => {
    const r = avaliarItem(duas('nao_contem_confirmado', 'contem'));
    expect(r.individuais.map(i => [i.restricaoId, i.resultado])).toEqual([['rA', 'sem_conflito_registrado'], ['rB', 'conflita']]);
    expect(r.agregado.resultado).toBe('conflita');
    expect(r.agregado.acaoAplicar).toBe('impedido');
  });
  it('a ação agregada é a mais restritiva mesmo quando a menos grave vem primeiro', () => {
    const e = entrada({
      restricoes: [restricao({ id: 'a1', alvo: alvo('alvo-a') }), restricao({ id: 'b2', alvo: alvo('alvo-b') })],
      item: item([mapeamento('contem', { alvoId: 'alvo-b' })])
    });
    const r = avaliarItem(e);
    expect(r.individuais.map(i => [i.restricaoId, i.acaoAplicar])).toEqual([['a1', 'exige_revisao'], ['b2', 'impedido']]);
    expect(r.agregado.acaoAplicar).toBe('impedido');
  });
  it('a avaliação vence no instante exato de venceEm (não vale mais)', () => {
    const noInstante = entrada({ avaliacao: avaliacao({ venceEm: AGORA }), item: item([mapeamento('nao_contem_confirmado')]) });
    expect(individuo(noInstante)).toMatchObject({ resultado: 'indeterminado', motivo: 'avaliacao_vencida' });
    const umMsDepois = entrada({ avaliacao: avaliacao({ venceEm: '2026-11-12T12:00:00.001Z' }), item: item([mapeamento('nao_contem_confirmado')]) });
    expect(individuo(umMsDepois).resultado).toBe('sem_conflito_registrado');
  });
  it('o agregado só é sem_conflito_registrado se todas as restrições confirmadas deram sem conflito', () => {
    expect(avaliarItem(duas('nao_contem_confirmado', 'nao_contem_confirmado')).agregado.resultado).toBe('sem_conflito_registrado');
    expect(avaliarItem(duas('nao_contem_confirmado', 'pode_conter')).agregado.resultado).toBe('pode_conflitar');
  });
  it('a ordem conflita > pode_conflitar > incompatibilidade_escolha > indeterminado > sem_conflito vale em qualquer ordem de entrada', () => {
    const e = entrada({
      restricoes: [
        restricao({ id: 'c', alvo: alvo('alvo-c') }),
        restricao({ id: 'e', natureza: 'escolha', subtipoClinico: undefined, alvo: { tipo: 'categoria_escolha', id: 'alvo-e' } }),
        restricao({ id: 'p', alvo: alvo('alvo-p') }),
        restricao({ id: 'i', alvo: alvo('alvo-i') })
      ],
      item: item([mapeamento('contem', { alvoId: 'alvo-c' }), mapeamento('contem', { alvoId: 'alvo-e' }), mapeamento('pode_conter', { alvoId: 'alvo-p' })])
    });
    const ordens = [[0, 1, 2, 3], [3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1]];
    const ref = avaliarItem(e);
    for (const o of ordens) {
      const r = avaliarItem({ ...e, restricoes: o.map(k => e.restricoes[k]) });
      expect(r.agregado).toEqual(ref.agregado);
      expect([...r.individuais].sort((x, y) => x.restricaoId.localeCompare(y.restricaoId))).toEqual([...ref.individuais].sort((x, y) => x.restricaoId.localeCompare(y.restricaoId)));
      expect(r.impressao).toBe(ref.impressao);
    }
    expect(ref.agregado.resultado).toBe('conflita');
    const semConflito = avaliarItem({ ...e, restricoes: [e.restricoes[1], e.restricoes[2], e.restricoes[3]] });
    expect(semConflito.agregado.resultado).toBe('pode_conflitar');
    expect(avaliarItem({ ...e, restricoes: [e.restricoes[1], e.restricoes[3]] }).agregado.resultado).toBe('incompatibilidade_escolha');
    expect(avaliarItem({ ...e, restricoes: [e.restricoes[3]] }).agregado.resultado).toBe('indeterminado');
  });
  it('sem restrições e avaliação "sem restrições" válida: sem conflito registrado; vencida: indeterminado sem bloquear', () => {
    const valida = avaliarItem(entrada({ restricoes: [], avaliacao: avaliacao({ situacao: 'sem_restricoes_confirmadas' }) }));
    expect(valida.agregado.resultado).toBe('sem_conflito_registrado');
    const vencida = avaliarItem(entrada({ restricoes: [], avaliacao: avaliacao({ situacao: 'sem_restricoes_confirmadas', venceEm: VENCIDA }) }));
    expect(vencida.agregado).toMatchObject({ resultado: 'indeterminado', acaoAplicar: 'permitido' });
    expect(vencida.agregado.motivos).toContain('avaliacao_vencida');
  });
  it('avaliação "sem restrições" com restrição confirmada ativa é inconsistente e nunca vira sem conflito', () => {
    const r = avaliarItem(entrada({ avaliacao: avaliacao({ situacao: 'sem_restricoes_confirmadas' }), item: item([mapeamento('nao_contem_confirmado')]) }));
    expect(r.avaliacaoValida).toBe(false);
    expect(r.agregado.resultado).toBe('indeterminado');
    expect(r.agregado.motivos).toContain('avaliacao_inconsistente');
  });
  it('restrição confirmada vencida continua gerando conflita e pode_conflitar (só some o sem conflito)', () => {
    const e = entrada({ avaliacao: avaliacao({ venceEm: VENCIDA }), item: item([mapeamento('contem')]) });
    expect(avaliarItem(e).agregado).toMatchObject({ resultado: 'conflita', acaoAplicar: 'impedido' });
  });
  it('ingrediente não identificado: indeterminado com motivo próprio e revisão para restrição clínica', () => {
    const r = avaliarItem(entrada({ item: item([], { ingredienteIdentificado: false }) }));
    expect(r.individuais[0]).toMatchObject({ resultado: 'indeterminado', motivo: 'ingrediente_nao_identificado', acaoAplicar: 'exige_revisao' });
  });
  it('regra mais específica por alvo vence a regra do subtipo', () => {
    const e = entrada({
      restricoes: [restricao({ subtipoClinico: 'intolerancia_alimentar' })],
      regras: [regra({ subtipo: 'intolerancia_alimentar', acaoContem: 'exigir_revisao' }), regra({ subtipo: 'intolerancia_alimentar', alvoId: 'alvo-a', acaoContem: 'exigir_confirmacao', versaoRegra: 'regra-alvo' })],
      item: item([mapeamento('contem')])
    });
    expect(individuo(e)).toMatchObject({ resultado: 'conflita', acaoAplicar: 'exige_confirmacao', regraVersao: 'regra-alvo' });
  });
  it('regra sem validadaPor ou validadaEm é ignorada', () => {
    for (const parcial of [{ validadaPor: '' }, { validadaEm: '' }]) {
      const e = entrada({ regras: [regra(parcial)], item: item([mapeamento('contem')]) });
      expect(individuo(e)).toMatchObject({ resultado: 'indeterminado', motivo: 'regra_nao_validada' });
    }
  });
  it('mapeamentos duplicados e conflitantes para o mesmo alvo ficam com a relação mais conservadora', () => {
    const e = entrada({ item: item([mapeamento('nao_contem_confirmado'), mapeamento('contem', { versaoMapeamento: 'map-v2' })]) });
    expect(individuo(e).resultado).toBe('conflita');
  });
  it('registra a versão do mapeamento e da regra usadas na decisão', () => {
    const e = entrada({ item: item([mapeamento('contem', { versaoMapeamento: 'map-v7' })]), regras: [regra({ versaoRegra: 'regra-v9' })] });
    expect(individuo(e)).toMatchObject({ mapeamentoVersao: 'map-v7', regraVersao: 'regra-v9' });
  });
});

describe('FOOD06 P1a: receita (NUX-09) e prévia × aplicar (C6, C7)', () => {
  const ing = (id: string, mapeamentos: MapeamentoEntrada[], extra: Partial<ItemEntrada> = {}) => item(mapeamentos, { id, ...extra });
  const base = () => { const { item: _semItem, ...resto } = entrada(); return resto; };
  it('aponta o ingrediente exato e a restrição que causam o conflito', () => {
    const r = avaliarReceita({ ...base(), ingredientes: [ing('farinha', [mapeamento('nao_contem_confirmado')]), ing('molho', [mapeamento('contem')]), ing('sal', [])] });
    expect(r.agregado.resultado).toBe('conflita');
    expect(r.focos).toEqual([{ ingredienteId: 'molho', restricaoId: 'r1', resultado: 'conflita', acaoAplicar: 'impedido' }]);
    expect(r.porIngrediente.map(i => [i.itemId, i.agregado.resultado])).toEqual([['farinha', 'sem_conflito_registrado'], ['molho', 'conflita'], ['sal', 'indeterminado']]);
  });
  it('um ingrediente industrial sem composição torna a receita indeterminada, nunca sem conflito', () => {
    const r = avaliarReceita({ ...base(), ingredientes: [ing('a', [mapeamento('nao_contem_confirmado')]), ing('industrial', [], { ingredienteIdentificado: false })] });
    expect(r.agregado.resultado).toBe('indeterminado');
    expect(r.agregado.motivos).toContain('ingrediente_nao_identificado');
  });
  it('receita sem ingredientes é entrada inválida', () => {
    expect(() => avaliarReceita({ ...base(), ingredientes: [] })).toThrow(RestricoesInvalidasError);
  });
  it('mesma entrada: prévia e aplicar coincidem', () => {
    const e = entrada({ item: item([mapeamento('contem')]) });
    expect(compararPreviaComAplicacao(avaliarItem(e), avaliarItem(e))).toEqual({ estado: 'igual' });
  });
  it.each([
    ['nova revisão da restrição', (e: EntradaAvaliacao) => ({ ...e, restricoes: [{ ...e.restricoes[0], revisao: 2 }] })],
    ['versão do mapeamento', (e: EntradaAvaliacao) => ({ ...e, item: item([mapeamento('contem', { versaoMapeamento: 'map-v2' })]) })],
    ['versão da regra', (e: EntradaAvaliacao) => ({ ...e, regras: [regra({ versaoRegra: 'regra-v2' })] })],
    ['composição do alimento', (e: EntradaAvaliacao) => ({ ...e, item: item([mapeamento('contem')], { composicaoHash: 'hash-2' }) })],
    ['avaliação vencida entre a prévia e o aplicar', (e: EntradaAvaliacao) => ({ ...e, agora: '2027-06-01T00:00:00.000Z' })],
    ['revisão da avaliação global', (e: EntradaAvaliacao) => ({ ...e, avaliacao: avaliacao({ revisao: 2 }) })]
  ])('mudança em %s entre a prévia e o aplicar exige nova revisão', (_nome, muda) => {
    const e = entrada({ item: item([mapeamento('contem')]) });
    expect(compararPreviaComAplicacao(avaliarItem(e), avaliarItem(muda(e)))).toMatchObject({ estado: 'mudou', exigeNovaRevisao: true });
  });
  it('a impressão não depende do tempo quando nada muda e muda com a entrada', () => {
    const e = entrada({ item: item([mapeamento('contem')]) });
    expect(avaliarItem(e).impressao).toBe(avaliarItem({ ...e, agora: '2026-11-13T00:00:00.000Z' }).impressao);
    expect(avaliarItem(e).impressao).not.toBe(avaliarItem({ ...e, restricoes: [{ ...e.restricoes[0], revisao: 2 }] }).impressao);
    expect(avaliarItem(e).impressao).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('FOOD06 P1a: entrada fechada, sem mutação e sem vazamento', () => {
  it('não altera a entrada e é determinístico', () => {
    const e = entrada({ item: item([mapeamento('contem')]) });
    const copia = JSON.parse(JSON.stringify(e));
    const congelar = (o: unknown): void => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(congelar); } };
    congelar(e);
    const a = avaliarItem(e), b = avaliarItem(e);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(e))).toEqual(copia);
  });
  it.each([
    ['chave extra na raiz', (e: any) => ({ ...e, extra: 1 })],
    ['chave extra na restrição', (e: any) => ({ ...e, restricoes: [{ ...e.restricoes[0], observacao: CANARIO }] })],
    ['natureza desconhecida', (e: any) => ({ ...e, restricoes: [{ ...e.restricoes[0], natureza: CANARIO }] })],
    ['gravidade em escolha', (e: any) => ({ ...e, restricoes: [restricao({ natureza: 'escolha', subtipoClinico: undefined, gravidade: 'grave' })] })],
    ['subtipo em escolha', (e: any) => ({ ...e, restricoes: [restricao({ natureza: 'escolha', subtipoClinico: 'alergia_alimentar' })] })],
    ['clínica sem subtipo', (e: any) => ({ ...e, restricoes: [restricao({ subtipoClinico: undefined })] })],
    ['ids repetidos', (e: any) => ({ ...e, restricoes: [restricao(), restricao()] })],
    ['alvo catalogado sem id', (e: any) => ({ ...e, restricoes: [restricao({ alvo: { tipo: 'alergeno' } })] })],
    ['agora inválido', (e: any) => ({ ...e, agora: 'ontem' })],
    ['venceEm inválido', (e: any) => ({ ...e, avaliacao: avaliacao({ venceEm: 'amanhã' }) })],
    ['relação desconhecida', (e: any) => ({ ...e, item: item([{ ...mapeamento('contem'), relacao: CANARIO as never }]) })],
    ['chave extra no mapeamento', (e: any) => ({ ...e, item: item([{ ...mapeamento('contem'), fonteBruta: CANARIO } as never]) })],
    ['regra de alergia que não impede', (e: any) => ({ ...e, regras: [regra({ acaoContem: 'exigir_confirmacao' })] })],
    ['regra de alergia fraca para pode conter', (e: any) => ({ ...e, regras: [regra({ acaoPodeConter: 'exigir_revisao' })] })],
    ['entrada que não é objeto', () => null],
    ['restrições que não são lista', (e: any) => ({ ...e, restricoes: 'x' })],
    ['mais restrições que o limite', (e: any) => ({ ...e, restricoes: Array.from({ length: 201 }, (_, i) => restricao({ id: `r${i}` })) })]
  ])('recusa %s sem ecoar o conteúdo', (_nome, muda) => {
    const e = entrada({ item: item([mapeamento('contem')]) });
    let erro: unknown;
    try { avaliarItem(muda(e)); } catch (x) { erro = x; }
    expect(erro).toBeInstanceOf(RestricoesInvalidasError);
    expect(String((erro as Error).message)).not.toContain('CANARIO');
    expect(JSON.stringify(erro)).not.toContain('CANARIO');
  });
  it('a evidência e o hash de composição não são ecoados; só o que a decisão usou aparece', () => {
    const e = entrada({ item: item([mapeamento('nao_contem_confirmado', { evidenciaReferencia: CANARIO })], { composicaoHash: `${CANARIO}-hash` }) });
    const saida = JSON.stringify(avaliarItem(e));
    expect(saida).not.toContain('CANARIO');
  });
  it('declara que é avaliação e nunca autorização ou diagnóstico', () => {
    const r = avaliarItem(entrada());
    expect(r).toMatchObject({ schemaVersao: 1, motorVersao: 'food06-restricoes-v1', natureza: 'avaliacao_nao_gravada' });
    expect(JSON.stringify(r)).not.toMatch(/seguro|liberado|adequado|diagn/i);
  });
});
