const configuracao = {
  webUrl: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:3001',
  tenantSlug: process.env.E2E_TENANT_SLUG ?? 'clinica-carla',
  email: process.env.E2E_EMAIL ?? 'admin@octaclin.local',
  senha: process.env.E2E_SENHA ?? 'OctaClin@123'
};

const rotasProtegidas = [
  { caminho: '/operacoes', titulo: 'Confiabilidade OctaClin', subtitulo: 'Operacoes' },
  { caminho: '/pacientes', titulo: 'Pacientes', subtitulo: 'Acompanhamento clinico' },
  { caminho: '/profissionais', titulo: 'Profissionais', subtitulo: 'Equipe clinica' },
  { caminho: '/questionarios', titulo: 'Editor de Questionarios', subtitulo: 'Protocolos e check-ins' },
  { caminho: '/comunicacoes', titulo: 'Comunicacoes', subtitulo: 'Canais e mensagens' },
  { caminho: '/automacoes', titulo: 'Automacoes', subtitulo: 'Regras clinicas' },
  { caminho: '/ia', titulo: 'IA clinica', subtitulo: 'Modelos assistivos' },
  { caminho: '/mobile', titulo: 'Mobile', subtitulo: 'App e sincronizacao' },
  { caminho: '/gamificacao', titulo: 'Gamificacao', subtitulo: 'Comunidade e conquistas' }
];

const referenciasExternasProibidas = [
  ['Live', 'Clin'].join(''),
  ['Live', 'clin'].join(''),
  ['live', 'clin'].join('')
];

const cookies = new Map();

function baseUrl() {
  return configuracao.webUrl.replace(/\/$/, '');
}

function url(caminho) {
  return `${baseUrl()}${caminho}`;
}

function extrairSetCookie(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const valor = headers.get('set-cookie');
  if (!valor) return [];
  return valor.split(/,(?=\s*[^;,]+=)/);
}

function armazenarCookies(headers) {
  for (const cookie of extrairSetCookie(headers)) {
    const [parNomeValor] = cookie.split(';');
    const separador = parNomeValor.indexOf('=');
    if (separador <= 0) continue;
    cookies.set(parNomeValor.slice(0, separador).trim(), parNomeValor.slice(separador + 1).trim());
  }
}

function cabecalhoCookie() {
  return Array.from(cookies.entries())
    .map(([nome, valor]) => `${nome}=${valor}`)
    .join('; ');
}

async function requisitar(caminho, init = {}) {
  const resposta = await fetch(url(caminho), {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookies.size ? { Cookie: cabecalhoCookie() } : {}),
      ...init.headers
    }
  });
  armazenarCookies(resposta.headers);
  return resposta;
}

function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function assertStatus(resposta, status, contexto) {
  assert(resposta.status === status, `${contexto}: esperado HTTP ${status}, recebido HTTP ${resposta.status}`);
}

function assertInclui(html, texto, contexto) {
  assert(html.includes(texto), `${contexto}: texto esperado ausente: ${texto}`);
}

function assertNaoInclui(html, texto, contexto) {
  assert(!html.includes(texto), `${contexto}: texto proibido encontrado: ${texto}`);
}

function assertShell(html, contexto) {
  assertInclui(html, 'OctaClin', contexto);
  assertInclui(html, 'Console clinico', contexto);
  for (const referencia of referenciasExternasProibidas) assertNaoInclui(html, referencia, contexto);
  assertNaoInclui(html, '__NEXT_ERROR__', contexto);
  assertNaoInclui(html, 'Application error', contexto);
}

async function validarLogin() {
  const resposta = await requisitar('/login');
  assertStatus(resposta, 200, 'login');
  const html = await resposta.text();
  assertInclui(html, 'Acesso OctaClin', 'login');
  assertInclui(html, 'Email', 'login');
  assertInclui(html, 'Senha', 'login');
  assertNaoInclui(html, '>API<', 'login');
  assertNaoInclui(html, '>Tenant<', 'login');
  assertNaoInclui(html, configuracao.apiUrl, 'login');
  assertNaoInclui(html, configuracao.tenantSlug, 'login');
  assertNaoInclui(html, configuracao.email, 'login');
  assertNaoInclui(html, configuracao.senha, 'login');
}

async function validarProtecaoInicial() {
  const resposta = await fetch(url('/operacoes'), { redirect: 'manual' });
  assert(
    [302, 303, 307, 308].includes(resposta.status),
    `protecao inicial: esperado redirecionamento, recebido HTTP ${resposta.status}`
  );
  assert(
    resposta.headers.get('location')?.includes('/login'),
    'protecao inicial: Location precisa apontar para /login.'
  );
}

async function autenticar() {
  const resposta = await requisitar('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: configuracao.email,
      senha: configuracao.senha
    })
  });
  assertStatus(resposta, 200, 'login BFF');

  const sessao = await requisitar('/api/auth/session');
  assertStatus(sessao, 200, 'sessao BFF');
}

async function validarRota({ caminho, titulo, subtitulo }) {
  const resposta = await requisitar(caminho);
  assertStatus(resposta, 200, `rota ${caminho}`);
  const html = await resposta.text();
  assertShell(html, `rota ${caminho}`);
  assertInclui(html, titulo, `rota ${caminho}`);
  assertInclui(html, subtitulo, `rota ${caminho}`);
}

async function main() {
  await validarProtecaoInicial();
  await validarLogin();
  await autenticar();

  for (const rota of rotasProtegidas) {
    await validarRota(rota);
  }

  console.log('smoke-ui-regression-ok');
  console.log(`web=${configuracao.webUrl}`);
  console.log(`api=${configuracao.apiUrl}`);
  console.log(`rotas=${rotasProtegidas.length}`);
}

main().catch((erro) => {
  console.error('smoke-ui-regression-failed');
  console.error(erro);
  process.exitCode = 1;
});
