import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acrescentarItensDeRefeicao,
  copiarRefeicaoParaFormulario,
  duplicarRefeicaoNoRascunho,
  type RefeicaoFormularioCopia
} from '@/lib/copia-refeicoes-plano';
import type { RefeicaoPlanoAlimentarApi } from '@/lib/plano-alimentar-api';

const nutrientes = {
  energiaKcal: 125,
  proteinasG: 4.5,
  carboidratosG: 20,
  gordurasG: 3,
  fibrasG: 2
};

test('FOOD04 cópia factual entre planos não transplanta a autoridade do grupo', () => {
  const origem = refeicaoApi();
  const alternativa = origem.itens[0].substituicoes[0];
  const referencia = { grupoId: '10000000-0000-4000-8000-000000000051', revisao: 1,
    entradaId: '10000000-0000-4000-8000-000000000052', aplicacaoId: '10000000-0000-4000-8000-000000000053' };
  Object.assign(alternativa.composicaoSnapshot, { origemGrupo: referencia });
  const copia = copiarRefeicaoParaFormulario(origem, gerarChave).itens[0].substituicoes[0];
  assert.equal(Object.hasOwn(copia, 'origemGrupo'), false);
  assert.notEqual(copia.chaveCliente, alternativa.id);
  assert.equal(copia.porcaoGramas, alternativa.porcaoGramas);
  assert.deepEqual(copia.nutrientesPor100g, alternativa.composicaoSnapshot.nutrientesPor100g);
  alternativa.composicaoSnapshot.nutrientesPor100g.energiaKcal = 999;
  assert.notEqual(copia.nutrientesPor100g.energiaKcal, 999);
  assert.equal(referencia.revisao, 1);
});

test('FOOD04 duplicação local mantém fatos independentes e não reutiliza intenção antiga', () => {
  const origem = refeicaoFormulario('origem-grupo');
  const alternativa = { chaveCliente: 'alternativa-grupo', descricao: 'Alternativa sintética',
    quantidade: 1, unidade: 'g', porcaoGramas: 30, nutrientesPor100g: { ...nutrientes },
    preferida: false, liberadaParaPaciente: false };
  origem.itens[0].substituicoes = [alternativa];
  Object.assign(alternativa, { origemGrupo: { grupoId: 'grupo-sintetico', revisao: 1,
    entradaId: 'entrada-sintetica', aplicacaoId: 'acao-sintetica' } });
  const copia = duplicarRefeicaoNoRascunho([origem], 0, gerarChave)[1].itens[0].substituicoes[0];
  assert.equal(Object.hasOwn(copia, 'origemGrupo'), false);
  assert.notEqual(copia.chaveCliente, alternativa.chaveCliente);
  assert.equal(copia.porcaoGramas, alternativa.porcaoGramas);
  assert.deepEqual(copia.nutrientesPor100g, alternativa.nutrientesPor100g);
  assert.ok(Object.hasOwn(alternativa, 'origemGrupo'));
});

function refeicaoApi(id = 'origem-r1'): RefeicaoPlanoAlimentarApi {
  return {
    id,
    ordem: 0,
    nome: 'Lanche sintético',
    horarioLocal: '15:30',
    orientacoes: 'Orientação sintética',
    itens: [{
      id: `${id}-i1`,
      ordem: 0,
      alimentoComposicaoId: 'alimento-catalogo-1',
      descricao: 'Iogurte sintético',
      quantidade: 1,
      unidade: 'pote',
      porcaoGramas: 170,
      composicaoSnapshot: {
        origem: 'catalogo',
        alimentoComposicaoId: 'alimento-catalogo-1',
        descricao: 'Iogurte sintético',
        nutrientesPor100g: { ...nutrientes },
        nutrientesPorcao: { energiaKcal: 212.5, proteinasG: 7.65, carboidratosG: 34, gordurasG: 5.1 }
        ,micronutrientes: {
          schemaVersao: 1,
          mapeamentoVersao: 'octaclin-micronutrientes-v1',
          baseGramasOrigem: 100,
          porcaoGramas: 170,
          nutrientes: { ferroMg: { estado: 'conhecido', valorOrigem: 1, por100g: 1, porcao: 1.7 }, vitaminaDMcg: { estado: 'ausente' } }
        }
      },
      substituicoes: [{
        id: `${id}-s1`,
        ordem: 0,
        descricao: 'Alternativa sintética',
        quantidade: 1,
        unidade: 'unidade',
        porcaoGramas: 30,
        composicaoSnapshot: {
          origem: 'manual',
          descricao: 'Alternativa sintética',
          nutrientesPor100g: { energiaKcal: 80, proteinasG: 2, carboidratosG: 10, gordurasG: 3 },
          nutrientesPorcao: { energiaKcal: 24, proteinasG: 0.6, carboidratosG: 3, gordurasG: 0.9 }
        },
        liberadaParaPaciente: true,
        preferida: false
      }],
      substituicoesVisiveisInicialmente: 1
    }]
  };
}

