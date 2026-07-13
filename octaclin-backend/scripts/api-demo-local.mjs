import http from 'node:http';
import { randomUUID } from 'node:crypto';

function lerPorta() {
  const indice = process.argv.indexOf('--port');
  if (indice >= 0 && process.argv[indice + 1]) return Number(process.argv[indice + 1]);
  return Number(process.env.PORTA_HTTP ?? 3001);
}

const porta = lerPorta();
const tenantId = '11111111-1111-4111-8111-111111111111';
const usuarioAdminId = '22222222-2222-4222-8222-222222222222';
const profissionalId = '44444444-4444-4444-8444-444444444444';
const pacienteId = '66666666-6666-4666-8666-666666666666';
const canalEmailId = '77777777-7777-4777-8777-777777777777';
const templateEmailId = '88888888-8888-4888-8888-888888888888';
const regraAutomacaoId = '99999999-9999-4999-8999-999999999998';

const estado = {
  profissionais: [
    {
      id: profissionalId,
      tenantId,
      usuarioId: '33333333-3333-4333-8333-333333333333',
      nome: 'Dra. Carla Monteiro',
      registroProfissional: 'CRN-0000-DEMO',
      especialidade: 'Nutricao clinica',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    }
  ],
  pacientes: [
    {
      id: pacienteId,
      tenantId,
      usuarioId: '55555555-5555-4555-8555-555555555555',
      profissionalResponsavelId: profissionalId,
      nome: 'Paciente Demo',
      contato: '+55 11 90000-0000',
      dataNascimento: '1992-04-18',
      statusAdesao: 'em_acompanhamento',
      scoreRisco: '12.50',
      ultimoCheckinEm: new Date().toISOString(),
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    }
  ],
  canais: [
    {
      id: canalEmailId,
      tenantId,
      tipo: 'email',
      nome: 'Email transacional',
      configuracao: { remetente: 'atendimento@octaclin.local' },
      ativo: true
    }
  ],
  templates: [
    {
      id: templateEmailId,
      tenantId,
      canal: 'email',
      codigoExterno: 'demo-checkin',
      nome: 'Lembrete de check-in',
      conteudo: { assunto: 'Seu check-in OctaClin', corpo: 'Ola {{nome}}, seu check-in esta disponivel.' },
      aprovado: true
    }
  ],
  mensagens: [],
  regrasAutomacao: [
    {
      id: regraAutomacaoId,
      tenantId,
      profissionalId,
      nome: 'Risco alto por check-ins perdidos',
      gatilho: { tipo: 'checkin.atrasado' },
      condicoes: [{ campo: 'checkinsPerdidos', operador: 'maior_ou_igual', valor: 3 }],
      acoes: [{ tipo: 'notificar_profissional' }],
      ativa: true,
      criadoEm: new Date().toISOString()
    }
  ],
  execucoesRegra: [],
  analisesSentimento: [],
  reconhecimentosAlimentares: [],
  diariosRapidos: [],
  arquivosMidia: [],
  acompanhantes: [],
  circulos: [],
  membrosCirculo: [],
  postsComunidade: [],
  desafios: [],
  participacoesDesafio: [],
  badges: [],
  pacienteBadges: [],
  categorias: [
    { id: randomUUID(), tenantId, nome: 'Nutricao', iconeSvg: 'utensils', corHex: '#247BA0', ordem: 1 },
    { id: randomUUID(), tenantId, nome: 'Sono', iconeSvg: 'moon', corHex: '#6A5ACD', ordem: 2 },
    { id: randomUUID(), tenantId, nome: 'Atividade fisica', iconeSvg: 'activity', corHex: '#2F9E44', ordem: 3 },
    { id: randomUUID(), tenantId, nome: 'Emocional', iconeSvg: 'heart', corHex: '#C77D1A', ordem: 4 }
  ],
  questionarios: [],
  perguntas: new Map(),
  auditoria: [],
  outbox: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId,
      tipo: 'notificacao.enviar',
      payload: { mensagemId: '99999999-9999-4999-8999-999999999999' },
      status: 'falhou',
      tentativas: 5,
      erro: 'Falha demo para testar reprocessamento operacional.',
      criadoEm: new Date().toISOString()
    }
  ],
  sincronizacoes: [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      tenantId,
      idLocal: 'local-demo-diario-001',
      tipo: 'diario_rapido',
      status: 'sincronizado',
      recursoTipo: 'diario_rapido',
      recursoId: pacienteId,
      criadoEm: new Date().toISOString()
    }
  ]
};

function json(resposta, status, corpo) {
  resposta.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
  });
  resposta.end(JSON.stringify(corpo));
}

function texto(resposta, status, corpo) {
  resposta.writeHead(status, { 'Content-Type': 'text/plain' });
  resposta.end(corpo);
}

async function lerJson(requisicao) {
  const chunks = [];
  for await (const chunk of requisicao) chunks.push(chunk);
  const textoCorpo = Buffer.concat(chunks).toString('utf8');
  return textoCorpo ? JSON.parse(textoCorpo) : {};
}

function paginar(itens) {
  return { itens, total: itens.length };
}

