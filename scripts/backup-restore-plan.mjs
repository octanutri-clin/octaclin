import { fileURLToPath } from 'node:url';

function pad2(valor) {
  return String(valor).padStart(2, '0');
}

function timestamp(data) {
  return [
    data.getUTCFullYear(),
    pad2(data.getUTCMonth() + 1),
    pad2(data.getUTCDate()),
    '-',
    pad2(data.getUTCHours()),
    pad2(data.getUTCMinutes()),
    pad2(data.getUTCSeconds())
  ].join('');
}

export function mascararDatabaseUrl(valor = '') {
  if (!valor) return '';
  return valor.replace(/:\/\/([^:\s/@]+):([^@\s]+)@/, '://$1:<redacted>@');
}

function normalizarDatabaseUrl(valor = '') {
  if (!valor) return '';
  try {
    const url = new URL(valor);
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return valor;
  }
}

export function validarAmbienteBackupRestore(env = process.env) {
  const erros = [];
  const origem = env.DATABASE_URL?.trim();
  const restore = env.RESTORE_DATABASE_URL?.trim();

  if (!origem) erros.push('DATABASE_URL e obrigatoria para gerar backup.');

  if (origem && restore) {
    if (normalizarDatabaseUrl(origem) === normalizarDatabaseUrl(restore)) {
      erros.push('RESTORE_DATABASE_URL deve apontar para banco dedicado e diferente de DATABASE_URL.');
    }

    if (env.CONFIRMAR_RESTORE_TESTE !== 'SIM') {
      erros.push('CONFIRMAR_RESTORE_TESTE=SIM e obrigatorio para executar restore de teste.');
    }
  }

  return { ok: erros.length === 0, erros };
}

export function criarPlanoBackupRestore({ env = process.env, agora = new Date(), diretorioBackup = 'backups' } = {}) {
  const validacao = validarAmbienteBackupRestore(env);
  if (!validacao.ok) {
    const erro = new Error(validacao.erros.join(' '));
    erro.validacao = validacao;
    throw erro;
  }

  const nomeArquivo = `octaclin-postgres-${timestamp(agora)}.dump`;
  const caminhoBackup = `${diretorioBackup.replace(/[\\/]+$/, '')}/${nomeArquivo}`;
  const origem = env.DATABASE_URL.trim();
  const restore = env.RESTORE_DATABASE_URL?.trim();

  return {
    nomeArquivo,
    caminhoBackup,
    resumoSeguro: {
      origem: mascararDatabaseUrl(origem),
      restore: restore ? mascararDatabaseUrl(restore) : undefined,
      restoreHabilitado: Boolean(restore),
      formato: 'custom',
      politicaRetencao: {
        diarioDias: 7,
        semanalSemanas: 4,
        mensalMeses: 3
      }
    },
    comandos: {
      backup: {
        executavel: 'pg_dump',
        argumentos: ['--format=custom', '--no-owner', '--no-acl', '--file', caminhoBackup, '${DATABASE_URL}']
      },
      validacao: {
        executavel: 'pg_restore',
        argumentos: ['--list', caminhoBackup]
      },
      restore: restore
        ? {
            executavel: 'pg_restore',
            argumentos: ['--clean', '--if-exists', '--no-owner', '--no-acl', '--dbname', '${RESTORE_DATABASE_URL}', caminhoBackup]
          }
        : undefined
    }
  };
}

function imprimirPlano(plano) {
  console.log(JSON.stringify(plano, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    imprimirPlano(criarPlanoBackupRestore({ diretorioBackup: process.env.OCTACLIN_BACKUP_DIR || 'backups' }));
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exitCode = 1;
  }
}
