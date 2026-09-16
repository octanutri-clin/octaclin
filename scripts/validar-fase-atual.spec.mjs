import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const script = resolve(import.meta.dirname, 'validar-fase-atual.ps1');
const powershell = process.platform === 'win32' ? 'powershell' : 'pwsh';

function validar(status, checklist) {
  const directory = mkdtempSync(join(tmpdir(), 'octaclin-fase-atual-'));
  try {
    const statusPath = join(directory, 'status.md');
    const checklistPath = join(directory, 'checklist.md');
    writeFileSync(statusPath, status, 'utf8');
    writeFileSync(checklistPath, checklist, 'utf8');
    return spawnSync(
      powershell,
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
        '-StatusPath', statusPath, '-ChecklistPath', checklistPath],
      { encoding: 'utf8' },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const status = '- Fase 260 - Estabilidade, **concluida**.\n- Fase 261 - Seguranca, **em andamento**.\n';
const checklist = 'Atualizado em 2026-09-13. Fase 261 em andamento.\n\n- [x] Fase 260 - Estabilidade\n- [ ] Fase 261 - Seguranca\n';

test('aceita a ultima fase concluida e a proxima pendente', () => {
  const result = validar(status, checklist);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /260 concluida; 261 pendente ou em andamento/);
});

test('aceita a proxima fase marcada como em andamento', () => {
  const result = validar(status, checklist.replace('- [ ] Fase 261', '- [~] Fase 261'));
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /260 concluida; 261 pendente ou em andamento/);
});

test('reprova cabecalho historico que nao informa a fase atual', () => {
  const result = validar(status, checklist.replace('Fase 261 em andamento.', 'Fase 256 como proxima fase.'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cabecalho do checklist nao informa a Fase 261/);
});

test('reprova a proxima fase sem marcador aberto', () => {
  const result = validar(status, checklist.replace('- [ ] Fase 261', '- [-] Fase 261'));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Fase 261 pendente ou em andamento/);
});

test('reprova status sem conclusao da fase anterior', () => {
  const result = validar(status.replace('**concluida**', '**em andamento**'), checklist);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Fase 260 como concluida/);
});
