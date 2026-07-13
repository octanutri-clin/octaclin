const configuracao = {
  webUrl: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:3001',
  tenantSlug: process.env.E2E_TENANT_SLUG ?? 'clinica-carla',
  email: process.env.E2E_EMAIL ?? 'admin@octaclin.local',
  senha: process.env.E2E_SENHA ?? 'OctaClin@123'
};

const cookies = new Map();
const setCookiesRecebidos = [];

function url(caminho) {
  return `${configuracao.webUrl.replace(/\/$/, '')}${caminho}`;
}

function extrairSetCookie(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const valor = headers.get('set-cookie');
  if (!valor) return [];
  return valor.split(/,(?=\s*[^;,]+=)/);
}

function armazenarCookies(headers) {
  const setCookies = extrairSetCookie(headers);
  setCookiesRecebidos.push(...setCookies);

  setCookies.forEach((cookie) => {
    const [parNomeValor] = cookie.split(';');
    const separador = parNomeValor.indexOf('=');
    if (separador <= 0) return;
    cookies.set(parNomeValor.slice(0, separador).trim(), parNomeValor.slice(separador + 1).trim());
  });
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

async function requisitarJson(caminho, init = {}) {
  const resposta = await requisitar(caminho, init);
  const texto = await resposta.text();
  let corpo;

  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }

  return { resposta, corpo };
}

async function requisitarJsonStatus(caminho, status, contexto, init = {}) {
  const resultado = await requisitarJson(caminho, init);
  assertStatus(resultado.resposta, status, contexto);
  return resultado.corpo;
}

function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function assertStatus(resposta, status, contexto) {
  assert(resposta.status === status, `${contexto}: esperado HTTP ${status}, recebido HTTP ${resposta.status}`);
}

function assertCookieHttpOnly(nome) {
  const cookie = setCookiesRecebidos.find((valor) => valor.startsWith(`${nome}=`));
  assert(cookie, `Cookie ${nome} nao foi emitido.`);
  assert(/;\s*httponly/i.test(cookie), `Cookie ${nome} precisa ser HttpOnly.`);
}

function assertArray(corpo, nome) {
  assert(Array.isArray(corpo), `${nome}: resposta precisa ser lista.`);
  assert(corpo.length > 0, `${nome}: resposta precisa conter ao menos um item.`);
}

function assertListaPaginada(corpo, nome) {
  assert(corpo && Array.isArray(corpo.itens), `${nome}: resposta nao contem itens[].`);
  assert(typeof corpo.total === 'number', `${nome}: resposta nao contem total numerico.`);
  assert(corpo.itens.length > 0, `${nome}: seed demo precisa retornar ao menos um registro.`);
}

async function assertPaginaProtegida(caminho, tituloEsperado) {
  const resposta = await requisitar(caminho);
  assertStatus(resposta, 200, `pagina protegida ${caminho}`);
  const html = await resposta.text();
  assert(html.includes('OctaClin'), `pagina protegida ${caminho}: marca OctaClin ausente.`);
  assert(html.includes('Console clinico'), `pagina protegida ${caminho}: shell do console ausente.`);
  if (tituloEsperado) {
    assert(html.includes(tituloEsperado), `pagina protegida ${caminho}: titulo "${tituloEsperado}" ausente.`);
  }
}

