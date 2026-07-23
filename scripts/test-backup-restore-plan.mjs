import assert from 'node:assert/strict';
import {
  criarPlanoBackupRestore,
  mascararDatabaseUrl,
  validarAmbienteBackupRestore
} from './backup-restore-plan.mjs';

const origem = 'postgresql://octaclin:senha@ep-example.neon.tech/neondb?sslmode=require';
const restore = 'postgresql://octaclin_restore:senha@ep-restore.neon.tech/neondb?sslmode=require';

assert.equal(mascararDatabaseUrl(origem), 'postgresql://octaclin:' + '<redacted>' + '@ep-example.neon.tech/neondb?sslmode=require');

const validacaoSemOrigem = validarAmbienteBackupRestore({});
assert.equal(validacaoSemOrigem.ok, false);
assert.deepEqual(validacaoSemOrigem.erros, ['DATABASE_URL e obrigatoria para gerar backup.']);

const validacaoMesmoBanco = validarAmbienteBackupRestore({
  DATABASE_URL: origem,
  RESTORE_DATABASE_URL: origem,
  CONFIRMAR_RESTORE_TESTE: 'SIM'
});
assert.equal(validacaoMesmoBanco.ok, false);
assert(validacaoMesmoBanco.erros.includes('RESTORE_DATABASE_URL deve apontar para banco dedicado e diferente de DATABASE_URL.'));

const validacaoRestoreSemConfirmacao = validarAmbienteBackupRestore({
  DATABASE_URL: origem,
  RESTORE_DATABASE_URL: restore
});
assert.equal(validacaoRestoreSemConfirmacao.ok, false);
assert(validacaoRestoreSemConfirmacao.erros.includes('CONFIRMAR_RESTORE_TESTE=SIM e obrigatorio para executar restore de teste.'));

const plano = criarPlanoBackupRestore({
  env: {
    DATABASE_URL: origem,
    RESTORE_DATABASE_URL: restore,
    CONFIRMAR_RESTORE_TESTE: 'SIM'
  },
  agora: new Date('2026-07-23T10:20:30.000Z'),
  diretorioBackup: 'backups'
});

assert.equal(plano.nomeArquivo, 'octaclin-postgres-20260723-102030.dump');
assert.equal(plano.caminhoBackup, 'backups/octaclin-postgres-20260723-102030.dump');
assert.deepEqual(plano.comandos.backup.argumentos.slice(0, 4), ['--format=custom', '--no-owner', '--no-acl', '--file']);
assert(plano.comandos.backup.argumentos.includes('backups/octaclin-postgres-20260723-102030.dump'));
assert.equal(plano.comandos.validacao.executavel, 'pg_restore');
assert.deepEqual(plano.comandos.validacao.argumentos, ['--list', 'backups/octaclin-postgres-20260723-102030.dump']);
assert.equal(plano.comandos.restore?.executavel, 'pg_restore');
assert(plano.comandos.restore?.argumentos.includes('--clean'));
assert(plano.resumoSeguro.origem.includes('<redacted>'));
assert(plano.resumoSeguro.restore?.includes('<redacted>'));
assert(!JSON.stringify(plano).includes('senha@'));
