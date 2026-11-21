import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pacientes = [
  { id: 'paciente-a', nome: 'Paciente Exemplo A' },
  { id: 'paciente-b', nome: 'Paciente Exemplo B' }
];
const questionarios = ['q-1', 'q-2'].map((id, indice) => ({
  id, titulo: `Questionário sintético ${indice + 1}`, status: 'publicado', versao: 1
}));
const respostas = pacientes.map((paciente, indice) => ({
  respostaId: `resposta-${indice + 1}`, envioId: `envio-${indice + 1}`,
  pacienteId: paciente.id, questionarioId: 'q-1',
  finalizadoEm: '2026-11-20T12:00:00.000Z', totalRespostas: 1,
  respostas: [{ perguntaId: 'pergunta-1', tipo: 'texto', enunciado: 'Como foi a rotina?', valor: indice ? 'Preparei o jantar' : 'Organizei o almoço' }]
}));

async function preparar(page) {
  const requisicoes = [];
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/questionarios'), domain: 'localhost', path: '/' }
  ]);
  await page.addInitScript(() => {
    window.__persistenciasQst01 = 0;
    const salvar = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) {
      window.__persistenciasQst01 += 1;
      return salvar.apply(this, args);
    };
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const caminho = url.pathname;
    requisicoes.push({ caminho, metodo: route.request().method() });
    let corpo;
    if (caminho === '/api/auth/session') {
      corpo = {
        autenticado: true, papel: 'Professional', tenantSlug: 'clinica-sintetica',
        email: 'profissional@example.test', apiUrl: 'http://localhost:3001',
        expiraEm: '2099-12-31T12:00:00.000Z', destinoInicial: '/questionarios',
        permissoes: ['console.acessar', 'questionarios.ler', 'questionarios.gerenciar']
      };
    } else if (caminho === '/api/pacientes') {
      corpo = { itens: pacientes, total: pacientes.length };
    } else if (caminho === '/api/profissionais') {
      corpo = { itens: [{ id: 'profissional-1', nome: 'Profissional Exemplo' }], total: 1 };
    } else if (caminho === '/api/questionarios') {
      corpo = { itens: questionarios, total: questionarios.length };
    } else if (/^\/api\/questionarios\/q-[12]\/respostas\/leitura-clinica$/.test(caminho)) {
      const pacienteId = url.searchParams.get('pacienteId');
      const selecionadas = respostas.filter((resposta) => !pacienteId || resposta.pacienteId === pacienteId);
      corpo = {
        questionarioId: caminho.split('/')[3], pacientes: [], perguntas: [],
        resumo: { totalRespostas: selecionadas.length, totalPacientes: selecionadas.length, totalPerguntas: 1, mediaRespostasPorEnvio: 1 },
        respostas: selecionadas
      };
    } else if (caminho === '/api/categorias-pergunta') {
      corpo = [{ id: 'categoria-1', nome: 'Rotina', iconeSvg: 'utensils', corHex: '#247BA0', ordem: 1 }];
    } else if (caminho === '/api/notificacoes/resumos/gerar') {
      corpo = {};
    } else if (['/api/biblioteca-perguntas', '/api/questionarios/modelos'].includes(caminho) || /^\/api\/questionarios\/q-[12]\/perguntas$/.test(caminho)) {
      corpo = [];
    } else {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ mensagem: 'Rota fora da fixture sintética.' }) });
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
  });
  await page.goto('/questionarios');
  await page.getByRole('tab', { name: 'Respostas', exact: true }).click();
  await expect(page.getByText('Organizei o almoço', { exact: true })).toBeVisible();
  return requisicoes;
}

function envio(page, nome) {
  return page.locator('article').filter({ has: page.getByText(nome, { exact: true }) });
}

