import { expect, test } from '@playwright/test';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

const paciente = {
  id: 'paciente-densidade-1',
  tenantId: 'tenant-sintetico',
  profissionalResponsavelId: 'profissional-densidade-1',
  nome: 'Marina Sintetica de Almeida',
  contato: 'marina.sintetica@example.com',
  dataNascimento: '1991-05-18',
  statusAdesao: 'em_acompanhamento',
  scoreRisco: '28',
  criadoEm: '2026-08-20T10:00:00.000Z'
};

const profissional = {
  id: 'profissional-densidade-1',
  tenantId: 'tenant-sintetico',
  usuarioId: 'usuario-profissional-1',
  nome: 'Dra. Helena Sintetica',
  especialidade: 'Nutricao',
  criadoEm: '2026-08-20T10:00:00.000Z'
};

const consulta = {
  id: 'consulta-densidade-1',
  tenantId: 'tenant-sintetico',
  pacienteId: paciente.id,
  pacienteNome: paciente.nome,
  profissionalId: profissional.id,
  profissionalNome: profissional.nome,
  titulo: `Consulta - ${paciente.nome}`,
  inicioEm: '2026-08-24T13:00:00.000Z',
  fimEm: '2026-08-24T14:00:00.000Z',
  timezone: 'America/Sao_Paulo',
  status: 'agendada',
  modalidade: 'presencial',
  local: 'Sala Horizonte',
  valorCentavos: 18000,
  statusPagamento: 'pendente',
  notificacoes: {},
  payload: {},
  criadoEm: '2026-08-20T12:00:00.000Z',
  atualizadoEm: '2026-08-20T12:00:00.000Z'
};

const permissoes = [
  'console.acessar',
  'dashboard.ler',
  'agenda.consultas.ler',
  'agenda.consultas.criar',
  'pacientes.listar',
  'pacientes.ler',
  'pacientes.gerenciar',
  'profissionais.ler',
  'questionarios.ler',
  'comunicacoes.mensagens.ler',
  'materiais.ler',
  'materiais.gerenciar'
];

async function responderJson(route, body, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function prepararConsole(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
    { name: 'octaclin_papel', value: 'Professional', url: webUrl },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/dashboard'), url: webUrl }
  ]);

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const caminho = url.pathname;

    if (caminho === '/api/auth/session') {
      await responderJson(route, {
        autenticado: true,
        apiUrl: 'http://backend.sintetico.local',
        tenantSlug: 'clinica-sintetica',
        email: 'profissional.sintetico@example.com',
        expiraEm: '2026-08-21T12:00:00.000Z',
        papel: 'Professional',
        permissoes,
        destinoInicial: '/dashboard'
      });
      return;
    }

    if (caminho === '/api/notificacoes') return responderJson(route, { naoLidas: 0, itens: [] });

    if (caminho === '/api/agenda/consultas') return responderJson(route, [consulta]);
    if (caminho === '/api/agenda/agendamento-publico') return responderJson(route, null);
    if (caminho === '/api/agenda/solicitacoes') return responderJson(route, { itens: [], total: 0 });
    if (caminho === '/api/agenda/google/status') return responderJson(route, { conectado: false });
    if (caminho === '/api/agenda/feed') return responderJson(route, []);
    if (caminho === '/api/agenda/pacotes') return responderJson(route, []);
    if (caminho === '/api/pacientes') return responderJson(route, { itens: [paciente], total: 1 });
    if (caminho === '/api/profissionais') return responderJson(route, { itens: [profissional], total: 1 });
    if (caminho === `/api/pacientes/${paciente.id}/prontuario`) {
      return responderJson(route, {
        paciente,
        resumo: {
          consultas: 1,
          formulariosPendentes: 1,
          respostas: 2,
          checkinsRapidos: 1,
          mensagens: 3,
          evolucoes: 1,
          tarefasPendentes: 1,
          indicadoresRecentes: [],
          proximaConsulta: consulta,
          proximaConduta: {
            titulo: 'Revisar plano alimentar',
            descricao: 'Confirmar adesao e ajustar distribuicao das refeicoes.',
            dataReferencia: '2026-08-24T13:00:00.000Z'
          }
        },
        linhaDoTempo: []
      });
    }
    if (caminho.endsWith('/prontuario/timeline')) return responderJson(route, { itens: [], proximoCursor: null });
    if (caminho.endsWith('/avaliacoes-antropometricas')) return responderJson(route, { avaliacoes: [], deltaUltimas: [] });
    if (caminho === '/api/materiais' || caminho.includes('/materiais/pacientes/')) return responderJson(route, []);
    if (caminho.startsWith('/api/mobile/midias/uploads')) return responderJson(route, []);
    return responderJson(route, []);
  });
}

