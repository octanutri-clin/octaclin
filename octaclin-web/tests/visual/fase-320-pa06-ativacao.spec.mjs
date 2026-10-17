import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pacienteId = 'paciente-pa06-sintetico';
const planoId = 'plano-pa06-sintetico';
const identidadeRefeicao = '10000000-0000-4000-8000-000000000001';
const permissoes = [
  'console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar',
  'profissionais.ler', 'planos_alimentares.ler', 'planos_alimentares.gerenciar'
];

function refeicao() {
  return {
    id: 'refeicao-pa06-fisica', ordem: 0, nome: 'Refeição sintética', horarioLocal: '08:00', orientacoes: '', itens: []
  };
}

function versaoAtiva() {
  return {
    id: 'versao-pa06-atual', numero: 1, status: 'publicada', publicadoEm: '2026-10-15T12:00:00.000Z',
    criadoEm: '2026-10-15T12:00:00.000Z', atualizadoEm: '2026-10-15T12:00:00.000Z',
    apresentacaoEstado: 'configurada', preferenciasApresentacao: {
      schemaVersao: 1,
      profissional: { horario: true, macros: true, medidasCaseiras: true, orientacoes: true, substituicoesExpandidas: true, modoCompacto: false },
      paciente: { horario: true, macros: true, medidasCaseiras: true, orientacoes: true, substituicoesExpandidas: false, modoCompacto: false }
    },
    ativacaoRevisao: 1, ativoParaPaciente: true,
    ativacaoRefeicoes: [{ refeicaoId: 'refeicao-pa06-fisica', identidadeId: identidadeRefeicao, ativa: true }],
    resumoRefeicoesAtivas: { estado: 'completo', energiaKcal: 100, proteinasG: 4, carboidratosG: 15, gordurasG: 2 },
    calculo: { metaEnergeticaKcal: 1800, metasMacronutrientes: { carboidratosG: 225, proteinasG: 90, gordurasG: 60 } },
    totais: { energiaKcal: 100, proteinasG: 4, carboidratosG: 15, gordurasG: 2 },
    refeicoes: [refeicao()]
  };
}

function planoAtivo() {
  const current = versaoAtiva();
  return {
    id: planoId, pacienteId, profissionalId: 'profissional-pa06-sintetico', titulo: 'Plano clínico sintético',
    criadoEm: '2026-10-15T12:00:00.000Z', atualizadoEm: '2026-10-15T12:00:00.000Z',
    ativoParaPaciente: true, ativacaoRevisao: 1, resumoNutricionalVigente: current.resumoRefeicoesAtivas,
    current, historico: [{ id: current.id, numero: 1, status: 'publicada', publicadaEm: current.publicadaEm }]
  };
}

async function prepararConsole(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);
  await page.route((url) => url.pathname === '/api/auth/session', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ autenticado: true, apiUrl: 'http://localhost:3001',
      tenantSlug: 'clinica-sintetica', email: 'profissional@example.test', expiraEm: '2026-10-30T12:00:00.000Z',
      papel: 'Professional', permissoes, destinoInicial: '/pacientes' })
  }));
  await page.route((url) => url.pathname === '/api/profissionais', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'profissional-pa06-sintetico', nome: 'Profissional sintético' }], total: 1 })
  }));
  await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/prontuario`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      paciente: { id: pacienteId, tenantId: 'tenant-sintetico', profissionalResponsavelId: 'profissional-pa06-sintetico', nome: 'Paciente sintético', statusAdesao: 'aderente' },
      resumo: { consultas: 0, formulariosPendentes: 0, respostas: 0, checkinsRapidos: 0, mensagens: 0, evolucoes: 0, tarefasPendentes: 0,
        indicadoresRecentes: [], leituraClinica: { deltaUltimaAvaliacao: [], deltaDesdeInicio: [], condutasVencendo: [] } }, linhaDoTempo: []
    })
  }));
  await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/avaliacoes-antropometricas`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ avaliacoes: [], deltaUltimas: [] })
  }));
  await page.route((url) => url.pathname === '/api/planos-alimentares/modelos' || url.pathname === '/api/planos-alimentares/receitas', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 100 })
  }));
}

