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

function serializarFixture(v) {
  if(v && typeof v==='object' && v.questionarioId && v.resumo && Array.isArray(v.respostas)) {
    return JSON.stringify({filtros:{tamanho:25,...(v.filtroPacienteId?{pacienteId:v.filtroPacienteId}:{})},timezone:'America/Sao_Paulo',totalConsulta:v.respostas.length,proximoCursor:null,...v});
  }
  return JSON.stringify(v);
}

async function preparar(page, respostasDaFixture = respostas, questionariosDaFixture = questionarios) {
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
    // The independent notification bell polls every 5s. Give it its own synthetic
    // fixture, outside the questionnaire request invariant. All clinical reads
    // and every mutation (including notification mutations) remain recorded.
    if (caminho === '/api/notificacoes' && route.request().method() === 'GET') {
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({naoLidas:0,itens:[],resumos:[]})});
    }
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
      corpo = { itens: questionariosDaFixture, total: questionariosDaFixture.length };
    } else if (/^\/api\/questionarios\/q-[12]\/respostas\/(leitura-clinica|pagina)$/.test(caminho)) {
      const pacienteId = url.searchParams.get('pacienteId');
      const selecionadas = respostasDaFixture.filter((resposta) => !pacienteId || resposta.pacienteId === pacienteId);
      const tamanho=Number(url.searchParams.get('tamanho')??25),indice=Number(url.searchParams.get('cursor')??0);
      const pagina=selecionadas.slice(indice,indice+tamanho);
      corpo = {
        questionarioId: caminho.split('/')[3], pacientes: [], perguntas: [],
        filtros:{tamanho,...(pacienteId?{pacienteId}:{}),...(url.searchParams.get('inicio')?{inicio:url.searchParams.get('inicio')}:{}),...(url.searchParams.get('fim')?{fim:url.searchParams.get('fim')}:{})},
        timezone:'America/Sao_Paulo',totalConsulta:selecionadas.length,proximoCursor:indice+tamanho<selecionadas.length?String(indice+tamanho):null,
        resumo: { totalRespostas: pagina.length, totalPacientes: new Set(pagina.map(r=>r.pacienteId)).size, totalPerguntas: 1, mediaRespostasPorEnvio: 1 },
        respostas: pagina
      };
    } else if (caminho === '/api/categorias-pergunta') {
      corpo = [{ id: 'categoria-1', nome: 'Rotina', iconeSvg: 'utensils', corHex: '#247BA0', ordem: 1 }];
    } else if (caminho === '/api/notificacoes/resumos/gerar') {
      corpo = {};
    } else if (['/api/biblioteca-perguntas', '/api/questionarios/modelos'].includes(caminho) || /^\/api\/questionarios\/q-[12]\/perguntas$/.test(caminho)) {
      corpo = [];
    } else {
      return route.fulfill({ status: 404, contentType: 'application/json', body: serializarFixture({ mensagem: 'Rota fora da fixture sintética.' }) });
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: serializarFixture(corpo) });
  });
  await page.goto('/questionarios');
  await page.getByRole('tab', { name: 'Respostas', exact: true }).click();
  await expect(page.getByText('Organizei o almoço', { exact: true })).toBeVisible();
  return requisicoes;
}

function envio(page, nome) {
  return page.locator('article').filter({ has: page.getByText(nome, { exact: true }) });
}

function leituraSintetica(pacienteId) {
  const selecionadas = respostas.filter(resposta => resposta.pacienteId === pacienteId);
  return {
    questionarioId: 'q-1', filtroPacienteId:pacienteId, pacientes: [], perguntas: [],
    resumo: { totalRespostas: selecionadas.length, totalPacientes: selecionadas.length, totalPerguntas: 1, mediaRespostasPorEnvio: 1 },
    respostas: selecionadas
  };
}

// O servidor sintético controla a ordem da rede; a UI e o workspace são reais.
async function leituraAdiada(page, erro = false) {
  let recebeu;
  const recebida = new Promise(resolve => { recebeu = resolve; });
  let liberar;
  const liberada = new Promise(resolve => { liberar = resolve; });
  await page.route('**/api/questionarios/q-1/respostas/pagina*', async route => {
    const paciente = new URL(route.request().url()).searchParams.get('pacienteId');
    if (paciente === 'paciente-a') { recebeu(); await liberada; }
    await route.fulfill({
      status: paciente === 'paciente-a' && erro ? 500 : 200,
      contentType: 'application/json',
      body: serializarFixture(paciente === 'paciente-a' && erro ? { mensagem: 'Falha sintética antiga.' } : leituraSintetica(paciente))
    });
  });
  return { recebida, liberar };
}

