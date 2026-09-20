import { expect, test } from '@playwright/test';

// Fase 270 (PB-14): caminho manual para paciente com condicao especial.
// Antes desta fase marcar a condicao especial era um beco sem saida -- o
// formulario recusava salvar e mandava o profissional para "fora deste fluxo".
// O bloqueio do calculo automatico continua: o que passa a existir e a meta
// manual, em percentual ou em g/kg, escolhida por paciente.

const permissoes = [
  'console.acessar',
  'pacientes.listar',
  'pacientes.ler',
  'pacientes.gerenciar',
  'profissionais.ler',
  'planos_alimentares.ler',
  'planos_alimentares.gerenciar'
];

const paciente = {
  id: 'paciente-1',
  tenantId: 'tenant-1',
  profissionalResponsavelId: 'profissional-1',
  nome: 'Ana Sintética',
  statusAdesao: 'aderente',
  scoreRisco: '10.00',
  criadoEm: '2026-07-01T10:00:00.000Z'
};

const AVALIACAO_ID = 'avaliacao-1';
const PESO_KG = 80;

// Formato real de `AvaliacaoAntropometricaApi` (lib/prontuario-api.ts). O
// caminho g/kg multiplica pelo peso daqui, entao a avaliacao precisa existir
// de verdade -- nao da para usar a lista vazia das outras specs.
const avaliacao = {
  id: AVALIACAO_ID,
  pacienteId: paciente.id,
  avaliadaEm: '2026-08-01',
  protocolo: 'nenhum',
  sexo: 'feminino',
  idadeAnos: 35,
  medidas: { pesoKg: PESO_KG, alturaCm: 170 },
  resultado: { protocoloAplicado: 'nenhum', avisos: [] },
  criadoEm: '2026-08-01T12:00:00.000Z'
};

// Formato completo de `VersaoPlanoAlimentarApi`/`PlanoAlimentarApi`: campo
// obrigatorio faltando aqui nao vira erro de tipo (a spec e .mjs), vira crash
// de runtime que o error boundary transforma em tela de erro.
const plano = {
  id: 'plano-1',
  pacienteId: paciente.id,
  profissionalId: 'profissional-1',
  titulo: 'Plano clínico',
  criadoEm: '2026-08-09T12:00:00.000Z',
  atualizadoEm: '2026-08-10T12:00:00.000Z',
  historico: []
};

const versaoRascunho = {
  id: 'versao-1',
  numero: 1,
  status: 'rascunho',
  avaliacaoAntropometricaId: AVALIACAO_ID,
  criadoEm: '2026-08-09T12:00:00.000Z',
  atualizadoEm: '2026-08-10T12:00:00.000Z',
  objetivos: 'Estabilizar o quadro clínico.',
  refeicoes: [
    {
      id: 'versao-1-refeicao-1',
      ordem: 0,
      nome: 'Café da manhã',
      horarioLocal: '08:00',
      itens: [
        {
          id: 'versao-1-item-1',
          ordem: 0,
          descricao: 'Alimento sintético',
          quantidade: 100,
          unidade: 'g',
          porcaoGramas: 100,
          composicaoSnapshot: {
            origem: 'manual',
            descricao: 'Alimento sintético',
            // O formulario hidrata os campos obrigatorios de nutriente daqui.
            nutrientesPor100g: {
              energiaKcal: 120,
              proteinasG: 4,
              carboidratosG: 20,
              gordurasG: 2
            }
          },
          substituicoes: []
        }
      ]
    }
  ]
};

async function prepararSessao(page) {
  // O middleware roda no servidor: sem cookie a navegacao cai no login antes
  // de qualquer rota mockada no navegador ser consultada.
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
        usuarioId: 'usuario-1',
        tenantId: 'tenant-1',
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
          itens: [
            {
              id: 'profissional-1',
              tenantId: 'tenant-1',
              nome: 'Dra. Carla',
              criadoEm: '2026-07-01T10:00:00.000Z'
            }
          ],
          total: 1
        })
      })
  );

  await page.route(
    (url) => url.pathname === `/api/pacientes/${paciente.id}/prontuario`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paciente,
          resumo: {
            consultas: 0,
            formulariosPendentes: 0,
            respostas: 0,
            checkinsRapidos: 0,
            mensagens: 0,
            evolucoes: 0,
            tarefasPendentes: 0,
            indicadoresRecentes: []
          },
          linhaDoTempo: []
        })
      })
  );

  await page.route(
    (url) => url.pathname === `/api/pacientes/${paciente.id}/avaliacoes-antropometricas`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ avaliacoes: [avaliacao], deltaUltimas: [] })
      })
  );

  // Sem estes mocks o BFF real responde 401 e o app dispara "sua sessao
  // expirou", que aborta o submit antes de chegar a requisicao do rascunho.
  await page.route(
    (url) => url.pathname === `/api/pacientes/${paciente.id}/prioridade-acompanhamento`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pacienteId: paciente.id,
          valorCalculado: { score: 10, faixa: 'baixa', fatores: [] },
          valorEfetivo: { faixa: 'baixa', origem: 'calculado' }
        })
      })
  );

  await page.route(
    (url) => url.pathname === `/api/pacientes/${paciente.id}/planos-alimentares/plano-1/escolhas-paciente`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 25 })
      })
  );

  await page.route(
    (url) => url.pathname === '/api/notificacoes',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ naoLidas: 0, itens: [] })
      })
  );

  // Componentes irmaos do editor: sem mock eles falham no mount e escondem o
  // bloco que este teste exercita.
  for (const caminho of ['/api/planos-alimentares/modelos', '/api/planos-alimentares/receitas']) {
    await page.route(
      (url) => url.pathname === caminho,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 100 })
        })
    );
  }

  await page.route(
    (url) => url.pathname === `/api/pacientes/${paciente.id}/planos-alimentares`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          itens: [{ ...plano, draft: versaoRascunho }],
          total: 1,
          pagina: 1,
          limite: 25
        })
      })
  );

  await page.route(
    (url) => url.pathname === `/api/pacientes/${paciente.id}/planos-alimentares/plano-1`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...plano, draft: versaoRascunho })
      })
  );
}

