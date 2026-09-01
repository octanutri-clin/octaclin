// Gate do ledger canonico de excecoes de supply chain (PR 49).
//
// Uma excecao de seguranca sem owner, sem justificativa ou sem prazo vira
// divida permanente e invisivel. Este gate exige os dois e falha quando o prazo
// vence, de modo que a excecao volte para a mesa em vez de expirar em silencio.
//
// O gate tambem amarra o ledger a configuracao real: toda entrada de
// `trustPolicyExclude` em pnpm-workspace.yaml precisa de excecao correspondente
// e vice-versa, para que nao seja possivel afrouxar a politica do pnpm sem
// registrar owner e prazo.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO_LEDGER = join(RAIZ, 'docs', 'governance', 'excecoes-supply-chain.json');

const WORKSPACES = [
  'pnpm-workspace.yaml',
  join('octaclin-backend', 'pnpm-workspace.yaml'),
  join('octaclin-web', 'pnpm-workspace.yaml'),
  join('octaclin-mobile', 'pnpm-workspace.yaml'),
];

export const TIPOS_VALIDOS = [
  'vulnerability',
  'license',
  'minimumReleaseAge',
  'trustPolicy',
  'buildScript',
  'exoticDependency',
];

const SEVERIDADES_VALIDAS = ['baixa', 'media', 'alta', 'critica'];
const PRAZO_MAXIMO_EM_DIAS = 180;
const MOTIVO_MINIMO = 40;
const REACHABILITY_MINIMO = 20;
const VERSOES_AMPLAS_DEMAIS = new Set(['*', 'x', 'X', '', 'latest', '>=0', '*.*.*', 'any']);
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID_VALIDO = /^SC-\d{4}-\d{3,}$/;
const DIA_EM_MS = 24 * 60 * 60 * 1000;

function falhar(mensagem) {
  throw new Error(`Ledger de excecoes de supply chain invalido: ${mensagem}`);
}

function exigirTexto(excecao, campo, minimo) {
  const valor = excecao[campo];
  if (typeof valor !== 'string' || valor.trim().length < minimo) {
    falhar(
      `excecao ${excecao.id ?? '(sem id)'} precisa de "${campo}" com pelo menos ${minimo} caracteres uteis.`
    );
  }
}

function lerData(excecao, campo) {
  const valor = excecao[campo];
  if (typeof valor !== 'string' || !DATA_ISO.test(valor)) {
    falhar(`excecao ${excecao.id ?? '(sem id)'} precisa de "${campo}" no formato AAAA-MM-DD.`);
  }
  const data = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime())) {
    falhar(`excecao ${excecao.id} tem "${campo}" com data inexistente: ${valor}.`);
  }
  return data;
}

export function validarExcecao(excecao, { hoje }) {
  if (excecao === null || typeof excecao !== 'object' || Array.isArray(excecao)) {
    falhar('cada excecao precisa ser um objeto.');
  }

  if (typeof excecao.id !== 'string' || !ID_VALIDO.test(excecao.id)) {
    falhar(`id ausente ou fora do padrao SC-AAAA-NNN: ${JSON.stringify(excecao.id)}.`);
  }

  if (!TIPOS_VALIDOS.includes(excecao.tipo)) {
    falhar(
      `excecao ${excecao.id} tem "tipo" invalido: ${JSON.stringify(excecao.tipo)}. Validos: ${TIPOS_VALIDOS.join(', ')}.`
    );
  }

  if (!SEVERIDADES_VALIDAS.includes(excecao.severidade)) {
    falhar(
      `excecao ${excecao.id} tem "severidade" invalida: ${JSON.stringify(excecao.severidade)}.`
    );
  }

  exigirTexto(excecao, 'componente', 3);
  exigirTexto(excecao, 'package', 1);
  exigirTexto(excecao, 'motivo', MOTIVO_MINIMO);
  exigirTexto(excecao, 'reachability', REACHABILITY_MINIMO);
  exigirTexto(excecao, 'owner', 3);
  exigirTexto(excecao, 'approvedBy', 3);
  exigirTexto(excecao, 'source', 3);
  exigirTexto(excecao, 'condicaoDeRemocao', 10);

  const version = excecao.version;
  if (typeof version !== 'string' || VERSOES_AMPLAS_DEMAIS.has(version.trim())) {
    falhar(
      `excecao ${excecao.id} precisa de "version" especifica; wildcard amplo nao e aceito (recebido: ${JSON.stringify(version)}).`
    );
  }
  if (version.includes('*')) {
    falhar(`excecao ${excecao.id} usa wildcard em "version": ${version}.`);
  }

  if (!Array.isArray(excecao.controlesCompensatorios) || excecao.controlesCompensatorios.length === 0) {
    falhar(`excecao ${excecao.id} precisa de "controlesCompensatorios" com ao menos um item.`);
  }
  for (const controle of excecao.controlesCompensatorios) {
    if (typeof controle !== 'string' || controle.trim().length < 10) {
      falhar(`excecao ${excecao.id} tem controle compensatorio vazio ou generico demais.`);
    }
  }

  const criadaEm = lerData(excecao, 'createdAt');
  const expiraEm = lerData(excecao, 'expiresAt');

  if (expiraEm.getTime() <= criadaEm.getTime()) {
    falhar(`excecao ${excecao.id} tem "expiresAt" anterior ou igual a "createdAt".`);
  }

  const duracaoEmDias = Math.round((expiraEm.getTime() - criadaEm.getTime()) / DIA_EM_MS);
  if (duracaoEmDias > PRAZO_MAXIMO_EM_DIAS) {
    falhar(
      `excecao ${excecao.id} vale por ${duracaoEmDias} dias; o limite revisavel e de ${PRAZO_MAXIMO_EM_DIAS} dias.`
    );
  }

  if (expiraEm.getTime() < hoje.getTime()) {
    falhar(`excecao ${excecao.id} esta vencida em ${excecao.expiresAt}; renove com nova analise ou remova.`);
  }

  return true;
}