async function aguardarAuditoria(acao) {
  for (let tentativa = 1; tentativa <= 8; tentativa += 1) {
    const { resposta, corpo } = await requisitarJson(`/api/operacoes/auditoria?acao=${encodeURIComponent(acao)}&limite=10`);
    assertStatus(resposta, 200, `auditoria ${acao}`);
    assert(Array.isArray(corpo), `auditoria ${acao}: resposta precisa ser lista.`);

    const evento = corpo.find((item) => item.acao === acao);
    if (evento) return evento;

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Evento de auditoria nao encontrado para ${acao}.`);
}

async function main() {
  const sessaoAusente = await requisitar('/api/auth/session');
  assertStatus(sessaoAusente, 401, 'sessao antes do login');
  assert(
    sessaoAusente.headers.get('cache-control')?.includes('no-store'),
    'sessao antes do login precisa retornar Cache-Control no-store.'
  );

  const loginApiInvalida = await requisitarJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      apiUrl: 'ftp://localhost:3001',
      tenantSlug: configuracao.tenantSlug,
      email: configuracao.email,
      senha: configuracao.senha
    })
  });
  assertStatus(loginApiInvalida.resposta, 400, 'login BFF com API invalida');
  assert(
    typeof loginApiInvalida.corpo?.mensagem === 'string' && loginApiInvalida.corpo.mensagem.includes('HTTP'),
    'login BFF com API invalida precisa retornar envelope JSON com mensagem.'
  );

  const login = await requisitarJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      apiUrl: configuracao.apiUrl,
      tenantSlug: configuracao.tenantSlug,
      email: configuracao.email,
      senha: configuracao.senha
    })
  });
  assertStatus(login.resposta, 200, 'login BFF');
  assert(login.corpo?.email === configuracao.email, 'login BFF: email retornado nao confere.');
  assertCookieHttpOnly('octaclin_access_token');
  assertCookieHttpOnly('octaclin_refresh_token');

  const sessao = await requisitarJson('/api/auth/session');
  assertStatus(sessao.resposta, 200, 'sessao apos login');
  assert(sessao.corpo?.autenticado === true, 'sessao apos login: autenticado precisa ser true.');
  assert(
    sessao.resposta.headers.get('cache-control')?.includes('no-store'),
    'sessao apos login precisa retornar Cache-Control no-store.'
  );

  await assertPaginaProtegida('/operacoes', 'Confiabilidade OctaClin');
  await assertPaginaProtegida('/pacientes', 'Pacientes');
  await assertPaginaProtegida('/profissionais', 'Profissionais');
  await assertPaginaProtegida('/questionarios', 'Editor de Questionarios');
  await assertPaginaProtegida('/comunicacoes', 'Comunicacoes');
  await assertPaginaProtegida('/automacoes', 'Automacoes');
  await assertPaginaProtegida('/ia', 'IA clinica');
  await assertPaginaProtegida('/mobile', 'Mobile');
  await assertPaginaProtegida('/gamificacao', 'Gamificacao');

  const pacientes = await requisitarJson('/api/pacientes?pagina=1&limite=5');
  assertStatus(pacientes.resposta, 200, 'listagem de pacientes');
  assertListaPaginada(pacientes.corpo, 'listagem de pacientes');
  assert(typeof pacientes.corpo.itens[0].nome === 'string', 'paciente precisa retornar nome descriptografado.');
  assert(typeof pacientes.corpo.itens[0].contato === 'string', 'paciente precisa retornar contato descriptografado.');

  const profissionais = await requisitarJson('/api/profissionais?pagina=1&limite=5');
  assertStatus(profissionais.resposta, 200, 'listagem de profissionais');
  assertListaPaginada(profissionais.corpo, 'listagem de profissionais');
  assert(typeof profissionais.corpo.itens[0].nome === 'string', 'profissional precisa retornar nome descriptografado.');

  const sufixo = Date.now();
  const profissionalCriado = await requisitarJsonStatus('/api/profissionais', 201, 'criacao de profissional', {
    method: 'POST',
    body: JSON.stringify({
      email: `e2e.${sufixo}@octaclin.local`,
      senhaInicial: 'OctaClin@123',
      nome: `Profissional E2E ${sufixo}`,
      registroProfissional: `CRN-E2E-${sufixo}`,
      especialidade: 'Nutricao clinica'
    })
  });
  assert(profissionalCriado.id, 'criacao de profissional: id ausente.');

  const profissionalAtualizado = await requisitarJsonStatus(
    `/api/profissionais/${profissionalCriado.id}`,
    200,
    'edicao de profissional',
    {
      method: 'PATCH',
      body: JSON.stringify({
        nome: `${profissionalCriado.nome} atualizado`,
        registroProfissional: profissionalCriado.registroProfissional,
        especialidade: 'Nutricao comportamental'
      })
    }
  );
  assert(profissionalAtualizado.especialidade === 'Nutricao comportamental', 'edicao de profissional nao persistiu.');

  const pacienteCriado = await requisitarJsonStatus('/api/pacientes', 201, 'criacao de paciente', {
    method: 'POST',
    body: JSON.stringify({
      profissionalResponsavelId: profissionalCriado.id,
      nome: `Paciente E2E ${sufixo}`,
      contato: `+55 11 9${String(sufixo).slice(-8)}`,
      dataNascimento: '1990-01-15'
    })
  });
  assert(pacienteCriado.id, 'criacao de paciente: id ausente.');

  const pacienteAtualizado = await requisitarJsonStatus(`/api/pacientes/${pacienteCriado.id}`, 200, 'edicao de paciente', {
    method: 'PATCH',
    body: JSON.stringify({
      profissionalResponsavelId: profissionalCriado.id,
      nome: pacienteCriado.nome,
      contato: pacienteCriado.contato,
      dataNascimento: pacienteCriado.dataNascimento,
      statusAdesao: 'risco',
      scoreRisco: 42.5
    })
  });
  assert(String(pacienteAtualizado.statusAdesao) === 'risco', 'edicao de paciente nao persistiu status.');

  const canais = await requisitarJsonStatus('/api/comunicacoes/canais', 200, 'listagem de canais');
  assert(Array.isArray(canais), 'listagem de canais precisa ser lista.');

  const canalCriado = await requisitarJsonStatus('/api/comunicacoes/canais', 201, 'criacao de canal', {
    method: 'POST',
    body: JSON.stringify({
      tipo: 'email',
      nome: `Email E2E ${sufixo}`,
      configuracao: { remetente: `e2e.${sufixo}@octaclin.local` },
      ativo: true
    })
  });
  assert(canalCriado.id, 'criacao de canal: id ausente.');

  const templates = await requisitarJsonStatus('/api/comunicacoes/templates', 200, 'listagem de templates');
  assert(Array.isArray(templates), 'listagem de templates precisa ser lista.');

  const templateCriado = await requisitarJsonStatus('/api/comunicacoes/templates', 201, 'criacao de template', {
    method: 'POST',
    body: JSON.stringify({
      canal: 'email',
      codigoExterno: `e2e-${sufixo}`,
      nome: `Template E2E ${sufixo}`,
      conteudo: { assunto: 'Check-in E2E', corpo: 'Ola {{nome}}, esta e uma mensagem E2E.' },
      aprovado: true
    })
  });
  assert(templateCriado.id, 'criacao de template: id ausente.');

  const mensagemCriada = await requisitarJsonStatus('/api/comunicacoes/mensagens', 201, 'criacao de mensagem', {
    method: 'POST',
    body: JSON.stringify({
      pacienteId: pacienteCriado.id,
      canalId: canalCriado.id,
      templateId: templateCriado.id,
      payload: { nome: pacienteCriado.nome, observacao: 'Smoke E2E OctaClin' }
    })
  });
  assert(mensagemCriada.status === 'pendente', 'criacao de mensagem precisa iniciar como pendente.');
  const mensagensComunicacoes = await requisitarJsonStatus('/api/comunicacoes/mensagens', 200, 'listagem de mensagens');
  assert(Array.isArray(mensagensComunicacoes), 'listagem de mensagens precisa ser lista.');
  assert(
    mensagensComunicacoes.some((item) => item.id === mensagemCriada.id),
    'listagem de mensagens nao retornou mensagem criada.'
  );

  const regrasAutomacao = await requisitarJsonStatus('/api/automacoes/regras', 200, 'listagem de regras de automacao');
  assert(Array.isArray(regrasAutomacao), 'listagem de regras de automacao precisa ser lista.');

  const regraCriada = await requisitarJsonStatus('/api/automacoes/regras', 201, 'criacao de regra de automacao', {
    method: 'POST',
    body: JSON.stringify({
      profissionalId: profissionalCriado.id,
      nome: `Regra E2E ${sufixo}`,
      gatilho: { tipo: 'checkin.atrasado' },
      condicoes: [{ campo: 'checkinsPerdidos', operador: 'maior_ou_igual', valor: 3 }],
      acoes: [{ tipo: 'notificar_profissional' }],
      ativa: true
    })
  });
  assert(regraCriada.id, 'criacao de regra de automacao: id ausente.');

  const execucaoRegra = await requisitarJsonStatus('/api/automacoes/avaliacoes', 201, 'avaliacao de regra de automacao', {
    method: 'POST',
    body: JSON.stringify({
      regraId: regraCriada.id,
      pacienteId: pacienteCriado.id,
      contexto: { status: 'risco', checkinsPerdidos: 3, frustracaoScore: 72 }
    })
  });
  assert(execucaoRegra.status === 'pendente', 'avaliacao de regra precisa iniciar como pendente.');
  const avaliacoesAutomacao = await requisitarJsonStatus('/api/automacoes/avaliacoes', 200, 'listagem de avaliacoes');
  assert(Array.isArray(avaliacoesAutomacao), 'listagem de avaliacoes precisa ser lista.');
  assert(
    avaliacoesAutomacao.some((item) => item.id === execucaoRegra.id),
    'listagem de avaliacoes nao retornou avaliacao criada.'
  );

  const analiseSentimento = await requisitarJsonStatus('/api/ia/sentimento', 201, 'analise de sentimento', {
    method: 'POST',
    body: JSON.stringify({
      pacienteId: pacienteCriado.id,
      texto: 'Estou com dificuldade para manter a rotina e fiquei frustrado com meu progresso esta semana.',
      contexto: { origem: 'smoke-e2e' }
    })
  });
  assert(analiseSentimento.id, 'analise de sentimento: id ausente.');
  assert(analiseSentimento.alertaDisparado === true, 'analise de sentimento deveria disparar alerta no texto demo.');
  const analisesSentimento = await requisitarJsonStatus('/api/ia/sentimento', 200, 'listagem de analises de sentimento');
  assert(Array.isArray(analisesSentimento), 'listagem de analises de sentimento precisa ser lista.');
  assert(
    analisesSentimento.some((item) => item.id === analiseSentimento.id),
    'listagem de analises de sentimento nao retornou analise criada.'
  );

  const reconhecimentoAlimentar = await requisitarJsonStatus(
    '/api/ia/reconhecimento-alimentar',
    201,
    'reconhecimento alimentar',
    {
      method: 'POST',
      body: JSON.stringify({
        pacienteId: pacienteCriado.id,
        arquivoMidiaId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',
        imagemUrl: 'https://example.com/prato-demo.jpg',
        contexto: { origem: 'smoke-e2e' }
      })
    }
  );
  assert(reconhecimentoAlimentar.id, 'reconhecimento alimentar: id ausente.');
  assert(Array.isArray(reconhecimentoAlimentar.alimentosDetectados), 'reconhecimento alimentar precisa retornar alimentos.');
  const reconhecimentosAlimentares = await requisitarJsonStatus(
    '/api/ia/reconhecimento-alimentar',
    200,
    'listagem de reconhecimentos alimentares'
  );
  assert(Array.isArray(reconhecimentosAlimentares), 'listagem de reconhecimentos alimentares precisa ser lista.');
  assert(
    reconhecimentosAlimentares.some((item) => item.id === reconhecimentoAlimentar.id),
    'listagem de reconhecimentos alimentares nao retornou reconhecimento criado.'
  );

  const diarioRapido = await requisitarJsonStatus('/api/mobile/diario-rapido', 201, 'registro de diario rapido', {
    method: 'POST',
    body: JSON.stringify({
      pacienteId: pacienteCriado.id,
      tipo: 'humor',
      valor: { humor: 'estavel', escala: 4 }
    })
  });
  assert(diarioRapido.id, 'registro de diario rapido: id ausente.');
  const diariosRapidos = await requisitarJsonStatus('/api/mobile/diario-rapido', 200, 'listagem de diario rapido');
  assert(Array.isArray(diariosRapidos), 'listagem de diario rapido precisa ser lista.');
  assert(
    diariosRapidos.some((item) => item.id === diarioRapido.id),
    'listagem de diario rapido nao retornou diario criado.'
  );

  const uploadMidia = await requisitarJsonStatus('/api/mobile/midias/uploads', 201, 'solicitacao de upload mobile', {
    method: 'POST',
    body: JSON.stringify({
      pacienteId: pacienteCriado.id,
      tipo: 'imagem',
      mimeType: 'image/jpeg',
      tamanhoBytes: 245000,
      hashConteudo: `hash-${sufixo}`
    })
  });
  assert(uploadMidia.arquivo?.id, 'solicitacao de upload mobile: arquivo ausente.');
  assert(typeof uploadMidia.uploadUrl === 'string', 'solicitacao de upload mobile: uploadUrl ausente.');
  const arquivosMidia = await requisitarJsonStatus('/api/mobile/midias/uploads', 200, 'listagem de midias mobile');
  assert(Array.isArray(arquivosMidia), 'listagem de midias mobile precisa ser lista.');
  assert(
    arquivosMidia.some((item) => item.id === uploadMidia.arquivo.id),
    'listagem de midias mobile nao retornou arquivo criado.'
  );

  const acompanhanteCriado = await requisitarJsonStatus('/api/mobile/acompanhantes', 201, 'criacao de acompanhante', {
    method: 'POST',
    body: JSON.stringify({
      pacienteId: pacienteCriado.id,
      nome: `Acompanhante E2E ${sufixo}`,
      contato: '+55 11 98888-0000',
      pin: '1234'
    })
  });
  assert(acompanhanteCriado.id, 'criacao de acompanhante: id ausente.');
  assert(!('pinHash' in acompanhanteCriado), 'criacao de acompanhante nao deve retornar pinHash.');
  const acompanhantesMobile = await requisitarJsonStatus('/api/mobile/acompanhantes', 200, 'listagem de acompanhantes mobile');
  assert(Array.isArray(acompanhantesMobile), 'listagem de acompanhantes mobile precisa ser lista.');
  assert(
    acompanhantesMobile.some((item) => item.id === acompanhanteCriado.id),
    'listagem de acompanhantes mobile nao retornou acompanhante criado.'
  );
  assert(!acompanhantesMobile.some((item) => 'pinHash' in item), 'listagem de acompanhantes nao deve retornar pinHash.');

  const loteMobile = await requisitarJsonStatus('/api/mobile/sincronizacao/lote', 201, 'sincronizacao mobile em lote', {
    method: 'POST',
    body: JSON.stringify({
      itens: [
        {
          idLocal: `local-e2e-${sufixo}`,
          tipo: 'diario_rapido',
          payload: {
            pacienteId: pacienteCriado.id,
            tipo: 'humor',
            valor: { humor: 'sincronizado' }
          }
        }
      ]
    })
  });
  assert(Array.isArray(loteMobile.resultados), 'sincronizacao mobile em lote: resultados precisa ser lista.');
  assert(loteMobile.resultados[0]?.status === 'sincronizado', 'sincronizacao mobile em lote nao sincronizou.');

  const circuloCriado = await requisitarJsonStatus('/api/gamificacao/circulos', 201, 'criacao de circulo', {
    method: 'POST',
    body: JSON.stringify({
      profissionalId: profissionalCriado.id,
      nome: `Circulo E2E ${sufixo}`,
      objetivo: 'Validar comunidade E2E.',
      privado: true
    })
  });
  assert(circuloCriado.id, 'criacao de circulo: id ausente.');
  const circulosGamificacao = await requisitarJsonStatus('/api/gamificacao/circulos', 200, 'listagem de circulos gamificacao');
  assert(Array.isArray(circulosGamificacao), 'listagem de circulos gamificacao precisa ser lista.');
  assert(
    circulosGamificacao.some((item) => item.id === circuloCriado.id),
    'listagem de circulos gamificacao nao retornou circulo criado.'
  );

  const membroCirculo = await requisitarJsonStatus(
    `/api/gamificacao/circulos/${circuloCriado.id}/membros`,
    201,
    'entrada em circulo',
    {
      method: 'POST',
      body: JSON.stringify({ pacienteId: pacienteCriado.id })
    }
  );
  assert(membroCirculo.id, 'entrada em circulo: id ausente.');

  const postComunidade = await requisitarJsonStatus('/api/gamificacao/posts', 201, 'criacao de post comunidade', {
    method: 'POST',
    body: JSON.stringify({
      circuloId: circuloCriado.id,
      pacienteId: pacienteCriado.id,
      conteudo: 'Completei meu check-in E2E hoje.'
    })
  });
  assert(postComunidade.status === 'publicado', 'post comunidade deveria ser publicado.');

  const desafioCriado = await requisitarJsonStatus('/api/gamificacao/desafios', 201, 'criacao de desafio', {
    method: 'POST',
    body: JSON.stringify({
      profissionalId: profissionalCriado.id,
      titulo: `Desafio E2E ${sufixo}`,
      descricao: 'Validar desafio E2E.',
      regraPontuacao: { evento: 'checkin', pontosPorEvento: 10 },
      iniciaEm: new Date().toISOString(),
      terminaEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
  });
  assert(desafioCriado.id, 'criacao de desafio: id ausente.');
  const desafiosGamificacao = await requisitarJsonStatus('/api/gamificacao/desafios', 200, 'listagem de desafios gamificacao');
  assert(Array.isArray(desafiosGamificacao), 'listagem de desafios gamificacao precisa ser lista.');
  assert(
    desafiosGamificacao.some((item) => item.id === desafioCriado.id),
    'listagem de desafios gamificacao nao retornou desafio criado.'
  );

  const progressoDesafio = await requisitarJsonStatus('/api/gamificacao/desafios/progresso', 201, 'progresso de desafio', {
    method: 'POST',
    body: JSON.stringify({
      desafioId: desafioCriado.id,
      pacienteId: pacienteCriado.id,
      pontos: 25,
      progresso: { checkins: 3 }
    })
  });
  assert(Number(progressoDesafio.pontos) === 25, 'progresso de desafio nao persistiu pontos.');

  const rankingDesafio = await requisitarJsonStatus(
    `/api/gamificacao/desafios/${desafioCriado.id}/ranking`,
    200,
    'ranking de desafio'
  );
  assert(Array.isArray(rankingDesafio), 'ranking de desafio precisa ser lista.');
  assert(rankingDesafio[0]?.pacienteId === pacienteCriado.id, 'ranking de desafio nao retornou paciente esperado.');

  const badgeCriado = await requisitarJsonStatus('/api/gamificacao/badges', 201, 'criacao de badge', {
    method: 'POST',
    body: JSON.stringify({
      nome: `Badge E2E ${sufixo}`,
      descricao: 'Conquista E2E.',
      iconeSvg: 'award',
      regraConquista: { tipo: 'manual' }
    })
  });
  assert(badgeCriado.id, 'criacao de badge: id ausente.');
  const badgesGamificacao = await requisitarJsonStatus('/api/gamificacao/badges', 200, 'listagem de badges gamificacao');
  assert(Array.isArray(badgesGamificacao), 'listagem de badges gamificacao precisa ser lista.');
  assert(
    badgesGamificacao.some((item) => item.id === badgeCriado.id),
    'listagem de badges gamificacao nao retornou badge criado.'
  );

  const badgeConcedido = await requisitarJsonStatus('/api/gamificacao/badges/concessoes', 201, 'concessao de badge', {
    method: 'POST',
    body: JSON.stringify({ pacienteId: pacienteCriado.id, badgeId: badgeCriado.id })
  });
  assert(badgeConcedido.id, 'concessao de badge: id ausente.');

  let categorias = await requisitarJsonStatus('/api/categorias-pergunta', 200, 'listagem de categorias');
  if (!Array.isArray(categorias) || !categorias.length) {
    await requisitarJsonStatus('/api/categorias-pergunta', 201, 'criacao de categoria', {
      method: 'POST',
      body: JSON.stringify({ nome: 'Nutricao', iconeSvg: 'utensils', corHex: '#247BA0', ordem: 1 })
    });
    categorias = await requisitarJsonStatus('/api/categorias-pergunta', 200, 'listagem de categorias apos criacao');
  }
  assertArray(categorias, 'categorias');

  const categoria = categorias[0];
  const questionarioCriado = await requisitarJsonStatus('/api/questionarios', 201, 'criacao de questionario', {
    method: 'POST',
    body: JSON.stringify({
      profissionalId: profissionalCriado.id,
      titulo: `Questionario E2E ${sufixo}`,
      descricao: 'Criado pelo smoke E2E do OctaClin.'
    })
  });
  assert(questionarioCriado.id, 'criacao de questionario: id ausente.');

  const questionarioAtualizado = await requisitarJsonStatus(
    `/api/questionarios/${questionarioCriado.id}`,
    200,
    'edicao de questionario',
    {
      method: 'PATCH',
      body: JSON.stringify({
        titulo: `${questionarioCriado.titulo} atualizado`,
        descricao: questionarioCriado.descricao,
        status: 'publicado'
      })
    }
  );
  assert(questionarioAtualizado.status === 'publicado', 'edicao de questionario nao publicou.');

  const perguntaUm = await requisitarJsonStatus(
    `/api/questionarios/${questionarioCriado.id}/perguntas`,
    201,
    'criacao de pergunta 1',
    {
      method: 'POST',
      body: JSON.stringify({
        categoriaId: categoria.id,
        tipo: 'likert',
        enunciado: 'Como voce avalia sua adesao hoje?',
        peso: 2,
        obrigatoria: true,
        configuracao: {}
      })
    }
  );
  assert(perguntaUm.id, 'criacao de pergunta 1: id ausente.');

  const perguntaDois = await requisitarJsonStatus(
    `/api/questionarios/${questionarioCriado.id}/perguntas`,
    201,
    'criacao de pergunta 2',
    {
      method: 'POST',
      body: JSON.stringify({
        categoriaId: categoria.id,
        tipo: 'texto_longo',
        enunciado: 'Descreva seu maior desafio da semana.',
        peso: 1,
        obrigatoria: false,
        configuracao: {}
      })
    }
  );

  const perguntaAtualizada = await requisitarJsonStatus(
    `/api/questionarios/${questionarioCriado.id}/perguntas/${perguntaUm.id}`,
    200,
    'edicao de pergunta',
    {
      method: 'PATCH',
      body: JSON.stringify({
        categoriaId: categoria.id,
        tipo: 'likert',
        enunciado: 'Como voce avalia sua adesao alimentar hoje?',
        peso: 3,
        obrigatoria: true,
        configuracao: {}
      })
    }
  );
  assert(Number(perguntaAtualizada.peso) === 3, 'edicao de pergunta nao persistiu peso.');

  const perguntasReordenadas = await requisitarJsonStatus(
    `/api/questionarios/${questionarioCriado.id}/perguntas/ordem`,
    200,
    'reordenacao de perguntas',
    {
      method: 'PATCH',
      body: JSON.stringify({
        perguntas: [
          { id: perguntaDois.id, ordem: 1 },
          { id: perguntaUm.id, ordem: 2 }
        ]
      })
    }
  );
  assert(Array.isArray(perguntasReordenadas), 'reordenacao de perguntas: resposta precisa ser lista.');

  await requisitarJsonStatus('/api/agendamentos-questionario', 201, 'criacao de agendamento', {
    method: 'POST',
    body: JSON.stringify({
      questionarioId: questionarioCriado.id,
      regraCron: '0 8 * * 1',
      timezone: 'America/Sao_Paulo'
    })
  });

  const questionarioArquivado = await requisitarJsonStatus(
    `/api/questionarios/${questionarioCriado.id}`,
    200,
    'arquivamento de questionario',
    {
      method: 'PATCH',
      body: JSON.stringify({
        titulo: questionarioAtualizado.titulo,
        descricao: questionarioAtualizado.descricao,
        status: 'arquivado'
      })
    }
  );
  assert(questionarioArquivado.status === 'arquivado', 'arquivamento de questionario nao persistiu.');

  await requisitarJsonStatus(`/api/pacientes/${pacienteCriado.id}`, 204, 'arquivamento de paciente', { method: 'DELETE' });
  const pacientesAposArquivar = await requisitarJsonStatus('/api/pacientes?pagina=1&limite=25', 200, 'listagem apos arquivar paciente');
  assert(
    !pacientesAposArquivar.itens.some((paciente) => paciente.id === pacienteCriado.id),
    'paciente arquivado ainda aparece na listagem.'
  );

  await requisitarJsonStatus(`/api/profissionais/${profissionalCriado.id}`, 204, 'arquivamento de profissional', { method: 'DELETE' });
  const profissionaisAposArquivar = await requisitarJsonStatus(
    '/api/profissionais?pagina=1&limite=25',
    200,
    'listagem apos arquivar profissional'
  );
  assert(
    !profissionaisAposArquivar.itens.some((profissional) => profissional.id === profissionalCriado.id),
    'profissional arquivado ainda aparece na listagem.'
  );

  const resumoOperacional = await requisitarJsonStatus('/api/operacoes/resumo', 200, 'resumo operacional');
  assert(resumoOperacional.outbox && resumoOperacional.mobile, 'resumo operacional incompleto.');

  const falhasOutbox = await requisitarJsonStatus('/api/operacoes/outbox/falhas?limite=10', 200, 'falhas outbox');
  assert(Array.isArray(falhasOutbox), 'falhas outbox precisa ser lista.');
  const falhasOutboxPaginadas = await requisitarJsonStatus(
    '/api/operacoes/outbox/falhas/paginada?pagina=1&limite=10',
    200,
    'falhas outbox paginadas'
  );
  assert(Array.isArray(falhasOutboxPaginadas.itens), 'falhas outbox paginadas precisa conter itens.');
  assert(typeof falhasOutboxPaginadas.total === 'number', 'falhas outbox paginadas precisa conter total.');
  const exportacaoOutbox = await requisitar('/api/operacoes/outbox/falhas/exportar.csv?limite=10');
  assertStatus(exportacaoOutbox, 200, 'exportacao outbox CSV');
  assert(
    exportacaoOutbox.headers.get('content-type')?.includes('text/csv'),
    'exportacao outbox CSV precisa retornar text/csv.'
  );
  assert(
    (await exportacaoOutbox.text()).includes('"criadoEm","tipo","status","tentativas","erro","mensagemId"'),
    'exportacao outbox CSV precisa conter cabecalho esperado.'
  );
  if (falhasOutbox[0]?.id) {
    await requisitarJsonStatus(
      `/api/operacoes/outbox/${falhasOutbox[0].id}/reprocessar`,
      200,
      'reprocessamento outbox',
      { method: 'POST' }
    );
  }

  const sincronizacoes = await requisitarJsonStatus(
    '/api/operacoes/mobile/sincronizacoes?limite=10',
    200,
    'sincronizacoes mobile'
  );
  assert(Array.isArray(sincronizacoes), 'sincronizacoes mobile precisa ser lista.');

  const auditoriaPacientes = await aguardarAuditoria('pacientes.listar_dados_sensiveis');
  const auditoriaProfissionais = await aguardarAuditoria('profissionais.listar_dados_sensiveis');
  assert(auditoriaPacientes.usuarioId, 'auditoria de pacientes precisa registrar usuarioId.');
  assert(auditoriaProfissionais.usuarioId, 'auditoria de profissionais precisa registrar usuarioId.');
  const auditoriaPaginada = await requisitarJsonStatus(
    '/api/operacoes/auditoria/paginada?pagina=1&limite=10',
    200,
    'auditoria paginada'
  );
  assert(Array.isArray(auditoriaPaginada.itens), 'auditoria paginada precisa conter itens.');
  assert(typeof auditoriaPaginada.total === 'number', 'auditoria paginada precisa conter total.');
  const exportacaoAuditoria = await requisitar('/api/operacoes/auditoria/exportar.csv?limite=10');
  assertStatus(exportacaoAuditoria, 200, 'exportacao auditoria CSV');
  assert(
    exportacaoAuditoria.headers.get('content-type')?.includes('text/csv'),
    'exportacao auditoria CSV precisa retornar text/csv.'
  );
  assert(
    (await exportacaoAuditoria.text()).includes('"criadoEm","acao","recursoTipo","recursoId","usuarioId","ip","metadados"'),
    'exportacao auditoria CSV precisa conter cabecalho esperado.'
  );

  const acoesAuditadas = [
    'pacientes.criar',
    'pacientes.atualizar',
    'pacientes.arquivar',
    'profissionais.criar',
    'profissionais.atualizar',
    'profissionais.arquivar',
    'comunicacoes.canal.criar',
    'comunicacoes.template.criar',
    'comunicacoes.mensagem.disparar',
    'automacoes.regra.criar',
    'automacoes.avaliacao.solicitar',
    'ia.sentimento.analisar',
    'ia.reconhecimento_alimentar.criar',
    'mobile.diario_rapido.registrar',
    'mobile.midia.upload_solicitar',
    'mobile.acompanhante.criar',
    'mobile.sincronizacao_lote.executar',
    'gamificacao.circulo.criar',
    'gamificacao.circulo.membro_entrar',
    'gamificacao.post.criar',
    'gamificacao.desafio.criar',
    'gamificacao.desafio.progresso_atualizar',
    'gamificacao.badge.criar',
    'gamificacao.badge.conceder',
    'questionarios.criar',
    'questionarios.atualizar',
    'questionarios.pergunta.criar',
    'questionarios.pergunta.atualizar',
    'questionarios.perguntas.reordenar',
    'questionarios.agendamento.criar'
  ];

  for (const acao of acoesAuditadas) {
    const evento = await aguardarAuditoria(acao);
    assert(evento.usuarioId, `auditoria ${acao}: usuarioId ausente.`);
    assert(evento.recursoTipo, `auditoria ${acao}: recursoTipo ausente.`);
  }

  console.log('smoke-e2e-bff-ok');
  console.log(`web=${configuracao.webUrl}`);
  console.log(`api=${configuracao.apiUrl}`);
}

main().catch((erro) => {
  console.error('smoke-e2e-bff-failed');
  console.error(erro);
  process.exitCode = 1;
});
