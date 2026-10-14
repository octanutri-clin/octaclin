import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { registrarProtecaoAntesUnload } from '../lib/proteger-alteracoes-nao-salvas.mjs';

function criarAlvo() {
  const listeners = new Set();

  return {
    listeners,
    addEventListener(tipo, listener) {
      assert.equal(tipo, 'beforeunload');
      listeners.add(listener);
    },
    removeEventListener(tipo, listener) {
      assert.equal(tipo, 'beforeunload');
      listeners.delete(listener);
    },
    disparar(evento) {
      for (const listener of [...listeners]) listener(evento);
    }
  };
}

test('não registra proteção quando não há alterações pendentes', () => {
  const alvo = criarAlvo();
  const remover = registrarProtecaoAntesUnload(alvo, false);

  assert.equal(alvo.listeners.size, 0);
  remover();
  assert.equal(alvo.listeners.size, 0);
});

test('bloqueia a saída do navegador enquanto há alterações pendentes', () => {
  const alvo = criarAlvo();
  const remover = registrarProtecaoAntesUnload(alvo, true);
  let cancelado = false;
  const evento = {
    returnValue: 'valor inicial',
    preventDefault() {
      cancelado = true;
    }
  };

  assert.equal(alvo.listeners.size, 1);
  [...alvo.listeners][0](evento);
  assert.equal(cancelado, true);
  assert.equal(evento.returnValue, '');
  remover();
  assert.equal(alvo.listeners.size, 0);
});

test('cleanup remove o listener para não reter proteção após salvar ou desmontar', () => {
  const alvo = criarAlvo();
  const remover = registrarProtecaoAntesUnload(alvo, true);
  remover();
  assert.equal(alvo.listeners.size, 0);

  const evento = {
    returnValue: 'valor inicial',
    preventDefault() {
      assert.fail('listener removido não deve bloquear a saída');
    }
  };
  alvo.disparar(evento);
  assert.equal(evento.returnValue, 'valor inicial');
});

test('editores protegidos reutilizam a primitive em vez de listeners divergentes', async () => {
  const arquivos = [
    '../components/pacientes/prontuario-paciente.tsx',
    '../components/pacientes/plano-alimentar-profissional.tsx',
    '../components/questionarios/usar-workspace-questionarios.ts'
  ];

  for (const arquivo of arquivos) {
    const conteudo = await readFile(new URL(arquivo, import.meta.url), 'utf8');
    assert.match(conteudo, /useProtecaoAlteracoesNaoSalvas\(/, arquivo);
    assert.doesNotMatch(conteudo, /addEventListener\(['"]beforeunload['"]/, arquivo);
  }
});