function refeicaoFormulario(chave = 'destino-r1'): RefeicaoFormularioCopia {
  return {
    chaveCliente: chave,
    nome: 'Refeição de destino',
    horarioLocal: '12:00',
    orientacoes: 'Preservar esta orientação',
    itens: [{
      chaveCliente: `${chave}-item`,
      descricao: 'Item mantido',
      quantidade: 1,
      unidade: 'porção',
      porcaoGramas: 100,
      nutrientesPor100g: { energiaKcal: 1, proteinasG: 1, carboidratosG: 1, gordurasG: 1 },
      substituicoes: []
    }]
  };
}

function gerarChave(prefixo: string) {
  gerarChave.proxima += 1;
  return `${prefixo}-${gerarChave.proxima}`;
}
gerarChave.proxima = 0;

test('FOOD01 duplicar ou acrescentar conserva fatos sem transferir vínculo privado da medida', () => {
  const origem = refeicaoFormulario();
  const vinculo = { id: '10000000-0000-4000-8000-000000000001', revisao: 1, aplicacaoId: '10000000-0000-4000-8000-000000000002' };
  const referencia = { nome: 'Colher pessoal', quantidadeReferencia: 1, pesoReferenciaGramas: 25 };
  Object.assign(origem.itens[0], { unidade: 'Colher pessoal', quantidade: 2, porcaoGramas: 50, medidaCaseira: vinculo, referenciaMedidaCaseira: referencia });
  origem.itens[0].substituicoes.push({ ...origem.itens[0], chaveCliente: 'alternativa', liberadaParaPaciente: true, preferida: false });
  const duplicada = duplicarRefeicaoNoRascunho([origem], 0, gerarChave)[1];
  const acrescentada = acrescentarItensDeRefeicao(refeicaoFormulario('destino'), origem.itens, gerarChave);
  for (const item of [duplicada.itens[0], acrescentada.itens[1]]) {
    for (const alimento of [item, ...item.substituicoes]) {
      assert.equal(alimento.unidade, 'Colher pessoal');
      assert.equal(alimento.porcaoGramas, 50);
      assert.ok(!Object.hasOwn(alimento, 'medidaCaseira'));
      assert.ok(!Object.hasOwn(alimento, 'referenciaMedidaCaseira'));
    }
  }
  assert.equal((origem.itens[0] as typeof origem.itens[0] & { medidaCaseira: unknown }).medidaCaseira, vinculo);
});

test('copia refeição com novos IDs locais e preserva conteúdo clínico editável sem IDs de origem', () => {
  const copia = copiarRefeicaoParaFormulario(refeicaoApi(), gerarChave);
  const item = copia.itens[0];
  const alternativa = item.substituicoes[0];

  assert.equal(copia.nome, 'Lanche sintético');
  assert.equal(copia.horarioLocal, '15:30');
  assert.equal(copia.orientacoes, 'Orientação sintética');
  assert.equal(item.alimentoComposicaoId, 'alimento-catalogo-1');
  assert.equal(item.nutrientesPor100g.fibrasG, 2);
  assert.equal(item.micronutrientesPor100g, undefined);
  assert.equal(alternativa.liberadaParaPaciente, true);
  assert.equal(alternativa.preferida, false);
  assert.equal(item.substituicoesVisiveisInicialmente, 1);
  assert.notEqual(copia.chaveCliente, 'origem-r1');
  assert.notEqual(item.chaveCliente, 'origem-r1-i1');
  assert.notEqual(alternativa.chaveCliente, 'origem-r1-s1');
  assert.equal('id' in copia, false);
  assert.equal('id' in item, false);
  assert.equal('id' in alternativa, false);
});

test('cópia preserva micros manuais sem convertê-los em override de catálogo', () => {
  const manual = refeicaoApi();
  manual.itens[0].alimentoComposicaoId = undefined;
  assert.deepEqual(copiarRefeicaoParaFormulario(manual, gerarChave).itens[0].micronutrientesPor100g, { ferroMg: 1 });
  const catalogo = refeicaoFormulario();
  catalogo.itens[0].alimentoComposicaoId = 'alimento-catalogo-1';
  catalogo.itens[0].micronutrientesPor100g = { ferroMg: 1 };
  assert.equal(duplicarRefeicaoNoRascunho([catalogo], 0, gerarChave)[1].itens[0].micronutrientesPor100g, undefined);
});

