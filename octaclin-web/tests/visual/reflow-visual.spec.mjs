import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// PR 31 da governanca de acessibilidade: reflow e acessibilidade visual.
//
// POR QUE VIEWPORT EM CSS PX, E NAO `document.body.style.zoom`
//
// O SC 1.4.10 (Reflow) do WCAG 2.2 e definido em CSS px, nao em fator de zoom:
// "conteudo pode ser apresentado sem perda de informacao ou funcionalidade e
// sem exigir rolagem em duas dimensoes para uma largura equivalente a 320 CSS
// px". A propria Understanding do W3C indica reduzir a janela ate 320 CSS px
// como forma valida de verificar o criterio, porque o que o zoom faz e
// justamente reduzir a quantidade de CSS px disponiveis para o layout.
//
// `document.body.style.zoom` escala a caixa DEPOIS do layout: media queries,
// wrapping, grid e flex continuam recebendo a largura original, entao o reflow
// nunca e exercitado e o teste passaria sem provar nada. `deviceScaleFactor`
// tambem nao serve: ele muda a densidade de pixels do dispositivo, nao os CSS
// px do layout.
//
// Equivalencias usadas, sobre a referencia de 1280 CSS px:
//   200% -> 1280 / 2 = 640 CSS px de largura
//   400% -> 1280 / 4 = 320 CSS px de largura (o limite literal do criterio)
// Para o eixo horizontal, o criterio pede 256 CSS px de altura; e o que a
// configuracao de paisagem exercita.
//
// Todos os dados sao sinteticos e todas as APIs sao interceptadas: nenhuma
// chamada real a backend, Gmail, Google Agenda, Meta ou WhatsApp.
// ---------------------------------------------------------------------------

const LARGURA_REFERENCIA = 1280;

const VIEWPORTS = [
  { nome: 'zoom 200%', largura: LARGURA_REFERENCIA / 2, altura: 512, orientacao: 'retrato' },
  { nome: 'zoom 400%', largura: LARGURA_REFERENCIA / 4, altura: 512, orientacao: 'retrato' },
  { nome: 'zoom 400% paisagem', largura: 512, altura: 256, orientacao: 'paisagem' }
];

// ---------------------------------------------------------------------------
// Helpers de medicao. Cada um devolve EVIDENCIA (numeros e nomes de elemento),
// nunca apenas um booleano, para que a falha diga o que corrigir.
// ---------------------------------------------------------------------------

async function medirRolagemHorizontal(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
}

async function assertSemRolagemHorizontal(page, contexto) {
  const medida = await medirRolagemHorizontal(page);
  expect(
    medida.scrollWidth - medida.clientWidth,
    `${contexto}: documento rola horizontalmente (scrollWidth ${medida.scrollWidth} > clientWidth ${medida.clientWidth})`
  ).toBeLessThanOrEqual(1);
}