export function validarLedger(ledger, { hoje = new Date() } = {}) {
  if (ledger === null || typeof ledger !== 'object' || Array.isArray(ledger)) {
    falhar('o documento precisa ser um objeto JSON.');
  }
  if (!Array.isArray(ledger.excecoes)) {
    falhar('o campo "excecoes" precisa ser uma lista.');
  }

  const vistos = new Set();
  for (const excecao of ledger.excecoes) {
    validarExcecao(excecao, { hoje });
    if (vistos.has(excecao.id)) {
      falhar(`id duplicado: ${excecao.id}.`);
    }
    vistos.add(excecao.id);
  }

  return ledger.excecoes.length;
}

// Leitura deliberadamente restrita: so extrai a lista de `trustPolicyExclude`
// de um pnpm-workspace.yaml. Evita adicionar um parser YAML apenas para um gate.
export function extrairTrustPolicyExclude(conteudo) {
  const linhas = conteudo.split(/\r?\n/);
  const entradas = [];
  let dentro = false;

  for (const linha of linhas) {
    if (/^trustPolicyExclude:\s*$/.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;

    const item = linha.match(/^\s+-\s*'?"?([^'"\s#]+)'?"?\s*(?:#.*)?$/);
    if (item) {
      entradas.push(item[1]);
      continue;
    }
    if (linha.trim() === '' || linha.trimStart().startsWith('#')) continue;
    dentro = false;
  }

  return entradas;
}

export function validarAmarracaoComWorkspaces(ledger, { raiz = RAIZ } = {}) {
  const declaradas = new Set();
  for (const relativo of WORKSPACES) {
    let conteudo;
    try {
      conteudo = readFileSync(join(raiz, relativo), 'utf8');
    } catch {
      continue;
    }
    for (const entrada of extrairTrustPolicyExclude(conteudo)) {
      declaradas.add(entrada);
    }
  }

  const noLedger = new Set(
    ledger.excecoes
      .filter((excecao) => excecao.tipo === 'trustPolicy')
      .map((excecao) => `${excecao.package}@${excecao.version}`)
  );

  for (const entrada of declaradas) {
    if (!noLedger.has(entrada)) {
      falhar(
        `trustPolicyExclude declara ${entrada} em pnpm-workspace.yaml sem excecao correspondente no ledger.`
      );
    }
  }
  for (const entrada of noLedger) {
    if (!declaradas.has(entrada)) {
      falhar(
        `o ledger registra excecao trustPolicy para ${entrada}, mas nenhum pnpm-workspace.yaml a declara. Remova a excecao ociosa.`
      );
    }
  }

  return declaradas.size;
}

export function validarArquivoDeExcecoes({ caminho = CAMINHO_LEDGER, hoje = new Date() } = {}) {
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(caminho, 'utf8'));
  } catch (erro) {
    falhar(`nao foi possivel ler ou interpretar ${caminho}: ${erro.message}`);
  }

  const total = validarLedger(ledger, { hoje });
  const amarradas = validarAmarracaoComWorkspaces(ledger);

  return `Excecoes de supply chain validas: ${total} registradas, ${amarradas} amarradas a trustPolicyExclude.`;
}

if (process.argv[1] && process.argv[1].endsWith('validar-excecoes-supply-chain.mjs')) {
  console.log(validarArquivoDeExcecoes());
}
