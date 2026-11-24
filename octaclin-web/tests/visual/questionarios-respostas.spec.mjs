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

function leituraSintetica(pacienteId) {
  const selecionadas = respostas.filter(resposta => resposta.pacienteId === pacienteId);
  return {
    questionarioId: 'q-1', pacientes: [], perguntas: [],
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
  await page.route('**/api/questionarios/q-1/respostas/leitura-clinica*', async route => {
    const paciente = new URL(route.request().url()).searchParams.get('pacienteId');
    if (paciente === 'paciente-a') { recebeu(); await liberada; }
    await route.fulfill({
      status: paciente === 'paciente-a' && erro ? 500 : 200,
      contentType: 'application/json',
      body: JSON.stringify(paciente === 'paciente-a' && erro ? { mensagem: 'Falha sintética antiga.' } : leituraSintetica(paciente))
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
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
    await page.route('**/api/questionarios/q-1/respostas/leitura-clinica*', async route => {
      const paciente = new URL(route.request().url()).searchParams.get('pacienteId');
      const controle = controles[paciente];
      controle.recebeu(); await controle.liberada;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leituraSintetica(paciente)) });
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
    await page.route('**/api/questionarios/q-1/respostas/leitura-clinica*', async route => {
      const paciente = new URL(route.request().url()).searchParams.get('pacienteId');
      const leitura = leituraSintetica(paciente);
      if (paciente === 'paciente-a') {
        if (primeira) { primeira = false; recebeu(); await liberada; }
        else leitura.respostas = [{ ...respostas[0], respostas: [{ ...respostas[0].respostas[0], valor: 'Leitura atualizada de A' }] }];
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leitura) });
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
        status: 200, contentType: 'application/json', body: JSON.stringify({
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
    await page.route('**/api/questionarios/q-2/respostas/leitura-clinica*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
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
          contentType: 'application/json', body: JSON.stringify(paciente === 'paciente-a' && erro
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
    await page.route('**/api/questionarios/q-1/respostas/exportar.csv', async route => {
      selecao = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: 'respostaId,valor\nresposta-1,0\n' });
    });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar resultados filtrados', exact: true }).focus();
    await page.keyboard.press('Enter');
    expect((await download).suggestedFilename()).toBe('octaclin-respostas-filtradas.csv');
    expect(selecao).toEqual({ respostaIds: ['resposta-1'] });
    await expect(page.getByRole('link', { name: 'Exportar todas as respostas', exact: true })).toHaveAttribute('href', '/api/questionarios/q-1/respostas/exportar.csv');
    await expect(page.getByText(/A exportação completa não aplica os filtros/)).toBeVisible();
    await page.getByLabel('Busca', { exact: true }).fill('sem resultado sintético');
    await expect(page.getByRole('button', { name: 'Exportar resultados filtrados', exact: true })).toBeDisabled();
  });
  test('QPRO-01 falha de acesso não baixa arquivo nem expõe mensagem interna', async ({ page }) => {
    await preparar(page);
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.route('**/api/questionarios/q-1/respostas/exportar.csv', route => route.fulfill({ status: 404, body: 'DETALHE_INTERNO_NÃO_MOSTRAR' }));
    await page.getByRole('button', { name: 'Exportar resultados filtrados', exact: true }).click();
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
    await page.route('**/api/questionarios/q-1/respostas/exportar.csv', async route => {
      recebeu(); await liberada;
      await route.fulfill({ status: 200, contentType: 'text/csv', body: 'id,valor\nsintetico,0\n' });
    });
    await page.getByRole('button', { name: 'Exportar resultados filtrados', exact: true }).click();
    await recebida;
    await page.getByLabel('Busca', { exact: true }).fill('jantar');
    await entregarRespostaAntiga(page, liberar, '/exportar.csv');
    expect(downloads).toBe(0);
    await expect(page.getByRole('button', { name: 'Exportar resultados filtrados', exact: true })).toBeEnabled();
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
    await page.route('**/api/questionarios/q-1/respostas/leitura-clinica*', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ questionarioId:'q-1',pacientes:[],perguntas:[],resumo:{totalRespostas:atuais.length,totalPacientes:2,totalPerguntas:1,mediaRespostasPorEnvio:1},respostas:atuais })}));
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
    await page.route('**/api/questionarios/q-1/respostas/leitura-clinica*',async route=>{
      await pendente;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({questionarioId:'q-1',pacientes:[],perguntas:[],resumo:{totalRespostas:2,totalPacientes:2,totalPerguntas:1,mediaRespostasPorEnvio:1},respostas})});
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
    await page.route('**/api/questionarios/q-1/respostas/leitura-clinica*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({questionarioId:'q-1',pacientes:[],perguntas:[],resumo:{totalRespostas:1,totalPacientes:1,totalPerguntas:1,mediaRespostasPorEnvio:1},respostas:[longa,{...longa,respostaId:"longa-2",envioId:"envio-longo-2"}]})}));
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
    await expect(page.getByRole('link', { name: 'Exportar todas as respostas' })).toHaveAttribute('href', '/api/questionarios/q-1/respostas/exportar.csv');
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

async function prepararDistribuicoes(page, quantidades = [6, 5]) {
  await preparar(page);
  const perguntas = quantidades.map((quantidade, indice) => ({
    perguntaId: `distribuicao-${indice}`, enunciado: `Categorias sintéticas ${indice + 1}`,
    tipo: 'multipla_escolha', totalRespostas: 30, textosRecentes: [],
    distribuicao: Array.from({ length: quantidade }, (_, posicao) => ({
      valor: posicao === 4 ? '<b>Categoria especial</b>' : `Categoria ${posicao + 1}`,
      total: posicao === 5 ? 0 : 30 - posicao
    }))
  }));
  await page.route('**/api/questionarios/*/respostas/leitura-clinica*', route => route.fulfill({ json: {
    ...leituraSintetica('paciente-a'), perguntas,
    questionarioId: new URL(route.request().url()).pathname.split('/')[3]
  } }));
  await page.getByRole('button', { name: 'Atualizar respostas', exact: true }).click();
  await expect(page.getByText(perguntas[0].enunciado, { exact: true })).toBeVisible();
  return perguntas;
}

function grupoDistribuicao(page, indice = 1) {
  return page.getByRole('group', { name: `Distribuição de respostas: Categorias sintéticas ${indice}`, exact: true });
}

test.describe('QPRO-09 — categorias recebidas da distribuição', () => {
  test('revela categorias sem alterar ordem, zero, texto, filtros ou rede; perguntas independentes', async ({ page }) => {
    await prepararDistribuicoes(page);
    await page.getByLabel('Busca', { exact: true }).fill('Categorias sintéticas');
    const requisicoes = [];
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requisicoes.push(request.url()); });
    const persistencias = await page.evaluate(() => window.__persistenciasQst01);
    const primeiro = grupoDistribuicao(page);
    const segundo = grupoDistribuicao(page, 2);
    await expect(primeiro.getByRole('status')).toHaveText('4 de 6 categorias recebidas');
    await expect(primeiro.getByRole('listitem')).toHaveCount(4);
    const botao = primeiro.getByRole('button', { name: 'Mostrar mais categorias', exact: true });
    await botao.focus(); await page.keyboard.press('Enter');
    await expect(primeiro.getByRole('listitem')).toHaveText(['Categoria 1: 30', 'Categoria 2: 29', 'Categoria 3: 28', 'Categoria 4: 27', '<b>Categoria especial</b>: 26', 'Categoria 6: 0']);
    await expect(primeiro.locator('b')).toHaveCount(0);
    await expect(primeiro.getByRole('status')).toHaveText('6 de 6 categorias recebidas');
    const recolher = primeiro.getByRole('button', { name: 'Recolher categorias', exact: true });
    await expect(recolher).toBeFocused();
    await expect(recolher).toHaveAttribute('aria-expanded', 'true');
    await expect(segundo.getByRole('listitem')).toHaveCount(4);
    await page.keyboard.press('Enter');
    await expect(primeiro.getByRole('listitem')).toHaveCount(4);
    await expect(botao).toBeFocused();
    expect(requisicoes).toEqual([]);
    expect(await page.evaluate(() => window.__persistenciasQst01)).toBe(persistencias);
    await expect(page.locator('#filtro-paciente-respostas')).toHaveValue('');
    await expect(page.getByLabel('Busca', { exact: true })).toHaveValue('Categorias sintéticas');
  });

  test('limita expansão por etapa, anuncia progresso e recolhe também antes do fim', async ({ page }) => {
    await prepararDistribuicoes(page, [25]);
    const grupo = grupoDistribuicao(page);
    const mais = grupo.getByRole('button', { name: 'Mostrar mais categorias', exact: true });
    await mais.click();
    await expect(grupo.getByRole('listitem')).toHaveCount(24);
    await expect(grupo.getByRole('status')).toHaveText('24 de 25 categorias recebidas');
    await grupo.getByRole('button', { name: 'Recolher categorias', exact: true }).click();
    await expect(mais).toBeFocused();
    await expect(grupo.getByRole('listitem')).toHaveCount(4);
    await mais.click(); await mais.click();
    await expect(grupo.getByRole('listitem')).toHaveCount(25);
    await expect(grupo.getByRole('status')).toHaveText('25 de 25 categorias recebidas');
    await grupo.getByRole('button', { name: 'Recolher categorias', exact: true }).click();
    await expect(grupo.getByRole('listitem')).toHaveCount(4);
  });

  test('nova leitura e troca de paciente ou questionário reiniciam expansão', async ({ page }) => {
    await prepararDistribuicoes(page);
    const grupo = grupoDistribuicao(page);
    const expandir = async () => {
      await grupo.getByRole('button', { name: 'Mostrar mais categorias', exact: true }).click();
      await expect(grupo.getByRole('listitem')).toHaveCount(6);
    };
    await expandir();
    await page.getByRole('button', { name: 'Atualizar respostas', exact: true }).click();
    await expect(grupo.getByRole('listitem')).toHaveCount(4);
    await expandir();
    await page.locator('#filtro-paciente-respostas').selectOption('paciente-b');
    await expect(grupo.getByRole('listitem')).toHaveCount(4);
    await expandir();
    await page.getByRole('tab', { name: 'Formulários', exact: true }).click();
    await page.getByLabel('Selecionar', { exact: true }).selectOption('q-2');
    await page.getByRole('tab', { name: 'Respostas', exact: true }).click();
    await expect(grupo.getByRole('listitem')).toHaveCount(4);
  });

  test('até quatro categorias não cria controles; expansão acessível com texto ampliado', async ({ page }) => {
    await prepararDistribuicoes(page, [4, 6, 0]);
    await expect(grupoDistribuicao(page, 3)).toHaveCount(0);
    await expect(grupoDistribuicao(page).getByRole('listitem')).toHaveCount(4);
    await expect(grupoDistribuicao(page).getByRole('button')).toHaveCount(0);
    const grupo = grupoDistribuicao(page, 2);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await grupo.getByRole('button', { name: 'Mostrar mais categorias', exact: true }).click();
    await expect(grupo.getByRole('listitem')).toHaveCount(6);
    const id = await grupo.getByRole('button').getAttribute('aria-controls');
    await expect(grupo.locator(`[id="${id}"]`)).toHaveAttribute('role', 'list');
    expect(await grupo.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const axe = await new AxeBuilder({ page }).include('[data-qst-distribuicao]').analyze();
    expect(axe.violations).toEqual([]);
    await grupo.screenshot({ path: test.info().outputPath('distribuicao-ampliada.png') });
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
