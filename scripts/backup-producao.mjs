import { fileURLToPath } from 'node:url';

const HOST_NEON = /\.neon\.tech$/i;
const HOST_B2 = /(^|\.)backblazeb2\.com$/i;

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
  const [, , comando, argumento] = process.argv;
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
  throw new Error('Comando esperado: validar, validar-restore ou destinos.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    executarCli();
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exitCode = 1;
  }
}
