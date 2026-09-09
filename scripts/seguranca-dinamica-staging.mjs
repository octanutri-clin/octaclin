export const LIMITE_REQUISICOES_ATIVAS = 30;

const CONFIRMACAO_EXATA = 'DAST-FUZZ-STAGING-DESCARTAVEL';
const ALVOS_PERMITIDOS = Object.freeze({
  web: 'http://127.0.0.1:3000',
  api: 'http://127.0.0.1:3001',
});

function recusarExecucao() {
  throw new Error(
    'Execucao dinamica recusada: use workflow_dispatch, confirmacao exata e alvos loopback descartaveis.',
  );
}

function origemExata(valor, esperada) {
  try {
    const url = new URL(valor);
    return (
      url.origin === esperada
      && valor === esperada
      && url.username === ''
      && url.password === ''
      && url.pathname === '/'
      && url.search === ''
      && url.hash === ''
    );
  } catch {
    return false;
  }
}

export function validarAutorizacaoStaging({
  webUrl,
  apiUrl,
  confirmacao,
  confirmarRemoto,
  eventoGithub,
}) {
  if (
    eventoGithub !== 'workflow_dispatch'
    || confirmacao !== CONFIRMACAO_EXATA
    || confirmarRemoto !== 'SIM'
    || !origemExata(webUrl, ALVOS_PERMITIDOS.web)
    || !origemExata(apiUrl, ALVOS_PERMITIDOS.api)
  ) {
    recusarExecucao();
  }

  return {
    apiOrigin: ALVOS_PERMITIDOS.api,
    webOrigin: ALVOS_PERMITIDOS.web,
  };
}

export function criarOrcamentoRequisicoes(limite = LIMITE_REQUISICOES_ATIVAS) {
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_REQUISICOES_ATIVAS) {
    throw new Error(`Orcamento invalido; use entre 1 e ${LIMITE_REQUISICOES_ATIVAS} requisicoes.`);
  }

  let usadas = 0;
  return Object.freeze({
    consumir(rotulo) {
      if (usadas >= limite) {
        throw new Error(`Orcamento de requisicoes excedido antes de ${String(rotulo).slice(0, 80)}.`);
      }
      usadas += 1;
      return usadas;
    },
    get usadas() {
      return usadas;
    },
    limite,
  });
}

function textoNaoVazio(valor, tamanhoMinimo = 1) {
  return typeof valor === 'string' && valor.trim().length >= tamanhoMinimo;
}

export function validarFalsosPositivos(ledger, agora = new Date()) {
  const erros = [];
  if (!ledger || ledger.schemaVersion !== 1 || !Array.isArray(ledger.exceptions)) {
    throw new Error('Ledger de falsos positivos invalido: schemaVersion 1 e exceptions sao obrigatorios.');
  }

  const ids = new Set();
  for (const [indice, excecao] of ledger.exceptions.entries()) {
    const prefixo = `exceptions[${indice}]`;
    if (!textoNaoVazio(excecao?.id) || ids.has(excecao.id)) erros.push(`${prefixo}.id`);
    else ids.add(excecao.id);
    if (!/^\d+$/.test(excecao?.zapPluginId ?? '')) erros.push(`${prefixo}.zapPluginId`);
    if (!textoNaoVazio(excecao?.path) || !excecao.path.startsWith('/') || excecao.path.includes('?')) {
      erros.push(`${prefixo}.path`);
    }
    if (excecao?.decision !== 'false_positive') erros.push(`${prefixo}.decision`);
    if (!textoNaoVazio(excecao?.justification, 30)) erros.push(`${prefixo}.justification`);
    if (!/^docs\/[A-Za-z0-9_./-]+\.md#[A-Za-z0-9_-]+$/.test(excecao?.evidence ?? '')) {
      erros.push(`${prefixo}.evidence`);
    }
    if (!/^@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(excecao?.owner ?? '')) {
      erros.push(`${prefixo}.owner`);
    }
    const expiraEm = new Date(`${excecao?.expiresOn ?? ''}T23:59:59.999Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(excecao?.expiresOn ?? '') || Number.isNaN(expiraEm.getTime()) || expiraEm < agora) {
      erros.push(`${prefixo}.expiresOn`);
    }
  }

  if (erros.length) {
    throw new Error(`Ledger de falsos positivos invalido: ${erros.join(', ')}.`);
  }
  return true;
}

const RISCOS = Object.freeze({
  0: 'informativo',
  1: 'baixo',
  2: 'medio',
  3: 'alto',
});

function caminhoDaInstancia(instancia) {
  try {
    return new URL(instancia?.uri).pathname;
  } catch {
    return null;
  }
}

function obterExcecoes(alerta, ledger) {
  const caminhos = new Set((alerta.instances ?? []).map(caminhoDaInstancia).filter(Boolean));
  if (!caminhos.size) return [];
  const excecoes = [...caminhos].map((caminho) => ledger.exceptions.find(
    (excecao) => excecao.zapPluginId === String(alerta.pluginid) && excecao.path === caminho,
  ));
  return excecoes.every(Boolean) ? excecoes : [];
}

export function resumirRelatorioZap(relatorio, ledger, agora = new Date()) {
  validarFalsosPositivos(ledger, agora);
  if (!relatorio || !Array.isArray(relatorio.site)) {
    throw new Error('Relatorio ZAP invalido: site deve ser uma lista.');
  }

  const alertas = [];
  const totais = { informativo: 0, baixo: 0, medio: 0, alto: 0 };
  for (const site of relatorio.site) {
    if (!Array.isArray(site?.alerts)) {
      throw new Error('Relatorio ZAP invalido: alerts deve ser uma lista em cada site.');
    }
    for (const alerta of site.alerts) {
      const risco = RISCOS[Number(alerta?.riskcode)];
      if (!risco || !textoNaoVazio(String(alerta?.pluginid ?? '')) || !textoNaoVazio(alerta?.name)) {
        throw new Error('Relatorio ZAP invalido: alerta sem id, nome ou risco conhecido.');
      }
      const excecoes = obterExcecoes(alerta, ledger);
      totais[risco] += 1;
      alertas.push({
        alertaId: String(alerta.pluginid),
        nome: alerta.name.trim().slice(0, 200),
        risco,
        confianca: String(alerta.confidence ?? 'desconhecida').slice(0, 40),
        ocorrencias: Array.isArray(alerta.instances) ? alerta.instances.length : 0,
        decisao: excecoes.length ? 'falso_positivo_documentado' : 'triagem_pendente',
        ...(excecoes.length ? { excecoesIds: excecoes.map(({ id }) => id).sort() } : {}),
      });
    }
  }

  alertas.sort((a, b) => b.risco.localeCompare(a.risco) || a.alertaId.localeCompare(b.alertaId));
  const bloqueios = alertas
    .filter((alerta) => alerta.risco === 'alto' && alerta.decisao !== 'falso_positivo_documentado')
    .map(({ alertaId, nome, risco }) => ({ alertaId, nome, risco }));

  return {
    schemaVersion: 1,
    scanner: 'OWASP ZAP Baseline',
    aprovado: bloqueios.length === 0,
    totais,
    alertas,
    bloqueios,
  };
}
