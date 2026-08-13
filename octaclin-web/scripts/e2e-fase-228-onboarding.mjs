const config = {
  webUrl: process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000',
  apiUrl: process.env.E2E_API_URL ?? 'http://127.0.0.1:3001',
  tenantAdmin: 'octaclin-e2e-alfa',
  emailAdmin: 'admin.alfa@octaclin.test',
  senhaAdmin: 'OctaClinE2E@231'
};

const cookies = new Map();

function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

async function lerResposta(resposta) {
  const texto = await resposta.text();
  if (!texto) return null;
  try { return JSON.parse(texto); } catch { return texto; }
}

function validarStatus(resposta, esperado, contexto, corpo) {
  const esperados = Array.isArray(esperado) ? esperado : [esperado];
  assert(esperados.includes(resposta.status), `${contexto}: esperado HTTP ${esperados.join('/')}, recebido ${resposta.status}: ${JSON.stringify(corpo)}`);
}

async function api(caminho, { token, status = 200, ...init } = {}) {
  const resposta = await fetch(`${config.apiUrl}${caminho}`, {
    ...init,
    signal: AbortSignal.timeout(60_000),
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  const corpo = await lerResposta(resposta);
  validarStatus(resposta, status, `${init.method ?? 'GET'} ${caminho}`, corpo);
  return corpo;
}

function guardarCookies(headers) {
  const valores = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie')].filter(Boolean);
  for (const cookie of valores) {
    const [par] = cookie.split(';');
    const indice = par.indexOf('=');
    if (indice > 0) cookies.set(par.slice(0, indice).trim(), par.slice(indice + 1).trim());
  }
}

async function bff(caminho, { status = 200, ...init } = {}) {
  const metodo = (init.method ?? 'GET').toUpperCase();
  const resposta = await fetch(`${config.webUrl}${caminho}`, {
    ...init,
    signal: AbortSignal.timeout(60_000),
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(!['GET', 'HEAD', 'OPTIONS'].includes(metodo)
        ? { Origin: new URL(config.webUrl).origin, 'Sec-Fetch-Site': 'same-origin' }
        : {}),
      ...(cookies.size ? { Cookie: [...cookies].map(([nome, valor]) => `${nome}=${valor}`).join('; ') } : {}),
      ...init.headers
    }
  });
  guardarCookies(resposta.headers);
  const corpo = await lerResposta(resposta);
  validarStatus(resposta, status, `BFF ${metodo} ${caminho}`, corpo);
  return corpo;
}

async function login(tenantSlug, email, senha) {
  const resposta = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ tenantSlug, email, senha })
  });
  assert(typeof resposta?.accessToken === 'string', `Login de ${tenantSlug}/${email} nao retornou token.`);
  return resposta.accessToken;
}

function tokenDoLink(link, contexto) {
  assert(typeof link === 'string', `${contexto} nao expos link sintetico de primeiro acesso.`);
  const token = new URL(link).searchParams.get('token');
  assert(token, `${contexto} nao contem token.`);
  return token;
}

