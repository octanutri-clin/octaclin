import { expect, test } from '@playwright/test';

const webUrl = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const permissoes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'profissionais.ler'];
const profissional = { id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-1', nome: 'Dra. Sintética', criadoEm: '2026-08-22T10:00:00.000Z' };
const paciente = { id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: profissional.id, nome: 'Ana Sintética', contato: 'ana@example.com', dataNascimento: '1990-04-15', statusAdesao: 'em_acompanhamento', scoreRisco: '35', criadoEm: '2026-08-22T10:00:00.000Z' };
const candidatoDuplicidadeId = '11111111-1111-4111-8111-111111111111';
const profissionalRemovidoId = '22222222-2222-4222-8222-222222222222';

async function preparar(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', url: webUrl },
    { name: 'octaclin_refresh_token', value: 'fake', url: webUrl },
    { name: 'octaclin_papel', value: 'Professional', url: webUrl },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), url: webUrl },
    { name: 'octaclin_permissoes', value: encodeURIComponent(JSON.stringify(permissoes)), url: webUrl }
  ]);
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ autenticado: true, apiUrl: 'http://backend.test', tenantSlug: 'clinica-sintetica', email: 'pro@example.com', expiraEm: '2026-08-23T10:00:00.000Z', papel: 'Professional', permissoes, destinoInicial: '/pacientes' }) }));
  await page.route('**/api/profissionais?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [profissional], total: 1 }) }));
  await page.route('**/api/pacientes/verificacao-duplicidade', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidatos: [] }) }));
}