async function entregarRespostaAntiga(page, liberar, trecho) {
  const resposta = page.waitForResponse(r => r.url().includes(trecho));
  liberar();
  await (await resposta).finished();
  // Esperar os frames da aplicação após a rede, sem timeout arbitrário.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test.describe('QPRO-02 — contexto de leitura', () => {
  test('resposta antiga de paciente A não substitui leitura já entregue de B', async ({ page }) => {
    await preparar(page);
    const adiada = await leituraAdiada(page);
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-a');
    await adiada.recebida;
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-b');
    await expect(page.getByText('Preparei o jantar', { exact: true })).toBeVisible();
    await entregarRespostaAntiga(page, adiada.liberar, 'pacienteId=paciente-a');
    await expect(page.getByText('Preparei o jantar', { exact: true })).toBeVisible();
    await expect(page.getByText('Organizei o almoço', { exact: true })).toHaveCount(0);
    await expect(page.locator('#filtro-paciente-respostas')).toHaveValue('paciente-b');
  });

  test('erro tardio de A não aparece sobre consulta bem-sucedida de B', async ({ page }) => {
    await preparar(page);
    const adiada = await leituraAdiada(page, true);
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-a');
    await adiada.recebida;
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-b');
    await expect(page.getByText('Preparei o jantar', { exact: true })).toBeVisible();
    await entregarRespostaAntiga(page, adiada.liberar, 'pacienteId=paciente-a');
    // Next mantém um anunciador vazio com role=alert, fora da aplicação.
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
  });

  test('matriz pendente não aparece sob novos filtros sem nova confirmação', async ({ page }) => {
    await preparar(page);
    let recebeu;
    const recebida = new Promise(resolve => { recebeu = resolve; });
    let liberar;
    const liberada = new Promise(resolve => { liberar = resolve; });
    await page.route('**/api/questionarios/matriz-longitudinal*', async route => {
      recebeu(); await liberada;
      await route.fulfill({ status: 200, contentType: 'application/json', body: serializarFixture({
        filtros: { pacienteId: 'paciente-a' }, resumo: { totalRespostas: 1, totalIndicadores: 1 },
        indicadores: [{ pacienteId: 'paciente-a', questionarioId: 'q-1', perguntaId: 'metrica-1',
          questionarioTitulo: 'Questionário sintético 1', enunciado: 'Indicador exclusivo de A', tipo: 'metrica',
          atual: { valor: 7, finalizadoEm: '2026-11-20T12:00:00.000Z' }, historico: [] }]
      }) });
    });
    await page.locator('#matriz-paciente').selectOption('paciente-a');
    await page.getByRole('button', { name: 'Atualizar matriz', exact: true }).click();
    await recebida;
    await page.locator('#matriz-paciente').selectOption('paciente-b');
    await entregarRespostaAntiga(page, liberar, '/matriz-longitudinal');
    await expect(page.getByText('Indicador exclusivo de A', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Atualizar matriz', exact: true })).toBeEnabled();
  });

  test('fim de A não encerra o carregamento ainda pendente de B', async ({ page }) => {
    await preparar(page);
    const controles = {};
    for (const paciente of ['paciente-a', 'paciente-b']) {
      let recebeu, liberar;
      const recebida = new Promise(resolve => { recebeu = resolve; });
      const liberada = new Promise(resolve => { liberar = resolve; });
      controles[paciente] = { recebeu, recebida, liberar, liberada };
    }
    await page.route('**/api/questionarios/q-1/respostas/pagina*', async route => {
      const paciente = new URL(route.request().url()).searchParams.get('pacienteId');
      const controle = controles[paciente];
      controle.recebeu(); await controle.liberada;
      await route.fulfill({ status: 200, contentType: 'application/json', body: serializarFixture(leituraSintetica(paciente)) });
    });
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-a');
    await controles['paciente-a'].recebida;
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-b');
    await controles['paciente-b'].recebida;
    await entregarRespostaAntiga(page, controles['paciente-a'].liberar, 'pacienteId=paciente-a');
    await expect(page.getByRole('button', { name: 'Atualizando respostas', exact: true })).toBeDisabled();
    await expect(page.getByText('Organizei o almoço', { exact: true })).toHaveCount(0);
    await entregarRespostaAntiga(page, controles['paciente-b'].liberar, 'pacienteId=paciente-b');
    await expect(page.getByText('Preparei o jantar', { exact: true })).toBeVisible();
  });

  test('retorno A-B-A não aceita resultado da primeira passagem por A', async ({ page }) => {
    await preparar(page);
    let recebeu, liberar;
    const recebida = new Promise(resolve => { recebeu = resolve; });
    const liberada = new Promise(resolve => { liberar = resolve; });
    let primeira = true;
    await page.route('**/api/questionarios/q-1/respostas/pagina*', async route => {
      const paciente = new URL(route.request().url()).searchParams.get('pacienteId');
      const leitura = leituraSintetica(paciente);
      if (paciente === 'paciente-a') {
        if (primeira) { primeira = false; recebeu(); await liberada; }
        else leitura.respostas = [{ ...respostas[0], respostas: [{ ...respostas[0].respostas[0], valor: 'Leitura atualizada de A' }] }];
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: serializarFixture(leitura) });
    });
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-a');
    await recebida;
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-b');
    await expect(page.getByText('Preparei o jantar', { exact: true })).toBeVisible();
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-a');
    await expect(page.getByText('Leitura atualizada de A', { exact: true })).toBeVisible();
    await entregarRespostaAntiga(page, liberar, 'pacienteId=paciente-a');
    await expect(page.getByText('Leitura atualizada de A', { exact: true })).toBeVisible();
    await expect(page.getByText('Organizei o almoço', { exact: true })).toHaveCount(0);
  });

  for (const filtro of [
    ['#matriz-paciente', 'paciente-b'], ['#matriz-questionario', 'q-2'],
    ['#matriz-categoria', 'categoria-1'], ['#matriz-inicio', '2026-11-01'], ['#matriz-fim', '2026-11-22']
  ]) {
    test(`alterar ${filtro[0]} remove resultado da matriz até nova consulta`, async ({ page }) => {
      await preparar(page);
      await page.route('**/api/questionarios/matriz-longitudinal*', route => route.fulfill({
        status: 200, contentType: 'application/json', body: serializarFixture({
          filtros: {}, resumo: { totalRespostas: 0, totalIndicadores: 0 }, indicadores: []
        })
      }));
      await page.getByRole('button', { name: 'Atualizar matriz', exact: true }).click();
      await expect(page.getByText('0 indicadores comparaveis em 0 respostas.', { exact: true })).toBeVisible();
      if (filtro[0].includes('inicio') || filtro[0].includes('fim')) await page.locator(filtro[0]).fill(filtro[1]);
      else await page.locator(filtro[0]).selectOption(filtro[1]);
      await expect(page.getByText('0 indicadores comparaveis em 0 respostas.', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Escolha os filtros e atualize para comparar as duas respostas mais recentes de cada indicador.')).toBeVisible();
    });
  }

  test('QPRO-02 adicional — troca de questionário descarta leitura pendente da origem', async ({ page }) => {
    await preparar(page);
    const adiada = await leituraAdiada(page);
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-a');
    await adiada.recebida;
    await page.route('**/api/questionarios/q-2/respostas/pagina*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: serializarFixture({
        ...leituraSintetica('paciente-a'), questionarioId: 'q-2',
        respostas: [{ ...respostas[0], questionarioId: 'q-2',
          respostas: [{ ...respostas[0].respostas[0], valor: 'Resposta do segundo questionário' }] }]
      })
    }));
    await page.getByRole('tab', { name: 'Formulários', exact: true }).click();
    await page.getByLabel('Selecionar', { exact: true }).selectOption('q-2');
    await page.getByRole('tab', { name: 'Respostas', exact: true }).click();
    await expect(page.getByText('Resposta do segundo questionário', { exact: true })).toBeVisible();
    await entregarRespostaAntiga(page, adiada.liberar, 'pacienteId=paciente-a');
    await expect(page.getByText('Resposta do segundo questionário', { exact: true })).toBeVisible();
    await expect(page.getByText('Organizei o almoço', { exact: true })).toHaveCount(0);
  });

  for (const erro of [false, true]) {
    test(`QPRO-02 adicional — matriz antiga com ${erro ? 'erro' : 'sucesso'} não encerra nem substitui nova consulta`, async ({ page }) => {
      await preparar(page);
      const controles = {};
      for (const paciente of ['paciente-a', 'paciente-b']) {
        let recebeu, liberar;
        const recebida = new Promise(resolve => { recebeu = resolve; });
        const liberada = new Promise(resolve => { liberar = resolve; });
        controles[paciente] = { recebeu, recebida, liberar, liberada };
      }
      await page.route('**/api/questionarios/matriz-longitudinal*', async route => {
        const paciente = new URL(route.request().url()).searchParams.get('pacienteId');
        const controle = controles[paciente];
        controle.recebeu(); await controle.liberada;
        await route.fulfill({ status: paciente === 'paciente-a' && erro ? 500 : 200,
          contentType: 'application/json', body: serializarFixture(paciente === 'paciente-a' && erro
            ? { mensagem: 'Falha sintética da matriz antiga.' }
            : { filtros: { pacienteId: paciente }, resumo: { totalRespostas: 0, totalIndicadores: 0 }, indicadores: [] })
        });
      });
      await page.locator('#matriz-paciente').selectOption('paciente-a');
      await page.getByRole('button', { name: 'Atualizar matriz', exact: true }).click();
      await controles['paciente-a'].recebida;
      await page.locator('#matriz-paciente').selectOption('paciente-b');
      await page.getByRole('button', { name: 'Atualizar matriz', exact: true }).click();
      await controles['paciente-b'].recebida;
      await entregarRespostaAntiga(page, controles['paciente-a'].liberar, 'pacienteId=paciente-a');
      await expect(page.getByRole('button', { name: 'Atualizando matriz', exact: true })).toBeDisabled();
      await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
      await entregarRespostaAntiga(page, controles['paciente-b'].liberar, 'pacienteId=paciente-b');
      await expect(page.getByText('0 indicadores comparaveis em 0 respostas.', { exact: true })).toBeVisible();
    });
  }
});

