import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  criarOrcamentoRequisicoes,
  validarAutorizacaoStaging,
} from '../../scripts/seguranca-dinamica-staging.mjs';
import { aguardarProximoPeriodoTotp, exigirSegredoTotpSintetico, gerarCodigoTotp } from './e2e-mfa.mjs';

const SENHA_FIXTURE = 'OctaClinE2E@231';
const PACIENTE_ID = '23130000-0000-4000-8000-000000000001';
const PROFISSIONAL_ALFA_ID = '23110000-0000-4000-8000-000000000001';
const CONSENTIMENTO_SINTETICO_ID = '23140000-0000-4000-8000-000000000001';

function exigirSegredoSintetico(ambiente, nome) {
  const valor = ambiente[nome]?.trim();
  if (!valor || valor.length < 16) {
    throw new Error(`Configuracao sintetica obrigatoria ausente: ${nome}.`);
  }
  return valor;
}

async function lerJsonSemExpor(resposta, rotulo) {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`${rotulo}: resposta nao era JSON valido; conteudo omitido.`);
  }
}

function exigirCampoOpaco(objeto, campo, rotulo) {
  const valor = objeto?.[campo];
  if (typeof valor !== 'string' || !valor) {
    throw new Error(`${rotulo}: campo opaco esperado nao foi retornado; conteudo omitido.`);
  }
  return valor;
}

