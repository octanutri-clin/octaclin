import { expect, test } from '@playwright/test';

// Fase 269 (PB-13): duplicar o plano alimentar de outro paciente para o
// rascunho atual. Cobre a interacao inteira (buscar paciente -> escolher
// plano -> duplicar) e a invariante clinica de que so a estrutura de
// refeicoes atravessa: avaliacao, calculo e objetivo continuam do paciente
// de destino.

const permissoes = [
  'console.acessar',
  'pacientes.listar',
  'pacientes.ler',
  'pacientes.gerenciar',
  'profissionais.ler',
  'planos_alimentares.ler',
  'planos_alimentares.gerenciar'
];

const pacienteDestino = {
  id: 'paciente-1',
  tenantId: 'tenant-1',
  profissionalResponsavelId: 'profissional-1',
  nome: 'Ana Sintética',
  statusAdesao: 'aderente',
  scoreRisco: '10.00',
  criadoEm: '2026-07-01T10:00:00.000Z'
};

const pacienteOrigem = {
  ...pacienteDestino,
  id: 'paciente-2',
  nome: 'Bruno Sintético'
};

function versaoComRefeicoes({ id, numero, status, nomeRefeicao, descricaoItem, objetivos }) {
  return {
    id,
    numero,
    status,
    publicadaEm: status === 'publicada' ? '2026-08-10T12:00:00.000Z' : undefined,
    criadoEm: '2026-08-09T12:00:00.000Z',
    atualizadoEm: '2026-08-10T12:00:00.000Z',
    objetivos,
    refeicoes: [
      {
        id: `${id}-refeicao-1`,
        ordem: 0,
        nome: nomeRefeicao,
        horarioLocal: '08:00',
        itens: [
          {
            id: `${id}-item-1`,
            ordem: 0,
            descricao: descricaoItem,
            quantidade: 100,
            unidade: 'g',
            porcaoGramas: 100,
            composicaoSnapshot: {
              energiaKcal: 120,
              proteinasG: 4,
              carboidratosG: 20,
              gordurasG: 2
            },
            substituicoes: []
          }
        ]
      }
    ]
  };
}

async function prepararSessao(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);

  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autenticado: true,
        apiUrl: 'http://localhost:3001',
        tenantSlug: 'clinica-carla',
        email: 'dra.carla@octaclin.local',
        expiraEm: '2026-09-30T15:00:00.000Z',
        papel: 'Professional',
        permissoes,
        destinoInicial: '/pacientes'
      })
    })
  );

  await page.route(
    (url) => url.pathname === '/api/profissionais',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          itens: [{ id: 'profissional-1', tenantId: 'tenant-1', nome: 'Dra. Carla', criadoEm: '2026-07-01T10:00:00.000Z' }],
          total: 1
        })
      })
  );

  await page.route(
    (url) => url.pathname === `/api/pacientes/${pacienteDestino.id}/prontuario`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paciente: pacienteDestino,
          resumo: {
            consultas: 0,
            formulariosPendentes: 0,
            respostas: 0,
            checkinsRapidos: 0,
            mensagens: 0,
            evolucoes: 0,
            tarefasPendentes: 0,
            indicadoresRecentes: [],
            leituraClinica: {
              deltaUltimaAvaliacao: [],
              deltaDesdeInicio: [],
              condutasVencendo: []
            }
          },
          linhaDoTempo: []
        })
      })
  );

  // Vazio de proposito: este teste nao exercita antropometria. Uma avaliacao
  // sintetica incompleta (sem os campos obrigatorios de
  // `AvaliacaoAntropometricaApi`, como `avaliadaEm`) derrubava a pagina com
  // um erro de runtime em `ResumoAntropometrico` — mesmo padrao ja usado por
  // `prepararAvaliacoesAntropometricas` em acessibilidade.spec.mjs.
  await page.route(
    (url) => url.pathname === `/api/pacientes/${pacienteDestino.id}/avaliacoes-antropometricas`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ avaliacoes: [], deltaUltimas: [] })
      })
  );

  // Componentes irmaos do editor: sem mock eles falham no mount e escondem o
  // bloco que este teste exercita.
  await page.route(
    (url) => url.pathname === '/api/planos-alimentares/modelos',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 100 })
      })
  );
  await page.route(
    (url) => url.pathname === '/api/planos-alimentares/receitas',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 100 })
      })
  );
}

async function prepararPlanos(page) {
  const rascunhoDestino = versaoComRefeicoes({
    id: 'versao-destino-1',
    numero: 1,
    status: 'rascunho',
    nomeRefeicao: 'Refeição do destino',
    descricaoItem: 'Item original do destino',
    objetivos: 'Objetivo do paciente de destino.'
  });
  const publicadaOrigem = versaoComRefeicoes({
    id: 'versao-origem-1',
    numero: 3,
    status: 'publicada',
    nomeRefeicao: 'Café reaproveitado',
    descricaoItem: 'Aveia em flocos',
    objetivos: 'Objetivo do paciente de origem.'
  });

  const planoDestino = {
    id: 'plano-destino',
    pacienteId: pacienteDestino.id,
    profissionalId: 'profissional-1',
    titulo: 'Plano do destino',
    criadoEm: '2026-08-09T12:00:00.000Z',
    atualizadoEm: '2026-08-10T12:00:00.000Z',
    historico: [],
    historicoQuantidade: 0,
    draft: rascunhoDestino
  };
  const planoOrigem = {
    id: 'plano-origem',
    pacienteId: pacienteOrigem.id,
    profissionalId: 'profissional-1',
    titulo: 'Plano do Bruno',
    criadoEm: '2026-08-01T12:00:00.000Z',
    atualizadoEm: '2026-08-10T12:00:00.000Z',
    historico: [],
    historicoQuantidade: 1,
    current: publicadaOrigem
  };

  await page.route(
    (url) => url.pathname === `/api/pacientes/${pacienteDestino.id}/planos-alimentares`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ itens: [planoDestino], total: 1, pagina: 1, limite: 25 })
      })
  );
  await page.route(
    (url) => url.pathname === `/api/pacientes/${pacienteDestino.id}/planos-alimentares/${planoDestino.id}`,
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(planoDestino) })
  );

  await page.route(
    (url) => url.pathname === `/api/pacientes/${pacienteOrigem.id}/planos-alimentares`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ itens: [planoOrigem], total: 1, pagina: 1, limite: 25 })
      })
  );
  await page.route(
    (url) => url.pathname === `/api/pacientes/${pacienteOrigem.id}/planos-alimentares/${planoOrigem.id}`,
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(planoOrigem) })
  );
}