// Elementos interativos visiveis cuja caixa sai do viewport no eixo X. So o
// eixo X e avaliado: o 1.4.10 permite rolagem em UMA dimensao, e a vertical e a
// escolhida por este produto.
//
// Elementos dentro de um container com rolagem horizontal propria sao
// ignorados de proposito: ali sair do viewport e o comportamento correto e o
// conteudo continua alcancavel pelo scroll do container.
async function detectarInterativosForaDoViewport(page) {
  return page.evaluate(() => {
    const seletor = [
      'a[href]',
      'button:not([disabled])',
      'input:not([type="hidden"]):not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[role="tab"]',
      '[role="menuitem"]'
    ].join(', ');
    const largura = document.documentElement.clientWidth;

    return Array.from(document.querySelectorAll(seletor))
      .filter((elemento) => {
        const estilo = getComputedStyle(elemento);
        if (estilo.visibility === 'hidden' || estilo.display === 'none' || estilo.opacity === '0') return false;
        const caixa = elemento.getBoundingClientRect();
        if (caixa.width === 0 || caixa.height === 0) return false;

        for (let pai = elemento.parentElement; pai; pai = pai.parentElement) {
          const estiloPai = getComputedStyle(pai);
          const rolaX = estiloPai.overflowX === 'auto' || estiloPai.overflowX === 'scroll';
          if (rolaX && pai.scrollWidth > pai.clientWidth) return false;
        }

        return caixa.left < -1 || caixa.right > largura + 1;
      })
      .map((elemento, indice) => {
        const caixa = elemento.getBoundingClientRect();
        const nome = (elemento.getAttribute('aria-label') ?? elemento.textContent ?? '').trim().slice(0, 40);
        const cabecalho = `${elemento.tagName}${elemento.id ? `#${elemento.id}` : ''} "${nome}" [${Math.round(caixa.left)}..${Math.round(caixa.right)}] em ${largura}px`;
        // So o primeiro infrator carrega a cadeia de ancestrais: e nela que
        // aparece qual container nao encolhe (tipicamente `min-width: auto`
        // herdado por item de grid/flex), que e a causa real do estouro.
        if (indice > 0) return cabecalho;
        const cadeia = [];
        for (let pai = elemento; pai && pai !== document.documentElement; pai = pai.parentElement) {
          const estilo = getComputedStyle(pai);
          const retangulo = pai.getBoundingClientRect();
          cadeia.push(`      ${pai.tagName}${pai.id ? `#${pai.id}` : ''} w=${Math.round(retangulo.width)} display=${estilo.display} minW=${estilo.minWidth} overflowX=${estilo.overflowX} class="${String(pai.className).slice(0, 80)}"`);
        }
        return `${cabecalho}\n${cadeia.join('\n')}`;
      });
  });
}

// Conteudo cortado por overflow hidden SEM truncagem declarada. Truncar com
// `text-overflow: ellipsis` e decisao de layout legitima e nao e reportado; o
// que se procura e texto simplesmente desaparecendo da caixa.
async function detectarTextoCortado(page) {
  return page.evaluate(() => {
    const TOLERANCIA = 2;
    return Array.from(document.querySelectorAll('h1, h2, h3, p, label, span, li, td, th, button, a'))
      .filter((elemento) => {
        const estilo = getComputedStyle(elemento);
        if (estilo.visibility === 'hidden' || estilo.display === 'none') return false;
        if (estilo.overflowX !== 'hidden' && estilo.overflowY !== 'hidden') return false;
        if (estilo.textOverflow === 'ellipsis') return false;
        if (!elemento.textContent?.trim()) return false;
        const caixa = elemento.getBoundingClientRect();
        if (caixa.width === 0 || caixa.height === 0) return false;
        // Texto so-para-leitor-de-tela (sr-only) e uma caixa de 1x1 com
        // overflow hidden e clip: por definicao o conteudo "transborda", e isso
        // e o comportamento correto, nao conteudo cortado. Sem esta exclusao o
        // check acusa "Carregando pacientes" em toda tela com estado de
        // carregamento acessivel - falso positivo observado no primeiro run.
        if (caixa.width <= 1 || caixa.height <= 1) return false;
        if (estilo.clipPath !== 'none' || (estilo.clip && estilo.clip !== 'auto')) return false;
        const cortaX = elemento.scrollWidth > elemento.clientWidth + TOLERANCIA;
        const cortaY = elemento.scrollHeight > elemento.clientHeight + TOLERANCIA;
        return cortaX || cortaY;
      })
      .map((elemento) => `${elemento.tagName} "${elemento.textContent.trim().slice(0, 40)}" (conteudo ${elemento.scrollWidth}x${elemento.scrollHeight}, caixa ${elemento.clientWidth}x${elemento.clientHeight})`);
  });
}

// WCAG 2.4.11: o elemento focado nao pode ficar coberto por barra fixa, rodape
// ou overlay. Verificado por hit-test no centro da caixa focada.
async function detectarFocoObscurecido(locator) {
  await locator.focus();
  return locator.evaluate((alvo) => {
    const caixa = alvo.getBoundingClientRect();
    if (caixa.width === 0 || caixa.height === 0) return 'elemento focado sem caixa visivel';
    const x = Math.min(Math.max(caixa.left + caixa.width / 2, 1), window.innerWidth - 1);
    const y = Math.min(Math.max(caixa.top + caixa.height / 2, 1), window.innerHeight - 1);
    const noPonto = document.elementFromPoint(x, y);
    if (!noPonto) return 'o centro do elemento focado nao atinge nenhum elemento';
    if (noPonto === alvo || alvo.contains(noPonto) || noPonto.contains(alvo)) return null;
    const classe = typeof noPonto.className === 'string' ? noPonto.className.slice(0, 60) : '';
    return `coberto por ${noPonto.tagName}.${classe}`;
  });
}

// WCAG 2.4.7: o indicador de foco tem de existir e ser visivel. O projeto usa
// box-shadow em `:focus-visible` (app/globals.css), entao aceitar outline OU
// box-shadow cobre os dois estilos em uso.
async function detectarFocoSemIndicador(locator) {
  await locator.focus();
  return locator.evaluate((alvo) => {
    const estilo = getComputedStyle(alvo);
    const temOutline = estilo.outlineStyle !== 'none' && estilo.outlineWidth !== '0px';
    const temSombra = estilo.boxShadow !== 'none';
    return temOutline || temSombra ? null : `${alvo.tagName} sem outline nem box-shadow no foco`;
  });
}

// WCAG 1.4.12: aplica o espacamento de texto exigido pelo criterio. Nao ha
// `!important` no criterio, mas o teste precisa vencer os utilitarios do
// Tailwind para simular a folha de estilo do usuario.
async function aplicarEspacamentoDeTextoWcag(page) {
  await page.addStyleTag({
    content: `
      * {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p, li {
        margin-bottom: 2em !important;
      }
    `
  });
}

// WCAG 2.3.3 / prefers-reduced-motion: com a media emulada em "reduce",
// nenhuma animacao ou transicao perceptivel pode continuar ativa. O limiar de
// 100ms separa "neutralizada" de "ainda anima".
async function detectarMovimentoIgnorandoReducedMotion(page) {
  return page.evaluate(() => {
    const LIMITE_MS = 100;
    const emMs = (valor) => Math.max(
      0,
      ...String(valor).split(',').map((parte) => {
        const texto = parte.trim();
        const numero = parseFloat(texto);
        if (Number.isNaN(numero)) return 0;
        return texto.endsWith('ms') ? numero : numero * 1000;
      })
    );

    return Array.from(document.querySelectorAll('*'))
      .filter((elemento) => {
        const estilo = getComputedStyle(elemento);
        if (estilo.visibility === 'hidden' || estilo.display === 'none') return false;
        const animando = estilo.animationName !== 'none' && emMs(estilo.animationDuration) > LIMITE_MS;
        const transicionando = estilo.transitionProperty !== 'none' && emMs(estilo.transitionDuration) > LIMITE_MS;
        return animando || transicionando;
      })
      .slice(0, 10)
      .map((elemento) => {
        const estilo = getComputedStyle(elemento);
        return `${elemento.tagName} animation=${estilo.animationName}/${estilo.animationDuration} transition=${estilo.transitionProperty}/${estilo.transitionDuration}`;
      });
  });
}

// Executa o conjunto de checks confiaveis para um estado de tela. Recebe
// `alvoFoco` opcional: um locator representativo da acao principal, para os
// criterios 2.4.7 e 2.4.11.
// O layout so pode ser medido depois de assentar. Sem isto as medidas variam
// entre corridas: `next dev` compila a rota sob demanda e as fontes carregam
// depois da primeira pintura, entao a mesma tela dava 2 ou 7 infratores
// dependendo de o servidor ja ter compilado a rota. Um gate que muda de
// resposta entre corridas nao e evidencia de nada.
async function aguardarLayoutEstavel(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts?.ready);
  await page.evaluate(() => new Promise((resolve) => {
    let anterior = -1;
    let estaveis = 0;
    const medir = () => {
      const atual = document.documentElement.scrollWidth;
      estaveis = atual === anterior ? estaveis + 1 : 0;
      anterior = atual;
      if (estaveis >= 3) return resolve();
      requestAnimationFrame(medir);
    };
    requestAnimationFrame(medir);
  }));
}