test('cópia é profunda e mudanças na origem, destino ou cópia não cruzam', () => {
  const api = refeicaoApi();
  const copia = copiarRefeicaoParaFormulario(api, gerarChave);
  const segundoClone = copiarRefeicaoParaFormulario(api, gerarChave);
  copia.itens[0].nutrientesPor100g.energiaKcal = 999;
  copia.itens[0].substituicoes[0].nutrientesPor100g.energiaKcal = 888;
  assert.equal(api.itens[0].composicaoSnapshot.nutrientesPor100g.energiaKcal, 125);
  assert.equal(segundoClone.itens[0].nutrientesPor100g.energiaKcal, 125);
  assert.notEqual(copia.itens[0].chaveCliente, segundoClone.itens[0].chaveCliente);
  assert.notEqual(copia.itens[0].substituicoes[0].chaveCliente, segundoClone.itens[0].substituicoes[0].chaveCliente);
});

test('rejeita snapshot sem nutrientes essenciais em vez de fabricar zeros', () => {
  const api = refeicaoApi();
  const item = api.itens[0] as unknown as { composicaoSnapshot: { nutrientesPor100g?: object } };
  delete item.composicaoSnapshot.nutrientesPor100g;
  assert.throws(() => copiarRefeicaoParaFormulario(api, gerarChave), /snapshot nutricional incompleto/i);
});

test('duplicação local insere imediatamente depois da origem e limita refeições sem truncar', () => {
  const primeira = refeicaoFormulario('a');
  const segunda = refeicaoFormulario('b');
  const resultado = duplicarRefeicaoNoRascunho([primeira, segunda], 0, gerarChave);
  assert.deepEqual(resultado.map((item) => item.nome), [primeira.nome, primeira.nome, segunda.nome]);
  assert.notEqual(resultado[0].itens[0].chaveCliente, resultado[1].itens[0].chaveCliente);
  const cinquenta = Array.from({ length: 50 }, (_, indice) => refeicaoFormulario(`r-${indice}`));
  assert.throws(() => duplicarRefeicaoNoRascunho(cinquenta, 0, gerarChave), /limite de 50 refeições/i);
  assert.equal(cinquenta.length, 50);
});

test('acrescentar itens conserva cabeçalho e conteúdo do destino, respeitando 100 sem parcial', () => {
  const destino = refeicaoFormulario();
  const itensOrigem = copiarRefeicaoParaFormulario(refeicaoApi(), gerarChave).itens;
  const combinado = acrescentarItensDeRefeicao(destino, itensOrigem, gerarChave);
  assert.equal(combinado.nome, destino.nome);
  assert.equal(combinado.horarioLocal, destino.horarioLocal);
  assert.equal(combinado.orientacoes, destino.orientacoes);
  assert.equal(combinado.itens[0].descricao, 'Item mantido');
  assert.equal(combinado.itens.length, 2);
  const cem = { ...destino, itens: Array.from({ length: 100 }, (_, i) => ({ ...destino.itens[0], chaveCliente: `item-${i}` })) };
  assert.throws(() => acrescentarItensDeRefeicao(cem, itensOrigem, gerarChave), /limite de 100 alimentos/i);
  assert.equal(cem.itens.length, 100);
});

test('respeita máximo real de 20 substituições sem truncamento', () => {
  const api = refeicaoApi();
  api.itens[0].substituicoes = Array.from({ length: 21 }, (_, indice) => ({
    ...api.itens[0].substituicoes[0], id: `s-${indice}`
  }));
  assert.throws(() => copiarRefeicaoParaFormulario(api, gerarChave), /limite de 20 substituições/i);
});

test('PA06 copiar texto numérico válido não trata campo vazio como zero', () => {
  const origem = refeicaoFormulario();
  const editar = (quantidade: string) => ({ ...origem, itens: [{ ...origem.itens[0], quantidade, porcaoGramas: '100,5' }] });
  const copia = duplicarRefeicaoNoRascunho([editar('1,2')], 0, gerarChave);
  assert.equal(copia[1].itens[0].quantidade, 1.2);
  assert.equal(copia[1].itens[0].porcaoGramas, 100.5);
  assert.throws(() => duplicarRefeicaoNoRascunho([editar('')], 0, gerarChave), /Complete a quantidade/);
  assert.throws(() => duplicarRefeicaoNoRascunho([editar('-')], 0, gerarChave), /Complete a quantidade/);
});

test('PA06 duplicação local conserva texto parcial de micronutriente exatamente como editado', () => {
  const origem = refeicaoFormulario('rascunho-r1');
  origem.itens[0].micronutrientesPor100g = { ferroMg: '1,' };
  const copia = duplicarRefeicaoNoRascunho([origem], 0, gerarChave)[1];
  assert.equal(copia.itens[0].micronutrientesPor100g?.ferroMg, '1,');
});