// Os labels envolvem o controle, entao o nome acessivel carrega junto o texto
// interno (a opcao selecionada, no caso dos selects). Localizar por papel +
// prefixo evita a ambiguidade com o checkbox de aplicabilidade da formula.
function condicaoEspecial(page) {
  return page.getByRole('checkbox', { name: /condicao especial/i });
}

const campos = {
  formula: (page) => page.getByRole('combobox', { name: /^Fórmula/ }),
  fatorAtividade: (page) => page.getByRole('spinbutton', { name: /Fator de atividade/ }),
  metaManual: (page) => page.getByRole('spinbutton', { name: /Meta energética/ }),
  metodoMacros: (page) => page.getByRole('combobox', { name: /Método dos macronutrientes/ }),
  justificativa: (page) => page.getByRole('textbox', { name: /Justificativa da condicao especial/ }),
  macroPorPeso: (page, macro) => page.getByRole('spinbutton', { name: new RegExp(`${macro} \\(g/kg\\)`) }),
  macroPercentual: (page, macro) => page.getByRole('spinbutton', { name: new RegExp(`${macro} \\(%\\)`) })
};

async function abrirEditor(page) {
  await page.goto(`/pacientes/${paciente.id}?aba=plano_alimentar`);
  await expect(condicaoEspecial(page)).toBeVisible();
}

test.describe('Fase 270 - caminho manual para condicao especial (PB-14)', () => {
  test('condicao especial troca a formula por meta manual em vez de recusar o plano', async ({ page }) => {
    await prepararSessao(page);
    await abrirEditor(page);

    // Caminho automatico: formula e fator de atividade disponiveis.
    await expect(campos.formula(page)).toBeVisible();
    await expect(campos.fatorAtividade(page)).toBeVisible();

    await condicaoEspecial(page).check();

    // A formula sai de cena -- o bloqueio do calculo automatico continua.
    await expect(campos.formula(page)).toHaveCount(0);
    await expect(campos.fatorAtividade(page)).toHaveCount(0);
    // E existe saida: meta manual e justificativa, no lugar do beco sem saida.
    await expect(campos.metaManual(page)).toBeVisible();
    await expect(campos.metodoMacros(page)).toBeVisible();
    await expect(campos.justificativa(page)).toBeVisible();
    await expect(
      page.getByText('O cálculo automático deste MVP não atende condições especiais')
    ).toHaveCount(0);
  });

  test('permite escolher entre percentual e g/kg por paciente', async ({ page }) => {
    await prepararSessao(page);
    await abrirEditor(page);
    await condicaoEspecial(page).check();

    // Percentual e o padrao: mantem os campos de porcentagem.
    await expect(campos.macroPercentual(page, 'Carboidratos')).toBeVisible();
    await expect(campos.macroPorPeso(page, 'Carboidratos')).toHaveCount(0);

    await campos.metodoMacros(page).selectOption('gramas_por_kg');

    await expect(campos.macroPorPeso(page, 'Carboidratos')).toBeVisible();
    await expect(campos.macroPorPeso(page, 'Proteinas')).toBeVisible();
    await expect(campos.macroPorPeso(page, 'Gorduras')).toBeVisible();
    await expect(campos.macroPercentual(page, 'Carboidratos')).toHaveCount(0);
    // Em g/kg a energia vem dos gramas: nao ha meta energetica digitada.
    await expect(campos.metaManual(page)).toHaveCount(0);
  });

  test('envia a meta manual em g/kg sem formula no corpo da requisicao', async ({ page }) => {
    await prepararSessao(page);

    const corpos = [];
    await page.route(
      (url) => url.pathname === `/api/pacientes/${paciente.id}/planos-alimentares/plano-1/rascunho`,
      (route) => {
        corpos.push(JSON.parse(route.request().postData() ?? '{}'));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(versaoRascunho)
        });
      }
    );

    await abrirEditor(page);
    await condicaoEspecial(page).check();
    await campos.justificativa(page).fill('Doença renal crônica em tratamento conservador.');
    await campos.metodoMacros(page).selectOption('gramas_por_kg');
    await campos.macroPorPeso(page, 'Proteinas').fill('0.6');

    await page.getByRole('button', { name: /salvar rascunho/i }).click();

    await expect.poll(() => corpos.length).toBeGreaterThan(0);
    const corpo = corpos[corpos.length - 1];
    expect(corpo.origemMeta).toBe('manual');
    expect(corpo.possuiCondicaoEspecial).toBe(true);
    expect(corpo.metodoMacrosManual).toBe('gramas_por_kg');
    expect(corpo.macrosGramasPorKg.proteinasGPorKg).toBe(0.6);
    // Nada de formula preditiva atravessa no caminho manual.
    expect(corpo.formula).toBeUndefined();
    expect(corpo.fatorAtividade).toBeUndefined();
    expect(corpo.distribuicaoMacros).toBeUndefined();
  });
});
