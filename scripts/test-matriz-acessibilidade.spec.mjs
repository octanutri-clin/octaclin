// Prova que o inventario executavel realmente reprova cada divergencia que ele
// promete detectar. Sem isto a matriz teria um validador que passa sempre, o
// que e pior do que nao ter validador: daria confianca sem cobertura.
//
// Cada caso parte da matriz real, aplica uma mutacao e exige a reprovacao.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { MATRIZ_PADRAO, validarMatriz } from './test-matriz-acessibilidade.mjs';

const diretorioTemporario = mkdtempSync(join(tmpdir(), 'matriz-a11y-'));
const original = readFileSync(MATRIZ_PADRAO, 'utf8');

function reprova(nome, mutacao, trechoEsperado) {
  test(nome, () => {
    const matriz = JSON.parse(original);
    mutacao(matriz);
    const caminho = join(diretorioTemporario, `${nome.replace(/[^a-z0-9]+/gi, '-')}.json`);
    writeFileSync(caminho, JSON.stringify(matriz));
    assert.throws(
      () => validarMatriz(caminho),
      (erro) => erro instanceof Error && erro.message.includes(trechoEsperado)
    );
  });
}

const gate = (matriz, id) => matriz.gates.find((g) => g.id === id);
const linha = (matriz, superficie) => matriz.linhas.find((l) => l.superficie === superficie);

test('a matriz versionada passa na validacao', () => {
  assert.match(validarMatriz(), /Matriz de acessibilidade valida/);
});

reprova(
  'script documentado que nao existe no package.json',
  (m) => {
    gate(m, 'web-a11y').comando = 'test:a11y-que-nao-existe';
  },
  'nao existe em octaclin-web/package.json'
);

reprova(
  'spec removido do disco',
  (m) => {
    gate(m, 'mobile-a11y').especificacao = 'octaclin-mobile/scripts/removido.spec.mjs';
  },
  'nao existe'
);

reprova(
  'gate mobile desconectado do CI',
  (m) => {
    gate(m, 'mobile-a11y').ci.job = 'job-inexistente';
  },
  'o job job-inexistente nao existe'
);

reprova(
  'gate presente no CI, mas com outro comando',
  (m) => {
    gate(m, 'mobile-audit-security').ci.run = 'pnpm audit:security:outro';
  },
  'nao executa'
);

reprova(
  'gate coberto por outro gate que nao roda no CI',
  (m) => {
    gate(m, 'web-a11y').cobertoPor = 'mobile-audit-a11y';
  },
  'nao esta ligado ao CI'
);

reprova(
  'bloco de teste citado pela matriz nao existe no spec',
  (m) => {
    linha(m, 'componentes compartilhados').evidencia.blocos = ['bloco que nunca existiu'];
  },
  'nao existe em octaclin-web/tests/visual/acessibilidade.spec.mjs'
);

reprova(
  'rota documentada nao e visitada pelo spec',
  (m) => {
    linha(m, 'jornadas por teclado').rotas.push('/rota-fantasma');
  },
  'a rota /rota-fantasma nao e visitada'
);

reprova(
  'project Playwright esperado ausente da configuracao',
  (m) => {
    linha(m, 'reflow e zoom').plataforma = ['desktop-firefox'];
  },
  'nao existe em octaclin-web/playwright.config.mjs'
);

reprova(
  'resultado manual tratado como automatizado',
  (m) => {
    const nvda = linha(m, 'NVDA');
    nvda.evidencia = { gate: 'web-a11y' };
  },
  'e manual, mas aponta para o gate automatizado'
);

reprova(
  'validacao manual sem relatorio de evidencia',
  (m) => {
    delete linha(m, 'NVDA').evidencia.relatorio;
  },
  'Linha manual sem relatorio de evidencia'
);

reprova(
  'TalkBack declarado PASS',
  (m) => {
    linha(m, 'TalkBack').resultado = 'PASS';
  },
  'depende de dispositivo real e nao pode ser PASS'
);

reprova(
  'VoiceOver declarado PASS',
  (m) => {
    linha(m, 'VoiceOver').resultado = 'PASS';
  },
  'depende de dispositivo real e nao pode ser PASS'
);

reprova(
  'fonte ampliada nativa declarada PASS',
  (m) => {
    const nativa = m.linhas.find((l) => l.estado.includes('fonte ampliada do sistema operacional'));
    nativa.resultado = 'PASS';
  },
  'depende de dispositivo real e nao pode ser PASS'
);

reprova(
  'SKIPPED sem condicao de fechamento',
  (m) => {
    delete linha(m, 'TalkBack').condicaoDeFechamento;
  },
  'Linha SKIPPED sem condicao de fechamento'
);

reprova(
  'SKIPPED sem justificativa',
  (m) => {
    delete linha(m, 'VoiceOver').justificativa;
  },
  'Linha SKIPPED sem justificativa'
);

reprova(
  'quarentena sem responsavel',
  (m) => {
    m.quarentena.push({ teste: 'algum teste', justificativa: 'instavel', prazo: '2026-09-30', resultado: 'SKIPPED' });
  },
  'Item de quarentena sem responsavel'
);

reprova(
  'quarentena declarada PASS',
  (m) => {
    m.quarentena.push({
      teste: 'algum teste',
      responsavel: 'governanca',
      justificativa: 'instavel',
      prazo: '2026-09-30',
      resultado: 'PASS'
    });
  },
  'precisa ser SKIPPED'
);

reprova(
  'retry acima do teto da politica de flakes',
  (m) => {
    m.politicaDeFlakes.retriesMaximoCi = 0;
  },
  'acima do maximo 0 da politica de flakes'
);

reprova(
  'politica de artefato divergente da configuracao do Playwright',
  (m) => {
    m.politicaDeFlakes.traceEsperado = 'off';
  },
  "trace deveria ser 'off'"
);