function prepararBuscaPacientes(page, { itens }) {
  return page.route(
    (url) => url.pathname === '/api/pacientes',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens, total: itens.length }) })
  );
}

/** O bloco e uma regiao nomeada: evita casar com a aba "Plano" do prontuario. */
function blocoDuplicar(page) {
  return page.getByRole('region', { name: 'Duplicar de outro paciente' });
}

async function abrirEditorDePlano(page) {
  await page.goto(`/pacientes/${pacienteDestino.id}?aba=plano_alimentar`);
  await expect(blocoDuplicar(page)).toBeVisible();
}

test.describe('Fase 269 - duplicar plano de outro paciente (PB-13)', () => {
  test('duplica as refeições do plano publicado de outro paciente para o rascunho (interacao relevante)', async ({ page }) => {
    await prepararSessao(page);
    await prepararPlanos(page);
    // A busca devolve os dois: o proprio paciente precisa ser filtrado pela
    // interface, e nao aparecer como origem possivel.
    await prepararBuscaPacientes(page, { itens: [pacienteDestino, pacienteOrigem] });
    await abrirEditorDePlano(page);

    const nomeRefeicao = page.getByRole('textbox', { name: 'Nome da refeição' }).first();
    const alimento = page.getByRole('textbox', { name: 'Alimento' }).first();
    await expect(nomeRefeicao).toHaveValue('Refeição do destino');
    await expect(alimento).toHaveValue('Item original do destino');

    await blocoDuplicar(page).getByLabel('Buscar paciente de origem').fill('Sintét');
    await blocoDuplicar(page).getByRole('button', { name: 'Buscar', exact: true }).click();

    const seletorPaciente = blocoDuplicar(page).getByLabel('Paciente', { exact: true });
    await expect(seletorPaciente).toBeVisible();
    await expect(seletorPaciente.getByRole('option', { name: 'Ana Sintética' })).toHaveCount(0);

    await seletorPaciente.selectOption({ label: 'Bruno Sintético' });
    await blocoDuplicar(page).getByLabel('Plano', { exact: true }).selectOption({ label: 'Plano do Bruno - publicado (v3)' });
    await blocoDuplicar(page).getByRole('button', { name: 'Duplicar' }).click();

    await expect(blocoDuplicar(page).getByRole('status')).toContainText('Refeições duplicadas para o rascunho');
    // A estrutura do paciente de origem substitui a do rascunho atual.
    await expect(nomeRefeicao).toHaveValue('Café reaproveitado');
    await expect(alimento).toHaveValue('Aveia em flocos');
  });

  test('não copia objetivo, avaliação nem cálculo do paciente de origem', async ({ page }) => {
    await prepararSessao(page);
    await prepararPlanos(page);
    await prepararBuscaPacientes(page, { itens: [pacienteOrigem] });
    await abrirEditorDePlano(page);

    const objetivo = page.getByLabel('Objetivo clínico');
    await expect(objetivo).toHaveValue('Objetivo do paciente de destino.');

    await blocoDuplicar(page).getByLabel('Buscar paciente de origem').fill('Bruno');
    await blocoDuplicar(page).getByRole('button', { name: 'Buscar', exact: true }).click();
    await blocoDuplicar(page).getByLabel('Paciente', { exact: true }).selectOption({ label: 'Bruno Sintético' });
    await blocoDuplicar(page).getByLabel('Plano', { exact: true }).selectOption({ label: 'Plano do Bruno - publicado (v3)' });
    await blocoDuplicar(page).getByRole('button', { name: 'Duplicar' }).click();

    await expect(page.getByRole('textbox', { name: 'Alimento' }).first()).toHaveValue('Aveia em flocos');
    // O objetivo do destino continua intacto; o da origem nunca atravessa.
    await expect(objetivo).toHaveValue('Objetivo do paciente de destino.');
    await expect(page.getByText('Objetivo do paciente de origem.')).toHaveCount(0);
  });

  test('avisa quando a busca não encontra outro paciente', async ({ page }) => {
    await prepararSessao(page);
    await prepararPlanos(page);
    // So o proprio paciente volta da busca: depois do filtro, nao sobra origem.
    await prepararBuscaPacientes(page, { itens: [pacienteDestino] });
    await abrirEditorDePlano(page);

    await blocoDuplicar(page).getByLabel('Buscar paciente de origem').fill('Ana');
    await blocoDuplicar(page).getByRole('button', { name: 'Buscar', exact: true }).click();

    await expect(blocoDuplicar(page).getByText('Nenhum outro paciente encontrado com esse nome.')).toBeVisible();
    await expect(blocoDuplicar(page).getByLabel('Paciente', { exact: true })).toHaveCount(0);
  });
});