async function esperarInterface(page) {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Internal server error');
}

async function esperarSemOverflowDocumento(page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1);
}

async function esperarAlvosMinimos(page, seletor) {
  const dimensoes = await page.locator(seletor).evaluateAll((elementos) => elementos
    .filter((elemento) => {
      const estilo = window.getComputedStyle(elemento);
      const caixa = elemento.getBoundingClientRect();
      return estilo.visibility !== 'hidden' && estilo.display !== 'none' && caixa.width > 0 && caixa.height > 0;
    })
    .map((elemento) => {
      const caixa = elemento.getBoundingClientRect();
      return { nome: elemento.getAttribute('aria-label') || elemento.textContent?.trim(), largura: caixa.width, altura: caixa.height };
    }));

  expect(dimensoes.length).toBeGreaterThan(0);
  for (const dimensao of dimensoes) {
    expect.soft(dimensao.largura, `${dimensao.nome} deve ter largura acionavel`).toBeGreaterThanOrEqual(40);
    expect.soft(dimensao.altura, `${dimensao.nome} deve ter altura acionavel`).toBeGreaterThanOrEqual(40);
  }
}

test.describe('Fase 249 - densidade e responsividade do console clinico', () => {
  test('agenda adapta a visualizacao e os controles entre desktop e celular', async ({ page }, testInfo) => {
    await prepararConsole(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/agenda');
    await esperarInterface(page);
    await expect(page.getByRole('heading', { name: 'Agenda interna' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'semana', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await esperarSemOverflowDocumento(page);
    await page.screenshot({ path: testInfo.outputPath('agenda-1440.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('button', { name: /^dia$/i })).toHaveAttribute('aria-pressed', 'true');
    await esperarSemOverflowDocumento(page);
    await esperarAlvosMinimos(page, '[aria-label="Visualização da agenda"] button');
    await page.screenshot({ path: testInfo.outputPath('agenda-390.png'), fullPage: true });
  });

  test('lista de pacientes usa faixa de acoes e tabela compacta sem perder alvos de toque', async ({ page }, testInfo) => {
    await prepararConsole(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/pacientes');
    await esperarInterface(page);
    await expect(page.getByRole('heading', { name: 'Lista de pacientes' })).toBeVisible();
    const linha = page.getByTestId('linha-paciente').first();
    await expect(linha).toBeVisible();
    expect((await linha.boundingBox())?.height ?? 999).toBeLessThanOrEqual(72);
    await esperarAlvosMinimos(page, '[data-testid="acoes-paciente"] a, [data-testid="acoes-paciente"] button');
    await page.screenshot({ path: testInfo.outputPath('pacientes-1440.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    const acoes = page.getByRole('group', { name: 'Ações da lista de pacientes' });
    await expect(acoes).toBeVisible();
    expect((await acoes.boundingBox())?.height ?? 999).toBeLessThanOrEqual(56);
    await esperarSemOverflowDocumento(page);
    await page.screenshot({ path: testInfo.outputPath('pacientes-390.png'), fullPage: true });
  });

  test('prontuario preserva cabecalho, acoes e abas em uma unica faixa no celular', async ({ page }, testInfo) => {
    await prepararConsole(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/pacientes/${paciente.id}`);
    await esperarInterface(page);
    await expect(page.getByRole('heading', { name: paciente.nome })).toBeVisible();

    const acoes = page.getByRole('navigation', { name: 'Ações rápidas do paciente' });
    await expect(acoes).toBeVisible();
    expect((await acoes.boundingBox())?.height ?? 999).toBeLessThanOrEqual(56);
    await esperarAlvosMinimos(page, '[role="navigation"][aria-label="Ações rápidas do paciente"] a, [role="navigation"][aria-label="Ações rápidas do paciente"] button');

    const abas = page.getByRole('tablist', { name: 'Áreas principais do prontuário' });
    expect((await abas.boundingBox())?.height ?? 999).toBeLessThanOrEqual(60);
    const abaAtiva = abas.getByRole('tab', { selected: true });
    const textoAbaAtiva = await abaAtiva.textContent();
    await abaAtiva.focus();
    await page.keyboard.press('ArrowRight');
    await expect(abas.getByRole('tab', { selected: true })).not.toHaveText(textoAbaAtiva ?? '');
    await esperarSemOverflowDocumento(page);
    await page.screenshot({ path: testInfo.outputPath('prontuario-390.png'), fullPage: true });
  });
});
