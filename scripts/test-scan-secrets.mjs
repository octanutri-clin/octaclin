import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanPathForSecrets } from './scan-secrets.mjs';

const tempDir = await mkdtemp(join(tmpdir(), 'octaclin-secret-scan-'));

try {
  await writeFile(
    join(tempDir, 'arquivo-com-segredos.txt'),
    [
      'OPENAI_API_KEY=sk-proj-' + 'A'.repeat(48),
      'META_WHATSAPP_TOKEN=EAAY' + 'B'.repeat(80),
      'DATABASE_URL=' + 'postgresql://octaclin:' + 'senha-real@db.example.com:5432/octaclin'
    ].join('\n')
  );
  await writeFile(
    join(tempDir, '.env.example'),
    [
      'OPENAI_API_KEY=changeme',
      'META_WHATSAPP_TOKEN=placeholder',
      'DATABASE_URL=postgresql://usuario:senha@localhost:5432/octaclin'
    ].join('\n')
  );
  await mkdir(join(tempDir, 'node_modules'), { recursive: true });
  await writeFile(join(tempDir, 'node_modules', 'pacote.txt'), 'OPENAI_API_KEY=sk-proj-' + 'C'.repeat(48));
  await mkdir(join(tempDir, '.agents', 'skills', 'fixture'), { recursive: true });
  await writeFile(
    join(tempDir, '.agents', 'skills', 'fixture', 'tooling.txt'),
    'GOOGLE_REFRESH_TOKEN=1//' + 'D'.repeat(48)
  );

  const findings = await scanPathForSecrets(tempDir);
  const ids = findings.map((finding) => finding.ruleId).sort();

  assert.deepEqual(ids, [
    'database-url-with-password',
    'google-oauth-refresh-token',
    'meta-whatsapp-token',
    'openai-api-key'
  ]);
  assert(findings.every((finding) => !finding.file.includes('node_modules')));
  assert(findings.every((finding) => !finding.file.endsWith('.env.example')));
  assert(findings.some((finding) => finding.file.includes('.agents/skills/fixture/tooling.txt')));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