test.describe('QST01 — organização da leitura de respostas', () => {
  test('P01 realça busca literal, informa exibidos e limpa com foco sem efeitos colaterais', async ({ page }) => {
    const requisicoes = await preparar(page);
    const busca = page.getByLabel('Busca', { exact: true });
    await expect(page.getByRole('status').filter({ hasText: '2 envios exibidos' })).toBeVisible();
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-a');
    await expect(page.getByText('1 envio exibido', { exact: true })).toBeVisible();
    const antes = requisicoes.slice();
    const persistencias = await page.evaluate(() => window.__persistenciasQst01);
    await envio(page, pacientes[0].nome).getByRole('button', { name: /^Recolher respostas/ }).click();
    await busca.fill('  ALMOÇO  ');
    await expect(page.getByText('1 envio exibido', { exact: true })).toBeVisible();
    await expect(page.getByText('Organizei o almoço', { exact: true })).toBeHidden();
    await page.getByRole('button', { name: /^Expandir respostas/ }).click();
    await expect(page.locator('article dd mark')).toHaveText('almoço');
    await page.locator('[data-qst01-respostas]').screenshot({ path: test.info().outputPath('p01-realce.png') });
    await page.getByRole('button', { name: /^Recolher respostas/ }).click();
    await busca.fill('nenhum resultado sintético');
    await expect(page.getByText('0 envios exibidos', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar busca', exact: true }).click();
    await expect(busca).toBeFocused();
    await expect(busca).toHaveValue('');
    await expect(page.getByText('1 envio exibido', { exact: true })).toBeVisible();
    await expect(page.locator('#filtro-paciente-respostas')).toHaveValue('paciente-a');
    await expect(page.getByRole('button', { name: /^Expandir respostas/ })).toBeVisible();
    expect(await page.evaluate(() => window.__persistenciasQst01)).toBe(persistencias);
    await expect(page.locator('article mark')).toHaveCount(0);
    expect(requisicoes).toEqual(antes);
  });

  test('P01 anuncia carregamento sem apresentar contagem antiga como atual', async ({ page }) => {
    await preparar(page);
    let liberar;
    const aguardar = new Promise(resolve => { liberar = resolve; });
    await page.route('**/api/questionarios/q-1/respostas/leitura-clinica*', async route => {
      await aguardar;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ questionarioId: 'q-1', pacientes: [], perguntas: [], resumo: { totalRespostas: 0, totalPacientes: 0, totalPerguntas: 0, mediaRespostasPorEnvio: 0 }, respostas: [] }) });
    });
    await page.getByRole('button', { name: 'Atualizar respostas', exact: true }).click();
    const estado = page.locator('[data-qst-p01-contagem] [role="status"]');
    await expect(estado).toHaveText('Atualizando envios...');
    liberar();
    await expect(estado).toHaveText('0 envios exibidos');
  });

  test('P01 realce mantém Unicode, caracteres especiais e HTML como texto', async ({ page }) => {
    await preparar(page);
    await page.route('**/api/questionarios/q-1/respostas/leitura-clinica*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        questionarioId: 'q-1', pacientes: [], perguntas: [],
        resumo: { totalRespostas: 1, totalPacientes: 1, totalPerguntas: 1, mediaRespostasPorEnvio: 1 },
        respostas: [{ ...respostas[0], respostas: [{ ...respostas[0].respostas[0], valor: 'İ literal .* <img src=x onerror=alert(1)>' }] }]
      })
    }));
    await page.getByRole('button', { name: 'Atualizar respostas', exact: true }).click();
    await expect(page.getByText('İ literal .* <img src=x onerror=alert(1)>', { exact: true })).toBeVisible();
    await page.getByLabel('Busca', { exact: true }).fill('.*');
    await expect(page.locator('article dd mark')).toHaveText('.*');
    await page.getByLabel('Busca', { exact: true }).fill('<img');
    await expect(page.locator('article dd mark')).toHaveText('<img');
    await expect(page.locator('article img')).toHaveCount(0);
  });

  test('contagens usam singular para uma resposta e plural para zero ou várias', async ({ page }) => {
    await preparar(page);
    await expect(envio(page, pacientes[0].nome).getByText('1 resposta', { exact: true })).toBeVisible();
    const atualizadas = [
      { ...respostas[0], totalRespostas: 0, respostas: [] },
      { ...respostas[1], totalRespostas: 2, respostas: [respostas[1].respostas[0], { perguntaId: 'pergunta-2', tipo: 'texto', enunciado: 'O que pretende manter?', valor: 'Organização' }] }
    ];
    await page.route('**/api/questionarios/q-1/respostas/leitura-clinica*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        questionarioId: 'q-1', pacientes: [], perguntas: [],
        resumo: { totalRespostas: 2, totalPacientes: 2, totalPerguntas: 2, mediaRespostasPorEnvio: 1 },
        respostas: atualizadas
      })
    }));
    await page.getByRole('button', { name: 'Atualizar respostas', exact: true }).click();
    await expect(envio(page, pacientes[0].nome).getByText('0 respostas', { exact: true })).toBeVisible();
    await expect(envio(page, pacientes[1].nome).getByText('2 respostas', { exact: true })).toBeVisible();
  });

  test('inicia aberto e recolhe somente o envio escolhido, mantendo resumo e conteúdo', async ({ page }) => {
    await preparar(page);
    const primeiro = envio(page, pacientes[0].nome);
    const segundo = envio(page, pacientes[1].nome);
    const controle = primeiro.getByRole('button', { name: /^Recolher respostas/ });
    await expect(controle).toHaveAttribute('aria-expanded', 'true');
    const idConteudo = await controle.getAttribute('aria-controls');
    await expect(page.locator(`[id="${idConteudo}"]`)).toContainText('Organizei o almoço');
    await page.locator('[data-qst01-respostas]').screenshot({ path: test.info().outputPath('qst01-aberto.png') });
    await controle.click();
    await expect(primeiro.getByText('Organizei o almoço', { exact: true })).toBeHidden();
    await expect(primeiro.getByText(pacientes[0].nome, { exact: true })).toBeVisible();
    await expect(primeiro.getByText(/Finalizado em/)).toBeVisible();
    await expect(segundo.getByText('Preparei o jantar', { exact: true })).toBeVisible();
    await page.locator('[data-qst01-respostas]').screenshot({ path: test.info().outputPath('qst01-recolhido.png') });
    await primeiro.getByRole('button', { name: /^Expandir respostas/ }).click();
    await expect(primeiro.getByText('Organizei o almoço', { exact: true })).toBeVisible();
    await expect(primeiro.getByRole('button', { name: /^Recolher respostas/ })).toHaveAttribute('aria-controls', idConteudo);
  });

  test('ações coletivas afetam só resultados exibidos e preservam busca em conteúdo recolhido', async ({ page }) => {
    await preparar(page);
    const busca = page.getByLabel('Busca', { exact: true });
    await page.getByRole('button', { name: 'Recolher tudo', exact: true }).click();
    await busca.fill('almoço');
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Expandir respostas/ })).toBeVisible();
    await page.getByRole('button', { name: 'Expandir tudo', exact: true }).click();
    await expect(page.getByText('Organizei o almoço', { exact: true })).toBeVisible();
    await busca.clear();
    await expect(envio(page, pacientes[1].nome).getByRole('button', { name: /^Expandir respostas/ })).toBeVisible();
    await busca.fill('jantar');
    await page.getByRole('button', { name: 'Expandir tudo', exact: true }).click();
    await page.getByRole('button', { name: 'Recolher tudo', exact: true }).click();
    await busca.clear();
    await expect(page.getByText('Organizei o almoço', { exact: true })).toBeVisible();
    await expect(page.getByText('Preparei o jantar', { exact: true })).toBeHidden();
    await busca.fill('termo inexistente sintético');
    await expect(page.getByText('Nenhuma resposta encontrada para os filtros atuais.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Expandir tudo', exact: true })).toHaveCount(0);
    await busca.clear();
    await expect(envio(page, pacientes[1].nome).getByRole('button', { name: /^Expandir respostas/ })).toBeVisible();
  });

  test('trocar paciente ou questionário reinicia a apresentação aberta', async ({ page }) => {
    await preparar(page);
    await page.getByRole('button', { name: 'Recolher tudo', exact: true }).click();
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-a');
    await expect(page.getByText('Organizei o almoço', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Recolher respostas/ })).toHaveCount(1);
    await page.getByRole('button', { name: 'Recolher tudo', exact: true }).click();
    await page.locator('#filtro-paciente-respostas').selectOption('');
    await expect(page.getByRole('button', { name: /^Recolher respostas/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'Recolher tudo', exact: true }).click();
    await page.getByRole('tab', { name: 'Formulários', exact: true }).click();
    await page.getByLabel('Selecionar', { exact: true }).selectOption('q-2');
    await page.getByRole('tab', { name: 'Respostas', exact: true }).click();
    await expect(page.getByText('Organizei o almoço', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Recolher respostas/ })).toHaveCount(2);
  });

  test('organizar respostas não grava, não faz novas requisições e não altera URL', async ({ page }) => {
    const requisicoes = await preparar(page);
    const antes = requisicoes.slice();
    const url = page.url();
    const persistencias = await page.evaluate(() => window.__persistenciasQst01);
    await page.getByRole('button', { name: 'Recolher tudo', exact: true }).click();
    await page.getByRole('button', { name: 'Expandir tudo', exact: true }).click();
    await envio(page, pacientes[0].nome).getByRole('button', { name: /^Recolher respostas/ }).click();
    expect(requisicoes).toEqual(antes);
    expect(requisicoes.filter((item) => item.metodo !== 'GET')).toEqual(antes.filter((item) => item.metodo !== 'GET'));
    expect(await page.evaluate(() => window.__persistenciasQst01)).toBe(persistencias);
    expect(page.url()).toBe(url);
    await expect(page.getByRole('link', { name: 'Exportar CSV' })).toHaveAttribute('href', '/api/questionarios/q-1/respostas/exportar.csv');
    await page.reload();
    await page.getByRole('tab', { name: 'Respostas', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Recolher respostas/ })).toHaveCount(2);
  });

  test('atualizar e reordenar envios do mesmo paciente preserva o estado por envio', async ({ page }) => {
    await preparar(page);
    const original = page.locator('article').filter({ hasText: 'Organizei o almoço' });
    const controle = original.getByRole('button', { name: /^Recolher respostas/ });
    const idConteudo = await controle.getAttribute('aria-controls');
    await controle.click();
    const nova = {
      ...respostas[0], respostaId: 'resposta-nova', envioId: 'envio-novo',
      finalizadoEm: '2026-11-21T12:00:00.000Z',
      respostas: [{ ...respostas[0].respostas[0], valor: 'Nova rotina sintética' }]
    };
    await page.route('**/api/questionarios/q-1/respostas/leitura-clinica*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        questionarioId: 'q-1', pacientes: [], perguntas: [],
        resumo: { totalRespostas: 3, totalPacientes: 2, totalPerguntas: 1, mediaRespostasPorEnvio: 1 },
        respostas: [respostas[1], nova, respostas[0]]
      })
    }));
    await page.getByRole('button', { name: 'Atualizar respostas', exact: true }).click();
    await expect(page.getByText('Nova rotina sintética', { exact: true })).toBeVisible();
    await expect(original.getByText('Organizei o almoço', { exact: true })).toBeHidden();
    await expect(original.getByRole('button', { name: /^Expandir respostas/ })).toHaveAttribute('aria-controls', idConteudo);
    await expect(page.locator('article').nth(0)).toContainText('Preparei o jantar');
    await expect(page.locator('article').nth(1)).toContainText('Nova rotina sintética');
    await original.getByRole('button', { name: /^Expandir respostas/ }).click();
    await expect(original.getByText('Organizei o almoço', { exact: true })).toBeVisible();
    await expect(page.getByText('Nova rotina sintética', { exact: true })).toBeVisible();
  });

  test('teclado mantém foco e estado acessível, sem violações axe na lista', async ({ page }) => {
    await preparar(page);
    const grupo = page.getByRole('group', { name: 'Organizar respostas exibidas' });
    await grupo.getByRole('button', { name: 'Expandir tudo', exact: true }).focus();
    await page.keyboard.press('Tab');
    const recolher = grupo.getByRole('button', { name: 'Recolher tudo', exact: true });
    await expect(recolher).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(recolher).toBeFocused();
    await page.keyboard.press('Tab');
    const individual = envio(page, pacientes[0].nome).getByRole('button', { name: /^(Expandir|Recolher) respostas/ });
    await expect(individual).toBeFocused();
    await page.keyboard.press('Space');
    await expect(individual).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(individual).toHaveAttribute('aria-expanded', 'false');
    const foco = await individual.evaluate((botao) => ({
      visivel: botao.matches(':focus-visible'),
      outline: getComputedStyle(botao).outlineStyle,
      largura: getComputedStyle(botao).outlineWidth,
      sombra: getComputedStyle(botao).boxShadow
    }));
    expect(foco.visivel).toBe(true);
    // O tema usa box-shadow em :focus-visible; outline é apenas outra forma válida.
    expect((foco.outline !== 'none' && foco.largura !== '0px') || foco.sombra !== 'none').toBe(true);
    const resultado = await new AxeBuilder({ page }).include('[data-qst01-respostas]').include('[data-qst-p01-busca]').include('[data-qst-p01-contagem]').analyze();
    expect(resultado.violations).toEqual([]);
  });

  test('texto ampliado preserva controles e leitura sem rolagem horizontal', async ({ page }) => {
    await preparar(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.getByRole('button', { name: 'Recolher tudo', exact: true }).click();
    await page.getByRole('button', { name: 'Expandir tudo', exact: true }).click();
    await expect(page.getByText('Organizei o almoço', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('qst01-texto-ampliado.png'), fullPage: true });
  });
});