async function auditarReflow(page, contexto, { alvoFoco } = {}) {
  await aguardarLayoutEstavel(page);
  await assertSemRolagemHorizontal(page, contexto);

  const foraDoViewport = await detectarInterativosForaDoViewport(page);
  expect(foraDoViewport, `${contexto}: controles interativos fora do viewport:\n${foraDoViewport.join('\n')}`).toEqual([]);

  const cortado = await detectarTextoCortado(page);
  expect(cortado, `${contexto}: conteudo cortado por overflow sem truncagem declarada:\n${cortado.join('\n')}`).toEqual([]);

  if (alvoFoco) {
    const semIndicador = await detectarFocoSemIndicador(alvoFoco);
    expect(semIndicador, `${contexto}: ${semIndicador}`).toBeNull();

    const obscurecido = await detectarFocoObscurecido(alvoFoco);
    expect(obscurecido, `${contexto}: foco obscurecido - ${obscurecido}`).toBeNull();
  }
}

// ---------------------------------------------------------------------------
// Mocks sinteticos. Seguem o formato ja usado em
// fase-249-densidade-responsividade.spec.mjs (catch-all `**/api/**` com
// fallback), que e o padrao desta suite. Extrair um modulo comum entre os
// specs seria refatoracao fora do escopo deste PR.
// ---------------------------------------------------------------------------

