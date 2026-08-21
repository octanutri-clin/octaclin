import { expect, test } from '@playwright/test';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const erroTecnico = JSON.stringify({
  statusCode: 500,
  message: 'Internal server error',
  path: '/interno/nao-expor'
});

const paciente = {
  id: 'paciente-1',
  tenantId: 'tenant-sintetico',
  profissionalResponsavelId: 'profissional-1',
  nome: 'Ana Sintetica',
  contato: 'ana.sintetica@example.com',
  dataNascimento: '1990-04-12',
  statusAdesao: 'em_acompanhamento',
  scoreRisco: '32',
  criadoEm: '2026-08-20T10:00:00.000Z'
};

const profissional = {
  id: 'profissional-1',
  tenantId: 'tenant-sintetico',
  usuarioId: 'usuario-profissional-1',
  nome: 'Dra. Sintetica',
  especialidade: 'Nutricao',
  criadoEm: '2026-08-20T10:00:00.000Z'
};

async function responderJson(route, body, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function prepararSessao(page, permissoes) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
    { name: 'octaclin_papel', value: 'Professional', url: webUrl },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/dashboard'), url: webUrl }
  ]);

  await page.route('**/api/auth/session', async (route) => {
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
  });
}

async function prepararAgenda(page) {
  let permitirLeitura = false;
  let criacoes = 0;
  const consultas = [];

  await prepararSessao(page, [
    'console.acessar',
    'agenda.consultas.ler',
    'agenda.consultas.criar',
    'pacientes.listar',
    'profissionais.ler'
  ]);

  await page.route('**/api/agenda/consultas', async (route) => {
    if (route.request().method() === 'POST') {
      criacoes += 1;
      if (criacoes === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: erroTecnico });
        return;
      }
      const criada = {
        id: 'consulta-recuperada',
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
        local: 'Sala recuperada',
        valorCentavos: 0,
        statusPagamento: 'pendente',
        notificacoes: {},
        payload: {},
        criadoEm: '2026-08-20T12:00:00.000Z',
        atualizadoEm: '2026-08-20T12:00:00.000Z'
      };
      consultas.push(criada);
      await responderJson(route, criada, 201);
      return;
    }

    if (!permitirLeitura) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: erroTecnico });
      return;
    }
    await responderJson(route, consultas);
  });

  await page.route('**/api/pacientes?**', (route) => responderJson(route, { itens: [paciente], total: 1 }));
  await page.route('**/api/profissionais?**', (route) => responderJson(route, { itens: [profissional], total: 1 }));
  await page.route('**/api/agenda/agendamento-publico', (route) => responderJson(route, null));
  await page.route('**/api/agenda/solicitacoes', (route) => responderJson(route, { itens: [], total: 0 }));
  await page.route('**/api/agenda/google/status', (route) => responderJson(route, { conectado: false }));
  await page.route('**/api/agenda/feed?**', (route) => responderJson(route, []));
  await page.route('**/api/agenda/pacotes?**', (route) => responderJson(route, []));

  return {
    permitirRecuperacao() {
      permitirLeitura = true;
    }
  };
}

async function prepararPacientes(page) {
  let permitirLeitura = false;
  let criacoes = 0;
  const pacientes = [paciente];

  await prepararSessao(page, ['console.acessar', 'pacientes.listar', 'pacientes.gerenciar', 'profissionais.ler']);
  await page.route('**/api/profissionais?**', (route) => responderJson(route, { itens: [profissional], total: 1 }));
  await page.route(/\/api\/pacientes(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      criacoes += 1;
      if (criacoes === 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: erroTecnico });
        return;
      }
      const criado = { ...paciente, id: 'paciente-recuperado', nome: 'Bruno Sintetico' };
      pacientes.push(criado);
      await responderJson(route, criado, 201);
      return;
    }

    if (!permitirLeitura) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: erroTecnico });
      return;
    }
    await responderJson(route, { itens: pacientes, total: pacientes.length });
  });

  return {
    permitirRecuperacao() {
      permitirLeitura = true;
    }
  };
}

async function prepararProntuario(page) {
  let permitirLeitura = false;
  let criacoesEvolucao = 0;

  await prepararSessao(page, [
    'console.acessar',
    'pacientes.listar',
    'pacientes.ler',
    'pacientes.gerenciar',
    'materiais.ler',
    'materiais.gerenciar',
    'agenda.consultas.ler',
    'agenda.consultas.criar'
  ]);

  await page.route('**/api/materiais', (route) => responderJson(route, []));
  await page.route('**/api/materiais/pacientes/paciente-1', (route) => responderJson(route, []));
  await page.route('**/api/mobile/midias/uploads?**', (route) => responderJson(route, []));
  await page.route('**/api/pacientes/paciente-1/avaliacoes-antropometricas', (route) =>
    responderJson(route, { avaliacoes: [], deltaUltimas: [] })
  );
  await page.route('**/api/pacientes/paciente-1/evolucoes', async (route) => {
    if (route.request().method() !== 'POST') {
      await responderJson(route, []);
      return;
    }
    criacoesEvolucao += 1;
    if (criacoesEvolucao === 1) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: erroTecnico });
      return;
    }
    await responderJson(route, {
      id: 'evolucao-recuperada',
      tenantId: 'tenant-sintetico',
      pacienteId: paciente.id,
      autorUsuarioId: 'usuario-profissional-1',
      titulo: 'Conduta sintetica preservada',
      conteudo: 'Conteudo digitado antes da falha.',
      tipo: 'observacao',
      visibilidade: 'privada',
      criadoEm: '2026-08-20T12:00:00.000Z',
      atualizadoEm: '2026-08-20T12:00:00.000Z'
    }, 201);
  });
  await page.route('**/api/pacientes/paciente-1/prontuario', async (route) => {
    if (!permitirLeitura) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: erroTecnico });
      return;
    }
    await responderJson(route, {
      paciente,
      resumo: {
        consultas: 0,
        formulariosPendentes: 0,
        respostas: 0,
        checkinsRapidos: 0,
        mensagens: 0,
        evolucoes: criacoesEvolucao > 1 ? 1 : 0,
        tarefasPendentes: 0,
        indicadoresRecentes: []
      },
      linhaDoTempo: []
    });
  });

  return {
    permitirRecuperacao() {
      permitirLeitura = true;
    }
  };
}

