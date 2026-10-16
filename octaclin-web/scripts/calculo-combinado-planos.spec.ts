import assert from 'node:assert/strict';
import test from 'node:test';
import { atualizarSelecaoCalculo, iniciarSelecaoCalculo, montarEntradaCalculoCombinado } from '../lib/calculo-combinado-planos';
import type { SelecaoCalculoPlanoApi } from '../lib/plano-alimentar-api';
import { formatarNutrientePlano } from '../lib/micronutrientes-plano';

test('PA06 apresentação por nutriente distingue zero de positivo abaixo da resolução', () => {
  assert.equal(formatarNutrientePlano('energiaKcal', 12.5), '13');
  assert.equal(formatarNutrientePlano('proteinasG', 1.25), '1,3');
  assert.equal(formatarNutrientePlano('ferroMg', 0.00001), '<0,01');
  assert.equal(formatarNutrientePlano('ferroMg', 0), '0');
  assert.equal(formatarNutrientePlano('vitaminaCMg', 0.00001), '<0,001');
  assert.equal(formatarNutrientePlano('selenioMcg', 0.00001), '<0,01');
  assert.equal(formatarNutrientePlano('ferroMg', undefined), '—');
});

function api(overrides: Partial<SelecaoCalculoPlanoApi> = {}): SelecaoCalculoPlanoApi {
  return {
    planoId: 'plano-1', ativoParaPaciente: true, ativacaoRevisao: 3,
    versao: { id: 'versao-1', numero: 4, publicadaEm: '2026-10-01T12:00:00Z' },
    refeicoes: [
      { identidadeId: 'refeicao-ativa', nome: 'Café sintético', ordem: 0, ativa: true },
      { identidadeId: 'refeicao-off', nome: 'Lanche sintético', ordem: 1, ativa: false }
    ],
    ...overrides
  };
}

test('PA06 iniciar seleção inclui refeições ativas no instante da seleção e ignora desativadas', () => {
  const selecao = iniciarSelecaoCalculo(api(), 'Plano sintético');
  assert.equal(selecao?.refeicoes[0].selecionada, true);
  assert.equal(selecao?.refeicoes[1].selecionada, false);
  assert.equal(selecao?.ativoParaPaciente, true);
  assert.equal(selecao?.publicadaEm, '2026-10-01T12:00:00Z');
  assert.equal(iniciarSelecaoCalculo(api({ versao: null }), 'Rascunho'), null);
  assert.equal(iniciarSelecaoCalculo(api({ ativoParaPaciente: false }), 'Plano desativado'), null);
});

test('PA06 refresh depois de publicação obsoleta preserva somente identidades ainda selecionadas', () => {
  const antiga = iniciarSelecaoCalculo(api(), 'Plano sintético')!;
  antiga.refeicoes[1].selecionada = true;
  const atualizada = atualizarSelecaoCalculo(antiga, api({
    versao: { id: 'versao-2', numero: 5, publicadaEm: '2026-10-02T12:00:00Z' },
    ativacaoRevisao: 4,
    refeicoes: [
      { identidadeId: 'refeicao-ativa', nome: 'Café alterado', ordem: 0, ativa: false },
      { identidadeId: 'nova-refeicao', nome: 'Nova refeição', ordem: 1, ativa: true }
    ]
  }));
  assert.equal(atualizada?.versaoId, 'versao-2');
  assert.equal(atualizada?.publicadaEm, '2026-10-02T12:00:00Z');
  assert.equal(atualizada?.ativacaoRevisao, 4);
  assert.equal(atualizada?.refeicoes[0].selecionada, true);
  assert.equal(atualizada?.refeicoes[1].selecionada, false);
});

test('PA06 payload contém somente ids, precondições e refeições escolhidas', () => {
  const selecao = iniciarSelecaoCalculo(api(), 'Plano sintético')!;
  const payload = montarEntradaCalculoCombinado([selecao]);
  assert.deepEqual(payload, { selecoes: [{
    planoId: 'plano-1', versaoIdEsperada: 'versao-1', ativacaoRevisaoEsperada: 3,
    identidadesRefeicoes: ['refeicao-ativa']
  }] });
  assert.equal(JSON.stringify(payload).includes('nome'), false);
  assert.equal(JSON.stringify(payload).includes('nutrientes'), false);
  assert.deepEqual(montarEntradaCalculoCombinado([]), { selecoes: [] });
});
