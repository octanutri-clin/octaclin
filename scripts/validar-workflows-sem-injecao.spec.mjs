import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  validarConteudoWorkflowSemInjecao,
  validarWorkflowsDeploy,
} from './validar-workflows-sem-injecao.mjs';

const payloadsInjecao = [
  'latest"; printf comprometido > "$MARKER_FILE"; #',
  'latest$(printf comprometido > "$MARKER_FILE")',
  'latest`printf comprometido > "$MARKER_FILE"`',
];

function bashDisponivel() {
  const candidatos = process.platform === 'win32'
    ? ['C:\\Program Files\\Git\\bin\\bash.exe', 'bash']
    : ['bash'];

  for (const candidato of candidatos) {
    const resultado = spawnSync(candidato, ['--version'], { encoding: 'utf8' });
    if (!resultado.error && resultado.status === 0) return candidato;
  }

  throw new Error('Bash e obrigatorio para provar os payloads de command injection');
}

const bash = bashDisponivel();

for (const payload of payloadsInjecao) {
  test(`rejeita input interpolado no script com payload: ${payload}`, () => {
    const diretorio = mkdtempSync(join(tmpdir(), 'octaclin-workflow-injection-'));
    const marcadorInterpolado = join(diretorio, 'interpolado.txt');
    const marcadorEnv = join(diretorio, 'env.txt');
    const scriptVulneravel = 'printf \'%s\\n\' "${{ inputs.image_tag }}"';
    const scriptMaterializado = scriptVulneravel.replace('${{ inputs.image_tag }}', payload);

    const workflowVulneravel = [
      'steps:',
      '  - name: Build',
      '    run: |',
      `      ${scriptVulneravel}`,
    ].join('\n');

    try {
      const resultadoInterpolado = spawnSync(bash, ['-c', scriptMaterializado], {
        encoding: 'utf8',
        env: { ...process.env, MARKER_FILE: marcadorInterpolado },
      });
      assert.equal(resultadoInterpolado.status, 0, resultadoInterpolado.stderr);
      assert.equal(existsSync(marcadorInterpolado), true, 'payload interpolado deveria executar o comando');

      const resultadoViaEnv = spawnSync(bash, ['-c', 'printf \'%s\\n\' "$IMAGE_TAG"'], {
        encoding: 'utf8',
        env: { ...process.env, IMAGE_TAG: payload, MARKER_FILE: marcadorEnv },
      });
      assert.equal(resultadoViaEnv.status, 0, resultadoViaEnv.stderr);
      assert.equal(existsSync(marcadorEnv), false, 'payload em env deve permanecer dado');

      assert.throws(
        () => validarConteudoWorkflowSemInjecao(workflowVulneravel, 'inseguro.yml'),
        /expressoes GitHub nao podem ser interpoladas diretamente em run/,
      );
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });
}

test('aceita expressao no env e variavel do shell tratada como dado', () => {
  const workflowSeguro = [
    'steps:',
    '  - name: Build',
    '    env:',
    '      IMAGE_TAG: ${{ inputs.image_tag }}',
    '    run: |',
    '      docker build -t "$REPOSITORY:$IMAGE_TAG" "$BUILD_CONTEXT"',
  ].join('\n');

  assert.doesNotThrow(() => validarConteudoWorkflowSemInjecao(workflowSeguro));
});

test('rejeita expressao em run inline', () => {
  assert.throws(
    () => validarConteudoWorkflowSemInjecao('steps:\n  - run: echo "${{ github.event.issue.title }}"'),
    /expressoes GitHub nao podem ser interpoladas diretamente em run/,
  );
});

test('workflows reais de AWS e Azure obedecem a politica', () => {
  assert.match(validarWorkflowsDeploy(), /Workflows de deploy sem interpolacao direta/);
});