test.describe('Fase 248 - estados e recuperacao clinica', () => {
  test('agenda, pacientes e prontuario distinguem permissao negada de indisponibilidade', async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: erroTecnico })
    );
    await prepararSessao(page, ['console.acessar']);

    for (const caminho of ['/agenda', '/pacientes', '/pacientes/paciente-1']) {
      await page.goto(caminho);
      await expect(page.getByText('Acesso não autorizado')).toBeVisible();
      await expect(page.getByText('Internal server error')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Tentar novamente' })).toHaveCount(0);
    }
  });

  test('agenda recupera a carga e preserva o agendamento digitado apos falha', async ({ page }) => {
    const controle = await prepararAgenda(page);
    await page.goto('/agenda');

    await expect(page.getByRole('heading', { name: 'Não foi possível carregar a agenda' })).toBeVisible();
    await expect(page.getByText('Internal server error')).toHaveCount(0);
    await expect(page.getByText('/interno/nao-expor')).toHaveCount(0);
    controle.permitirRecuperacao();
    await page.getByRole('button', { name: 'Tentar novamente' }).click();

    await expect(page.getByRole('heading', { name: 'Agenda interna' })).toBeVisible();
    await page.getByRole('button', { name: 'Nova consulta' }).click();
    const modal = page.getByRole('dialog', { name: 'Nova consulta' });
    await modal.getByLabel('Data e hora').fill('2026-08-24T10:00');
    await modal.getByLabel('Local').fill('Sala recuperada');
    await modal.getByLabel('Observações').fill('Manter esta observacao apos a falha.');
    await modal.getByRole('button', { name: 'Agendar' }).click();

    await expect(page.getByText('Não foi possível agendar a consulta. Tente novamente.')).toBeVisible();
    await expect(modal.getByLabel('Local')).toHaveValue('Sala recuperada');
    await expect(modal.getByLabel('Observações')).toHaveValue('Manter esta observacao apos a falha.');
    await modal.getByRole('button', { name: 'Agendar' }).click();
    await expect(page.getByText(/Consulta agendada e horário bloqueado/)).toBeVisible();
  });

  test('pacientes recupera a lista e preserva o cadastro digitado apos falha', async ({ page }) => {
    const controle = await prepararPacientes(page);
    await page.goto('/pacientes');

    await expect(page.getByRole('heading', { name: 'Não foi possível carregar os pacientes' })).toBeVisible();
    await expect(page.getByText('Internal server error')).toHaveCount(0);
    controle.permitirRecuperacao();
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.locator('a:visible', { hasText: 'Ana Sintetica' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Novo paciente' }).click();
    const modal = page.getByRole('dialog', { name: 'Novo paciente' });
    await modal.getByLabel('Nome completo').fill('Bruno Sintetico');
    await modal.getByLabel('E-mail ou telefone').fill('bruno.sintetico@example.com');
    await modal.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByText('Não foi possível salvar o paciente. Tente novamente.')).toBeVisible();
    await expect(modal.getByLabel('Nome completo')).toHaveValue('Bruno Sintetico');
    await expect(modal.getByLabel('E-mail ou telefone')).toHaveValue('bruno.sintetico@example.com');
    await modal.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Paciente criado.')).toBeVisible();
    await expect(page.locator('a:visible', { hasText: 'Bruno Sintetico' }).first()).toBeVisible();
  });

  test('prontuario recupera a carga e preserva a evolucao digitada apos falha', async ({ page }) => {
    const controle = await prepararProntuario(page);
    await page.goto('/pacientes/paciente-1');

    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o prontuário' })).toBeVisible();
    await expect(page.getByText('Internal server error')).toHaveCount(0);
    controle.permitirRecuperacao();
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByText('Ana Sintetica')).toBeVisible();

    await page.getByRole('button', { name: 'Nova evolução' }).click();
    await page.getByLabel('Título da evolução').fill('Conduta sintetica preservada');
    await page.getByLabel('Conteúdo da evolução').fill('Conteudo digitado antes da falha.');
    await page.getByRole('button', { name: 'Registrar evolução' }).click();

    await expect(page.getByText('Não foi possível registrar a evolução clínica. Tente novamente.')).toBeVisible();
    await expect(page.getByLabel('Título da evolução')).toHaveValue('Conduta sintetica preservada');
    await expect(page.getByLabel('Conteúdo da evolução')).toHaveValue('Conteudo digitado antes da falha.');
    await page.getByRole('button', { name: 'Registrar evolução' }).click();
    await expect(page.getByText('Evolução clínica registrada.')).toBeVisible();
  });
});