const PERMISSOES_CONSOLE = [
  'console.acessar',
  'dashboard.ler',
  'agenda.consultas.ler',
  'agenda.consultas.criar',
  'pacientes.listar',
  'pacientes.ler',
  'pacientes.gerenciar',
  'profissionais.ler',
  'questionarios.ler',
  'questionarios.gerenciar',
  'comunicacoes.mensagens.ler',
  'comunicacoes.mensagens.enviar'
];

const pacienteSintetico = {
  id: 'paciente-reflow-1',
  tenantId: 'tenant-sintetico',
  profissionalResponsavelId: 'profissional-reflow-1',
  nome: 'Participante Sintético com Nome Bastante Longo Para Testar Quebra',
  contato: 'participante.sintetico@octaclin.test',
  dataNascimento: '1990-03-12',
  statusAdesao: 'em_acompanhamento',
  scoreRisco: '31',
  criadoEm: '2026-08-20T10:00:00.000Z'
};

const profissionalSintetico = {
  id: 'profissional-reflow-1',
  tenantId: 'tenant-sintetico',
  usuarioId: 'usuario-reflow-1',
  nome: 'Equipe Sintética de Acompanhamento',
  especialidade: 'Acompanhamento sintético',
  criadoEm: '2026-08-20T10:00:00.000Z'
};

const consultaSintetica = {
  id: 'consulta-reflow-1',
  tenantId: 'tenant-sintetico',
  pacienteId: pacienteSintetico.id,
  pacienteNome: pacienteSintetico.nome,
  profissionalId: profissionalSintetico.id,
  profissionalNome: profissionalSintetico.nome,
  titulo: 'Consulta sintética de acompanhamento',
  inicioEm: '2026-08-24T13:00:00.000Z',
  fimEm: '2026-08-24T14:00:00.000Z',
  timezone: 'America/Sao_Paulo',
  status: 'agendada',
  modalidade: 'presencial',
  local: 'Sala Sintética',
  notificacoes: {},
  payload: {},
  criadoEm: '2026-08-20T12:00:00.000Z',
  atualizadoEm: '2026-08-20T12:00:00.000Z'
};

function responderJson(route, corpo) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
}