function registrarAuditoria(acao, recursoTipo, recursoId, metadados = {}) {
  estado.auditoria.unshift({
    id: randomUUID(),
    tenantId,
    usuarioId: usuarioAdminId,
    acao,
    recursoTipo,
    recursoId,
    ip: '127.0.0.1',
    userAgent: 'api-demo-local',
    metadados,
    criadoEm: new Date().toISOString()
  });
}

function normalizarLimite(valor, padrao = 50, maximo = 100) {
  const numero = Number(valor ?? padrao);
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(Math.max(Math.trunc(numero), 1), maximo);
}

function normalizarPagina(valor) {
  const numero = Number(valor ?? 1);
  if (!Number.isFinite(numero)) return 1;
  return Math.max(Math.trunc(numero), 1);
}

function filtrarPorPeriodo(itens, inicio, fim) {
  const inicioMs = inicio ? new Date(inicio).getTime() : undefined;
  const fimMs = fim ? new Date(fim).getTime() : undefined;
  return itens.filter((item) => {
    const criadoEmMs = new Date(item.criadoEm).getTime();
    if (Number.isFinite(inicioMs) && criadoEmMs < inicioMs) return false;
    if (Number.isFinite(fimMs) && criadoEmMs > fimMs) return false;
    return true;
  });
}

function paginarResultado(itens, paginaValor, limiteValor) {
  const pagina = normalizarPagina(paginaValor);
  const limite = normalizarLimite(limiteValor);
  const inicio = (pagina - 1) * limite;
  return { itens: itens.slice(inicio, inicio + limite), total: itens.length, pagina, limite };
}

function escaparCsv(valor) {
  return `"${String(valor ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`;
}

function csv(resposta, nomeArquivo, cabecalho, linhas) {
  const corpo = `${[cabecalho, ...linhas].map((linha) => linha.map(escaparCsv).join(',')).join('\n')}\n`;
  resposta.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${nomeArquivo}"`
  });
  resposta.end(corpo);
}

function filtrarAuditoriaDemo(url) {
  let itens = estado.auditoria;
  const filtros = ['acao', 'recursoTipo', 'recursoId', 'usuarioId'];
  for (const filtro of filtros) {
    const valor = url.searchParams.get(filtro);
    if (valor) itens = itens.filter((item) => item[filtro] === valor);
  }
  return filtrarPorPeriodo(itens, url.searchParams.get('inicio'), url.searchParams.get('fim'));
}

function filtrarFalhasOutboxDemo(url) {
  let itens = estado.outbox.filter((item) => item.status === 'falhou');
  const tipo = url.searchParams.get('tipo');
  if (tipo) itens = itens.filter((item) => item.tipo === tipo);
  return filtrarPorPeriodo(itens, url.searchParams.get('inicio'), url.searchParams.get('fim'));
}

function criarTokens() {
  return {
    accessToken: `demo-access-${Date.now()}`,
    refreshToken: `demo-refresh-${Date.now()}`,
    tipoToken: 'Bearer',
    expiraEmSegundos: 3600
  };
}

function normalizarStatusPaciente(status) {
  return status === 'aderente' ? 'aderente' : status;
}