test('PA06 alterna plano e refeição sem salvar ou publicar conteúdo clínico', async ({ page }) => {
  await prepararConsole(page);
  let detalhe = planoAtivo();
  const mutacoes = [];
  await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [detalhe], total: 1, pagina: 1, limite: 25 })
  }));
  await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(detalhe)
  }));
  await page.route((url) => url.pathname.startsWith(`/api/pacientes/${pacienteId}/planos-alimentares/${planoId}/`) && url.pathname.endsWith('/ativacao'), async (route) => {
    const body = route.request().postDataJSON();
    const caminho = new URL(route.request().url()).pathname;
    const refeicaoTarget = caminho.includes('/refeicoes/');
    mutacoes.push({ url: caminho, body });
    const revision = body.ativacaoRevisaoEsperada + 1;
    if (refeicaoTarget) {
      const current = detalhe.current;
      current.ativacaoRevisao = revision;
      current.ativacaoRefeicoes[0].ativa = body.ativo;
      current.resumoRefeicoesAtivas = body.ativo
        ? { estado: 'completo', energiaKcal: 100, proteinasG: 4, carboidratosG: 15, gordurasG: 2 }
        : { estado: 'completo', energiaKcal: 0, proteinasG: 0, carboidratosG: 0, gordurasG: 0 };
      detalhe = { ...detalhe, ativacaoRevisao: revision, current };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        planoId, ativoParaPaciente: detalhe.ativoParaPaciente, ativacaoRevisao: revision, identidadeRefeicaoId: identidadeRefeicao, ativa: body.ativo
      }) });
      return;
    }
    detalhe = { ...detalhe, ativoParaPaciente: body.ativo, ativacaoRevisao: revision,
      current: { ...detalhe.current, ativoParaPaciente: body.ativo, ativacaoRevisao: revision } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planoId, ativoParaPaciente: body.ativo, ativacaoRevisao: revision }) });
  });

  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('article').getByRole('heading', { name: 'Plano clínico sintético' })).toBeVisible();
  const planoSwitch = page.getByRole('switch', { name: /Plano alimentar para o paciente/ });
  await expect(planoSwitch).toHaveAttribute('aria-checked', 'true');
  await planoSwitch.focus();
  await page.keyboard.press('Space');
  await expect(planoSwitch).toHaveAttribute('aria-checked', 'false');
  await planoSwitch.click();
  await expect(planoSwitch).toHaveAttribute('aria-checked', 'true');

  const refeicaoSwitch = page.getByRole('switch', { name: /Visibilidade da refeição Refeição sintética/ });
  await refeicaoSwitch.click();
  await expect(refeicaoSwitch).toHaveAttribute('aria-checked', 'false');
  await planoSwitch.click();
  await expect(planoSwitch).toHaveAttribute('aria-checked', 'false');
  await planoSwitch.click();
  await expect(planoSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(refeicaoSwitch).toHaveAttribute('aria-checked', 'false');
  expect(mutacoes.map((item) => item.body.ativacaoRevisaoEsperada)).toEqual([1, 2, 3, 4, 5]);
  await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toHaveCount(0);
  expect(mutacoes.every((item) => item.body.ativo === false || item.body.ativo === true)).toBe(true);
  const acessibilidade = await new AxeBuilder({ page }).include('[role="switch"]').analyze();
  expect(acessibilidade.violations).toEqual([]);
});

