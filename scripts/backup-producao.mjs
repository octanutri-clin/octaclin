import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HOST_NEON = /\.neon\.tech$/i;
const HOST_B2 = /(^|\.)backblazeb2\.com$/i;

export const OBJETIVOS_RECUPERACAO = Object.freeze({
  rpoHoras: 24,
  toleranciaAlertaRpoHoras: 2,
  rtoRestoreMinutos: 30
});

function dataValida(valor, rotulo) {
  const data = new Date(valor);
  if (!valor || Number.isNaN(data.getTime())) throw new Error(`${rotulo} deve ser uma data ISO valida.`);
  return data;
}

export function avaliarMedicaoRecuperacao({ snapshotEm, restoreIniciadoEm, restoreConcluidoEm }) {
  const snapshot = dataValida(snapshotEm, 'snapshotEm');
  const inicio = dataValida(restoreIniciadoEm, 'restoreIniciadoEm');
  const fim = dataValida(restoreConcluidoEm, 'restoreConcluidoEm');
  if (inicio < snapshot) throw new Error('O restore nao pode iniciar antes do snapshot.');
  if (fim < inicio) throw new Error('O restore nao pode terminar antes de iniciar.');

  const idadeSnapshotSegundos = Math.floor((fim.getTime() - snapshot.getTime()) / 1000);
  const restoreSegundos = Math.floor((fim.getTime() - inicio.getTime()) / 1000);
  return {
    idadeSnapshotSegundos,
    restoreSegundos,
    rpoDentroObjetivo: idadeSnapshotSegundos <= OBJETIVOS_RECUPERACAO.rpoHoras * 60 * 60,
    rtoDentroObjetivo: restoreSegundos <= OBJETIVOS_RECUPERACAO.rtoRestoreMinutos * 60
  };
}

function iguais(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function validarManifestosRestore({
  origem,
  destino,
  bancoOrigemEsperado,
  bancoDestinoEsperado,
  roleOrigemEsperada,
  roleDestinoEsperada
}) {
  const erros = [];
  if (!origem || typeof origem !== 'object') erros.push('Manifesto de origem invalido.');
  if (!destino || typeof destino !== 'object') erros.push('Manifesto de destino invalido.');
  if (erros.length) return { ok: false, erros };

  if (origem.banco !== bancoOrigemEsperado) erros.push('O manifesto de origem nao corresponde ao banco esperado.');
  if (destino.banco !== bancoDestinoEsperado) erros.push('O manifesto de destino nao corresponde ao banco dedicado esperado.');
  if (origem.banco === destino.banco) erros.push('Origem e destino do restore devem ser bancos diferentes.');
  if (origem.role !== roleOrigemEsperada) erros.push('A consulta da origem nao executou com a role dedicada de backup.');
  if (destino.role !== roleDestinoEsperada) erros.push('A consulta do destino nao executou com a role proprietaria de restore.');

  if (!Array.isArray(origem.migrations) || origem.migrations.length === 0) erros.push('A origem nao possui inventario de migrations.');
  if (!Array.isArray(origem.tabelasPublicas) || origem.tabelasPublicas.length === 0) erros.push('A origem nao possui inventario de tabelas publicas.');
  if (!Array.isArray(origem.tabelasTenant) || origem.tabelasTenant.length === 0) erros.push('A origem nao possui tabelas tenant-scoped inventariadas.');
  if (!origem.contagensCriticas || typeof origem.contagensCriticas !== 'object') erros.push('A origem nao possui contagens criticas.');
  if (!destino.contagensCriticas || typeof destino.contagensCriticas !== 'object') erros.push('O destino nao possui contagens criticas.');

  for (const item of [...(origem.tabelasTenant ?? []), ...(destino.tabelasTenant ?? [])]) {
    if (!item?.rls || !item?.rlsForcada || !item?.policyCompleta) {
      erros.push(`A tabela tenant-scoped ${item?.tabela ?? 'desconhecida'} nao preservou o contrato RLS completo.`);
    }
  }

  for (const campo of ['migrations', 'tabelasPublicas', 'tabelasTenant']) {
    if (!iguais(origem[campo], destino[campo])) erros.push(`O restore divergiu da origem em ${campo}.`);
  }
  if (!iguais(Object.keys(origem.contagensCriticas ?? {}).sort(), Object.keys(destino.contagensCriticas ?? {}).sort())) {
    erros.push('O restore divergiu da origem no inventario de tabelas criticas.');
  }
  const tenants = Number(destino.contagensCriticas?.tenants);
  const usuarios = Number(destino.contagensCriticas?.usuarios);
  if (!Number.isFinite(tenants) || tenants <= 0) erros.push('O restore nao comprova tenants presentes.');
  if (!Number.isFinite(usuarios) || usuarios <= 0) erros.push('O restore nao comprova usuarios presentes.');

  return { ok: erros.length === 0, erros };
}

function partesData(data, timezone) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).formatToParts(data);
  return Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
}

