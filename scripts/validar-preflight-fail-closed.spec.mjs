import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import test from 'node:test';

const raiz = resolve(import.meta.dirname, '..');

function powershellDisponivel() {
  const candidatos = process.platform === 'win32' ? ['powershell'] : ['pwsh'];

  for (const candidato of candidatos) {
    const resultado = spawnSync(candidato, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
      encoding: 'utf8',
    });
    if (!resultado.error && resultado.status === 0) return candidato;
  }

  throw new Error('PowerShell e obrigatorio para provar o fail-closed do preflight');
}

test('preflight reprova quando um comando nativo retorna exit code diferente de zero', () => {
  const diretorio = mkdtempSync(join(tmpdir(), 'octaclin-preflight-fail-closed-'));
  const powershell = powershellDisponivel();
  const nomeGit = process.platform === 'win32' ? 'git.cmd' : 'git';
  const gitFalso = join(diretorio, nomeGit);
  const conteudo = process.platform === 'win32'
    ? '@echo off\r\nexit /b 42\r\n'
    : '#!/usr/bin/env sh\nexit 42\n';

  try {
    writeFileSync(gitFalso, conteudo, 'utf8');
    if (process.platform !== 'win32') chmodSync(gitFalso, 0o755);

    const resultado = spawnSync(
      powershell,
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(raiz, 'validar-preflight.ps1'), '-DocsOnly'],
      {
        cwd: raiz,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${diretorio}${delimiter}${process.env.PATH ?? ''}`,
        },
      },
    );

    assert.notEqual(resultado.status, 0, `preflight aceitou git exit 42:\n${resultado.stdout}\n${resultado.stderr}`);
    assert.doesNotMatch(resultado.stdout, /Preflight OctaClin OK/);
  } finally {
    rmSync(diretorio, { recursive: true, force: true });
  }
});
