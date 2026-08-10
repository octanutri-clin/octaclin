import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calcularDestinosBackup,
  validarConfiguracaoBackup,
  validarConfiguracaoRestore
} from './backup-producao.mjs';

function urlPostgres(role, host, banco) {
  return ['postgresql://', role, ':', 'credencial-sintetica', '@', host, '/', banco, '?sslmode=verify-full'].join('');
}

const base = {
  OCTACLIN_BACKUP_DATABASE_URL: urlPostgres('octaclin_backup_producao', 'ep-prod.neon.tech', 'Octaclin-db-producao'),
  OCTACLIN_BACKUP_DATABASE_EXPECTED: 'Octaclin-db-producao',
  OCTACLIN_BACKUP_ROLE_EXPECTED: 'octaclin_backup_producao',
  B2_BACKUP_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
  B2_BACKUP_REGION: 'us-east-005',
  B2_BACKUP_BUCKET: 'octaclin-backups-private',
  B2_BACKUP_KEY_ID: 'id-sintetico',
  B2_BACKUP_APPLICATION_KEY: 'segredo-sintetico'
};

assert.equal(validarConfiguracaoBackup(base).ok, true);
assert(!JSON.stringify(validarConfiguracaoBackup(base)).includes('segredo'));

const owner = validarConfiguracaoBackup({
  ...base,
  OCTACLIN_BACKUP_DATABASE_URL: base.OCTACLIN_BACKUP_DATABASE_URL.replace('octaclin_backup_producao', 'neondb_owner')
});
assert.equal(owner.ok, false);
assert(owner.erros.includes('A URL de backup nao usa a role dedicada esperada.'));

assert.equal(validarConfiguracaoBackup({ ...base, B2_BACKUP_ENDPOINT: 'http://127.0.0.1:9000' }).ok, false);
assert.equal(validarConfiguracaoBackup({ ...base, OCTACLIN_BACKUP_DATABASE_URL: '' }).ok, false);

const nome = 'octaclin-postgres-20260809T031700Z.dump';
assert.deepEqual(
  calcularDestinosBackup(nome, new Date('2026-08-09T03:17:00.000Z')).destinos,
  [`daily/2026/08/${nome}`, `weekly/2026/${nome}`]
);
assert.deepEqual(
  calcularDestinosBackup('octaclin-postgres-20261101T031700Z.dump', new Date('2026-11-01T03:17:00.000Z')).destinos,
  [
    'daily/2026/11/octaclin-postgres-20261101T031700Z.dump',
    'weekly/2026/octaclin-postgres-20261101T031700Z.dump',
    'monthly/2026/octaclin-postgres-20261101T031700Z.dump'
  ]
);
assert.throws(() => calcularDestinosBackup('../producao.dump'), /fora do contrato/);

assert.equal(validarConfiguracaoRestore({
  ...base,
  OCTACLIN_RESTORE_DATABASE_URL: urlPostgres('neondb_owner', 'ep-restore.neon.tech', 'octaclin_restore_fase219'),
  OCTACLIN_RESTORE_DATABASE_EXPECTED: 'octaclin_restore_fase219',
  OCTACLIN_RESTORE_ROLE_EXPECTED: 'neondb_owner'
}).ok, true);
assert.equal(validarConfiguracaoRestore({
  ...base,
  OCTACLIN_RESTORE_DATABASE_URL: base.OCTACLIN_BACKUP_DATABASE_URL,
  OCTACLIN_RESTORE_DATABASE_EXPECTED: 'Octaclin-db-producao',
  OCTACLIN_RESTORE_ROLE_EXPECTED: 'octaclin_backup_producao'
}).ok, false);

const workflow = readFileSync(new URL('../.github/workflows/backup-producao.yml', import.meta.url), 'utf8');
assert.match(workflow, /github\.event_name == 'workflow_dispatch' \|\| vars\.OCTACLIN_BACKUP_AUTOMATICO_HABILITADO == 'true'/);
assert.match(workflow, /OCTACLIN_BACKUP_ROLE_EXPECTED: octaclin_backup_producao/);
assert.match(workflow, /OCTACLIN_RESTORE_ROLE_EXPECTED: neondb_owner/);
assert.match(workflow, /--exclude-extension=timescaledb/);
assert.match(workflow, /--sse AES256/);
assert.match(workflow, /get-bucket-lifecycle-configuration/);
assert.match(workflow, /\.Grantee\.URI\? \/\/ ""/);
assert.match(workflow, /if: always\(\)/);
assert.doesNotMatch(workflow, /upload-artifact/);
assert.doesNotMatch(workflow, /neondb_owner.*OCTACLIN_BACKUP_DATABASE_URL/);

console.log('Contrato de backup de producao validado.');