function analisarUrlPostgres(valor, rotulo, erros) {
  if (!valor) {
    erros.push(`${rotulo} e obrigatoria.`);
    return undefined;
  }
  try {
    const url = new URL(valor);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) erros.push(`${rotulo} deve usar PostgreSQL.`);
    if (!HOST_NEON.test(url.hostname)) erros.push(`${rotulo} deve apontar para um endpoint Neon.`);
    if (!url.username || !url.password) erros.push(`${rotulo} deve conter role e senha dedicadas.`);
    return url;
  } catch {
    erros.push(`${rotulo} deve ser uma URL PostgreSQL valida.`);
    return undefined;
  }
}

export function validarConfiguracaoBackup(env = process.env) {
  const erros = [];
  const origem = analisarUrlPostgres(env.OCTACLIN_BACKUP_DATABASE_URL?.trim(), 'OCTACLIN_BACKUP_DATABASE_URL', erros);
  const bancoEsperado = env.OCTACLIN_BACKUP_DATABASE_EXPECTED?.trim();
  const roleEsperada = env.OCTACLIN_BACKUP_ROLE_EXPECTED?.trim();
  if (!bancoEsperado) erros.push('OCTACLIN_BACKUP_DATABASE_EXPECTED e obrigatoria.');
  if (!roleEsperada) erros.push('OCTACLIN_BACKUP_ROLE_EXPECTED e obrigatoria.');
  if (origem && bancoEsperado && decodeURIComponent(origem.pathname.slice(1)) !== bancoEsperado) {
    erros.push('A URL de backup nao aponta para o banco de producao esperado.');
  }
  if (origem && roleEsperada && decodeURIComponent(origem.username) !== roleEsperada) {
    erros.push('A URL de backup nao usa a role dedicada esperada.');
  }

  const endpoint = env.B2_BACKUP_ENDPOINT?.trim();
  try {
    const urlB2 = new URL(endpoint || '');
    if (urlB2.protocol !== 'https:' || !HOST_B2.test(urlB2.hostname)) {
      erros.push('B2_BACKUP_ENDPOINT deve ser um endpoint HTTPS oficial do Backblaze B2.');
    }
  } catch {
    erros.push('B2_BACKUP_ENDPOINT deve ser uma URL valida.');
  }
  for (const nome of ['B2_BACKUP_REGION', 'B2_BACKUP_BUCKET', 'B2_BACKUP_KEY_ID', 'B2_BACKUP_APPLICATION_KEY']) {
    if (!env[nome]?.trim()) erros.push(`${nome} e obrigatoria.`);
  }

  return {
    ok: erros.length === 0,
    erros,
    resumo: origem
      ? {
          banco: decodeURIComponent(origem.pathname.slice(1)),
          role: decodeURIComponent(origem.username),
          provedor: 'Neon/PostgreSQL',
          armazenamento: 'Backblaze B2 privado'
        }
      : undefined
  };
}

