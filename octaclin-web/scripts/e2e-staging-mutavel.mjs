import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { exigirSegredoTotpSintetico, gerarCodigoTotp } from './e2e-mfa.mjs';

const config = {
  webUrl: process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000',
  apiUrl: process.env.E2E_API_URL ?? 'http://127.0.0.1:3001',
  tenantAlfa: 'octaclin-e2e-alfa',
  tenantBeta: 'octaclin-e2e-beta',
  emailAlfa: 'admin.alfa@octaclin.test',
  emailBeta: 'admin.beta@octaclin.test',
  emailProfissionalBeta: 'profissional.beta@octaclin.test',
  senha: 'OctaClinE2E@231',
  profissionalAlfaId: '23110000-0000-4000-8000-000000000001',
  categoriaAlfaId: '23120000-0000-4000-8000-000000000001'
};

const cookies = new Map();

function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function extrairSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const valor = headers.get('set-cookie');
  return valor ? valor.split(/,(?=\s*[^;,]+=)/) : [];
}

function guardarCookies(headers) {
  for (const cookie of extrairSetCookies(headers)) {
    const [par] = cookie.split(';');
    const indice = par.indexOf('=');
    if (indice > 0) cookies.set(par.slice(0, indice).trim(), par.slice(indice + 1).trim());
  }
}

function cookieHeader() {
  return [...cookies].map(([nome, valor]) => `${nome}=${valor}`).join('; ');
}