test.describe('QST01 — organização da leitura de respostas', () => {
  test('QPRO-01 oferece CSV filtrado por paciente e busca e explica o alcance completo', async ({ page }) => {
    await preparar(page);
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-a');
    await page.getByLabel('Busca', { exact: true }).fill('almoço');
    let selecao;
    await page.route('**/api/questionarios/q-1/respostas/exportacao.csv', async route => {
      selecao = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: 'respostaId,valor\nresposta-1,0\n' });
    });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar itens visíveis', exact: true }).focus();
    await page.keyboard.press('Enter');
    expect((await download).suggestedFilename()).toBe('octaclin-respostas-filtradas.csv');
    expect(selecao).toEqual({escopo:'visiveis',filtros:{pacienteId:'paciente-a'},respostaIds:['resposta-1']});
    await expect(page.getByRole('button', {name:'Exportar questionário',exact:true})).toBeEnabled();
    await expect(page.getByText(/Questionário: todo o conjunto autorizado, sem filtros/)).toBeVisible();
    await page.getByLabel('Busca', { exact: true }).fill('sem resultado sintético');
    await expect(page.getByRole('button', { name: 'Exportar itens visíveis', exact: true })).toBeDisabled();
  });
  test('QPRO-01 falha de acesso não baixa arquivo nem expõe mensagem interna', async ({ page }) => {
    await preparar(page);
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.route('**/api/questionarios/q-1/respostas/exportacao.csv', route => route.fulfill({ status: 404, body: 'DETALHE_INTERNO_NÃO_MOSTRAR' }));
    await page.getByRole('button', { name: 'Exportar itens visíveis', exact: true }).click();
    await expect(page.getByText('Não foi possível exportar. Atualize as respostas e tente novamente.')).toBeVisible();
    await expect(page.getByText('DETALHE_INTERNO_NÃO_MOSTRAR')).toHaveCount(0);
    expect(downloads).toBe(0);
  });
  test('QPRO-01 exportação acessível com texto ampliado e sem overflow', async ({ page }) => {
    await preparar(page);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const grupo = page.getByRole('group', { name: 'Exportação de respostas' });
    await expect(grupo).toBeVisible();
    expect(await grupo.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('[aria-label="Exportação de respostas"]').analyze()).violations).toEqual([]);
    await grupo.screenshot({ path: test.info().outputPath('qpro01-exportacao.png') });
  });
  test('QPRO-01 mudança de busca descarta CSV tardio sem download automático', async ({ page }) => {
    await preparar(page);
    let liberar, recebeu;
    const liberada = new Promise(resolve => { liberar = resolve; });
    const recebida = new Promise(resolve => { recebeu = resolve; });
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.route('**/api/questionarios/q-1/respostas/exportacao.csv', async route => {
      recebeu(); await liberada;
      await route.fulfill({ status: 200, contentType: 'text/csv', body: 'id,valor\nsintetico,0\n' });
    });
    await page.getByRole('button', { name: 'Exportar itens visíveis', exact: true }).click();
    await recebida;
    await page.getByLabel('Busca', { exact: true }).fill('jantar');
    await entregarRespostaAntiga(page, liberar, '/exportacao.csv');
    expect(downloads).toBe(0);
    await expect(page.getByRole('button', { name: 'Exportar itens visíveis', exact: true })).toBeEnabled();
  });
  test('P02 navega sem ciclo e volta ao gatilho com recolhimentos preservados', async ({ page }) => {
    const requisicoes = await preparar(page);
    const antes = requisicoes.slice();
    const primeiro = envio(page, pacientes[0].nome);
    await primeiro.getByRole('button', { name: /^Recolher respostas/ }).click();
    await primeiro.getByRole('button', { name: 'Ler envio', exact: true }).click();
    const leitor = page.locator('[data-qst-p02-leitura]');
    await expect(leitor.getByRole('heading', { name: 'Leitura individual' })).toBeFocused();
    await expect(leitor.getByText('Envio 1 de 2', { exact: true })).toBeVisible();
    await expect(leitor.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
    await expect(page.getByText('Organizei o almoço', { exact: true })).toBeVisible();
    await leitor.getByRole('button', { name: 'Próximo', exact: true }).click();
    await expect(leitor.getByText('Envio 2 de 2', { exact: true })).toBeVisible();
    await expect(leitor.getByRole('button', { name: 'Próximo', exact: true })).toBeDisabled();
    await expect(page.getByText('Preparei o jantar', { exact: true })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(leitor.getByRole('button', { name: 'Anterior', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(leitor.getByText('Envio 1 de 2', { exact: true })).toBeVisible();
    await leitor.getByRole('button', { name: 'Voltar à lista', exact: true }).click();
    await expect(primeiro.getByRole('button', { name: 'Ler envio', exact: true })).toBeFocused();
    await expect(primeiro.getByRole('button', { name: /^Expandir respostas/ })).toBeVisible();
    expect(requisicoes).toEqual(antes);
  });

  test('P02 respeita busca e não reabre envio removido dos resultados', async ({ page }) => {
    await preparar(page);
    const busca = page.getByLabel('Busca', { exact: true });
    await busca.fill('almoço');
    await page.getByRole('button', { name: 'Ler envio', exact: true }).click();
    await expect(page.getByText('Envio 1 de 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Próximo', exact: true })).toBeDisabled();
    await busca.fill('jantar');
    await expect(page.getByRole('heading', { name: 'Leitura individual' })).toHaveCount(0);
    await expect(busca).toBeFocused();
    await busca.clear();
    await expect(page.getByRole('heading', { name: 'Leitura individual' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ler envio', exact: true })).toHaveCount(2);
  });

  test('P02 mantém identidade após reordenação e sai com foco seguro após remoção', async ({ page }) => {
    await preparar(page);
    let atuais = [respostas[0], { ...respostas[0], respostaId: 'outro-envio', envioId: 'outro', finalizadoEm: '2026-11-21T12:00:00.000Z', respostas: [{ ...respostas[0].respostas[0], valor: 'Outro envio do mesmo paciente' }] }, respostas[1]];
    await page.route('**/api/questionarios/q-1/respostas/pagina*', route => route.fulfill({status:200,contentType:'application/json',body:serializarFixture({ questionarioId:'q-1',pacientes:[],perguntas:[],resumo:{totalRespostas:atuais.length,totalPacientes:2,totalPerguntas:1,mediaRespostasPorEnvio:1},respostas:atuais })}));
    await page.getByRole('button', { name: 'Atualizar respostas', exact: true }).click();
    await page.locator('article').filter({ hasText:'Outro envio do mesmo paciente' }).getByRole('button', {name:'Ler envio',exact:true}).click();
    await expect(page.getByText('Envio 2 de 3', {exact:true})).toBeVisible();
    atuais = [atuais[1],atuais[2],atuais[0]];
    await page.getByRole('button', {name:'Atualizar respostas',exact:true}).click();
    await expect(page.getByText('Envio 1 de 3', {exact:true})).toBeVisible();
    await expect(page.getByText('Outro envio do mesmo paciente', {exact:true})).toBeVisible();
    atuais = [respostas[1]];
    await page.getByRole('button', {name:'Atualizar respostas',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Leitura individual'})).toHaveCount(0);
    await expect(page.getByText('Preparei o jantar',{exact:true})).toBeVisible();
    // Atualizar fica temporariamente desabilitado; a remoção devolve o foco
    // ao grupo estável quando o gatilho original também desaparece.
    await expect(page.getByRole('group',{name:'Leitura dos envios',exact:true})).toBeFocused();
  });

  test('P02 leitura individual acessível e sem overflow com fonte ampliada', async ({ page }) => {
    await preparar(page);
    await page.getByRole('button', {name:'Ler envio',exact:true}).first().click();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.getByRole('button', {name:'Próximo',exact:true}).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth+1)).toBe(true);
    const resultado=await new AxeBuilder({page}).include('[data-qst-p02-leitura]').analyze();
    expect(resultado.violations).toEqual([]);
    await page.locator('[data-qst-p02-leitura]').screenshot({path:test.info().outputPath('p02-leitura.png')});
  });

  test('P02 volta durante carregamento com foco no grupo estável', async ({ page }) => {
    await preparar(page);
    await page.getByRole('button',{name:'Ler envio',exact:true}).first().click();
    let liberar;
    const pendente=new Promise(resolve=>{liberar=resolve;});
    await page.route('**/api/questionarios/q-1/respostas/pagina*',async route=>{
      await pendente;
      await route.fulfill({status:200,contentType:'application/json',body:serializarFixture({questionarioId:'q-1',pacientes:[],perguntas:[],resumo:{totalRespostas:2,totalPacientes:2,totalPerguntas:1,mediaRespostasPorEnvio:1},respostas})});
    });
    await page.getByRole('button',{name:'Atualizar respostas',exact:true}).click();
    await expect(page.getByRole('button',{name:'Próximo',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Voltar à lista',exact:true}).click();
    try {
      await expect(page.getByRole('group',{name:'Leitura dos envios',exact:true})).toBeFocused();
    } finally { liberar(); }
    await expect(page.getByRole('button',{name:'Ler envio',exact:true}).first()).toBeEnabled();
  });

  test('P02 cabeçalho acompanha rolagem desktop em resposta longa', async ({page},testInfo)=>{
    await preparar(page);
    const longa={...respostas[0],respostas:[{...respostas[0].respostas[0],valor:'Resposta sintética longa para leitura. '.repeat(600)}]};
    await page.route('**/api/questionarios/q-1/respostas/pagina*',route=>route.fulfill({status:200,contentType:'application/json',body:serializarFixture({questionarioId:'q-1',pacientes:[],perguntas:[],resumo:{totalRespostas:1,totalPacientes:1,totalPerguntas:1,mediaRespostasPorEnvio:1},respostas:[longa,{...longa,respostaId:"longa-2",envioId:"envio-longo-2"}]})}));
    await page.getByRole('button',{name:'Atualizar respostas',exact:true}).click();
    await expect(page.locator('article dd').first()).toContainText('Resposta sintética longa');
    await page.getByRole('button',{name:'Ler envio',exact:true}).first().click();
    const cabecalho=page.getByRole('heading',{name:'Leitura individual'}).locator('..');
    if(testInfo.project.name === 'desktop-chromium') {
      const leitor=page.locator('[data-qst-p02-leitura]');
      await leitor.evaluate(el=>{el.scrollTop=180;});
      await expect.poll(()=>leitor.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
      await expect.poll(async()=>Math.round((await cabecalho.boundingBox()).y-(await leitor.boundingBox()).y)).toBe(0);
      await page.getByRole('button',{name:'Próximo',exact:true}).click();
      await expect.poll(()=>leitor.evaluate(el=>el.scrollTop)).toBe(0);
    } else {
      const alvo=await cabecalho.evaluate(el=>el.getBoundingClientRect().top+window.scrollY+180);
      await page.evaluate(y=>window.scrollTo(0,y),alvo);
      await expect.poll(async()=>Math.round((await cabecalho.boundingBox()).y)).toBeLessThan(0);
    }
  });

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
    await page.route('**/api/questionarios/q-1/respostas/pagina*', async route => {
      await aguardar;
      await route.fulfill({ status: 200, contentType: 'application/json', body: serializarFixture({ questionarioId: 'q-1', pacientes: [], perguntas: [], resumo: { totalRespostas: 0, totalPacientes: 0, totalPerguntas: 0, mediaRespostasPorEnvio: 0 }, respostas: [] }) });
    });
    await page.getByRole('button', { name: 'Atualizar respostas', exact: true }).click();
    const estado = page.locator('[data-qst-p01-contagem] [role="status"]');
    await expect(estado).toHaveText('Atualizando envios...');
    liberar();
    await expect(estado).toHaveText('0 envios exibidos');
  });

  test('P01 realce mantém Unicode, caracteres especiais e HTML como texto', async ({ page }) => {
    await preparar(page);
    await page.route('**/api/questionarios/q-1/respostas/pagina*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: serializarFixture({
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
    await page.route('**/api/questionarios/q-1/respostas/pagina*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: serializarFixture({
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
    await expect(page.getByRole('button', {name:'Exportar questionário',exact:true})).toBeEnabled();
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
    await page.route('**/api/questionarios/q-1/respostas/pagina*', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: serializarFixture({
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

test('QST10-01 apresenta variação factual sem cores de julgamento clínico', async ({ page }) => {
  await preparar(page);
  await page.route('**/api/questionarios/matriz-longitudinal*', route => route.fulfill({ json: {
    resumo: { totalIndicadores: 4, totalRespostas: 7 },
    indicadores: [
      { perguntaId: 'a', enunciado: 'Indicador subiu', atual: { valor: 5 }, anterior: { valor: 3 }, delta: 2 },
      { perguntaId: 'b', enunciado: 'Indicador desceu', atual: { valor: 3 }, anterior: { valor: 5 }, delta: -2 },
      { perguntaId: 'c', enunciado: 'Indicador estável', atual: { valor: 0 }, anterior: { valor: 0 }, delta: 0 },
      { perguntaId: 'd', enunciado: 'Indicador inicial', atual: { valor: 3 } }
    ].map(indicador => ({ ...indicador, pacienteId: 'paciente-a', questionarioId: 'q-1', questionarioTitulo: 'Retorno sintético', tipo: 'metrica', historico: [], atual: { ...indicador.atual, finalizadoEm: '2026-11-23T08:00:00Z' } }))
  } }));
  await page.getByRole('button', { name: 'Atualizar matriz', exact: true }).click();
  for (const [titulo, texto] of [['Indicador subiu', 'Aumentou: +2'], ['Indicador desceu', 'Diminuiu: -2'], ['Indicador estável', 'Sem alteração: 0'], ['Indicador inicial', 'Sem comparação']]) {
    const card = page.locator('article').filter({ has: page.getByText(titulo, { exact: true }) });
    await expect(card.getByText(texto, { exact: true })).toBeVisible();
    await expect(card.locator('.text-sucesso-forte, .text-perigo')).toHaveCount(0);
  }
  const zero = page.locator('article').filter({ has: page.getByText('Indicador estável', { exact: true }) });
  await expect(zero.getByText('0', { exact: true })).toHaveCount(2);
});

test('QST10-02 alterna envios e resumo sem perder leitura ou filtros nem fazer consultas', async ({ page }) => {
  const requisicoes = await preparar(page);
  const anteriores = requisicoes.slice();
  const envios = page.getByRole('tab', { name: 'Envios', exact: true });
  const resumo = page.getByRole('tab', { name: 'Resumo por pergunta', exact: true });
  await expect(envios).toHaveAttribute('aria-selected', 'true');
  await envio(page, pacientes[0].nome).getByRole('button', { name: 'Ler envio', exact: true }).click();
  await resumo.click();
  await expect(page.getByRole('tabpanel', { name: 'Resumo por pergunta', exact: true })).toBeVisible();
  await expect(page.getByText('Resumo da página', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leitura individual', exact: true })).not.toBeVisible();
  await page.getByLabel('Busca', { exact: true }).fill('almoço');
  await resumo.focus(); await page.keyboard.press('ArrowLeft');
  await expect(envios).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Leitura individual', exact: true })).toBeVisible();
  await expect(page.getByLabel('Busca', { exact: true })).toHaveValue('almoço');
  await expect(page.getByText('Organizei o almoço', { exact: true })).toBeVisible();
  expect(requisicoes).toEqual(anteriores);
});

test('QST10-02 painéis acessíveis com texto ampliado e contexto novo inicia em envios', async ({ page }) => {
  await preparar(page);
  await page.getByRole('tab', { name: 'Resumo por pergunta', exact: true }).click();
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const painel = page.getByRole('tabpanel', { name: 'Resumo por pergunta', exact: true });
  expect(await painel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const axe = await new AxeBuilder({ page }).include('[data-qst10-leitura]').analyze();
  expect(axe.violations).toEqual([]);
  await page.locator('#filtro-paciente-respostas').selectOption('paciente-b');
  await expect(page.getByRole('tab', { name: 'Envios', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('QST10-07 leitura usa contagens históricas sem marcar revisão e mantém incerteza legada', async ({ page }) => {
  const respostasCoerentes=[{...respostas[0],totalRespostas:2,respostas:[...respostas[0].respostas,{perguntaId:'pergunta-2',tipo:'metrica',enunciado:'Indicador sintético',valor:0}]},respostas[1]];
  const requisicoes=await preparar(page,respostasCoerentes,questionarios.map(q=>q.id==='q-1'?{...q,versao:3}:q));
  await page.route('**/api/questionarios/q-1/respostas/resposta-1/completude',route=>route.fulfill({status:200,contentType:'application/json',body:serializarFixture({respostaId:'resposta-1',completude:{estado:'disponivel',versaoQuestionario:2,totalPerguntas:4,respondidas:2,obrigatorias:2,obrigatoriasRespondidas:2}})}));
  await page.route('**/api/questionarios/q-1/respostas/resposta-2/completude',route=>route.fulfill({status:200,contentType:'application/json',body:serializarFixture({respostaId:'resposta-2',completude:{estado:'desconhecido',motivo:'snapshot_ausente',versaoQuestionario:null,totalPerguntas:null,respondidas:null,obrigatorias:null,obrigatoriasRespondidas:null}})}));
  await envio(page,pacientes[0].nome).getByRole('button',{name:'Ler envio',exact:true}).click();
  await page.getByRole('button',{name:'Consultar preenchimento histórico',exact:true}).click();
  const painel=page.getByRole('region',{name:'Preenchimento histórico',exact:true});
  await expect(painel).toContainText('2 de 4 perguntas preenchidas na versão enviada 2.');
  await expect(painel).toContainText('2 de 2 perguntas obrigatórias preenchidas.');
  await expect(envio(page,pacientes[0].nome)).toContainText('2 respostas');
  await expect(envio(page,pacientes[0].nome)).toContainText('Indicador sintético');
  await expect(painel).toContainText('Preenchimento não mede qualidade');
  await painel.screenshot({path:test.info().outputPath('qst10-07-completude.png')});
  await page.locator('[data-qst-p02-leitura]').screenshot({path:test.info().outputPath('qst10-07-leitor.png')});
  await page.getByRole('button',{name:'Próximo',exact:true}).click();await page.getByRole('button',{name:'Consultar preenchimento histórico',exact:true}).click();await expect(painel).toContainText('Preenchimento desconhecido');await expect(painel).not.toContainText('2 de 4');
  expect(requisicoes.some(r=>r.metodo==='POST'&&r.caminho.includes('revisar'))).toBe(false);
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});const a=await new AxeBuilder({page}).include('[data-qst10-completude]').analyze();expect(a.violations).toEqual([]);
});

test('QST10-07 resultado atrasado não invade outro envio e acesso revogado não mantém contagem', async ({ page }) => {
  await preparar(page);let liberar;
  const espera=new Promise(resolve=>{liberar=resolve;});
  await page.route('**/api/questionarios/q-1/respostas/resposta-1/completude',async route=>{await espera;await route.fulfill({status:200,contentType:'application/json',body:serializarFixture({respostaId:'resposta-1',completude:{estado:'disponivel',versaoQuestionario:1,totalPerguntas:99,respondidas:99,obrigatorias:0,obrigatoriasRespondidas:0}})});});
  let acessoRevogado=false;
  await page.route('**/api/questionarios/q-1/respostas/resposta-2/completude',route=>{return route.fulfill({status:acessoRevogado?404:200,contentType:'application/json',body:serializarFixture(!acessoRevogado?{respostaId:'resposta-2',completude:{estado:'disponivel',versaoQuestionario:1,totalPerguntas:0,respondidas:0,obrigatorias:0,obrigatoriasRespondidas:0}}:{mensagem:'Indisponível'})});});
  const requisicaoA=page.waitForRequest(r=>r.url().endsWith('/resposta-1/completude'));
  await envio(page,pacientes[0].nome).getByRole('button',{name:'Ler envio',exact:true}).click();
  await page.getByRole('button',{name:'Consultar preenchimento histórico',exact:true}).click();await requisicaoA;
  await page.getByRole('button',{name:'Próximo',exact:true}).click();await page.getByRole('button',{name:'Consultar preenchimento histórico',exact:true}).click();
  const painel=page.getByRole('region',{name:'Preenchimento histórico',exact:true});await expect(painel).toContainText('0 de 0 perguntas preenchidas');liberar();
  await expect(painel).not.toContainText('99 de 99');
  acessoRevogado=true;await painel.getByRole('button',{name:'Atualizar preenchimento',exact:true}).click();await expect(painel).toContainText('Não foi possível consultar');await expect(painel).not.toContainText('0 de 0');
  await expect(painel.getByRole('button',{name:'Tentar consultar novamente',exact:true})).toBeVisible();
});

test('QST10-07 atualização preserva foco de teclado e não duplica consulta pendente', async ({ page }) => {
  await preparar(page);let bloquear=false, liberar, iniciou;let repeticoes=0;
  const espera=new Promise(resolve=>{liberar=resolve;});const iniciada=new Promise(resolve=>{iniciou=resolve;});
  await page.route('**/api/questionarios/q-1/respostas/resposta-1/completude',async route=>{
    if(bloquear){repeticoes++;iniciou();await espera;}
    await route.fulfill({status:200,contentType:'application/json',body:serializarFixture({respostaId:'resposta-1',completude:{estado:'disponivel',versaoQuestionario:2,totalPerguntas:3,respondidas:2,obrigatorias:2,obrigatoriasRespondidas:2}})});
  });
  await envio(page,pacientes[0].nome).getByRole('button',{name:'Ler envio',exact:true}).click();
  await page.getByRole('button',{name:'Consultar preenchimento histórico',exact:true}).click();
  const painel=page.getByRole('region',{name:'Preenchimento histórico',exact:true});await expect(painel).toContainText('2 de 3');
  bloquear=true;const botao=painel.getByRole('button',{name:'Atualizar preenchimento',exact:true});await botao.focus();await page.keyboard.press('Enter');await iniciada;
  try{
    await expect(painel.locator('button')).toBeFocused();await expect(painel.locator('button')).toHaveAttribute('aria-disabled','true');
    await page.keyboard.press('Enter');expect(repeticoes).toBe(1);
  }finally{liberar();}
  await expect(botao).toBeFocused();await expect(painel).toContainText('2 de 3');
});

test('QST10-08 pagina e busca somente os envios da página sem perder o alcance da consulta', async ({page}) => {
  const trinta=Array.from({length:30},(_,i)=>({...respostas[i%2],respostaId:`resposta-${i+1}`,envioId:`envio-${i+1}`,respostas:[{...respostas[0].respostas[0],valor:i===0?'Organizei o almoço':`Rotina sintética ${i+1}`}]}));
  await preparar(page,trinta);
  await expect(page.getByRole('button',{name:'Ler envio',exact:true})).toHaveCount(25);
  await expect(page.getByText('Página 1 · 30 respostas na consulta',{exact:true})).toBeVisible();
  await page.getByLabel('Busca', {exact:true}).fill('Rotina sintética 30');
  await expect(page.getByRole('button',{name:'Ler envio',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Limpar busca',exact:true}).click();
  await page.getByRole('button',{name:'Próxima página',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByText('Página 2 · 30 respostas na consulta',{exact:true})).toBeVisible();
  await expect(page.getByRole('group',{name:'Paginação das respostas',exact:true}).getByRole('status')).toBeFocused();
  await expect(page.getByRole('button',{name:'Ler envio',exact:true})).toHaveCount(5);
  await page.getByRole('button',{name:'Página anterior',exact:true}).click();
  await expect(page.getByRole('button',{name:'Ler envio',exact:true})).toHaveCount(25);
  await page.getByLabel('Respostas por página',{exact:true}).selectOption('50');
  await expect(page.getByRole('button',{name:'Ler envio',exact:true})).toHaveCount(30);
  await expect(page.getByText('Página 1 · 30 respostas na consulta',{exact:true})).toBeVisible();
});

test('QST10-08 separa filtros aplicados e três escopos de CSV', async ({page}) => {
  await preparar(page);const corpos=[];
  await page.route('**/api/questionarios/q-1/respostas/exportacao.csv',async route=>{corpos.push(route.request().postDataJSON());await route.fulfill({status:200,contentType:'text/csv',body:'respostaId\n'});});
  await page.getByLabel('Início do período',{exact:true}).fill('2026-11-01');
  await expect(page.getByRole('button',{name:'Exportar consulta',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Atualizar respostas',exact:true}).click();
  await expect(page.getByText('Fuso do período: America/Sao_Paulo. O dia final é incluído.',{exact:true})).toBeVisible();
  for(const nome of ['Exportar itens visíveis','Exportar consulta','Exportar questionário']){
    const download=page.waitForEvent('download');await page.getByRole('button',{name:nome,exact:true}).click();await download;
  }
  expect(corpos).toEqual([
    {escopo:'visiveis',filtros:{inicio:'2026-11-01'},respostaIds:['resposta-1','resposta-2']},
    {escopo:'consulta',filtros:{inicio:'2026-11-01'}},
    {escopo:'questionario'}
  ]);
});

for(const erro of [false,true])test(`QST10-08 página tardia ${erro?'com erro':'com sucesso'} não substitui novo paciente`,async({page})=>{
 const trinta=Array.from({length:30},(_,i)=>({...respostas[i%2],respostaId:`resposta-${i+1}`,envioId:`envio-${i+1}`,respostas:[{...respostas[0].respostas[0],valor:i===0?'Organizei o almoço':`Rotina tardia ${i+1}`}]}));
 await preparar(page,trinta);let liberar,recebeu;const pendente=new Promise(r=>liberar=r),recebida=new Promise(r=>recebeu=r);
 await page.route('**/api/questionarios/q-1/respostas/pagina*',async route=>{
  const url=new URL(route.request().url());if(url.searchParams.has('cursor')){recebeu();await pendente;await route.fulfill({status:erro?404:200,contentType:'application/json',body:serializarFixture(erro?{mensagem:'Leitura antiga negada.'}:{questionarioId:'q-1',pacientes:[],perguntas:[],resumo:{totalRespostas:5,totalPacientes:2,totalPerguntas:1,mediaRespostasPorEnvio:1},respostas:trinta.slice(25)})});}
  else await route.fallback();
 });
 await page.getByRole('button',{name:'Próxima página',exact:true}).click();await recebida;
 await page.locator('#filtro-paciente-respostas').selectOption('paciente-a');
 await expect(page.getByRole('button',{name:'Ler envio',exact:true})).toHaveCount(15);
 await entregarRespostaAntiga(page,liberar,'cursor=25');
 await expect(page.getByRole('button',{name:'Ler envio',exact:true})).toHaveCount(15);
 await expect(page.getByText('Página 1 · 15 respostas na consulta',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Página anterior',exact:true})).toBeDisabled();
 await expect(page.getByText('Leitura antiga negada.',{exact:true})).toHaveCount(0);
});

test('QST10-08 filtros e páginas acessíveis com texto ampliado',async({page},info)=>{
 await preparar(page);await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
 const painel=page.locator('[data-qst10-paginacao]');
 const borda=await painel.boundingBox();
 for(const nome of ['Início do período','Fim do período','Respostas por página']){
   const caixa=await page.getByLabel(nome,{exact:true}).boundingBox();
   expect(caixa.x+caixa.width,`${nome} precisa caber dentro do cartão`).toBeLessThanOrEqual(borda.x+borda.width+1);
 }
 const busca=await page.getByLabel('Busca',{exact:true}).boundingBox();
 expect(busca.width,'a busca não pode se reduzir a poucos caracteres').toBeGreaterThanOrEqual(Math.min(240,borda.width-32));
 expect((await new AxeBuilder({page}).include('[data-qst10-paginacao]').analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
 await page.getByLabel('Início do período',{exact:true}).focus();await expect(page.getByLabel('Início do período',{exact:true})).toBeFocused();
 await painel.screenshot({path:`../docs/agents/ux/reports/QST10-08-BC-2026-11-23/paginacao-${info.project.name.startsWith('desktop')?'desktop':'mobile'}.png`});
});

test('QST10-10 seleciona dois retornos entre páginas e compara somente após ação explícita',async({page})=>{
  const trinta=Array.from({length:32},(_,i)=>({...respostas[0],respostaId:`resposta-${i+1}`,envioId:`envio-${i+1}`,
    finalizadoEm:new Date(Date.UTC(2026,9,i+1,12)).toISOString(),respostas:[{...respostas[0].respostas[0],valor:i?`Registro ${i+1}`:'Organizei o almoço'}]}));
  await preparar(page,trinta);const chamadas=[];
  await page.route('**/api/questionarios/q-1/respostas/comparacao',async route=>{
    const corpo=route.request().postDataJSON();chamadas.push(corpo);
    await route.fulfill({json:{questionarioId:'q-1',pacienteId:'paciente-a',timezone:'America/Sao_Paulo',ordem:'cronologica',
      a:{respostaId:'resposta-1',envioId:'envio-1',finalizadoEm:trinta[0].finalizadoEm,versaoQuestionario:1},
      b:{respostaId:'resposta-26',envioId:'envio-26',finalizadoEm:trinta[25].finalizadoEm,versaoQuestionario:2},
      itens:[{perguntaId:'medida',enunciadoA:'Medida original',enunciadoB:'Medida original',tipoA:'metrica',tipoB:'metrica',
        unidade:'kg',unidadeA:'kg',unidadeB:'kg',a:{estado:'respondida',valor:0},b:{estado:'respondida',valor:2},compativel:true,motivo:null,delta:2}]}});
  });
  await page.getByRole('checkbox',{name:/Selecionar para comparação/}).first().check();
  await expect(page.getByText('1 de 2 selecionados',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Próxima página',exact:true}).click();
  await expect(page.getByText('Registro 26',{exact:true})).toBeVisible();
  await page.getByRole('checkbox',{name:/Selecionar para comparação/}).first().check();
  await expect(page.getByText('2 de 2 selecionados',{exact:true})).toBeVisible();expect(chamadas).toHaveLength(0);
  await page.getByRole('button',{name:'Comparar selecionados',exact:true}).click();
  await expect(page.getByRole('region',{name:'Comparação dos retornos'})).toContainText('Medida original');
  await expect(page.getByRole('region',{name:'Comparação dos retornos'})).toContainText('Aumentou: +2 kg');
  expect(chamadas).toEqual([{pacienteId:'paciente-a',respostaIds:['resposta-1','resposta-26']}]);
});

const retornosComparaveis = () => [respostas[0], {...respostas[0],respostaId:'retorno-2',envioId:'envio-2',respostas:[{...respostas[0].respostas[0],valor:'Segundo retorno'}]},
  {...respostas[0],respostaId:'retorno-3',envioId:'envio-3',respostas:[{...respostas[0].respostas[0],valor:'Terceiro retorno'}]}, respostas[1]];
function comparacaoSintetica(itens=[]) {
  return {questionarioId:'q-1',pacienteId:'paciente-a',timezone:'America/Sao_Paulo',ordem:'selecao',
    a:{respostaId:'resposta-1',envioId:'envio-1',finalizadoEm:null,versaoQuestionario:1},
    b:{respostaId:'retorno-2',envioId:'envio-2',finalizadoEm:null,versaoQuestionario:null},itens};
}
async function selecionarPar(page) {
  const caixas=page.getByRole('checkbox',{name:/Selecionar para comparação/});await caixas.nth(0).check();await caixas.nth(1).check();
}

test('QST10-10 limita o par ao mesmo paciente e limpa ao mudar o contexto',async({page})=>{
  await preparar(page,retornosComparaveis());const caixas=page.getByRole('checkbox',{name:/Selecionar para comparação/});
  await caixas.nth(0).check();await expect(caixas.nth(3)).toBeDisabled();await caixas.nth(1).check();
  await expect(caixas.nth(2)).toBeDisabled();await caixas.nth(0).uncheck();await expect(caixas.nth(2)).toBeEnabled();
  await page.getByRole('button',{name:'Remover da comparação: retorno 1'}).click();
  await expect(page.getByText('0 de 2 selecionados',{exact:true})).toBeVisible();
  await caixas.nth(0).check();await page.locator('#filtro-paciente-respostas').selectOption('paciente-b');
  await expect(page.getByText('0 de 2 selecionados',{exact:true})).toBeVisible();
  await page.locator('#filtro-paciente-respostas').selectOption('');
  await expect(page.getByText('0 de 2 selecionados',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.__persistenciasQst01)).toBe(0);
});

test('QST10-10 preserva zero, não, ausências, mudanças e anexos sem expor referências',async({page})=>{
  await preparar(page,retornosComparaveis());
  const item=(id,tipo,a,b,motivo,extra={})=>({perguntaId:id,enunciadoA:id,enunciadoB:id,tipoA:tipo,tipoB:tipo,
    unidade:null,unidadeA:null,unidadeB:null,a:{estado:'respondida',valor:a},b:{estado:'respondida',valor:b},compativel:true,motivo,delta:null,...extra});
  const dados=comparacaoSintetica([
    item('Escala original','linear',0,0,null,{delta:0}),item('Resposta booleana','sim_nao',false,true,'nao_numerico'),
    item('Resposta ausente','linear',0,null,'sem_resposta',{b:{estado:'sem_resposta',valor:null}}),
    item('Unidade alterada','metrica',1,100,'definicao_alterada',{compativel:false,unidadeA:'kg',unidadeB:'cm'}),
    item('Anexo original','upload_midia',null,null,'anexo',{a:{estado:'anexo',valor:null,quantidadeArquivos:1},b:{estado:'anexo',valor:null,quantidadeArquivos:2}})
  ]);
  await page.route('**/api/questionarios/q-1/respostas/comparacao',route=>route.fulfill({json:dados}));
  await selecionarPar(page);await page.getByRole('button',{name:'Comparar selecionados',exact:true}).click();
  const regiao=page.getByRole('region',{name:'Comparação dos retornos'});
  await expect(regiao.getByText('0',{exact:true})).toHaveCount(3);await expect(regiao.getByText('Não',{exact:true})).toBeVisible();
  await expect(regiao.getByText('Sem resposta',{exact:true})).toBeVisible();await expect(regiao).toContainText('não são diretamente comparáveis');
  await expect(regiao).toContainText('1 anexo registrado');await expect(regiao).toContainText('Versão indisponível');
  await expect(regiao).toContainText('não permitem estabelecer uma ordem cronológica');await expect(regiao.locator('a')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Comparar dois retornos'})).toBeFocused();
  await page.getByRole('button',{name:'Voltar à seleção',exact:true}).click();await expect(regiao).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Comparar selecionados',exact:true})).toBeFocused();
  await expect(page.getByText('2 de 2 selecionados',{exact:true})).toBeVisible();
});

for(const acao of ['cancelar','contexto','remover']) test(`QST10-10 ignora resposta tardia após ${acao}`,async({page})=>{
  await preparar(page,retornosComparaveis());let liberar,receber;
  const espera=new Promise(r=>liberar=r),recebida=new Promise(r=>receber=r);
  await page.route('**/api/questionarios/q-1/respostas/comparacao',async route=>{receber();await espera;await route.fulfill({json:comparacaoSintetica()});});
  await selecionarPar(page);await page.getByRole('button',{name:'Comparar selecionados',exact:true}).click();await recebida;
  if(acao==='cancelar') await page.getByRole('button',{name:'Cancelar comparação',exact:true}).click();
  if(acao==='remover') await page.getByRole('button',{name:'Remover da comparação: retorno 1'}).click();
  if(acao==='contexto') {await page.locator('#filtro-paciente-respostas').selectOption('paciente-b');await page.locator('#filtro-paciente-respostas').selectOption('');}
  const resposta=page.waitForResponse(r=>r.url().endsWith('/respostas/comparacao'));liberar();await resposta;
  await expect(page.getByRole('region',{name:'Comparação dos retornos'})).toHaveCount(0);
  await expect(page.getByText(`${acao==='cancelar'?2:acao==='remover'?1:0} de 2 selecionados`,{exact:true})).toBeVisible();
});

test('QST10-10 negações limpam o par e não exibem detalhes do servidor',async({page})=>{
  await preparar(page,retornosComparaveis());let chamadas=0;
  await page.route('**/api/questionarios/q-1/respostas/comparacao',route=>{chamadas++;return route.fulfill({status:403,json:{mensagem:'DETALHE_INTERNO_SINTETICO'}});});
  await selecionarPar(page);await page.getByRole('button',{name:'Comparar selecionados',exact:true}).click();
  await expect(page.locator('[data-qst10-comparacao]').getByRole('alert')).toContainText('Confira suas permissões');await expect(page.getByText('0 de 2 selecionados',{exact:true})).toBeVisible();
  await expect(page.getByText('DETALHE_INTERNO_SINTETICO')).toHaveCount(0);expect(chamadas).toBe(1);
});

test('QST10-10 teclado, axe e ampliação mantêm comparação legível sem persistência',async({page},testInfo)=>{
  await preparar(page,retornosComparaveis());await page.route('**/api/questionarios/q-1/respostas/comparacao',route=>route.fulfill({json:comparacaoSintetica()}));
  const caixas=page.getByRole('checkbox',{name:/Selecionar para comparação/});await caixas.first().focus();await page.keyboard.press('Space');
  await caixas.nth(1).focus();await page.keyboard.press('Space');const botao=page.getByRole('button',{name:'Comparar selecionados',exact:true});
  await botao.focus();await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'Comparação dos retornos'})).toBeVisible();
  const axe=await new AxeBuilder({page}).include('[data-qst10-comparacao]').analyze();expect(axe.violations).toEqual([]);
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  const regiao=page.getByRole('region',{name:'Comparação dos retornos'});await regiao.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('comparacao-200.png'),fullPage:true});
  expect(await page.evaluate(()=>window.__persistenciasQst01)).toBe(0);
});

test('QST10-10 troca de questionário limpa seleção sem recuperar o par anterior',async({page})=>{
  await preparar(page,retornosComparaveis());await selecionarPar(page);
  for(const q of ['q-2','q-1']) {
    await page.getByRole('tab',{name:'Formulários',exact:true}).click();
    await page.getByLabel('Selecionar',{exact:true}).selectOption(q);
    await page.getByRole('tab',{name:'Respostas',exact:true}).click();
    await expect(page.getByText('0 de 2 selecionados',{exact:true})).toBeVisible();
  }
});

test('QST10-10 falha recuperável preserva a seleção e exige nova tentativa explícita',async({page})=>{
  await preparar(page,retornosComparaveis());let chamadas=0;
  await page.route('**/api/questionarios/q-1/respostas/comparacao',route=>{
    chamadas++;return chamadas===1?route.fulfill({status:503,json:{mensagem:'DETALHE_INTERNO_SINTETICO'}}):route.fulfill({json:comparacaoSintetica()});
  });
  await selecionarPar(page);await page.getByRole('button',{name:'Comparar selecionados',exact:true}).click();
  await expect(page.locator('[data-qst10-comparacao]').getByRole('alert')).toContainText('Tente novamente');
  await expect(page.getByText('2 de 2 selecionados',{exact:true})).toBeVisible();expect(chamadas).toBe(1);
  await page.getByRole('button',{name:'Comparar selecionados',exact:true}).click();
  await expect(page.getByRole('region',{name:'Comparação dos retornos'})).toBeVisible();expect(chamadas).toBe(2);
});