const servidor = http.createServer(async (requisicao, resposta) => {
  if (requisicao.method === 'OPTIONS') return json(resposta, 204, {});

  const url = new URL(requisicao.url ?? '/', `http://localhost:${porta}`);
  const partes = url.pathname.split('/').filter(Boolean);

  try {
    if (requisicao.method === 'GET' && url.pathname === '/health') {
      return json(resposta, 200, { status: 'ok', modo: 'demo-local' });
    }

    if (requisicao.method === 'POST' && url.pathname === '/auth/login') {
      const body = await lerJson(requisicao);
      if (body.tenantSlug !== 'clinica-carla' || body.email !== 'admin@octaclin.local' || body.senha !== 'OctaClin@123') {
        return json(resposta, 401, { mensagem: 'Credenciais demo invalidas.' });
      }
      return json(resposta, 200, criarTokens());
    }

    if (requisicao.method === 'POST' && url.pathname === '/auth/renovar') return json(resposta, 200, criarTokens());
    if (requisicao.method === 'POST' && url.pathname === '/auth/sair') return json(resposta, 204, {});

    if (requisicao.method === 'GET' && url.pathname === '/pacientes') {
      registrarAuditoria('pacientes.listar_dados_sensiveis', 'paciente', undefined, { total: estado.pacientes.length });
      return json(resposta, 200, paginar(estado.pacientes));
    }

    if (requisicao.method === 'POST' && url.pathname === '/pacientes') {
      const body = await lerJson(requisicao);
      const paciente = {
        id: randomUUID(),
        tenantId,
        usuarioId: undefined,
        profissionalResponsavelId: body.profissionalResponsavelId,
        nome: body.nome,
        contato: body.contato,
        dataNascimento: body.dataNascimento,
        statusAdesao: 'novo',
        scoreRisco: '0',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };
      estado.pacientes.unshift(paciente);
      registrarAuditoria('pacientes.criar', 'paciente', paciente.id, { profissionalResponsavelId: body.profissionalResponsavelId });
      return json(resposta, 201, paciente);
    }

    if (partes[0] === 'pacientes' && partes[1] && requisicao.method === 'PATCH') {
      const body = await lerJson(requisicao);
      const paciente = estado.pacientes.find((item) => item.id === partes[1]);
      if (!paciente) return json(resposta, 404, { mensagem: 'Paciente nao encontrado.' });
      Object.assign(paciente, {
        ...body,
        statusAdesao: body.statusAdesao ? normalizarStatusPaciente(body.statusAdesao) : paciente.statusAdesao,
        scoreRisco: body.scoreRisco !== undefined ? String(body.scoreRisco) : paciente.scoreRisco,
        atualizadoEm: new Date().toISOString()
      });
      registrarAuditoria('pacientes.atualizar', 'paciente', paciente.id, { statusAdesao: body.statusAdesao });
      return json(resposta, 200, paciente);
    }

    if (partes[0] === 'pacientes' && partes[1] && requisicao.method === 'DELETE') {
      const indice = estado.pacientes.findIndex((item) => item.id === partes[1]);
      if (indice === -1) return json(resposta, 404, { mensagem: 'Paciente nao encontrado.' });
      estado.pacientes.splice(indice, 1);
      registrarAuditoria('pacientes.arquivar', 'paciente', partes[1]);
      return json(resposta, 204, {});
    }

    if (requisicao.method === 'GET' && url.pathname === '/profissionais') {
      registrarAuditoria('profissionais.listar_dados_sensiveis', 'profissional', undefined, { total: estado.profissionais.length });
      return json(resposta, 200, paginar(estado.profissionais));
    }

    if (requisicao.method === 'POST' && url.pathname === '/profissionais') {
      const body = await lerJson(requisicao);
      const profissional = {
        id: randomUUID(),
        tenantId,
        usuarioId: randomUUID(),
        nome: body.nome,
        registroProfissional: body.registroProfissional,
        especialidade: body.especialidade,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };
      estado.profissionais.unshift(profissional);
      registrarAuditoria('profissionais.criar', 'profissional', profissional.id, { especialidade: body.especialidade });
      return json(resposta, 201, profissional);
    }

    if (partes[0] === 'profissionais' && partes[1] && requisicao.method === 'PATCH') {
      const body = await lerJson(requisicao);
      const profissional = estado.profissionais.find((item) => item.id === partes[1]);
      if (!profissional) return json(resposta, 404, { mensagem: 'Profissional nao encontrado.' });
      Object.assign(profissional, body, { atualizadoEm: new Date().toISOString() });
      registrarAuditoria('profissionais.atualizar', 'profissional', profissional.id, { especialidade: body.especialidade });
      return json(resposta, 200, profissional);
    }

    if (partes[0] === 'profissionais' && partes[1] && requisicao.method === 'DELETE') {
      const indice = estado.profissionais.findIndex((item) => item.id === partes[1]);
      if (indice === -1) return json(resposta, 404, { mensagem: 'Profissional nao encontrado.' });
      estado.profissionais.splice(indice, 1);
      registrarAuditoria('profissionais.arquivar', 'profissional', partes[1]);
      return json(resposta, 204, {});
    }

    if (requisicao.method === 'GET' && url.pathname === '/comunicacoes/canais') return json(resposta, 200, estado.canais);

    if (requisicao.method === 'POST' && url.pathname === '/comunicacoes/canais') {
      const body = await lerJson(requisicao);
      const canal = {
        id: randomUUID(),
        tenantId,
        tipo: body.tipo,
        nome: body.nome,
        configuracao: body.configuracao ?? {},
        ativo: body.ativo ?? true
      };
      estado.canais.unshift(canal);
      registrarAuditoria('comunicacoes.canal.criar', 'canal_notificacao', canal.id, { tipo: body.tipo, ativo: canal.ativo });
      return json(resposta, 201, canal);
    }

    if (requisicao.method === 'GET' && url.pathname === '/comunicacoes/templates') return json(resposta, 200, estado.templates);

    if (requisicao.method === 'POST' && url.pathname === '/comunicacoes/templates') {
      const body = await lerJson(requisicao);
      const template = {
        id: randomUUID(),
        tenantId,
        canal: body.canal,
        codigoExterno: body.codigoExterno,
        nome: body.nome,
        conteudo: body.conteudo ?? {},
        aprovado: body.aprovado ?? false
      };
      estado.templates.unshift(template);
      registrarAuditoria('comunicacoes.template.criar', 'template_mensagem', template.id, {
        canal: body.canal,
        aprovado: template.aprovado
      });
      return json(resposta, 201, template);
    }

    if (requisicao.method === 'GET' && url.pathname === '/comunicacoes/mensagens') return json(resposta, 200, estado.mensagens);

    if (requisicao.method === 'POST' && url.pathname === '/comunicacoes/mensagens') {
      const body = await lerJson(requisicao);
      const canal = estado.canais.find((item) => item.id === body.canalId && item.ativo);
      if (!canal) return json(resposta, 404, { mensagem: 'Canal de notificacao nao encontrado ou inativo.' });
      const template = estado.templates.find((item) => item.id === body.templateId);
      if (!template) return json(resposta, 404, { mensagem: 'Template de mensagem nao encontrado.' });
      if (template.canal !== canal.tipo) return json(resposta, 400, { mensagem: 'Template incompativel com o canal.' });
      if (canal.tipo === 'whatsapp' && !template.aprovado) {
        return json(resposta, 400, { mensagem: 'Templates WhatsApp devem estar aprovados antes do disparo.' });
      }
      const mensagem = {
        id: randomUUID(),
        tenantId,
        pacienteId: body.pacienteId,
        canalId: body.canalId,
        templateId: body.templateId,
        status: 'pendente',
        payload: body.payload ?? {},
        criadoEm: new Date().toISOString()
      };
      estado.mensagens.unshift(mensagem);
      estado.outbox.unshift({
        id: randomUUID(),
        tenantId,
        tipo: 'notificacao.enviar',
        payload: { mensagemId: mensagem.id },
        status: 'pendente',
        tentativas: 0,
        criadoEm: new Date().toISOString()
      });
      registrarAuditoria('comunicacoes.mensagem.disparar', 'mensagem_notificacao', mensagem.id, {
        pacienteId: body.pacienteId,
        canalId: body.canalId,
        templateId: body.templateId,
        status: mensagem.status
      });
      return json(resposta, 201, mensagem);
    }

    if (requisicao.method === 'GET' && url.pathname === '/automacoes/regras') return json(resposta, 200, estado.regrasAutomacao);

    if (requisicao.method === 'POST' && url.pathname === '/automacoes/regras') {
      const body = await lerJson(requisicao);
      const regra = {
        id: randomUUID(),
        tenantId,
        profissionalId: body.profissionalId,
        nome: body.nome,
        gatilho: body.gatilho ?? {},
        condicoes: body.condicoes ?? [],
        acoes: body.acoes ?? [],
        ativa: body.ativa ?? true,
        criadoEm: new Date().toISOString()
      };
      estado.regrasAutomacao.unshift(regra);
      registrarAuditoria('automacoes.regra.criar', 'regra_automacao', regra.id, {
        profissionalId: body.profissionalId,
        ativa: regra.ativa,
        totalCondicoes: regra.condicoes.length,
        totalAcoes: regra.acoes.length
      });
      return json(resposta, 201, regra);
    }

    if (requisicao.method === 'GET' && url.pathname === '/automacoes/avaliacoes') return json(resposta, 200, estado.execucoesRegra);

    if (requisicao.method === 'POST' && url.pathname === '/automacoes/avaliacoes') {
      const body = await lerJson(requisicao);
      const regra = estado.regrasAutomacao.find((item) => item.id === body.regraId && item.ativa);
      if (!regra) return json(resposta, 404, { mensagem: 'Regra de automacao nao encontrada ou inativa.' });
      const execucao = {
        id: randomUUID(),
        tenantId,
        regraId: body.regraId,
        pacienteId: body.pacienteId,
        status: 'pendente',
        resultado: { contexto: body.contexto ?? {} },
        criadoEm: new Date().toISOString()
      };
      estado.execucoesRegra.unshift(execucao);
      registrarAuditoria('automacoes.avaliacao.solicitar', 'execucao_regra', execucao.id, {
        regraId: body.regraId,
        pacienteId: body.pacienteId,
        status: execucao.status
      });
      return json(resposta, 201, execucao);
    }

    if (requisicao.method === 'GET' && url.pathname === '/ia/sentimento') return json(resposta, 200, estado.analisesSentimento);

    if (requisicao.method === 'POST' && url.pathname === '/ia/sentimento') {
      const body = await lerJson(requisicao);
      const textoEntrada = String(body.texto ?? '').toLowerCase();
      const frustracao = textoEntrada.includes('frustr') || textoEntrada.includes('dificuldade') ? 78.5 : 35.2;
      const motivacao = textoEntrada.includes('progresso') ? 58.3 : 71.4;
      const analise = {
        id: randomUUID(),
        tenantId,
        pacienteId: body.pacienteId,
        respostaCheckinId: body.respostaCheckinId,
        transcricaoMidiaId: body.transcricaoMidiaId,
        modelo: 'octaclin-demo-heuristica',
        ansiedadeScore: String(textoEntrada.includes('ansiedade') ? 72.1 : 41.6),
        frustracaoScore: String(frustracao),
        motivacaoScore: String(motivacao),
        confusaoScore: String(textoEntrada.includes('confuso') ? 66.7 : 22.4),
        explicacao: { provedor: 'api-demo-local', contexto: body.contexto ?? {}, heuristica: 'palavras-chave' },
        alertaDisparado: frustracao >= 70,
        criadoEm: new Date().toISOString()
      };
      estado.analisesSentimento.unshift(analise);
      registrarAuditoria('ia.sentimento.analisar', 'analise_sentimento', analise.id, {
        pacienteId: body.pacienteId,
        respostaCheckinId: body.respostaCheckinId,
        transcricaoMidiaId: body.transcricaoMidiaId,
        alertaDisparado: analise.alertaDisparado
      });
      return json(resposta, 201, analise);
    }

    if (requisicao.method === 'GET' && url.pathname === '/ia/reconhecimento-alimentar') {
      return json(resposta, 200, estado.reconhecimentosAlimentares);
    }

    if (requisicao.method === 'POST' && url.pathname === '/ia/reconhecimento-alimentar') {
      const body = await lerJson(requisicao);
      const referencia = String(body.imagemBase64 ?? body.imagemUrl ?? body.arquivoMidiaId ?? randomUUID());
      const reconhecimento = {
        id: randomUUID(),
        tenantId,
        pacienteId: body.pacienteId,
        arquivoMidiaId: body.arquivoMidiaId,
        provedor: 'heuristica-local',
        imagemHash: `demo-${Buffer.from(referencia).toString('base64url').slice(0, 24)}`,
        alimentosDetectados: [
          { nome: 'arroz', confianca: 0.91 },
          { nome: 'frango grelhado', confianca: 0.86 },
          { nome: 'salada', confianca: 0.78 }
        ],
        pesoEstimadoGramas: '420.00',
        caloriasEstimadas: '610.00',
        confiancaMedia: '85.00',
        criadoEm: new Date().toISOString()
      };
      estado.reconhecimentosAlimentares.unshift(reconhecimento);
      registrarAuditoria('ia.reconhecimento_alimentar.criar', 'reconhecimento_alimentar', reconhecimento.id, {
        pacienteId: body.pacienteId,
        arquivoMidiaId: body.arquivoMidiaId,
        totalAlimentos: reconhecimento.alimentosDetectados.length
      });
      return json(resposta, 201, reconhecimento);
    }

    if (requisicao.method === 'GET' && url.pathname === '/mobile/diario-rapido') return json(resposta, 200, estado.diariosRapidos);

    if (requisicao.method === 'POST' && url.pathname === '/mobile/diario-rapido') {
      const body = await lerJson(requisicao);
      const log = {
        id: randomUUID(),
        tenantId,
        pacienteId: body.pacienteId,
        tipo: body.tipo,
        valor: body.valor ?? {},
        registradoEm: new Date().toISOString()
      };
      estado.diariosRapidos.unshift(log);
      registrarAuditoria('mobile.diario_rapido.registrar', 'log_diario_rapido', log.id, {
        pacienteId: body.pacienteId,
        tipo: body.tipo
      });
      return json(resposta, 201, log);
    }

    if (requisicao.method === 'GET' && url.pathname === '/mobile/midias/uploads') return json(resposta, 200, estado.arquivosMidia);

    if (requisicao.method === 'POST' && url.pathname === '/mobile/midias/uploads') {
      const body = await lerJson(requisicao);
      const arquivo = {
        id: randomUUID(),
        tenantId,
        pacienteId: body.pacienteId,
        tipo: body.tipo,
        bucket: 'octaclin-midias-local',
        chaveObjeto: `${tenantId}/${body.pacienteId}/${body.tipo}/${randomUUID()}`,
        mimeType: body.mimeType,
        tamanhoBytes: String(body.tamanhoBytes),
        hashConteudo: body.hashConteudo,
        metadados: { duracaoSegundos: body.duracaoSegundos },
        criadoEm: new Date().toISOString()
      };
      estado.arquivosMidia.unshift(arquivo);
      registrarAuditoria('mobile.midia.upload_solicitar', 'arquivo_midia', arquivo.id, {
        pacienteId: body.pacienteId,
        tipo: body.tipo,
        mimeType: body.mimeType,
        tamanhoBytes: body.tamanhoBytes
      });
      return json(resposta, 201, { arquivo, uploadUrl: `http://localhost:9000/${arquivo.bucket}/${arquivo.chaveObjeto}` });
    }

    if (requisicao.method === 'GET' && url.pathname === '/mobile/acompanhantes') {
      return json(
        resposta,
        200,
        estado.acompanhantes.map(({ id, tenantId: itemTenantId, pacienteId, ativo, criadoEm }) => ({
          id,
          tenantId: itemTenantId,
          pacienteId,
          ativo,
          criadoEm
        }))
      );
    }

    if (requisicao.method === 'POST' && url.pathname === '/mobile/acompanhantes') {
      const body = await lerJson(requisicao);
      const acompanhante = {
        id: randomUUID(),
        tenantId,
        pacienteId: body.pacienteId,
        nomeCriptografado: 'demo',
        contatoCriptografado: body.contato ? 'demo' : undefined,
        pinHash: 'demo-hash',
        ativo: true,
        criadoEm: new Date().toISOString()
      };
      estado.acompanhantes.unshift(acompanhante);
      registrarAuditoria('mobile.acompanhante.criar', 'acompanhante', acompanhante.id, {
        pacienteId: body.pacienteId,
        possuiContato: Boolean(body.contato)
      });
      return json(resposta, 201, {
        id: acompanhante.id,
        tenantId: acompanhante.tenantId,
        pacienteId: acompanhante.pacienteId,
        ativo: acompanhante.ativo,
        criadoEm: acompanhante.criadoEm
      });
    }

    if (requisicao.method === 'POST' && url.pathname === '/mobile/sincronizacao/lote') {
      const body = await lerJson(requisicao);
      const resultados = [];
      for (const item of body.itens ?? []) {
        const existente = estado.sincronizacoes.find((sync) => sync.idLocal === item.idLocal);
        if (existente?.recursoId) {
          resultados.push({ idLocal: item.idLocal, status: 'sincronizado', recursoId: existente.recursoId });
          continue;
        }

        const recursoId = randomUUID();
        estado.sincronizacoes.unshift({
          id: randomUUID(),
          tenantId,
          idLocal: item.idLocal,
          tipo: item.tipo,
          status: 'sincronizado',
          recursoTipo: item.tipo,
          recursoId,
          criadoEm: new Date().toISOString()
        });
        resultados.push({ idLocal: item.idLocal, status: 'sincronizado', recursoId });
      }
      registrarAuditoria('mobile.sincronizacao_lote.executar', 'sincronizacao_mobile', undefined, {
        totalItens: body.itens?.length ?? 0,
        tipos: Array.from(new Set((body.itens ?? []).map((item) => item.tipo))),
        totalSincronizados: resultados.filter((item) => item.status === 'sincronizado').length
      });
      return json(resposta, 201, { resultados });
    }

    if (requisicao.method === 'GET' && url.pathname === '/gamificacao/circulos') return json(resposta, 200, estado.circulos);

    if (requisicao.method === 'POST' && url.pathname === '/gamificacao/circulos') {
      const body = await lerJson(requisicao);
      const circulo = {
        id: randomUUID(),
        tenantId,
        profissionalId: body.profissionalId,
        nome: body.nome,
        objetivo: body.objetivo,
        privado: body.privado ?? true,
        criadoEm: new Date().toISOString()
      };
      estado.circulos.unshift(circulo);
      registrarAuditoria('gamificacao.circulo.criar', 'circulo_pacientes', circulo.id, {
        profissionalId: body.profissionalId,
        privado: circulo.privado
      });
      return json(resposta, 201, circulo);
    }

    if (partes[0] === 'gamificacao' && partes[1] === 'circulos' && partes[3] === 'membros' && requisicao.method === 'POST') {
      const body = await lerJson(requisicao);
      const membro = {
        id: randomUUID(),
        tenantId,
        circuloId: partes[2],
        pacienteId: body.pacienteId,
        entrouEm: new Date().toISOString()
      };
      estado.membrosCirculo.unshift(membro);
      registrarAuditoria('gamificacao.circulo.membro_entrar', 'membro_circulo', membro.id, {
        circuloId: partes[2],
        pacienteId: body.pacienteId
      });
      return json(resposta, 201, membro);
    }

    if (requisicao.method === 'POST' && url.pathname === '/gamificacao/posts') {
      const body = await lerJson(requisicao);
      const conteudo = String(body.conteudo ?? '');
      const post = {
        id: randomUUID(),
        tenantId,
        circuloId: body.circuloId,
        pacienteId: body.pacienteId,
        conteudo,
        status: conteudo.toLowerCase().includes('bloqueado') ? 'pendente_moderacao' : 'publicado',
        criadoEm: new Date().toISOString()
      };
      estado.postsComunidade.unshift(post);
      registrarAuditoria('gamificacao.post.criar', 'post_comunidade', post.id, {
        circuloId: body.circuloId,
        pacienteId: body.pacienteId,
        status: post.status
      });
      return json(resposta, 201, post);
    }

    if (requisicao.method === 'GET' && url.pathname === '/gamificacao/desafios') return json(resposta, 200, estado.desafios);

    if (requisicao.method === 'POST' && url.pathname === '/gamificacao/desafios') {
      const body = await lerJson(requisicao);
      const desafio = {
        id: randomUUID(),
        tenantId,
        profissionalId: body.profissionalId,
        titulo: body.titulo,
        descricao: body.descricao,
        regraPontuacao: body.regraPontuacao ?? {},
        iniciaEm: body.iniciaEm,
        terminaEm: body.terminaEm,
        criadoEm: new Date().toISOString()
      };
      estado.desafios.unshift(desafio);
      registrarAuditoria('gamificacao.desafio.criar', 'desafio', desafio.id, {
        profissionalId: body.profissionalId,
        iniciaEm: body.iniciaEm,
        terminaEm: body.terminaEm
      });
      return json(resposta, 201, desafio);
    }

    if (requisicao.method === 'POST' && url.pathname === '/gamificacao/desafios/progresso') {
      const body = await lerJson(requisicao);
      const existente = estado.participacoesDesafio.find(
        (item) => item.desafioId === body.desafioId && item.pacienteId === body.pacienteId
      );
      const participacao = {
        ...(existente ?? { id: randomUUID(), tenantId }),
        desafioId: body.desafioId,
        pacienteId: body.pacienteId,
        pontos: String(body.pontos),
        progresso: body.progresso ?? {}
      };
      if (existente) Object.assign(existente, participacao);
      else estado.participacoesDesafio.unshift(participacao);
      registrarAuditoria('gamificacao.desafio.progresso_atualizar', 'participacao_desafio', participacao.id, {
        desafioId: body.desafioId,
        pacienteId: body.pacienteId,
        pontos: body.pontos
      });
      return json(resposta, 201, participacao);
    }

    if (partes[0] === 'gamificacao' && partes[1] === 'desafios' && partes[3] === 'ranking' && requisicao.method === 'GET') {
      return json(
        resposta,
        200,
        estado.participacoesDesafio
          .filter((item) => item.desafioId === partes[2])
          .sort((a, b) => Number(b.pontos) - Number(a.pontos))
      );
    }

    if (requisicao.method === 'GET' && url.pathname === '/gamificacao/badges') return json(resposta, 200, estado.badges);

    if (requisicao.method === 'POST' && url.pathname === '/gamificacao/badges') {
      const body = await lerJson(requisicao);
      const badge = {
        id: randomUUID(),
        tenantId,
        nome: body.nome,
        descricao: body.descricao,
        iconeSvg: body.iconeSvg,
        regraConquista: body.regraConquista ?? {}
      };
      estado.badges.unshift(badge);
      registrarAuditoria('gamificacao.badge.criar', 'badge', badge.id, { iconeSvg: body.iconeSvg });
      return json(resposta, 201, badge);
    }

    if (requisicao.method === 'POST' && url.pathname === '/gamificacao/badges/concessoes') {
      const body = await lerJson(requisicao);
      const concessao = {
        id: randomUUID(),
        tenantId,
        pacienteId: body.pacienteId,
        badgeId: body.badgeId,
        conquistadoEm: new Date().toISOString()
      };
      estado.pacienteBadges.unshift(concessao);
      registrarAuditoria('gamificacao.badge.conceder', 'paciente_badge', concessao.id, {
        pacienteId: body.pacienteId,
        badgeId: body.badgeId
      });
      return json(resposta, 201, concessao);
    }

    if (requisicao.method === 'GET' && url.pathname === '/categorias-pergunta') return json(resposta, 200, estado.categorias);

    if (requisicao.method === 'POST' && url.pathname === '/categorias-pergunta') {
      const body = await lerJson(requisicao);
      const categoria = { id: randomUUID(), tenantId, ...body };
      estado.categorias.push(categoria);
      registrarAuditoria('questionarios.categoria.criar', 'categoria_pergunta', categoria.id, { ordem: body.ordem });
      return json(resposta, 201, categoria);
    }

    if (requisicao.method === 'GET' && url.pathname === '/questionarios') return json(resposta, 200, paginar(estado.questionarios));

    if (requisicao.method === 'POST' && url.pathname === '/questionarios') {
      const body = await lerJson(requisicao);
      const questionario = {
        id: randomUUID(),
        tenantId,
        profissionalId: body.profissionalId,
        titulo: body.titulo,
        descricao: body.descricao,
        status: 'rascunho',
        versao: 1,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };
      estado.questionarios.unshift(questionario);
      estado.perguntas.set(questionario.id, []);
      registrarAuditoria('questionarios.criar', 'questionario', questionario.id, { profissionalId: body.profissionalId });
      return json(resposta, 201, questionario);
    }

    if (partes[0] === 'questionarios' && partes[1] && partes.length === 2 && requisicao.method === 'PATCH') {
      const body = await lerJson(requisicao);
      const questionario = estado.questionarios.find((item) => item.id === partes[1]);
      if (!questionario) return json(resposta, 404, { mensagem: 'Questionario nao encontrado.' });
      Object.assign(questionario, body, { versao: questionario.versao + 1, atualizadoEm: new Date().toISOString() });
      registrarAuditoria('questionarios.atualizar', 'questionario', questionario.id, { status: body.status });
      return json(resposta, 200, questionario);
    }

    if (partes[0] === 'questionarios' && partes[2] === 'perguntas' && partes.length === 3 && requisicao.method === 'GET') {
      return json(resposta, 200, estado.perguntas.get(partes[1]) ?? []);
    }

    if (partes[0] === 'questionarios' && partes[2] === 'perguntas' && partes.length === 3 && requisicao.method === 'POST') {
      const body = await lerJson(requisicao);
      const lista = estado.perguntas.get(partes[1]) ?? [];
      const pergunta = {
        id: randomUUID(),
        tenantId,
        questionarioId: partes[1],
        categoriaId: body.categoriaId,
        tipo: body.tipo,
        enunciado: body.enunciado,
        peso: String(body.peso),
        obrigatoria: body.obrigatoria ?? true,
        configuracao: body.configuracao ?? {},
        ordem: lista.length + 1
      };
      lista.push(pergunta);
      estado.perguntas.set(partes[1], lista);
      registrarAuditoria('questionarios.pergunta.criar', 'pergunta', pergunta.id, {
        questionarioId: partes[1],
        categoriaId: body.categoriaId,
        tipo: body.tipo,
        obrigatoria: pergunta.obrigatoria
      });
      return json(resposta, 201, pergunta);
    }

    if (partes[0] === 'questionarios' && partes[2] === 'perguntas' && partes[3] === 'ordem' && requisicao.method === 'PATCH') {
      const body = await lerJson(requisicao);
      const lista = estado.perguntas.get(partes[1]) ?? [];
      for (const ordem of body.perguntas ?? []) {
        const pergunta = lista.find((item) => item.id === ordem.id);
        if (pergunta) pergunta.ordem = ordem.ordem;
      }
      lista.sort((a, b) => a.ordem - b.ordem);
      registrarAuditoria('questionarios.perguntas.reordenar', 'questionario', partes[1], {
        totalPerguntas: body.perguntas?.length ?? 0
      });
      return json(resposta, 200, lista);
    }

    if (partes[0] === 'questionarios' && partes[2] === 'perguntas' && partes[3] && requisicao.method === 'PATCH') {
      const body = await lerJson(requisicao);
      const lista = estado.perguntas.get(partes[1]) ?? [];
      const pergunta = lista.find((item) => item.id === partes[3]);
      if (!pergunta) return json(resposta, 404, { mensagem: 'Pergunta nao encontrada.' });
      Object.assign(pergunta, body, { peso: String(body.peso) });
      registrarAuditoria('questionarios.pergunta.atualizar', 'pergunta', pergunta.id, {
        questionarioId: partes[1],
        categoriaId: body.categoriaId,
        tipo: body.tipo,
        obrigatoria: body.obrigatoria
      });
      return json(resposta, 200, pergunta);
    }

    if (requisicao.method === 'POST' && url.pathname === '/agendamentos-questionario') {
      const body = await lerJson(requisicao);
      const agendamento = { id: randomUUID(), tenantId, ...body, ativo: true, criadoEm: new Date().toISOString() };
      registrarAuditoria('questionarios.agendamento.criar', 'agendamento_questionario', agendamento.id, {
        questionarioId: body.questionarioId,
        timezone: body.timezone
      });
      return json(resposta, 201, agendamento);
    }

    if (requisicao.method === 'GET' && url.pathname === '/operacoes/resumo') {
      return json(resposta, 200, {
        outbox: { pendente: 1, processando: 0, processado: 8, falhou: estado.outbox.length },
        mobile: { sincronizado: estado.sincronizacoes.length, erro: 0 }
      });
    }

    if (requisicao.method === 'GET' && url.pathname === '/operacoes/outbox/falhas/paginada') {
      const itens = filtrarFalhasOutboxDemo(url);
      return json(resposta, 200, paginarResultado(itens, url.searchParams.get('pagina'), url.searchParams.get('limite')));
    }
    if (requisicao.method === 'GET' && url.pathname === '/operacoes/outbox/falhas/exportar.csv') {
      const itens = filtrarFalhasOutboxDemo(url).slice(0, normalizarLimite(url.searchParams.get('limite'), 500, 1000));
      return csv(
        resposta,
        'octaclin-outbox-falhas.csv',
        ['criadoEm', 'tipo', 'status', 'tentativas', 'erro', 'mensagemId'],
        itens.map((item) => [item.criadoEm, item.tipo, item.status, item.tentativas, item.erro ?? '', item.payload?.mensagemId ?? ''])
      );
    }
    if (requisicao.method === 'GET' && url.pathname === '/operacoes/outbox/falhas') return json(resposta, 200, estado.outbox);
    if (requisicao.method === 'POST' && partes[0] === 'operacoes' && partes[1] === 'outbox') {
      const evento = estado.outbox.find((item) => item.id === partes[2]);
      if (!evento) return json(resposta, 404, { mensagem: 'Evento nao encontrado.' });
      evento.status = 'pendente';
      evento.erro = undefined;
      return json(resposta, 200, evento);
    }
    if (requisicao.method === 'GET' && url.pathname === '/operacoes/mobile/sincronizacoes') return json(resposta, 200, estado.sincronizacoes);
    if (requisicao.method === 'GET' && url.pathname === '/operacoes/auditoria/paginada') {
      const itens = filtrarAuditoriaDemo(url);
      return json(resposta, 200, paginarResultado(itens, url.searchParams.get('pagina'), url.searchParams.get('limite')));
    }
    if (requisicao.method === 'GET' && url.pathname === '/operacoes/auditoria/exportar.csv') {
      const itens = filtrarAuditoriaDemo(url).slice(0, normalizarLimite(url.searchParams.get('limite'), 500, 1000));
      return csv(
        resposta,
        'octaclin-auditoria.csv',
        ['criadoEm', 'acao', 'recursoTipo', 'recursoId', 'usuarioId', 'ip', 'metadados'],
        itens.map((item) => [
          item.criadoEm,
          item.acao,
          item.recursoTipo ?? '',
          item.recursoId ?? '',
          item.usuarioId ?? '',
          item.ip ?? '',
          Object.entries(item.metadados ?? {})
            .filter(([, valor]) => ['string', 'number', 'boolean'].includes(typeof valor))
            .map(([chave, valor]) => `${chave}=${String(valor)}`)
            .join(';')
        ])
      );
    }
    if (requisicao.method === 'GET' && url.pathname === '/operacoes/auditoria') {
      const itens = filtrarAuditoriaDemo(url);
      return json(resposta, 200, itens.slice(0, normalizarLimite(url.searchParams.get('limite'))));
    }

    return json(resposta, 404, { mensagem: `Rota demo nao encontrada: ${requisicao.method} ${url.pathname}` });
  } catch (erro) {
    return json(resposta, 500, { mensagem: erro instanceof Error ? erro.message : 'Falha demo desconhecida.' });
  }
});

servidor.listen(porta, () => {
  console.log(`API demo OctaClin ouvindo em http://localhost:${porta}`);
  console.log('Credenciais: clinica-carla / admin@octaclin.local / OctaClin@123');
});