test('PA06 conflito e resposta incerta não otimizam estado e permitem reconciliar pelo servidor', async ({ page }) => {
  await prepararConsole(page);
  let detalhe = planoAtivo();
  let mutacoes = 0;
  await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [detalhe], total: 1, pagina: 1, limite: 25 })
  }));
  await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(detalhe)
  }));
  await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}/ativacao`, async (route) => {
    mutacoes += 1;
    if (mutacoes === 1) {
      detalhe = { ...detalhe, ativoParaPaciente: false, ativacaoRevisao: 2,
        current: { ...detalhe.current, ativoParaPaciente: false, ativacaoRevisao: 2 } };
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ statusCode: 409, message: 'Conflito de revisão' }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, message: 'Indisponível' }) });
  });

  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
  const planoSwitch = page.getByRole('switch', { name: /Plano alimentar para o paciente/ });
  await expect(planoSwitch).toHaveAttribute('aria-checked', 'true');
  await planoSwitch.click();
  await expect(planoSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText(/alterada em outra operação/)).toBeVisible();

  await planoSwitch.click();
  await expect(planoSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText(/resposta da alteração de visibilidade não foi confirmada/)).toBeVisible();
  await page.getByRole('button', { name: 'Consultar estado da visibilidade' }).click();
  await expect(planoSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('status').filter({ hasText: 'Estado de visibilidade atualizado a partir do servidor.' })).toBeVisible();
  expect(mutacoes).toBe(2);
});

for (const [modo, alvoRefeicao] of [['impressao carregada', false], ['impressao carregada', true], ['impressao pendente', true], ['previa carregada', true]]) {
  test(`PA06 OFF ${alvoRefeicao ? 'refeição' : 'plano'} invalida ${modo} e descarta respostas antigas`, async ({ page }) => {
    await prepararConsole(page);
    let detalhe = planoAtivo();
    if (modo === 'previa carregada') detalhe = { ...detalhe,
      draft: { ...versaoAtiva(), id: 'draft-pa06', numero: 2, status: 'rascunho', rascunhoRevisao: 1 } };
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares`, (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [detalhe], total: 1, pagina: 1, limite: 25 })
    }));
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`, (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(detalhe)
    }));
    await page.route((url) => url.pathname.endsWith('/ativacao'), async (route) => {
      detalhe = { ...detalhe, ativacaoRevisao: 2, ativoParaPaciente: alvoRefeicao };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ planoId, ativoParaPaciente: alvoRefeicao, ativacaoRevisao: 2,
        ...(alvoRefeicao ? { identidadeRefeicaoId: identidadeRefeicao, ativa: false } : {}) }) });
    });
    let liberarResposta;
    let iniciarResposta;
    const iniciou = new Promise((resolve) => { iniciarResposta = resolve; });
    const resposta = new Promise((resolve) => { liberarResposta = resolve; });
    await page.route((url) => url.pathname.endsWith('/apresentacao-paciente'), async (route) => {
      iniciarResposta();
      if (modo === 'impressao pendente') await resposta;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        id: planoId, titulo: 'Projeção sintética', numeroVersao: 1,
        refeicoes: [{ id: 'ref-projecao', nome: 'Refeição somente na projeção', itens: [] }]
      }) });
    });
    await page.addInitScript(() => { window.__pa06Impressoes = 0; window.print = () => { window.__pa06Impressoes += 1; }; });
    await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: modo === 'previa carregada' ? 'Prévia do paciente' : 'Imprimir', exact: true }).click();
    await iniciou;
    if (modo === 'impressao carregada') await expect.poll(() => page.evaluate(() => window.__pa06Impressoes)).toBe(1);
    if (modo === 'previa carregada') await expect(page.getByRole('region', { name: 'Prévia do paciente' })).toBeVisible();
    try {
      const controle = page.getByRole('switch', { name: alvoRefeicao ? /Visibilidade da refeição Refeição sintética/ : /Plano alimentar para o paciente/ });
      await controle.click();
      await expect(controle).toHaveAttribute('aria-checked', 'false');
    } finally {
      liberarResposta();
    }
    await expect(page.getByRole('button', { name: 'Imprimir', exact: true })).toBeEnabled();
    await expect(page.getByRole('region', { name: 'Prévia do paciente' })).toHaveCount(0);
    await expect(page.locator('[data-impressao-paciente-chave]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__pa06Impressoes)).toBe(modo === 'impressao carregada' ? 1 : 0);
  });
}

test('PA06 portal pagina todos os planos ativos e abre o detalhe selecionado sem cache', async ({ page }) => {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/portal'), domain: 'localhost', path: '/' }
  ]);
  await page.route((url) => url.pathname === '/api/auth/session', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ autenticado: true, papel: 'Patient', destinoInicial: '/portal', permissoes: [] })
  }));
  await page.route((url) => url.pathname === '/api/portal/paciente', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      paciente: { id: 'paciente-portal-pa06', nome: 'Paciente sintético', statusAdesao: 'aderente' },
      perfil: { preferenciasContato: {}, profissionalResponsavelId: 'profissional-sintetico' },
      resumo: { consultasProximas: 0, formulariosPendentes: 0, formulariosRespondidos: 0, mensagensRecentes: 0, tarefasPendentes: 0, materiaisDisponiveis: 0, checkinsRecentes: 0, notificacoesPendentes: 0, notificacoesHistorico: 0 },
      consultasProximas: [], formulariosPendentes: [], formulariosRespondidos: [], mensagensRecentes: [], lgpd: { versaoAtual: '1', consentimentos: [], solicitacoes: [] }
    })
  }));
  const consultas = [];
  const resumo = (id) => ({ id, titulo: `Plano sintético ${id}`, numeroVersao: 1, publicadoEm: '2026-10-15T12:00:00.000Z' });
  await page.route((url) => url.pathname === '/api/portal/paciente/planos-alimentares', (route) => {
    const consulta = new URL(route.request().url());
    const pagina = Number(consulta.searchParams.get('pagina') ?? 1);
    const limite = Number(consulta.searchParams.get('limite') ?? 10);
    consultas.push({ pagina, limite });
    const todos = Array.from({ length: 11 }, (_, indice) => resumo(`plano-${String(indice + 1).padStart(2, '0')}`));
    const inicio = (pagina - 1) * limite;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: todos.slice(inicio, inicio + limite), total: todos.length, pagina, limite }) });
  });
  await page.route((url) => url.pathname.startsWith('/api/portal/paciente/planos-alimentares/'), (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ...resumo(id), refeicoes: [], apresentacaoEstado: 'configurada', preferenciasApresentacao: { macros: true, modoCompacto: false }
    }) });
  });

  await page.goto('/portal/plano', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Plano sintético plano-01/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plano sintético plano-01' })).toBeVisible();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByRole('button', { name: /Plano sintético plano-11/ })).toBeVisible();
  await page.getByRole('button', { name: /Plano sintético plano-11/ }).click();
  await expect(page.getByRole('heading', { name: 'Plano sintético plano-11' })).toBeVisible();
  expect(consultas.some((consulta) => consulta.pagina === 2 && consulta.limite === 10)).toBe(true);
  await expect(page.getByRole('navigation', { name: 'Paginação dos planos alimentares' })).toBeVisible();
  const acessibilidade = await new AxeBuilder({ page }).include('[aria-label="Seus planos alimentares"]').analyze();
  expect(acessibilidade.violations).toEqual([]);
});