async function lerResposta(resposta) {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

function validarStatus(resposta, esperados, contexto, corpo) {
  const lista = Array.isArray(esperados) ? esperados : [esperados];
  assert(
    lista.includes(resposta.status),
    `${contexto}: esperado HTTP ${lista.join('/')}, recebido ${resposta.status}: ${JSON.stringify(corpo)}`
  );
}

async function bff(caminho, { status = 200, ...init } = {}) {
  const metodo = (init.method ?? 'GET').toUpperCase();
  const mutacao = !['GET', 'HEAD', 'OPTIONS'].includes(metodo);
  const resposta = await fetch(`${config.webUrl}${caminho}`, {
    ...init,
    signal: AbortSignal.timeout(60_000),
    headers: {
      Accept: 'application/json',
      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(mutacao ? { Origin: new URL(config.webUrl).origin, 'Sec-Fetch-Site': 'same-origin' } : {}),
      ...(cookies.size ? { Cookie: cookieHeader() } : {}),
      ...init.headers
    }
  });
  guardarCookies(resposta.headers);
  const corpo = await lerResposta(resposta);
  validarStatus(resposta, status, `BFF ${metodo} ${caminho}`, corpo);
  return corpo;
}

async function api(caminho, { token, status = 200, ...init } = {}) {
  const metodo = (init.method ?? 'GET').toUpperCase();
  const resposta = await fetch(`${config.apiUrl}${caminho}`, {
    ...init,
    signal: AbortSignal.timeout(60_000),
    headers: {
      Accept: 'application/json',
      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  const corpo = await lerResposta(resposta);
  validarStatus(resposta, status, `API ${metodo} ${caminho}`, corpo);
  return corpo;
}

async function loginDireto(tenantSlug, email, senha = config.senha) {
  let sessao = await api('/auth/login', {
    method: 'POST',
    status: 200,
    body: JSON.stringify({ tenantSlug, email, senha })
  });
  if (sessao?.mfaObrigatorio === true) {
    let segredo = exigirSegredoTotpSintetico();
    if (sessao.modo === 'configurar') {
      const configuracao = await api('/auth/mfa/login/configuracao', {
        method: 'POST',
        body: JSON.stringify({ desafioMfa: sessao.desafioMfa })
      });
      segredo = configuracao?.segredo;
    }
    sessao = await api('/auth/mfa/login', {
      method: 'POST',
      body: JSON.stringify({ desafioMfa: sessao.desafioMfa, codigo: gerarCodigoTotp(segredo) })
    });
  }
  assert(typeof sessao?.accessToken === 'string', `Login direto de ${tenantSlug} nao retornou accessToken.`);
  return sessao.accessToken;
}

async function loginBff(email, senha = config.senha) {
  const desafio = await bff('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha })
  });
  if (desafio?.mfaObrigatorio !== true) return desafio;

  let segredo = exigirSegredoTotpSintetico();
  if (desafio.modo === 'configurar') {
    const configuracao = await bff('/api/auth/mfa/configuracao-login', { method: 'POST' });
    segredo = configuracao?.segredo;
  }
  return bff('/api/auth/mfa/concluir-login', {
    method: 'POST',
    body: JSON.stringify({ codigo: gerarCodigoTotp(segredo) })
  });
}

async function executar() {
  const sufixo = `${Date.now()}-${process.env.GITHUB_RUN_ID ?? 'local'}`;
  const inicio = new Date(Date.now() + 48 * 60 * 60 * 1000);
  inicio.setUTCMinutes(0, 0, 0);
  const remarcado = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  const pronto = await api('/health/pronto');
  assert(pronto?.status === 'ok' || pronto?.pronto === true, 'Backend nao ficou pronto para a jornada mutavel.');

  await loginBff(config.emailAlfa);
  const sessaoBff = await bff('/api/auth/session');
  assert(sessaoBff?.autenticado === true, 'Sessao BFF do tenant Alfa nao foi estabelecida.');

  const tokenBeta = await loginDireto(config.tenantBeta, config.emailProfissionalBeta);

  const paciente = await bff('/api/pacientes', {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      profissionalResponsavelId: config.profissionalAlfaId,
      nome: `Paciente E2E ${sufixo}`,
      contato: `paciente.${sufixo}@octaclin.test`,
      dataNascimento: '1992-06-15',
      referenciaExterna: `fase231-${sufixo}`
    })
  });
  assert(paciente?.id, 'Criacao de paciente nao retornou id.');

  const pacienteEditado = await bff(`/api/pacientes/${paciente.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ statusAdesao: 'em_acompanhamento' })
  });
  assert(pacienteEditado?.statusAdesao === 'em_acompanhamento', 'Edicao do paciente nao persistiu.');

  await api(`/pacientes/${paciente.id}`, { token: tokenBeta, status: 404 });
  const listaBeta = await api('/pacientes?pagina=1&limite=100', { token: tokenBeta });
  assert(!listaBeta.itens.some((item) => item.id === paciente.id), 'Tenant Beta enxergou paciente do tenant Alfa.');

  // A prévia FOOD05 usa somente composições criadas neste banco descartável.
  // Ela passa pela sessão profissional do BFF e pelo serviço autenticado real,
  // mas não salva nem publica o plano nem a equivalência.
  cookies.clear();
  await loginBff('profissional.alfa@octaclin.test');
  const sessaoProfissional = await bff('/api/auth/session');
  assert(sessaoProfissional?.autenticado === true, 'Sessao BFF profissional da FOOD05 nao foi estabelecida.');

  const principalFood05 = await bff('/api/planos-alimentares/alimentos-personalizados', {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      chaveIdempotencia: randomUUID(),
      escopo: 'pessoal',
      nome: `Principal FOOD05 E2E ${sufixo}`,
      preparacao: 'sintetico',
      referenciaComposicao: 'fixture sintética E2E',
      base: { tipo: 'por100g' },
      nutrientes: { energiaKcal: 200, proteinasG: 10, carboidratosG: 20, gordurasG: 5 }
    })
  });
  const alternativaFood05 = await bff('/api/planos-alimentares/alimentos-personalizados', {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      chaveIdempotencia: randomUUID(),
      escopo: 'pessoal',
      nome: `Alternativa FOOD05 E2E ${sufixo}`,
      preparacao: 'sintetico',
      referenciaComposicao: 'fixture sintética E2E',
      base: { tipo: 'por100g' },
      nutrientes: { energiaKcal: 100, proteinasG: 5, carboidratosG: 10, gordurasG: 2.5 }
    })
  });
  assert(principalFood05?.id && principalFood05?.revisao === 1, 'Composicao principal FOOD05 sintetica nao foi criada.');
  assert(alternativaFood05?.id && alternativaFood05?.revisao === 1, 'Composicao alternativa FOOD05 sintetica nao foi criada.');

  const planoFood05 = await bff(`/api/pacientes/${paciente.id}/planos-alimentares`, {
    method: 'POST',
    status: 201,
    body: JSON.stringify({ titulo: `Plano FOOD05 E2E ${sufixo}` })
  });
  assert(planoFood05?.id, 'Plano FOOD05 sintetico nao foi criado.');
  const rascunhoFood05 = await bff(`/api/pacientes/${paciente.id}/planos-alimentares/${planoFood05.id}/rascunho`);
  assert(rascunhoFood05?.id && Number.isInteger(rascunhoFood05?.rascunhoRevisao), 'Rascunho FOOD05 nao retornou identidade e revisao.');

  const itemFood05 = `item-food05-${sufixo}`;
  const refeicaoFood05 = `refeicao-food05-${sufixo}`;
  const pedidoFood05 = {
    versaoId: rascunhoFood05.id,
    rascunhoRevisaoEsperada: rascunhoFood05.rascunhoRevisao,
    itemChave: itemFood05,
    nutriente: 'energiaKcal',
    politica: { passoPorcaoGramas: '1' },
    documentoEdicao: {
      schemaVersao: 1,
      refeicoes: [{
        chaveCliente: refeicaoFood05,
        nome: 'Refeicao sintetica FOOD05',
        itens: [{
          chaveCliente: itemFood05,
          descricao: principalFood05.nome,
          alimentoPersonalizado: { id: principalFood05.id, revisao: principalFood05.revisao, aplicacaoId: randomUUID() },
          quantidade: 50,
          unidade: 'g',
          porcaoGramas: 50,
          substituicoes: []
        }]
      }]
    },
    alternativas: [{
      chaveCliente: `alternativa-food05-${sufixo}`,
      descricao: alternativaFood05.nome,
      alimentoPersonalizado: { id: alternativaFood05.id, revisao: alternativaFood05.revisao, aplicacaoId: randomUUID() },
      quantidade: 1,
      unidade: 'g'
    }]
  };
  const previaFood05 = await bff(`/api/pacientes/${paciente.id}/planos-alimentares/${planoFood05.id}/equivalencias/previa`, {
    method: 'POST',
    body: JSON.stringify(pedidoFood05)
  });
  const resultadoFood05 = previaFood05?.alternativas?.[0]?.resultado;
  assert(previaFood05?.nutriente === 'energiaKcal' && resultadoFood05?.estado === 'calculavel', 'Prévia autenticada FOOD05 nao calculou a alternativa sintetica.');
  assert(Number(resultadoFood05?.nutrienteAlvo) === 100 && Number(resultadoFood05?.porcaoSugeridaGramas) === 100, 'Prévia FOOD05 nao preservou o resultado matematico esperado.');
  const rascunhoDepoisDaPrevia = await bff(`/api/pacientes/${paciente.id}/planos-alimentares/${planoFood05.id}/rascunho`);
  assert(rascunhoDepoisDaPrevia?.id === rascunhoFood05.id && rascunhoDepoisDaPrevia?.rascunhoRevisao === rascunhoFood05.rascunhoRevisao, 'Prévia FOOD05 alterou o rascunho sem confirmação.');

  await api(`/pacientes/${paciente.id}/planos-alimentares/${planoFood05.id}/equivalencias/previa`, {
    token: tokenBeta,
    method: 'POST',
    status: 404,
    body: JSON.stringify(pedidoFood05)
  });

  const consulta = await bff('/api/agenda/consultas', {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      pacienteId: paciente.id,
      profissionalId: config.profissionalAlfaId,
      inicioEm: inicio.toISOString(),
      duracaoMinutos: 50,
      modalidade: 'presencial',
      local: 'Sala E2E',
      enviarNotificacoes: false
    })
  });
  assert(consulta?.id, 'Agendamento nao retornou id.');

  const consultaRemarcada = await bff(`/api/agenda/consultas/${consulta.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      inicioEm: remarcado.toISOString(),
      duracaoMinutos: 45,
      modalidade: 'presencial',
      local: 'Sala E2E 2'
    })
  });
  assert(new Date(consultaRemarcada.inicioEm).getTime() === remarcado.getTime(), 'Reagendamento nao persistiu a data.');
  await bff(`/api/agenda/consultas/${consulta.id}`, {
    method: 'DELETE',
    body: JSON.stringify({ motivo: 'Cancelamento sintetico da Fase 231' })
  });

  const canal = await bff('/api/comunicacoes/canais', {
    method: 'POST',
    status: 201,
    body: JSON.stringify({ tipo: 'email', nome: `Canal E2E ${sufixo}`, configuracao: { modo: 'e2e' }, ativo: true })
  });
  const template = await bff('/api/comunicacoes/templates', {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      canal: 'email',
      codigoExterno: `fase231-${sufixo}`,
      nome: `Template E2E ${sufixo}`,
      conteudo: { assunto: 'Fase 231', corpo: 'Mensagem sintetica para {{nome}}.' },
      aprovado: true
    })
  });
  const mensagem = await bff('/api/comunicacoes/mensagens', {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      pacienteId: paciente.id,
      canalId: canal.id,
      templateId: template.id,
      payload: { nome: paciente.nome, destino: `paciente.${sufixo}@octaclin.test` }
    })
  });
  assert(mensagem?.status === 'pendente', 'Comunicacao E2E deve ficar pendente sem worker externo.');

  const convite = await bff(`/api/pacientes/${paciente.id}/convites-acesso`, {
    method: 'POST',
    status: 201,
    body: JSON.stringify({ email: `portal.${sufixo}@octaclin.test` })
  });
  assert(typeof convite?.token === 'string', 'Convite nao retornou token de ativacao.');
  await api(`/pacientes/convites-acesso/${encodeURIComponent(convite.token)}`);

  const questionario = await bff('/api/questionarios', {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      profissionalId: config.profissionalAlfaId,
      titulo: `Check-in Fase 231 ${sufixo}`,
      descricao: 'Formulario sintetico mutavel.'
    })
  });
  const perguntaTexto = await bff(`/api/questionarios/${questionario.id}/perguntas`, {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      categoriaId: config.categoriaAlfaId,
      tipo: 'texto_longo',
      enunciado: 'Como foi sua semana?',
      peso: 1,
      obrigatoria: true,
      configuracao: { limiteCaracteres: 500 }
    })
  });
  const perguntaUpload = await bff(`/api/questionarios/${questionario.id}/perguntas`, {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      categoriaId: config.categoriaAlfaId,
      tipo: 'upload_midia',
      enunciado: 'Envie uma imagem sintetica.',
      peso: 0,
      obrigatoria: true,
      configuracao: { tiposAceitos: ['image/png'], maxArquivos: 1 }
    })
  });
  await bff(`/api/questionarios/${questionario.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'publicado' })
  });
  const envio = await bff(`/api/questionarios/${questionario.id}/envios`, {
    method: 'POST',
    status: 201,
    body: JSON.stringify({ pacienteId: paciente.id })
  });
  assert(typeof envio?.tokenFormulario === 'string', 'Envio do formulario nao retornou token publico.');
  const tokenFormulario = encodeURIComponent(envio.tokenFormulario);
  const formulario = await bff(`/api/formularios/${tokenFormulario}`);
  assert(formulario?.perguntas?.length === 2, 'Formulario publico nao retornou o snapshot esperado.');

  const imagemSintetica = await readFile(new URL('../public/icons/octaclin-192.png', import.meta.url));
  const upload = await bff(`/api/formularios/${tokenFormulario}/anexos`, {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      perguntaId: perguntaUpload.id,
      nomeArquivo: 'fase-231.png',
      mimeType: 'image/png',
      tamanhoBytes: imagemSintetica.length
    })
  });
  assert(upload?.arquivo?.id && upload?.uploadUrl, 'Solicitacao de upload nao retornou URL assinada.');
  const envioObjeto = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: upload.uploadHeaders,
    body: imagemSintetica,
    signal: AbortSignal.timeout(30_000)
  });
  assert(envioObjeto.ok, `Upload no S3 efemero falhou com HTTP ${envioObjeto.status}.`);
  const arquivo = await bff(`/api/formularios/${tokenFormulario}/anexos/${upload.arquivo.id}/confirmacao`, {
    method: 'POST',
    status: 201,
    body: JSON.stringify({ perguntaId: perguntaUpload.id })
  });
  assert(arquivo?.status === 'confirmado', 'Upload nao foi confirmado apos inspecao do objeto.');

  const respostas = [
    { perguntaId: perguntaTexto.id, valor: 'Semana sintetica concluida com sucesso.' },
    { perguntaId: perguntaUpload.id, valor: [arquivo.id] }
  ];
  const rascunho = await bff(`/api/formularios/${tokenFormulario}/rascunho`, {
    method: 'PATCH',
    body: JSON.stringify({ versaoBase: 0, respostas })
  });
  assert(rascunho?.rascunhoVersao === 1, 'Rascunho do formulario nao avancou versao.');
  const finalizacao = await bff(`/api/formularios/${tokenFormulario}/respostas`, {
    method: 'POST',
    status: 201,
    body: JSON.stringify({ respostas })
  });
  assert(finalizacao?.status === 'respondido', 'Formulario nao foi finalizado.');
  const respostasClinicas = await bff(`/api/questionarios/${questionario.id}/respostas`);
  assert(respostasClinicas.some((item) => item.envioId === envio.id), 'Resposta nao apareceu na leitura clinica.');

  const ativacao = await api('/pacientes/convites-acesso/ativar', {
    method: 'POST',
    status: 201,
    body: JSON.stringify({
      token: convite.token,
      senha: 'PortalE2E@231',
      aceiteLgpd: true,
      aceiteTermosUso: true,
      aceitePoliticaPrivacidade: true
    })
  });
  assert(ativacao?.pacienteId === paciente.id, 'Convite nao ativou o paciente esperado.');
  await loginDireto(config.tenantAlfa, `portal.${sufixo}@octaclin.test`, 'PortalE2E@231');

  await bff(`/api/pacientes/${paciente.id}`);
  await api(`/pacientes/${paciente.id}`, { token: tokenBeta, status: 404 });

  console.log(
    JSON.stringify(
      {
        fase: 231,
        tenantAlfa: config.tenantAlfa,
        tenantBeta: config.tenantBeta,
        jornadas: {
          paciente: 'criado_e_editado',
          agenda: 'agendada_reagendada_cancelada',
          comunicacao: 'persistida_e_enfileirada_sem_envio_externo',
          convite: 'ativado_com_login_paciente',
          formulario: 'rascunho_upload_resposta_leitura_clinica',
          isolamentoTenant: 'negado_em_leitura_cruzada',
          food05: 'previa_autenticada_calculada_sem_persistencia_e_acesso_cross_tenant_negado'
        }
      },
      null,
      2
    )
  );
}

executar().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