async function prepararConsoleSintetico(page) {
  const naoMockadas = [];

  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/dashboard'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/**', async (route) => {
    const caminho = new URL(route.request().url()).pathname;

    if (caminho === '/api/auth/session') {
      return responderJson(route, {
        autenticado: true,
        apiUrl: 'http://backend.sintetico.local',
        tenantSlug: 'clinica-sintetica',
        email: 'profissional.sintetico@octaclin.test',
        expiraEm: '2026-12-31T18:00:00.000Z',
        papel: 'Professional',
        permissoes: PERMISSOES_CONSOLE,
        destinoInicial: '/dashboard'
      });
    }
    if (caminho === '/api/notificacoes') return responderJson(route, { naoLidas: 0, itens: [] });
    if (caminho === '/api/agenda/consultas') return responderJson(route, [consultaSintetica]);
    if (caminho === '/api/agenda/solicitacoes') return responderJson(route, { itens: [], total: 0 });
    if (caminho === '/api/agenda/google/status') return responderJson(route, { conectado: false });
    if (caminho === '/api/agenda/agendamento-publico') return responderJson(route, null);
    if (caminho === '/api/pacientes') return responderJson(route, { itens: [pacienteSintetico], total: 1 });
    if (caminho === '/api/pacientes/filtros-salvos') return responderJson(route, { itens: [] });
    if (caminho === '/api/profissionais') return responderJson(route, { itens: [profissionalSintetico], total: 1 });
    // Formato real do BFF, copiado do mock ja validado em acessibilidade.spec.mjs.
    if (caminho.startsWith('/api/dashboard')) {
      return responderJson(route, {
        contexto: { periodo: 'hoje', inicioEm: '2026-08-24T00:00:00.000Z', fimEm: '2026-08-24T23:59:59.999Z' },
        indicadores: {
          consultasHoje: 1, proximas: 1, concluidas: 0, reagendadas: 0, canceladas: 0, faltas: 0,
          semRetorno30: 0, semRetorno60: 0, semRetorno90Mais: 0, formulariosPendentes: 0,
          tarefasVencidas: 0, solicitacoesPendentes: 0, comunicacoesEmAlerta: 0, pacientesRiscoAlto: 0
        },
        atendimentos: [], semRetorno: [], tarefasVencidas: [], formulariosPendentes: [],
        solicitacoesPendentes: [], comunicacoes: [], alertas: [], selecaoObrigatoria: false
      });
    }
    if (caminho === '/api/questionarios/modelos') return responderJson(route, []);
    if (caminho === '/api/questionarios') return responderJson(route, { itens: [], total: 0 });
    if (caminho.startsWith('/api/biblioteca-perguntas')) return responderJson(route, []);

    naoMockadas.push(`${route.request().method()} ${caminho}`);
    return responderJson(route, []);
  });

  return { naoMockadas };
}