test.describe('Fase 254 - rotas e formulario de pacientes', () => {
  test('preserva rascunho de novo paciente apenas na sessao da aba e limpa apos sucesso', async ({ page }) => {
    await preparar(page);
    let criado;
    await page.route(/\/api\/pacientes(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      criado = await route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...paciente, ...criado, id: 'paciente-novo', statusAdesao: 'novo', scoreRisco: '0' }) });
    });

    await page.goto('/pacientes/novo');
    await page.getByLabel('Nome completo').fill('Bruno Sintético');
    await page.getByLabel('E-mail ou telefone').fill('bruno@example.com');
    await page.reload();
    await expect(page.getByText('Rascunho desta aba restaurado.')).toBeVisible();
    await expect(page.getByLabel('Nome completo')).toHaveValue('Bruno Sintético');
    await page.getByRole('button', { name: 'Cadastrar paciente' }).click();
    await expect.poll(() => criado?.nome).toBe('Bruno Sintético');
    await expect(page).toHaveURL(/\/pacientes\/paciente-novo$/);
    const rascunhos = await page.evaluate(() => Object.keys(sessionStorage).filter((chave) => chave.startsWith('octaclin:rascunho-paciente:')));
    expect(rascunhos).toEqual([]);
  });

  test('carrega a edicao pelo BFF e envia somente o formulario confirmado', async ({ page }) => {
    await preparar(page);
    let atualizado;
    await page.route('**/api/pacientes/paciente-1', async (route) => {
      if (route.request().method() === 'PATCH') {
        atualizado = await route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...paciente, ...atualizado }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paciente) });
    });

    await page.goto('/pacientes/paciente-1/editar');
    await expect(page.getByLabel('Nome completo')).toHaveValue('Ana Sintética');
    await page.getByLabel('Situação do acompanhamento').selectOption('aderente');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect.poll(() => atualizado?.statusAdesao).toBe('aderente');
    await expect(page).toHaveURL(/\/pacientes\/paciente-1$/);
  });

  test('exige decisao humana para possivel duplicidade e envia apenas os UUIDs dispensados', async ({ page }) => {
    await preparar(page);
    let criado;
    await page.route('**/api/pacientes/verificacao-duplicidade', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ candidatos: [{ pacienteId: candidatoDuplicidadeId, nome: 'Ana Sintética', motivos: ['nome_e_nascimento'] }] })
    }));
    await page.route(/\/api\/pacientes(?:\?.*)?$/, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      criado = await route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...paciente, ...criado, id: 'paciente-novo' }) });
    });

    await page.goto('/pacientes/novo');
    await page.getByLabel('Nome completo').fill('Ana Sintética');
    await expect(page.getByRole('button', { name: 'Cadastrar paciente' })).toBeDisabled();
    await page.getByLabel('Data de nascimento').fill('1990-04-15');
    await expect(page.getByRole('heading', { name: 'Confira antes de cadastrar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar paciente' })).toBeDisabled();
    await page.getByRole('button', { name: 'É outra pessoa, continuar cadastro' }).click();
    await page.getByRole('button', { name: 'Cadastrar paciente' }).click();

    await expect.poll(() => criado?.candidatosDuplicidadeDispensados).toEqual([candidatoDuplicidadeId]);
  });

  test('mantem o cadastro disponivel quando a verificacao de duplicidade falha', async ({ page }) => {
    await preparar(page);
    await page.route('**/api/pacientes/verificacao-duplicidade', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'indisponivel' }) }));
    await page.goto('/pacientes/novo');
    await page.getByLabel('Nome completo').fill('Paciente Novo');
    await expect(page.getByText('Não foi possível verificar cadastros semelhantes. Você ainda pode concluir o cadastro.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar paciente' })).toBeEnabled();
  });

  test('aplica e salva visoes sem persistir busca livre e trata responsavel removido', async ({ page }) => {
    await preparar(page);
    const consultas = [];
    let filtroCriado;
    let filtroArquivado;
    await page.route('**/api/pacientes?**', (route) => {
      consultas.push(new URL(route.request().url()).searchParams);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [paciente], total: 1 }) });
    });
    await page.route('**/api/pacientes/filtros-salvos', async (route) => {
      if (route.request().method() === 'POST') {
        filtroCriado = await route.request().postDataJSON();
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'filtro-novo', atualizadoEm: '2026-08-22T10:00:00.000Z', ...filtroCriado }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [
        { id: 'filtro-1', nome: 'Minha prioridade', origem: 'pessoal', criterios: { risco: 'alto' }, atualizadoEm: '2026-08-22T10:00:00.000Z' },
        { id: 'filtro-2', nome: 'Carteira antiga', origem: 'clinica', criterios: { profissionalId: profissionalRemovidoId }, atualizadoEm: '2026-08-22T10:00:00.000Z' }
      ] }) });
    });
    await page.route(/\/api\/pacientes\/filtros-salvos\/([^/?]+)$/, async (route) => {
      filtroArquivado = route.request().url().split('/').at(-1);
      await route.fulfill({ status: 204 });
    });
    await page.route(`**/api/profissionais/${profissionalRemovidoId}`, (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'não encontrado' }) }));

    await page.goto('/pacientes');
    await page.getByLabel('Visão salva', { exact: true }).selectOption({ label: 'Minha prioridade' });
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect.poll(() => consultas.some((query) => query.get('risco') === 'alto')).toBe(true);
    await page.getByRole('button', { name: 'Remover visão salva' }).click();
    await page.getByRole('button', { name: 'Remover visão', exact: true }).click();
    await expect.poll(() => filtroArquivado).toBe('filtro-1');

    await page.getByLabel('Visão salva', { exact: true }).selectOption({ label: 'Carteira antiga' });
    await expect(page.getByText('Esta visão referencia um profissional que não está mais disponível.')).toBeVisible();
    const consultasAntes = consultas.length;
    await page.getByRole('button', { name: 'Aplicar sem responsável' }).click();
    await expect.poll(() => consultas.length).toBeGreaterThan(consultasAntes);
    await expect.poll(() => consultas.at(-1)?.has('profissionalId')).toBe(false);

    await page.getByLabel('Buscar pacientes').fill('Maria');
    await page.getByRole('button', { name: 'Salvar visão' }).click();
    await page.getByLabel('Nome da visão').fill('Prioridade da equipe');
    await page.getByLabel('Disponibilidade').selectOption('clinica');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect.poll(() => filtroCriado?.nome).toBe('Prioridade da equipe');
    expect(filtroCriado.criterios).not.toHaveProperty('busca');
  });
});