export async function executarProbesSeguranca({
  ambiente = process.env,
  fetchImpl = fetch,
  aguardarJanelaTotp = aguardarProximoPeriodoTotp,
} = {}) {
  const { apiOrigin } = validarAutorizacaoStaging({
    webUrl: ambiente.E2E_WEB_URL,
    apiUrl: ambiente.E2E_API_URL,
    confirmacao: ambiente.DAST_FUZZ_CONFIRMAR_EXECUCAO,
    confirmarRemoto: ambiente.E2E_CONFIRMAR_REMOTO,
    eventoGithub: ambiente.GITHUB_EVENT_NAME,
  });
  const appSecret = exigirSegredoSintetico(ambiente, 'META_WHATSAPP_APP_SECRET');
  const receiveToken = exigirSegredoSintetico(ambiente, 'META_WHATSAPP_WEBHOOK_RECEIVE_TOKEN');
  const orcamento = criarOrcamentoRequisicoes();
  const resultados = [];

  async function solicitar(rotulo, categoria, caminho, { status, token, headers, ...init } = {}) {
    if (!caminho.startsWith('/') || caminho.startsWith('//')) {
      throw new Error(`${rotulo}: caminho de probe invalido.`);
    }
    orcamento.consumir(rotulo);
    const esperados = Array.isArray(status) ? status : [status];
    let resposta;
    try {
      resposta = await fetchImpl(`${apiOrigin}${caminho}`, {
        ...init,
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: 'application/json',
          ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
      });
    } catch {
      throw new Error(`${rotulo}: falha de transporte; URL e detalhes omitidos.`);
    }
    if (!esperados.includes(resposta.status)) {
      throw new Error(`${rotulo}: esperado HTTP ${esperados.join('/')}, recebido HTTP ${resposta.status}; corpo omitido.`);
    }
    resultados.push({ probe: rotulo, categoria, status: resposta.status });
    return resposta;
  }

  async function login(rotulo, tenantSlug, email) {
    const resposta = await solicitar(rotulo, 'auth', '/auth/login', {
      method: 'POST',
      status: 200,
      body: JSON.stringify({ tenantSlug, email, senha: SENHA_FIXTURE }),
    });
    let resultado = await lerJsonSemExpor(resposta, rotulo);
    if (resultado?.mfaObrigatorio === true) {
      if (resultado.modo !== 'verificar') {
        throw new Error(`${rotulo}: fixture MFA sintetico nao foi preparado; conteudo omitido.`);
      }
      const desafioMfa = exigirCampoOpaco(resultado, 'desafioMfa', rotulo);
      const verificacao = await solicitar(`${rotulo} MFA`, 'auth', '/auth/mfa/login', {
        method: 'POST',
        status: 200,
        body: JSON.stringify({
          desafioMfa,
          codigo: gerarCodigoTotp(exigirSegredoTotpSintetico(ambiente)),
        }),
      });
      resultado = await lerJsonSemExpor(verificacao, `${rotulo} MFA`);
    }
    return exigirCampoOpaco(resultado, 'accessToken', rotulo);
  }

  await solicitar('readiness do alvo descartavel', 'limites', '/health/pronto', { status: 200 });
  await solicitar('rota protegida sem credencial', 'auth', '/pacientes', { status: 401 });
  await solicitar('JWT malformado', 'auth', '/pacientes', { status: 401, token: 'token-invalido' });
  await aguardarJanelaTotp();

  const tokenAlfa = await login('login tenant Alfa', 'octaclin-e2e-alfa', 'admin.alfa@octaclin.test');
  const tokenBeta = await login('login tenant Beta', 'octaclin-e2e-beta', 'admin.beta@octaclin.test');
  const tokenProfissional = await login(
    'login profissional Alfa',
    'octaclin-e2e-alfa',
    'profissional.alfa@octaclin.test',
  );

  await solicitar('BFLA profissional em operacoes', 'autorizacao_bfla', '/operacoes/resumo', {
    status: 403,
    token: tokenProfissional,
  });

  const sufixo = String(ambiente.GITHUB_RUN_ID ?? 'local').replace(/[^0-9]/g, '').slice(0, 20) || 'local';
  const pacienteBase = {
    profissionalResponsavelId: PROFISSIONAL_ALFA_ID,
    nome: `Paciente seguranca dinamica ${sufixo}`,
    contato: `seguranca.${sufixo}@octaclin.test`,
    dataNascimento: '1990-01-01',
    referenciaExterna: `pr54-${sufixo}`,
  };
  await solicitar('mass assignment de tenant', 'mass_assignment', '/pacientes', {
    method: 'POST',
    status: 400,
    token: tokenAlfa,
    body: JSON.stringify({ ...pacienteBase, tenantId: '23100000-0000-4000-8000-000000000002' }),
  });
  const criacao = await solicitar('fixture para BOLA', 'autorizacao_bola', '/pacientes', {
    method: 'POST',
    status: 201,
    token: tokenAlfa,
    body: JSON.stringify(pacienteBase),
  });
  const pacienteId = exigirCampoOpaco(await lerJsonSemExpor(criacao, 'fixture para BOLA'), 'id', 'fixture para BOLA');
  if (pacienteId !== PACIENTE_ID && !/^[0-9a-f-]{36}$/i.test(pacienteId)) {
    throw new Error('fixture para BOLA: identificador retornado nao e UUID; conteudo omitido.');
  }
  await solicitar('BOLA leitura cruzada', 'autorizacao_bola', `/pacientes/${encodeURIComponent(pacienteId)}`, {
    status: 404,
    token: tokenBeta,
  });
  await solicitar('BOLA mutacao cruzada', 'autorizacao_bola', `/pacientes/${encodeURIComponent(pacienteId)}`, {
    method: 'PATCH',
    status: 404,
    token: tokenBeta,
    body: JSON.stringify({ nome: 'Mutacao cruzada recusada' }),
  });

  await solicitar('UUID malformado', 'parser', '/pacientes/nao-e-uuid', { status: 400, token: tokenAlfa });
  const busca = encodeURIComponent("' OR 1=1 -- <script>alert(1)</script>");
  await solicitar('entrada inerte em busca', 'parser', `/pacientes?pagina=1&limite=5&busca=${busca}`, {
    status: 200,
    token: tokenAlfa,
  });
  await solicitar('JSON truncado', 'parser', '/auth/login', {
    method: 'POST',
    status: 400,
    body: '{',
  });
  await solicitar('corpo acima de 100kb', 'limites', '/auth/login', {
    method: 'POST',
    status: 413,
    body: JSON.stringify({
      tenantSlug: 'octaclin-e2e-alfa',
      email: 'payload@octaclin.test',
      senha: 'A'.repeat(103 * 1024),
    }),
  });
  await solicitar('upload acima de 20MB', 'upload', `/pacientes/${encodeURIComponent(pacienteId)}/evolucoes-fotograficas/uploads`, {
    method: 'POST',
    status: 400,
    token: tokenAlfa,
    body: JSON.stringify({
      consentimentoId: CONSENTIMENTO_SINTETICO_ID,
      protocolo: 'Frente',
      capturadaEm: '2026-09-08T12:00:00.000Z',
      mimeType: 'image/jpeg',
      tamanhoBytes: 20 * 1024 * 1024 + 1,
      nomeArquivo: 'limite.jpg',
    }),
  });

  const caminhoWebhook = `/comunicacoes/webhooks/whatsapp?token=${encodeURIComponent(receiveToken)}`;
  const payloadWebhook = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  await solicitar('webhook content-type invalido', 'webhook', caminhoWebhook, {
    method: 'POST',
    status: 415,
    headers: { 'Content-Type': 'text/plain' },
    body: payloadWebhook,
  });
  await solicitar('webhook assinatura invalida', 'webhook', caminhoWebhook, {
    method: 'POST',
    status: 403,
    headers: { 'X-Hub-Signature-256': `sha256=${'0'.repeat(64)}` },
    body: payloadWebhook,
  });
  const assinatura = createHmac('sha256', appSecret).update(payloadWebhook).digest('hex');
  await solicitar('webhook assinatura valida', 'webhook', caminhoWebhook, {
    method: 'POST',
    status: 200,
    headers: { 'X-Hub-Signature-256': `sha256=${assinatura}` },
    body: payloadWebhook,
  });
  const replay = await solicitar('webhook replay idempotente', 'webhook', caminhoWebhook, {
    method: 'POST',
    status: 200,
    headers: { 'X-Hub-Signature-256': `sha256=${assinatura}` },
    body: payloadWebhook,
  });
  const replayJson = await lerJsonSemExpor(replay, 'webhook replay idempotente');
  if (replayJson?.duplicado !== true) {
    throw new Error('webhook replay idempotente: marcador duplicado nao retornado; conteudo omitido.');
  }

  for (let tentativa = 1; tentativa <= 6; tentativa += 1) {
    await solicitar(`rate limit login ${tentativa}/6`, 'rate_limit', '/auth/login', {
      method: 'POST',
      status: tentativa === 6 ? 429 : 401,
      body: JSON.stringify({
        tenantSlug: 'octaclin-e2e-alfa',
        email: `rate-limit.${sufixo}@octaclin.test`,
        senha: 'SenhaInvalida@PR54',
      }),
    });
  }

  return {
    schemaVersion: 1,
    suite: 'PR54 seguranca dinamica staging',
    aprovado: true,
    requisicoes: orcamento.usadas,
    limiteRequisicoes: orcamento.limite,
    concorrencia: 1,
    cobertura: [...new Set(resultados.map(({ categoria }) => categoria))].sort(),
    probes: resultados,
  };
}

async function executarCli() {
  const resumo = await executarProbesSeguranca();
  const destino = resolve(process.cwd(), '../artifacts/security/pr54-probes.json');
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, `${JSON.stringify(resumo, null, 2)}\n`, 'utf8');
  console.log(`Seguranca dinamica PASS: ${resumo.requisicoes}/${resumo.limiteRequisicoes} requisicoes serializadas.`);
}

const executadoDiretamente = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (executadoDiretamente) {
  executarCli().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : 'Falha desconhecida na seguranca dinamica.');
    process.exitCode = 1;
  });
}