async function prepararPortalSintetico(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/**', async (route) => {
    const caminho = new URL(route.request().url()).pathname;

    if (caminho === '/api/portal/paciente') {
      return responderJson(route, {
        paciente: { id: 'paciente-reflow-1', nome: 'Participante Sintético', statusAdesao: 'aderente' },
        perfil: {
          email: 'participante.sintetico@octaclin.test',
          preferenciasContato: {
            email: true,
            whatsapp: false,
            canalPreferido: 'email',
            horarioPermitido: { inicio: '08:00', fim: '20:00', timezone: 'America/Sao_Paulo' }
          },
          profissionalResponsavelId: 'profissional-reflow-1'
        },
        resumo: { consultasProximas: 1, formulariosPendentes: 0, formulariosRespondidos: 0, mensagensRecentes: 0 },
        consultasProximas: [
          {
            id: 'consulta-portal-1',
            titulo: 'Consulta sintética de acompanhamento nutricional',
            inicioEm: '2026-09-10T13:00:00.000Z',
            fimEm: '2026-09-10T13:50:00.000Z',
            status: 'agendada',
            local: 'Online'
          }
        ],
        formulariosPendentes: [],
        formulariosRespondidos: [],
        mensagensRecentes: [],
        diariosRecentes: [],
        lgpd: { versaoAtual: '2026-08', documentosLegais: [], consentimentos: [], solicitacoes: [] }
      });
    }
    if (caminho === '/api/notificacoes') return responderJson(route, { naoLidas: 0, itens: [] });
    return responderJson(route, []);
  });
}

async function prepararAgendamentoPublicoSintetico(page) {
  await page.route('**/api/**', async (route) => {
    const caminho = new URL(route.request().url()).pathname;
    if (caminho === '/api/agendamentos-publicos/token-publico') {
      return responderJson(route, {
        clinica: { nome: 'Clínica Sintética', corPrimaria: '#247BA0' },
        profissional: { nomeExibicao: 'Equipe Sintética', especialidade: 'Acompanhamento sintético' },
        timezone: 'America/Sao_Paulo',
        duracaoMinutos: 50,
        dias: [
          {
            data: '2026-09-03',
            rotulo: '03/09/2026',
            horarios: [
              { inicioEm: '2026-09-03T13:00:00.000Z', rotulo: '10:00' },
              { inicioEm: '2026-09-03T14:00:00.000Z', rotulo: '11:00' }
            ]
          }
        ]
      });
    }
    return responderJson(route, []);
  });
}

async function prepararFormularioPublicoSintetico(page) {
  await page.route('**/api/**', async (route) => {
    const caminho = new URL(route.request().url()).pathname;
    if (caminho === '/api/formularios/token-publico') {
      return responderJson(route, {
        envioId: 'envio-token-publico',
        titulo: 'Check-in sintético semanal',
        status: 'enviado',
        rascunhoVersao: 0,
        respostasRascunho: [],
        perguntas: [
          {
            id: 'pergunta-1',
            tipo: 'texto_longo',
            enunciado: 'Como foi a sua semana de acompanhamento nutricional sintético?',
            obrigatoria: true,
            configuracao: { secao: 'Hoje', limiteCaracteres: 500 },
            opcoes: [],
            ordem: 1
          }
        ]
      });
    }
    return responderJson(route, []);
  });
}

// ---------------------------------------------------------------------------
// Matriz: rota x viewport x orientacao x configuracao visual.
// ---------------------------------------------------------------------------

const ROTAS = [
  {
    nome: '/login',
    caminho: '/login',
    preparar: async () => undefined,
    aguardar: (page) => expect(page.getByRole('heading', { name: 'Acesso OctaClin' })).toBeVisible(),
    alvoFoco: (page) => page.getByRole('button', { name: 'Entrar' })
  },
  {
    nome: '/dashboard',
    caminho: '/dashboard',
    preparar: prepararConsoleSintetico,
    aguardar: (page) => expect(page.getByRole('heading', { name: 'Hoje', level: 1 })).toBeVisible(),
    alvoFoco: (page) => page.getByRole('button', { name: /Notificações/ })
  },
  {
    nome: '/agenda',
    caminho: '/agenda',
    preparar: prepararConsoleSintetico,
    aguardar: (page) => expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible(),
    alvoFoco: (page) => page.getByRole('button').first()
  },
  {
    nome: '/pacientes',
    caminho: '/pacientes',
    preparar: prepararConsoleSintetico,
    aguardar: (page) => expect(page.getByRole('heading', { name: 'Pacientes', level: 1 })).toBeVisible(),
    alvoFoco: (page) => page.getByRole('button').first()
  },
  {
    nome: '/questionarios',
    caminho: '/questionarios',
    preparar: prepararConsoleSintetico,
    aguardar: (page) => expect(page.getByRole('heading', { name: 'Editor de Questionários', level: 1 })).toBeVisible(),
    alvoFoco: (page) => page.getByRole('tab').first()
  },
  {
    nome: '/comunicacoes',
    caminho: '/comunicacoes',
    preparar: prepararConsoleSintetico,
    aguardar: (page) => expect(page.getByRole('heading', { name: 'Comunicações', level: 1 })).toBeVisible(),
    alvoFoco: (page) => page.getByRole('tab').first()
  },
  {
    nome: '/portal (paciente)',
    caminho: '/portal',
    preparar: prepararPortalSintetico,
    aguardar: (page) => expect(page.locator('main')).toBeVisible(),
    alvoFoco: (page) => page.getByRole('button').first()
  },
  {
    nome: '/agendar/token-publico',
    caminho: '/agendar/token-publico',
    preparar: prepararAgendamentoPublicoSintetico,
    aguardar: (page) => expect(page.locator('main')).toBeVisible(),
    alvoFoco: (page) => page.getByRole('button').first()
  },
  {
    nome: '/formularios/token-publico',
    caminho: '/formularios/token-publico',
    preparar: prepararFormularioPublicoSintetico,
    aguardar: (page) => expect(page.getByRole('heading', { name: 'Check-in sintético semanal' })).toBeVisible(),
    alvoFoco: (page) => page.getByRole('textbox').first()
  }
];

test.describe('PR 31 - reflow e acessibilidade visual', () => {
  for (const rota of ROTAS) {
    for (const viewport of VIEWPORTS) {
      test(`${rota.nome} - ${viewport.nome} (${viewport.largura}x${viewport.altura} CSS px, ${viewport.orientacao})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.largura, height: viewport.altura });
        await rota.preparar(page);
        await page.goto(rota.caminho);
        await rota.aguardar(page);

        const contexto = `${rota.nome} @ ${viewport.largura}x${viewport.altura}`;

        // 1.4.10 Reflow + 2.4.7/2.4.11 no estado padrao.
        await auditarReflow(page, contexto, { alvoFoco: rota.alvoFoco(page) });

        // 1.4.12 Text Spacing: mesmo estado, com o espacamento do criterio.
        await aplicarEspacamentoDeTextoWcag(page);
        await auditarReflow(page, `${contexto} + espacamento 1.4.12`);
      });
    }
  }

  test('prefers-reduced-motion neutraliza animacoes e transicoes no console', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 640, height: 512 });
    await prepararConsoleSintetico(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Hoje', level: 1 })).toBeVisible();

    const movimento = await detectarMovimentoIgnorandoReducedMotion(page);
    expect(movimento, `movimento ativo apesar de prefers-reduced-motion:\n${movimento.join('\n')}`).toEqual([]);
  });

  test('prefers-reduced-motion neutraliza animacoes e transicoes no portal publico', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 512 });
    await prepararFormularioPublicoSintetico(page);
    await page.goto('/formularios/token-publico');
    await expect(page.getByRole('heading', { name: 'Check-in sintético semanal' })).toBeVisible();

    const movimento = await detectarMovimentoIgnorandoReducedMotion(page);
    expect(movimento, `movimento ativo apesar de prefers-reduced-motion:\n${movimento.join('\n')}`).toEqual([]);
  });

  test('conteudo operacional continua utilizavel a 320 CSS px, nao apenas visivel', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 512 });
    await prepararConsoleSintetico(page);
    await page.goto('/pacientes');
    await expect(page.getByRole('heading', { name: 'Pacientes', level: 1 })).toBeVisible();

    // "Utilizavel" = alcancavel por teclado, com foco visivel e nao coberto.
    // Percorre a sequencia real de tabulacao em vez de conferir so a caixa.
    await page.locator('nextjs-portal').evaluateAll((elementos) => elementos.forEach((elemento) => elemento.remove()));

    const problemas = [];
    for (let volta = 1; volta <= 15; volta += 1) {
      await page.keyboard.press('Tab');
      const passo = await page.evaluate(() => {
        const ativo = document.activeElement;
        if (!ativo || ativo === document.body) return null;
        const caixa = ativo.getBoundingClientRect();
        const estilo = getComputedStyle(ativo);
        const x = Math.min(Math.max(caixa.left + caixa.width / 2, 1), window.innerWidth - 1);
        const y = Math.min(Math.max(caixa.top + caixa.height / 2, 1), window.innerHeight - 1);
        const noPonto = document.elementFromPoint(x, y);
        return {
          nome: `${ativo.tagName} "${(ativo.getAttribute('aria-label') ?? ativo.textContent ?? '').trim().slice(0, 30)}"`,
          dentroDoEixoX: caixa.left >= -1 && caixa.right <= window.innerWidth + 1,
          temIndicador: (estilo.outlineStyle !== 'none' && estilo.outlineWidth !== '0px') || estilo.boxShadow !== 'none',
          alcancavel: Boolean(noPonto) && (noPonto === ativo || ativo.contains(noPonto) || noPonto.contains(ativo))
        };
      });
      if (!passo) break;
      if (!passo.dentroDoEixoX) problemas.push(`Tab ${volta}: ${passo.nome} fora do eixo horizontal`);
      if (!passo.temIndicador) problemas.push(`Tab ${volta}: ${passo.nome} sem indicador de foco`);
      if (!passo.alcancavel) problemas.push(`Tab ${volta}: ${passo.nome} coberto por outro elemento`);
    }

    expect(problemas, `controles inutilizaveis a 320 CSS px:\n${problemas.join('\n')}`).toEqual([]);
  });
});
