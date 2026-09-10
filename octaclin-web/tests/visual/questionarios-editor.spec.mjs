import { expect, test } from '@playwright/test';

const usuarioProfissional = {
  autenticado: true,
  apiUrl: 'http://localhost:3001',
  tenantSlug: 'clinica-carla',
  email: 'dra.carla@octaclin.local',
  expiraEm: '2026-12-31T15:00:00.000Z',
  papel: 'Professional',
  permissoes: ['dashboard.ler', 'questionarios.ler', 'questionarios.gerenciar'],
  destinoInicial: '/questionarios'
};

async function criarSessao(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/questionarios'), domain: 'localhost', path: '/' }
  ]);
}

const questionarios = [
  { id: 'q-1', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Check-in semanal', descricao: 'Adesão', status: 'rascunho', versao: 1, criadoEm: '2026-07-01T10:00:00.000Z', atualizadoEm: '2026-07-01T10:00:00.000Z' },
  { id: 'q-2', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Avaliação mensal', descricao: 'Metricas', status: 'publicado', versao: 2, criadoEm: '2026-07-02T10:00:00.000Z', atualizadoEm: '2026-07-02T10:00:00.000Z' }
];

async function mockarBff(page) {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(usuarioProfissional) }));
  await page.route('**/api/categorias-pergunta', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'cat-1', tenantId: 'tenant-1', nome: 'Nutricao', iconeSvg: 'utensils', corHex: '#247BA0', ordem: 1 }]) }));
  await page.route('**/api/profissionais*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'profissional-1', tenantId: 'tenant-1', nome: 'Dra. Carla' }], total: 1 }) }));
  await page.route('**/api/pacientes*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'paciente-1', tenantId: 'tenant-1', nome: 'Joana' }], total: 1 }) }));
  await page.route('**/api/questionarios/modelos', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/api/biblioteca-perguntas*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/api/questionarios?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: questionarios, total: 2 }) }));
  await page.route('**/api/questionarios/q-1/perguntas', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
    { id: 'p-1', tenantId: 'tenant-1', questionarioId: 'q-1', categoriaId: 'cat-1', tipo: 'likert', enunciado: 'Como foi sua semana?', peso: '1', obrigatoria: true, configuracao: {}, opcoes: [], ordem: 1, visivelBiblioteca: false }
  ]) }));
  await page.route('**/api/questionarios/q-2/perguntas', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/api/questionarios/*/respostas/leitura-clinica*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questionarioId: 'q-1', resumo: { totalRespostas: 0, totalPacientes: 0, totalPerguntas: 0, mediaRespostasPorEnvio: 0 }, pacientes: [], perguntas: [], respostas: [] }) }));
}

test.describe('Editor de questionarios', () => {
  test('bloqueia troca de formulario com alteracao nao salva ate confirmar', async ({ page }) => {
    await criarSessao(page);
    await mockarBff(page);
    await page.goto('/questionarios');

    await page.getByRole('tab', { name: 'Formulários' }).click();
    const titulo = page.getByLabel('Título');
    await expect(titulo).toHaveValue('Check-in semanal');
    await titulo.fill('Check-in semanal (editado)');

    await page.getByLabel('Selecionar').selectOption('q-2');
    await expect(page.getByText('Você tem alterações não salvas')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(titulo).toHaveValue('Check-in semanal (editado)');

    await page.getByLabel('Selecionar').selectOption('q-2');
    await page.getByRole('button', { name: 'Trocar mesmo assim' }).click();
    await expect(page.getByLabel('Título')).toHaveValue('Avaliação mensal');
  });

  test('gera recorrencia semanal em linguagem comum sem expor cron', async ({ page }) => {
    let corpoAgendamento = null;
    await criarSessao(page);
    await mockarBff(page);
    await page.route('**/api/agendamentos-questionario', async (route) => {
      corpoAgendamento = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'agendamento-1' }) });
    });
    await page.goto('/questionarios');

    await page.getByRole('tab', { name: 'Distribuicoes' }).click();
    await expect(page.getByText('Cron', { exact: true })).toHaveCount(0);

    await page.getByLabel('Paciente do retorno de avaliação recorrente').selectOption('paciente-1');
    await page.getByRole('button', { name: 'Criar retorno de avaliação recorrente' }).click();

    await expect.poll(() => corpoAgendamento).toEqual(
      expect.objectContaining({ regraCron: '0 8 * * 1', pacienteId: 'paciente-1' })
    );
  });

  test('inicia um novo questionario pela opcao do seletor', async ({ page }) => {
    await criarSessao(page);
    await mockarBff(page);
    await page.goto('/questionarios');

    await page.getByRole('tab', { name: 'Formulários' }).click();
    await page.getByLabel('Selecionar').selectOption('');

    await expect(page.getByLabel('Título')).toHaveValue('');
    await expect(page.getByLabel('Descrição')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Criar questionário' })).toBeVisible();
  });

  test('mostra preview lado a lado com a edicao em telas largas', async ({ page }) => {
    await criarSessao(page);
    await mockarBff(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/questionarios');

    await page.getByRole('tab', { name: 'Editor' }).click();
    await expect(page.getByText('Preview do paciente')).toBeVisible();
    await expect(page.getByRole('button', { name: /Preview paciente/ })).toHaveCount(0);
  });

  test('abre o historico de versoes e expande uma versao anterior', async ({ page }) => {
    await criarSessao(page);
    await mockarBff(page);
    await page.route('**/api/questionarios/q-1/versoes', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          versaoQuestionario: 2,
          titulo: 'Check-in semanal',
          descricao: 'Adesão',
          perguntas: [{ id: 'p-1', categoriaId: 'cat-1', tipo: 'likert', enunciado: 'Como foi sua semana?', peso: '1', obrigatoria: true, configuracao: {}, ordem: 1, opcoes: [] }],
          atual: true,
          totalEnvios: 0
        },
        {
          versaoQuestionario: 1,
          titulo: 'Check-in semanal (original)',
          perguntas: [{ id: 'p-0', categoriaId: 'cat-1', tipo: 'likert', enunciado: 'Pergunta original', peso: '1', obrigatoria: true, configuracao: {}, ordem: 1, opcoes: [] }],
          atual: false,
          capturadoEm: '2026-07-05T10:00:00.000Z',
          totalEnvios: 3
        }
      ])
    }));
    await page.goto('/questionarios');

    await page.getByRole('tab', { name: 'Formulários' }).click();
    await expect(page.getByText('Pergunta original')).toHaveCount(0);

    await page.getByRole('button', { name: 'Histórico de versões' }).click();
    await expect(page.getByRole('button', { name: /Versão 2/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Versão 1/ })).toBeVisible();
    await expect(page.getByText('atual', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Versão 1/ }).click();
    await expect(page.getByText('Pergunta original')).toBeVisible();
    await expect(page.getByText('3 envio(s)')).toBeVisible();
  });
});