async function executar() {
  const sufixo = `${Date.now()}-${process.env.GITHUB_RUN_ID ?? 'local'}`;
  const slug = `clinica-e2e-${sufixo}`.toLowerCase();
  const referencia = `fase228-${sufixo}`.toLowerCase();
  const emailOwner = `owner.${sufixo}@octaclin.test`;
  const emailProfissional = `profissional.${sufixo}@octaclin.test`;
  const emailPaciente = `paciente.${sufixo}@octaclin.test`;
  const senhaOwner = 'OwnerE2E@228';
  const senhaProfissional = 'ProfE2E@228';
  const senhaPaciente = 'PacienteE2E@228';

  await bff('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: config.emailAdmin, senha: config.senhaAdmin })
  });
  const tokenAdmin = await login(config.tenantAdmin, config.emailAdmin, config.senhaAdmin);

  const dadosProvisionamento = {
    referencia,
    nome: `Clinica E2E Fase 228 ${sufixo}`,
    slug,
    emailProprietario: emailOwner,
    planoId: 'clinica',
    timezone: 'America/Sao_Paulo'
  };
  const [primeiro, segundo] = await Promise.all([
    bff('/api/operacoes/tenants', { method: 'POST', status: 201, body: JSON.stringify(dadosProvisionamento) }),
    bff('/api/operacoes/tenants', { method: 'POST', status: 201, body: JSON.stringify(dadosProvisionamento) })
  ]);
  const tenant = primeiro.reutilizado ? segundo : primeiro;
  const repeticao = primeiro.reutilizado ? primeiro : segundo;
  assert(tenant?.id && tenant?.reutilizado === false, 'Provisionamento concorrente nao criou tenant novo.');
  assert(repeticao?.id === tenant.id && repeticao?.reutilizado === true, 'Provisionamento concorrente duplicou ou mudou tenant.');

  const tokenOwnerConvite = tokenDoLink(tenant.convite?.linkPrimeiroAcesso, 'Convite do proprietario');
  await api('/auth/redefinir-senha', { method: 'POST', body: JSON.stringify({ token: tokenOwnerConvite, senha: senhaOwner }) });
  const tokenOwner = await login(slug, emailOwner, senhaOwner);
  const contextoOwner = await api('/auth/permissoes', { token: tokenOwner });
  assert(contextoOwner?.papel === 'Client', 'Proprietario nao recebeu papel Client.');

  await api(`/operacoes/tenants/${tenant.id}/ciclo-vida`, {
    token: tokenAdmin,
    method: 'POST',
    status: 201,
    body: JSON.stringify({ acao: 'marcar_primeiro_uso', motivo: 'Login sintetico do proprietario validado.' })
  });

  const usuarioProfissional = await api('/cliente/usuarios', {
    token: tokenOwner,
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      email: emailProfissional,
      role: 'Professional',
      nomeProfissional: `Profissional E2E ${sufixo}`,
      especialidade: 'Nutricao clinica'
    })
  });
  const tokenProfissionalConvite = tokenDoLink(usuarioProfissional.convite?.linkPrimeiroAcesso, 'Convite profissional');
  await api('/auth/redefinir-senha', {
    method: 'POST',
    body: JSON.stringify({ token: tokenProfissionalConvite, senha: senhaProfissional })
  });
  const tokenProfissional = await login(slug, emailProfissional, senhaProfissional);
  const contextoProfissional = await api('/auth/permissoes', { token: tokenProfissional });
  assert(contextoProfissional?.papel === 'Professional', 'Convite profissional nao aplicou o papel esperado.');
  const profissionais = await api('/profissionais?pagina=1&limite=10', { token: tokenProfissional });
  assert(profissionais?.total === 1 && profissionais.itens[0]?.id, 'Profissional nao encontrou o proprio painel isolado.');
  const profissionalId = profissionais.itens[0].id;

  const paciente = await api('/pacientes', {
    token: tokenProfissional,
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      profissionalResponsavelId: profissionalId,
      nome: `Paciente E2E Fase 228 ${sufixo}`,
      contato: emailPaciente,
      dataNascimento: '1994-05-20',
      referenciaExterna: referencia
    })
  });
  assert(paciente?.id, 'Paciente sintetico nao foi criado.');
  await api(`/pacientes/${paciente.id}`, { token: tokenAdmin, status: 404 });

  const convitePaciente = await api(`/pacientes/${paciente.id}/convites-acesso`, {
    token: tokenProfissional,
    method: 'POST',
    status: 201,
    body: JSON.stringify({ email: emailPaciente })
  });
  await api('/pacientes/convites-acesso/ativar', {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      token: convitePaciente.token,
      senha: senhaPaciente,
      aceiteLgpd: true,
      aceiteTermosUso: true,
      aceitePoliticaPrivacidade: true
    })
  });
  const tokenPaciente = await login(slug, emailPaciente, senhaPaciente);
  const contextoPaciente = await api('/auth/permissoes', { token: tokenPaciente });
  assert(contextoPaciente?.papel === 'Patient', 'Paciente ativado nao recebeu papel Patient.');

  const inicio = new Date(Date.now() + 72 * 60 * 60 * 1000);
  inicio.setUTCMinutes(0, 0, 0);
  const consulta = await api('/agenda/consultas', {
    token: tokenProfissional,
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      pacienteId: paciente.id,
      profissionalId,
      inicioEm: inicio.toISOString(),
      duracaoMinutos: 50,
      modalidade: 'online',
      local: 'Sala virtual E2E',
      enviarNotificacoes: false
    })
  });
  assert(consulta?.id, 'Consulta sintetica nao foi agendada.');

  const categoria = await api('/categorias-pergunta', {
    token: tokenProfissional,
    method: 'POST',
    status: 201,
    body: JSON.stringify({ nome: `Check-in E2E ${sufixo}`, iconeSvg: 'check-circle', corHex: '#167D7F', ordem: 1 })
  });
  const questionario = await api('/questionarios', {
    token: tokenProfissional,
    method: 'POST',
    status: 201,
    body: JSON.stringify({ profissionalId, titulo: `Ativacao Fase 228 ${sufixo}`, descricao: 'Formulario sintetico de onboarding.' })
  });
  const pergunta = await api(`/questionarios/${questionario.id}/perguntas`, {
    token: tokenProfissional,
    method: 'POST',
    status: 201,
    body: JSON.stringify({ categoriaId: categoria.id, tipo: 'texto_longo', enunciado: 'Como foi o primeiro acesso?', peso: 1, obrigatoria: true, configuracao: { limiteCaracteres: 300 } })
  });
  await api(`/questionarios/${questionario.id}`, { token: tokenProfissional, method: 'PATCH', body: JSON.stringify({ status: 'publicado' }) });
  const envio = await api(`/questionarios/${questionario.id}/envios`, {
    token: tokenProfissional,
    method: 'POST',
    status: 201,
    body: JSON.stringify({ pacienteId: paciente.id })
  });
  await api(`/formularios/${encodeURIComponent(envio.tokenFormulario)}/respostas`, {
    method: 'POST',
    status: 201,
    body: JSON.stringify({ respostas: [{ perguntaId: pergunta.id, valor: 'Primeiro acesso sintetico concluido.' }] })
  });

  await api(`/operacoes/tenants/${tenant.id}/ciclo-vida`, { token: tokenAdmin, method: 'POST', status: 201, body: JSON.stringify({ acao: 'iniciar_acompanhamento' }) });
  await api(`/operacoes/tenants/${tenant.id}/ciclo-vida`, { token: tokenAdmin, method: 'POST', status: 201, body: JSON.stringify({ acao: 'concluir_acompanhamento' }) });
  await api(`/operacoes/tenants/${tenant.id}/ciclo-vida`, { token: tokenAdmin, method: 'POST', status: 201, body: JSON.stringify({ acao: 'suspender', motivo: 'Teste sintetico de inadimplencia.' }) });
  await api('/cliente/usuarios', {
    token: tokenOwner,
    method: 'POST',
    status: 403,
    body: JSON.stringify({ email: `bloqueado.${sufixo}@octaclin.test`, role: 'Collaborator' })
  });
  await api(`/operacoes/tenants/${tenant.id}/ciclo-vida`, { token: tokenAdmin, method: 'POST', status: 201, body: JSON.stringify({ acao: 'reativar' }) });
  await api(`/operacoes/tenants/${tenant.id}/ciclo-vida`, { token: tokenAdmin, method: 'POST', status: 201, body: JSON.stringify({ acao: 'iniciar_encerramento', motivo: 'Encerramento sintetico.' }) });
  await api(`/operacoes/tenants/${tenant.id}/ciclo-vida`, {
    token: tokenAdmin,
    method: 'POST',
    status: 400,
    body: JSON.stringify({ acao: 'encerrar', exportacaoConfirmada: true })
  });
  await api(`/operacoes/tenants/${tenant.id}/ciclo-vida`, {
    token: tokenAdmin,
    method: 'POST',
    status: 201,
    body: JSON.stringify({ acao: 'encerrar', exportacaoConfirmada: true, protocoloExportacao: `EXP-${sufixo}` })
  });
  await api('/auth/login', {
    method: 'POST',
    status: 401,
    body: JSON.stringify({ tenantSlug: slug, email: emailOwner, senha: senhaOwner })
  });

  console.log(JSON.stringify({
    fase: 228,
    tenantSintetico: slug,
    resultado: {
      provisionamento: 'idempotente',
      proprietario: 'convite_e_senha_propria',
      profissional: 'convidado_e_permissoes_validadas',
      paciente: 'cadastrado_convidado_e_ativado',
      agenda: 'consulta_criada',
      formulario: 'publicado_distribuido_e_respondido',
      cicloVida: 'ativado_suspenso_reativado_exportado_encerrado',
      isolamento: 'leitura_cruzada_negada'
    }
  }, null, 2));
}

executar().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