export function validarConfiguracaoRestore(env = process.env) {
  const erros = [];
  const origem = analisarUrlPostgres(env.OCTACLIN_BACKUP_DATABASE_URL?.trim(), 'OCTACLIN_BACKUP_DATABASE_URL', erros);
  const destino = analisarUrlPostgres(env.OCTACLIN_RESTORE_DATABASE_URL?.trim(), 'OCTACLIN_RESTORE_DATABASE_URL', erros);
  const bancoEsperado = env.OCTACLIN_RESTORE_DATABASE_EXPECTED?.trim();
  const roleEsperada = env.OCTACLIN_RESTORE_ROLE_EXPECTED?.trim();
  if (!bancoEsperado) erros.push('OCTACLIN_RESTORE_DATABASE_EXPECTED e obrigatoria.');
  if (!roleEsperada) erros.push('OCTACLIN_RESTORE_ROLE_EXPECTED e obrigatoria.');
  if (destino && bancoEsperado && decodeURIComponent(destino.pathname.slice(1)) !== bancoEsperado) {
    erros.push('A URL de restore nao aponta para o banco dedicado esperado.');
  }
  if (destino && roleEsperada && decodeURIComponent(destino.username) !== roleEsperada) {
    erros.push('A URL de restore nao usa a role proprietaria esperada.');
  }
  if (origem && destino && origem.hostname === destino.hostname && origem.pathname === destino.pathname) {
    erros.push('O banco de restore deve ser diferente do banco de producao.');
  }
  return { ok: erros.length === 0, erros };
}

export function calcularDestinosBackup(nomeArquivo, agora = new Date(), timezone = 'America/Sao_Paulo') {
  if (!/^octaclin-postgres-\d{8}T\d{6}Z\.dump$/.test(nomeArquivo)) {
    throw new Error('Nome de backup fora do contrato esperado.');
  }
  const { year, month, day, weekday } = partesData(agora, timezone);
  const destinos = [`daily/${year}/${month}/${nomeArquivo}`];
  if (weekday === 'Sun') destinos.push(`weekly/${year}/${nomeArquivo}`);
  if (day === '01') destinos.push(`monthly/${year}/${nomeArquivo}`);
  return { destinos, dataLocal: `${year}-${month}-${day}`, semanal: weekday === 'Sun', mensal: day === '01' };
}

function executarCli() {
  const [, , comando, ...argumentos] = process.argv;
  const [argumento] = argumentos;
  if (comando === 'validar') {
    const resultado = validarConfiguracaoBackup();
    if (!resultado.ok) throw new Error(resultado.erros.join(' '));
    console.log(JSON.stringify(resultado.resumo));
    return;
  }
  if (comando === 'validar-restore') {
    const resultado = validarConfiguracaoRestore();
    if (!resultado.ok) throw new Error(resultado.erros.join(' '));
    console.log(JSON.stringify({ restore: 'configuracao valida' }));
    return;
  }
  if (comando === 'destinos') {
    console.log(JSON.stringify(calcularDestinosBackup(argumento, new Date())));
    return;
  }
  if (comando === 'validar-manifestos') {
    const [arquivoOrigem, arquivoDestino] = argumentos;
    const resultado = validarManifestosRestore({
      origem: JSON.parse(readFileSync(arquivoOrigem, 'utf8')),
      destino: JSON.parse(readFileSync(arquivoDestino, 'utf8')),
      bancoOrigemEsperado: process.env.OCTACLIN_BACKUP_DATABASE_EXPECTED,
      bancoDestinoEsperado: process.env.OCTACLIN_RESTORE_DATABASE_EXPECTED,
      roleOrigemEsperada: process.env.OCTACLIN_BACKUP_ROLE_EXPECTED,
      roleDestinoEsperada: process.env.OCTACLIN_RESTORE_ROLE_EXPECTED
    });
    if (!resultado.ok) throw new Error(resultado.erros.join(' '));
    console.log(JSON.stringify({ restore: 'manifestos equivalentes e tenancy integra' }));
    return;
  }
  if (comando === 'medir-recuperacao') {
    const resultado = avaliarMedicaoRecuperacao({
      snapshotEm: argumentos[0],
      restoreIniciadoEm: argumentos[1],
      restoreConcluidoEm: argumentos[2]
    });
    if (!resultado.rpoDentroObjetivo || !resultado.rtoDentroObjetivo) {
      throw new Error(`Objetivo de recuperacao violado: ${JSON.stringify(resultado)}`);
    }
    console.log(JSON.stringify(resultado));
    return;
  }
  throw new Error('Comando esperado: validar, validar-restore, destinos, validar-manifestos ou medir-recuperacao.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    executarCli();
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exitCode = 1;
  }
}
