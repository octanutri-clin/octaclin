import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const errosDePagina = new WeakMap();
test.beforeEach(({ context, page }) => {
  const erros = [];
  errosDePagina.set(context, erros);
  const observar = aba => aba.on('pageerror', erro => erros.push(erro.message));
  observar(page);
  context.on('page', observar);
});
test.afterEach(({ context }) => expect(errosDePagina.get(context)).toEqual([]));

const pacienteId = 'pa07-paciente-sintetico';
const planoId = 'pa07-plano-sintetico';
const instante = '2026-10-16T12:00:00.000Z';
const permissoes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'profissionais.ler', 'planos_alimentares.ler', 'planos_alimentares.gerenciar'];

function pausaControlada() {
  let liberar, sinalizar;
  const iniciou = new Promise(resolve => { sinalizar = resolve; });
  const fim = new Promise(resolve => { liberar = resolve; });
  return { iniciou, liberar, aguardar: () => { sinalizar(); return fim; } };
}

async function preparar(context) {
  let falharLeituraDetalhe = false;
  let codigoFalhaDetalhe = 503;
  let pausaEscrita, pausaLeitura, pausaCopia;
  let incluirOrigem = false;
  let detalhe = {
    id: planoId, pacienteId, profissionalId: 'pa07-profissional-sintetico', titulo: 'Plano sintético PA07',
    criadoEm: instante, atualizadoEm: instante, ativoParaPaciente: true, ativacaoRevisao: 1,
    draft: { id: 'pa07-rascunho-sintetico', numero: 1, status: 'rascunho', criadoEm: instante, atualizadoEm: instante,
      rascunhoRevisao: 1, objetivos: 'Objetivo sintético salvo', observacoes: '', refeicoes: [],
      ativoParaPaciente: true, ativacaoRevisao: 1, ativacaoEdicao: [], ativacaoRefeicoes: [] }, historico: []
  };
  const escritas = [];
  const origem = {
    ...detalhe, id: 'pa07-origem', titulo: 'Plano de origem sintético', draft: undefined,
    current: { ...detalhe.draft, id: 'pa07-origem-publicada', status: 'publicada',
      refeicoes: [{ id: 'pa07-refeicao-origem', ordem: 0, nome: 'Refeição copiada sintética', itens: [], orientacoes: '' }] }
  };
  await context.addCookies([
    { name: 'octaclin_access_token', value: 'synthetic', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'synthetic', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const caminho = url.pathname;
    if (pausaLeitura && caminho === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`) {
      const pausa = pausaLeitura; pausaLeitura = undefined;
      await pausa.aguardar();
    }
    if (falharLeituraDetalhe && caminho === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`) {
      await route.fulfill({ status: codigoFalhaDetalhe, contentType: 'application/json', body: JSON.stringify({ message: 'Falha sintética de leitura' }) });
      return;
    }
    let corpo = { itens: [], total: 0, pagina: 1, limite: 25 };
    if (caminho === '/api/auth/session') corpo = { autenticado: true, tenantSlug: 'pa07-clinica-sintetica', email: 'profissional@example.test', apiUrl: 'http://localhost:3001', expiraEm: '2026-10-30T12:00:00.000Z', papel: 'Professional', permissoes, destinoInicial: '/pacientes' };
    else if (caminho.endsWith('/prontuario')) corpo = {
      paciente: { id: pacienteId, tenantId: 'pa07-tenant-sintetico', profissionalResponsavelId: detalhe.profissionalId, nome: 'Paciente Sintético', statusAdesao: 'aderente' },
      resumo: { consultas: 0, formulariosPendentes: 0, respostas: 0, checkinsRapidos: 0, mensagens: 0, evolucoes: 0, tarefasPendentes: 0, indicadoresRecentes: [], leituraClinica: { deltaUltimaAvaliacao: [], deltaDesdeInicio: [], condutasVencendo: [] } }, linhaDoTempo: []
    };
    else if (caminho.endsWith('/prioridade-acompanhamento')) corpo = { pacienteId, apurado: false, valorCalculado: { score: 0, faixa: 'baixa', fatores: [] }, valorEfetivo: { faixa: 'baixa', origem: 'calculado' } };
    else if (caminho.endsWith('/avaliacoes-antropometricas')) corpo = { avaliacoes: [], deltaUltimas: [] };
    else if (caminho === '/api/profissionais') corpo = { itens: [{ id: detalhe.profissionalId, nome: 'Profissional Sintético' }], total: 1 };
    else if (caminho === `/api/pacientes/${pacienteId}/planos-alimentares`) corpo = { itens: incluirOrigem ? [detalhe, origem] : [detalhe], total: incluirOrigem ? 2 : 1, pagina: 1, limite: 25 };
    else if (caminho === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`) corpo = detalhe;
    else if (caminho === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}/versoes/1`) corpo = detalhe.current ?? detalhe.draft;
    else if (caminho.endsWith('/acompanhamento')) corpo = null;
    else if (caminho === `/api/pacientes/${pacienteId}/planos-alimentares/pa07-origem/versoes/1`) {
      const pausa = pausaCopia; pausaCopia = undefined;
      if (pausa) await pausa.aguardar();
      corpo = origem.current;
    }
    else if (caminho.endsWith('/edicao')) {
      const body = route.request().postDataJSON(); escritas.push(body);
      const pausa = pausaEscrita; pausaEscrita = undefined;
      if (pausa) await pausa.aguardar();
      if (body.rascunhoRevisaoEsperada !== detalhe.draft.rascunhoRevisao) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Revisão sintética divergente' }) });
        return;
      }
      const medidasCaseirasAplicadas = Object.fromEntries(body.documento.refeicoes.flatMap(refeicao => refeicao.itens.flatMap(item => [item, ...(item.substituicoes ?? [])]).filter(item => item.medidaCaseira).map(item => [item.chaveCliente, { nome: 'Colher sintética', quantidadeReferencia: 1, pesoReferenciaGramas: 25 }])));
      detalhe = { ...detalhe, draft: { ...detalhe.draft, rascunhoRevisao: body.rascunhoRevisaoEsperada + 1, documentoEdicao: body.documento, medidasCaseirasAplicadas, edicaoEstado: 'pendente' } };
      corpo = detalhe.draft;
    } else if (caminho === '/api/notificacoes') corpo = { naoLidas: 0, itens: [], resumos: [] };
    else if (caminho.endsWith('/resumos/gerar')) corpo = { gerado: false };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corpo) });
  });
  return {
    escritas,
    definirFalhaLeituraDetalhe: (falhar) => { falharLeituraDetalhe = falhar; },
    revogarAcesso: () => { codigoFalhaDetalhe = 403; falharLeituraDetalhe = true; },
    bloquearProximaEscrita: () => (pausaEscrita = pausaControlada()),
    bloquearProximaLeitura: () => (pausaLeitura = pausaControlada()),
    habilitarOrigem: () => { incluirOrigem = true; },
    bloquearProximaCopia: () => (pausaCopia = pausaControlada()),
    omitirReferenciasMedidas: () => { detalhe = { ...detalhe, draft: { ...detalhe.draft, medidasCaseirasAplicadas: undefined } }; },
    definirSomentePublicada: () => { detalhe = { ...detalhe, current: { ...detalhe.draft, status: 'publicada', publicadaEm: instante }, draft: undefined }; }
  };
}
async function abrir(page) {
  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeVisible({ timeout: 30_000 });
}

test('FOOD03 favorita alimentos no seletor sem aplicar a substituição ou alterar o rascunho', async ({ context, page }) => {
  const { escritas } = await preparar(context);
  const favoritosCriados = [];
  const busca = `/api/pacientes/${pacienteId}/planos-alimentares/alimentos`;
  await page.route(url => url.pathname === busca, route => route.fulfill({ json: {
    itens: [
      { id: '10000000-0000-4000-8000-000000000031', codigoOrigem: 'SINT-1', nome: 'Aveia sintética favorita', disponivelParaCalculo: true, favorito: false, fonte: { nome: 'Fonte sintética', versao: '1' } },
      { id: '10000000-0000-4000-8000-000000000032', codigoOrigem: 'SINT-2', nome: 'Banana sintética', disponivelParaCalculo: true, favorito: false, fonte: { nome: 'Fonte sintética', versao: '1' } }
    ], fontes: [], total: 2, pagina: 1, limite: 50
  } }));
  await page.route(url => url.pathname === '/api/planos-alimentares/favoritos', async route => {
    if (route.request().method() === 'POST') favoritosCriados.push(route.request().postDataJSON());
    await route.fulfill({ json: { origem: 'catalogo', alimentoId: '10000000-0000-4000-8000-000000000031', favorito: true } });
  });
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await page.getByRole('button', { name: 'Adicionar alimento', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar no catálogo' }).last().fill('Aveia');
  const lista = page.getByRole('list', { name: 'Resultados da busca de alimentos' });
  await expect(lista.getByRole('listitem')).toHaveCount(2);
  await expect(lista.getByRole('listitem').first()).toContainText('Aveia sintética favorita');
  const a11y = await new AxeBuilder({ page }).include('[aria-label="Resultados da busca de alimentos"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(a11y.violations).toEqual([]);
  const favorito = page.getByRole('button', { name: 'Adicionar Banana sintética aos favoritos' });
  await expect(favorito).toHaveAttribute('aria-pressed', 'false');
  await favorito.press('Enter');
  await expect.poll(() => favoritosCriados.length).toBe(1);
  expect(favoritosCriados[0]).toEqual({ origem: 'catalogo', alimentoId: '10000000-0000-4000-8000-000000000032' });
  await expect(page.getByRole('button', { name: 'Remover Banana sintética dos favoritos' })).toHaveAttribute('aria-pressed', 'true');
  await expect(lista.getByRole('listitem').first()).toContainText('Banana sintética');
  expect(escritas).toHaveLength(0);
});

test('PA07 segunda aba consulta sem habilitar edição nem autosave; aba original conserva conteúdo local', async ({ context, page }) => {
  const { escritas } = await preparar(context); await abrir(page);
  const objetivo = page.getByRole('textbox', { name: 'Objetivo clínico', exact: true }); await expect(objetivo).toBeEditable();
  await objetivo.fill('Alteração sintética somente local');
  const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
  await expect(segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeDisabled();
  await expect(segunda.getByRole('status').filter({ hasText: 'Salvamento automático pausado nesta aba.' })).toBeVisible();
  await expect(segunda.getByRole('button', { name: 'Expandir todas' })).toBeEnabled();
  await segunda.clock.fastForward(120_000);
  await expect(objetivo).toHaveValue('Alteração sintética somente local');
  expect(escritas).toHaveLength(0);
});

test('PA07 segunda aba informa consulta e oferece retomada acessível sem alterar a origem', async ({ context, page }) => {
  await preparar(context); await abrir(page);
  const objetivo = page.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await objetivo.fill('Alteração sintética preservada na origem');

  const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
  await expect(segunda.getByText('A edição está em outra aba. Esta aba está em modo de consulta.')).toBeVisible();
  const retomar = segunda.getByRole('button', { name: 'Editar nesta aba' });
  await expect(retomar).toBeVisible();
  await expect(retomar).toBeEnabled();
  const acessibilidade = await new AxeBuilder({ page: segunda }).include('[data-pa07-aviso]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(acessibilidade.violations).toEqual([]);
  const objetivoSegunda = segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await expect(objetivoSegunda).toBeDisabled();
  await expect(segunda.getByRole('switch', { name: 'Plano alimentar para o paciente: visível para o paciente' })).toBeEnabled();
  await expect(objetivo).toHaveValue('Alteração sintética preservada na origem');

  await retomar.focus();
  await retomar.press('Enter');
  await expect(objetivoSegunda).toBeEditable({ timeout: 15_000 });
  await expect(objetivo).toBeDisabled();
  await expect(objetivoSegunda).toHaveValue('Objetivo sintético salvo');
});

test('PA07 falha ao reconferir mantém edição bloqueada e oferece recarga explícita', async ({ context, page }) => {
  const { definirFalhaLeituraDetalhe } = await preparar(context); await abrir(page);
  await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeEditable();
  const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
  await expect(segunda.getByRole('button', { name: 'Editar nesta aba' })).toBeEnabled();
  definirFalhaLeituraDetalhe(true);

  await segunda.getByRole('button', { name: 'Editar nesta aba' }).press('Enter');
  await expect(segunda.getByRole('alert').filter({ hasText: 'O rascunho precisa ser reconferido' })).toBeVisible({ timeout: 15_000 });
  await expect(segunda.getByRole('button', { name: 'Recarregar rascunho' })).toBeEnabled();
  await expect(segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeDisabled();
  const acessibilidade = await new AxeBuilder({ page: segunda }).include('[data-pa07-aviso]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(acessibilidade.violations).toEqual([]);
  definirFalhaLeituraDetalhe(false);
  await segunda.getByRole('button', { name: 'Recarregar rascunho' }).click();
  await segunda.getByRole('button', { name: 'Descartar e recarregar' }).click();
  const objetivo = segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await expect(objetivo).toHaveValue('Objetivo sintético salvo');
  await expect(objetivo).toBeDisabled();
  await segunda.getByRole('button', { name: 'Editar nesta aba' }).click();
  await expect(objetivo).toBeEditable();
});

test('PA07 plano publicado sem rascunho também permite retomada explícita', async ({ context, page }) => {
  const fixture = await preparar(context); fixture.definirSomentePublicada();
  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`);
  await expect(page.getByRole('button', { name: 'Criar nova versão' })).toBeEnabled({ timeout: 30_000 });
  const segunda = await context.newPage(); await segunda.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`);
  await expect(segunda.getByRole('button', { name: 'Criar nova versão' })).toBeDisabled();
  await segunda.getByRole('button', { name: 'Editar nesta aba' }).click();
  await expect(segunda.getByRole('button', { name: 'Criar nova versão' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Criar nova versão' })).toBeDisabled();
});

test('PA07 retorno com texto antigo exige descarte e nova leitura antes de salvar', async ({ context, page }) => {
  const { escritas } = await preparar(context); await page.clock.install(); await abrir(page);
  const origem = page.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await origem.fill('Texto antigo somente na origem');
  const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
  await segunda.getByRole('button', { name: 'Editar nesta aba' }).click();
  const destino = segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await expect(destino).toBeEditable();
  await destino.fill('Revisão confirmada pela segunda aba');
  await segunda.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(segunda.getByText('Rascunho salvo. Os resultados clínicos continuam pendentes de revisão.')).toBeVisible();
  await page.getByRole('button', { name: 'Editar nesta aba' }).click();
  await expect(page.getByRole('button', { name: 'Recarregar rascunho' })).toBeVisible();
  await expect(origem).toBeDisabled();
  await expect(origem).toHaveValue('Texto antigo somente na origem');
  await page.clock.fastForward(120_000);
  expect(escritas).toHaveLength(1);
  await page.getByRole('button', { name: 'Recarregar rascunho' }).click();
  await page.getByRole('button', { name: 'Descartar e recarregar' }).click();
  await expect(origem).toHaveValue('Revisão confirmada pela segunda aba');
  await expect(origem).toBeDisabled();
  await page.getByRole('button', { name: 'Editar nesta aba' }).click();
  await expect(origem).toBeEditable();
  await origem.fill('Nova revisão deliberada após retorno');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect.poll(() => escritas.length).toBe(2);
  expect(escritas[1].rascunhoRevisaoEsperada).toBe(2);
  expect(escritas[1].documento.objetivos).toBe('Nova revisão deliberada após retorno');
});

test('PA07 transferência drena envio iniciado sem salvar a edição posterior', async ({ context, page }) => {
  const fixture = await preparar(context); await page.clock.install(); await abrir(page);
  const origem = page.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await origem.fill('Primeira edição em envio');
  const pausa = fixture.bloquearProximaEscrita();
  try {
    await page.getByRole('button', { name: 'Salvar rascunho' }).click(); await pausa.iniciou;
    await origem.fill('Segunda edição permanece somente local');
    const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
    await segunda.getByRole('button', { name: 'Editar nesta aba' }).click();
    await expect(segunda.getByText('Aguardando a outra aba liberar a edição deste plano.')).toBeVisible();
    await expect(origem).toBeDisabled();
    await expect(segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeDisabled();
    pausa.liberar();
    await expect(segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeEditable();
    await expect(segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toHaveValue('Primeira edição em envio');
    await expect(origem).toHaveValue('Segunda edição permanece somente local');
    await page.clock.fastForward(120_000);
    expect(fixture.escritas).toHaveLength(1);
  } finally { pausa.liberar(); }
});

test('PA07 aquisição aguarda leitura autorizada sem habilitação otimista', async ({ context, page }) => {
  const fixture = await preparar(context); await abrir(page);
  await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeEditable();
  const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
  const pausa = fixture.bloquearProximaLeitura();
  try {
    await segunda.getByRole('button', { name: 'Editar nesta aba' }).click(); await pausa.iniciou;
    await expect(segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeDisabled();
    pausa.liberar();
    await expect(segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeEditable();
  } finally { pausa.liberar(); }
});

test('PA07 cópia anterior à transferência não reaparece após perder e retomar posse', async ({ context, page }) => {
  const fixture = await preparar(context); fixture.habilitarOrigem(); await abrir(page);
  await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeEditable();
  const quantidadeInicial = await page.getByTestId('refeicao-editor').count();
  const copia = page.getByRole('region', { name: 'Copiar uma refeição salva' });
  await copia.getByLabel('Plano de origem').selectOption('pa07-origem');
  await copia.getByRole('button', { name: 'Carregar refeições' }).click();
  await copia.getByRole('combobox', { name: 'Refeição salva', exact: true }).selectOption('pa07-refeicao-origem');
  const pausa = fixture.bloquearProximaCopia();
  try {
    await copia.getByRole('button', { name: 'Copiar refeição', exact: true }).click(); await pausa.iniciou;
    const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
    await segunda.getByRole('button', { name: 'Editar nesta aba' }).click();
    await expect(segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeEditable();
    await page.getByRole('button', { name: 'Editar nesta aba' }).click();
    await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeEditable();
    pausa.liberar();
    await expect(copia.getByRole('alert')).toContainText('A edição foi transferida');
    await expect(page.getByTestId('refeicao-editor')).toHaveCount(quantidadeInicial);
    expect(fixture.escritas).toHaveLength(0);
  } finally { pausa.liberar(); }
});

test('PA07 fechar a detentora não retoma nem salva automaticamente na segunda aba', async ({ context, page }) => {
  const fixture = await preparar(context); await abrir(page);
  await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeEditable();
  const segunda = await context.newPage(); await segunda.clock.install(); await abrir(segunda);
  await expect(segunda.getByRole('button', { name: 'Editar nesta aba' })).toBeEnabled();
  await page.close();
  const objetivo = segunda.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await segunda.clock.fastForward(120_000);
  await expect(objetivo).toBeDisabled(); expect(fixture.escritas).toHaveLength(0);
  await segunda.getByRole('button', { name: 'Editar nesta aba' }).click();
  await expect(objetivo).toBeEditable();
});

test('PA07 revogação na revalidação de foco bloqueia writers e não perde texto local', async ({ context, page }) => {
  const fixture = await preparar(context); await page.clock.install(); await abrir(page);
  const objetivo = page.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await objetivo.fill('Edição local antes da revogação sintética');
  fixture.revogarAcesso();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(objetivo).toBeDisabled();
  for (const nome of ['Salvar rascunho', 'Revisar', 'Publicar', 'Arquivar', 'Adicionar refeição']) {
    const botoes = await page.getByRole('button', { name: nome, exact: true }).all();
    expect(botoes.length).toBeGreaterThan(0);
    for (const botao of botoes) await expect(botao).toBeDisabled();
  }
  await expect(objetivo).toHaveValue('Edição local antes da revogação sintética');
  await page.clock.fastForward(120_000); expect(fixture.escritas).toHaveLength(0);
  await page.getByRole('button', { name: 'Recarregar rascunho' }).click();
  await page.getByRole('button', { name: 'Descartar e recarregar' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Seu perfil não possui permissão para acessar este conteúdo.' })).toBeVisible();
  await expect(objetivo).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Editar nesta aba' })).toHaveCount(0);
});

test('PA07 evento de restauração persistida começa em consulta sem autosave implícito', async ({ context, page }) => {
  const fixture = await preparar(context); await page.clock.install(); await abrir(page);
  const objetivo = page.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await objetivo.fill('Edição local preservada na restauração');
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.getByRole('button', { name: 'Editar nesta aba' })).toBeEnabled();
  await expect(objetivo).toBeDisabled();
  await expect(objetivo).toHaveValue('Edição local preservada na restauração');
  await page.clock.fastForward(120_000); expect(fixture.escritas).toHaveLength(0);
  await page.getByRole('button', { name: 'Editar nesta aba' }).click();
  await expect(objetivo).toBeEditable();
});

test('PA07 ausência das APIs nativas exibe limitação e conserva leitura autorizada e CAS', async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
    window.BroadcastChannel = undefined;
  });
  const fixture = await preparar(context); await abrir(page);
  await expect(page.getByText('Não foi possível coordenar a edição entre abas. Evite editar este plano simultaneamente em outra aba.')).toBeVisible();
  const objetivo = page.getByRole('textbox', { name: 'Objetivo clínico', exact: true });
  await objetivo.fill('Edição deliberada com CAS e sem coordenação');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect.poll(() => fixture.escritas.length).toBe(1);
  expect(fixture.escritas[0].rascunhoRevisaoEsperada).toBe(1);
});

test('FOOD01 aplica medida explícita, recalcula com base escolhida e salva somente o vínculo mínimo', async ({ context, page }) => {
  test.setTimeout(60_000);
  const fixture = await preparar(context);
  const foodId = '7a1bb690-b95b-4c9f-b179-06fa8e8d5030';
  const measureId = '45c4bc05-7e40-4807-9b75-df8c2e97a70c';
  const secondMeasureId = '2a3a78be-37b2-451b-9cf1-c5b17d492c4c';
  let pesoReferenciaAtual = 25;
  const medidas = [];
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/alimentos`, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      itens: [{ id: foodId, codigoOrigem: 'SINT-FOOD-1', nome: 'Aveia sintética', nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 10, gordurasG: 10 }, disponivelParaCalculo: true, fonte: { codigo: 'SINTETICA', nome: 'Fonte sintética', versao: '1' } }],
      fontes: [{ codigo: 'SINTETICA', nome: 'Fonte sintética', versao: '1' }], total: 1, pagina: 1, limite: 50
    })
  }));
  await page.route(url => url.pathname === `/api/planos-alimentares/alimentos/${foodId}/medidas-caseiras`, async route => {
    if (route.request().method() === 'GET') {
      medidas[0] = { id: measureId, alimentoComposicaoId: foodId, nome: 'Colher sintética', quantidadeReferencia: 1, pesoReferenciaGramas: pesoReferenciaAtual, escopo: 'pessoal', revisao: 1, ativa: true, podeEditar: true };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: medidas.filter(item => item.ativa), total: medidas.filter(item => item.ativa).length, pagina: 1, limite: 25 }) });
      return;
    }
    const corpo = route.request().postDataJSON();
    const criada = { id: secondMeasureId, alimentoComposicaoId: foodId, nome: corpo.nome, quantidadeReferencia: corpo.quantidadeReferencia, pesoReferenciaGramas: corpo.pesoReferenciaGramas, escopo: corpo.escopo, revisao: 1, ativa: true, podeEditar: true };
    medidas.push(criada);
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(criada) });
  });
  await page.route(url => url.pathname.startsWith(`/api/planos-alimentares/alimentos/${foodId}/medidas-caseiras/`), async route => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    const indice = medidas.findIndex(item => item.id === id);
    const corpo = route.request().postDataJSON();
    medidas[indice] = { ...medidas[indice], ...corpo, revisao: medidas[indice].revisao + 1, ativa: corpo.ativa === false ? false : medidas[indice].ativa };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(medidas[indice]) });
  });
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await page.getByRole('button', { name: 'Adicionar alimento', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar no catálogo' }).last().fill('Aveia');
  const resultado = page.getByRole('button', { name: /^Aveia sintética/ });
  await expect(resultado).toBeVisible();
  await resultado.click();
  const painelMedidas = page.locator('section[aria-label="Medidas caseiras do alimento"]').last();
  await painelMedidas.getByRole('button', { name: 'Escolher medida' }).press('Enter');
  await painelMedidas.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(painelMedidas).toContainText('Aplicada: Colher sintética');
  await painelMedidas.getByLabel('Nome da medida').fill('Copo sintético');
  await painelMedidas.getByLabel('Quantidade de referência').fill('2');
  await painelMedidas.getByLabel('Peso de referência (g)').fill('100');
  await painelMedidas.getByRole('button', { name: 'Salvar na biblioteca' }).click();
  const linhaCopo = painelMedidas.getByRole('listitem').filter({ hasText: 'Copo sintético' });
  await expect(linhaCopo).toBeVisible();
  await linhaCopo.getByRole('button', { name: 'Editar' }).click();
  await painelMedidas.getByLabel('Nome da medida').fill('Copo revisado');
  await painelMedidas.getByRole('button', { name: 'Salvar edição' }).click();
  await expect(painelMedidas.getByText('Biblioteca atualizada.', { exact: false })).toBeVisible();
  const linhaRevisada = painelMedidas.getByRole('listitem').filter({ hasText: 'Copo revisado' });
  page.once('dialog', dialog => dialog.accept());
  await linhaRevisada.getByRole('button', { name: 'Desativar' }).click();
  await expect(linhaRevisada).toHaveCount(0);
  const quantidade = page.getByRole('textbox', { name: 'Quantidade' }).nth(1);
  const gramas = page.getByRole('textbox', { name: 'Porcao (g)' }).nth(1);
  await expect(gramas).toHaveValue('25');
  await quantidade.fill('2,5');
  await expect(quantidade).toHaveValue('2,5');
  await expect(gramas).toHaveValue('62.5');
  const acessibilidade = await new AxeBuilder({ page }).include('section[aria-label="Medidas caseiras do alimento"]').analyze();
  expect(acessibilidade.violations).toEqual([]);
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect.poll(() => fixture.escritas.length).toBe(1);
  const salvo = fixture.escritas[0].documento.refeicoes[0].itens[1];
  expect(salvo.quantidade).toBe('2,5');
  expect(salvo.unidade).toBe('Colher sintética');
  expect(salvo.porcaoGramas).toBe(62.5);
  expect(salvo.medidaCaseira).toMatchObject({ id: measureId, revisao: 1 });
  expect(salvo.medidaCaseira.aplicacaoId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(salvo).not.toHaveProperty('referenciaMedidaCaseira');
  expect(salvo).not.toHaveProperty('medidasCaseirasAplicadas');
  pesoReferenciaAtual = 50;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await expect(page.getByRole('textbox', { name: 'Quantidade' }).nth(1)).toHaveValue('2,5');
  await expect(page.getByRole('textbox', { name: 'Porcao (g)' }).nth(1)).toHaveValue('62.5');
  await page.getByRole('textbox', { name: 'Quantidade' }).nth(1).fill('3');
  await expect(page.getByRole('textbox', { name: 'Porcao (g)' }).nth(1)).toHaveValue('75');
  await page.getByRole('textbox', { name: 'Quantidade' }).nth(1).fill('');
  await expect(page.getByRole('textbox', { name: 'Porcao (g)' }).nth(1)).toHaveValue('');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect.poll(() => fixture.escritas.length).toBe(2);
  expect(fixture.escritas[1].documento.refeicoes[0].itens[1].medidaCaseira.aplicacaoId).toBe(salvo.medidaCaseira.aplicacaoId);
  await page.getByRole('textbox', { name: 'Quantidade' }).nth(1).fill('3');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect.poll(() => fixture.escritas.length).toBe(3);
  fixture.omitirReferenciasMedidas();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await expect(page.getByText('A referência desta medida não está disponível.', { exact: false })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Porcao (g)' }).nth(1)).toHaveValue('75');
  await page.getByRole('textbox', { name: 'Quantidade' }).nth(1).fill('4');
  await expect(page.getByRole('textbox', { name: 'Porcao (g)' }).nth(1)).toHaveValue('');
  await page.getByRole('textbox', { name: 'Porcao (g)' }).nth(1).fill('80');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect.poll(() => fixture.escritas.length).toBe(4);
  expect(fixture.escritas[3].documento.refeicoes[0].itens[1].medidaCaseira).toBeNull();
});

async function abrirBibliotecaFood01(context, page, responderBiblioteca) {
  const fixture = await preparar(context);
  const alimentoId = '7a1bb690-b95b-4c9f-b179-06fa8e8d5030';
  await context.route(url => url.pathname.endsWith('/planos-alimentares/alimentos'), route => route.fulfill({
    json: { itens: [{ id: alimentoId, nome: 'Aveia sintética', nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 10, gordurasG: 10 }, disponivelParaCalculo: true }], fontes: [], total: 1, pagina: 1, limite: 50 }
  }));
  await context.route(url => url.pathname.includes(`/alimentos/${alimentoId}/medidas-caseiras`), responderBiblioteca);
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await page.getByRole('button', { name: 'Adicionar alimento', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar no catálogo' }).last().fill('Aveia');
  await page.getByRole('button', { name: /^Aveia sintética/ }).click();
  await page.getByRole('button', { name: 'Escolher medida' }).last().click();
  const painel = page.getByRole('region', { name: 'Medidas caseiras do alimento' }).last();
  await expect(painel.getByRole('status').filter({ hasText: 'Carregando' })).toHaveCount(0);
  return { ...fixture, painel };
}

test('FOOD01 autosave do plano preserva cadastro de medida ainda não enviado', async ({ context, page }) => {
  await page.clock.install();
  const { painel, escritas } = await abrirBibliotecaFood01(context, page, route => route.fulfill({ json: { itens: [], total: 0, pagina: 1, limite: 25 } }));
  await painel.getByLabel('Nome da medida').fill('Xícara ainda em edição');
  await page.getByRole('textbox', { name: 'Objetivo clínico', exact: true }).fill('Objetivo sintético alterado');
  await page.clock.fastForward(60_000);
  await expect.poll(() => escritas.length).toBe(1);
  await expect(painel.getByLabel('Nome da medida')).toHaveValue('Xícara ainda em edição');
});

test('FOOD01 pagina escopos, atualiza conflito sem retry e cria com escopo pessoal por padrão', async ({ context, page }) => {
  let revisao = 1, patches = 0, criada = false;
  const pausaPatch = pausaControlada();
  const alimentoComposicaoId = '7a1bb690-b95b-4c9f-b179-06fa8e8d5030';
  const medida = { id: '45c4bc05-7e40-4807-9b75-df8c2e97a70c', alimentoComposicaoId, nome: 'Colher própria', quantidadeReferencia: 1, pesoReferenciaGramas: 25, escopo: 'pessoal', revisao: 1, ativa: true, podeEditar: true };
  const compartilhada = { ...medida, id: '2a3a78be-37b2-451b-9cf1-c5b17d492c4c', nome: 'Copo da clínica', escopo: 'clinica', podeEditar: false };
  const { painel } = await abrirBibliotecaFood01(context, page, async route => {
    if (route.request().method() === 'PATCH') {
      patches++; revisao++;
      await pausaPatch.aguardar();
      await route.fulfill({ status: 409, json: { message: 'Revisão sintética divergente' } });
    } else if (route.request().method() === 'POST') {
      const entrada = route.request().postDataJSON();
      expect(entrada.escopo).toBe('pessoal');
      expect(entrada.chaveIdempotencia).toMatch(/^[0-9a-f-]{36}$/i);
      criada = true;
      await route.fulfill({ status: 201, json: { ...medida, nome: entrada.nome } });
    } else {
      const pagina = Number(new URL(route.request().url()).searchParams.get('pagina'));
      await route.fulfill({ json: { itens: pagina === 1 ? [compartilhada, ...(criada ? [{ ...medida, nome: 'Xícara criada' }] : [])] : [{ ...medida, revisao }], total: 26, pagina, limite: 25 } });
    }
  });
  const linhaClinica = painel.getByRole('listitem').filter({ hasText: 'Copo da clínica' });
  await expect(linhaClinica).toContainText('Clínica');
  await expect(linhaClinica.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  await painel.getByRole('button', { name: 'Próxima' }).click();
  await expect(painel.getByText('Página 2 de 2')).toBeVisible();
  await painel.getByRole('button', { name: 'Editar', exact: true }).click();
  await painel.getByLabel('Nome da medida').fill('Alteração stale');
  await painel.getByRole('button', { name: 'Salvar edição' }).click();
  try {
    await pausaPatch.iniciou;
    await expect(painel.getByRole('button', { name: 'Editar', exact: true })).toBeDisabled();
  } finally { pausaPatch.liberar(); }
  await expect(painel.getByText('A medida foi alterada em outra operação.', { exact: false })).toBeVisible();
  await expect(painel.getByLabel('Nome da medida')).toHaveValue('');
  expect(patches).toBe(1);
  await painel.getByLabel('Nome da medida').fill('Xícara criada');
  await painel.getByLabel('Peso de referência (g)').fill('30');
  await painel.getByRole('button', { name: 'Salvar na biblioteca' }).click();
  await expect(painel.getByText('Página 1 de 2')).toBeVisible();
  await expect(painel.getByRole('listitem').filter({ hasText: 'Xícara criada' })).toBeVisible();
  expect(patches).toBe(1);
});

test('FOOD01 resposta tardia da biblioteca não reaparece ao converter o alimento em manual', async ({ context, page }) => {
  const pausa = pausaControlada();
  let fixture;
  const abertura = abrirBibliotecaFood01(context, page, async route => {
    await pausa.aguardar();
    await route.fulfill({ json: { itens: [], total: 0, pagina: 1, limite: 25 } });
  });
  try {
    await pausa.iniciou;
    await page.getByRole('button', { name: 'Transformar em item manual' }).last().click();
  } finally { pausa.liberar(); }
  fixture = await abertura;
  await expect(page.getByRole('region', { name: 'Medidas caseiras do alimento' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect.poll(() => fixture.escritas.length).toBe(1);
  expect(fixture.escritas[0].documento.refeicoes[0].itens[1].medidaCaseira).toBeNull();
  expect(fixture.escritas[0].documento.refeicoes[0].itens[1]).not.toHaveProperty('alimentoComposicaoId');
});

async function abrirBibliotecaFood02(context, page, aoLerDetalhe) {
  const fixture = await preparar(context);
  const alimento = { id: '00000000-0000-4000-8000-000000000031', nome: 'Composição sintética FOOD02', escopo: 'pessoal', revisao: 1, ativo: true,
    baseOrigem: { tipo: 'por100g', pesoGramas: 100 }, nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 10, gordurasG: 2 },
    micronutrientesPor100g: {}, composicaoOrigem: { nutrientes: { energiaKcal: 100, proteinasG: 10, carboidratosG: 10, gordurasG: 2 }, micronutrientes: {} },
    disponivelParaCalculo: true, podeEditar: true };
  await page.route(url => url.pathname === '/api/planos-alimentares/alimentos-personalizados', route => route.fulfill({ json: { itens: [alimento], total: 1, pagina: 1, limite: 25 } }));
  await page.route(url => url.pathname === `/api/planos-alimentares/alimentos-personalizados/${alimento.id}`, async route => {
    await aoLerDetalhe();
    await route.fulfill({ json: alimento });
  });
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await page.getByRole('button', { name: 'Adicionar alimento', exact: true }).click();
  const indice = await page.getByLabel('Porcao (g)', { exact: true }).count() - 1;
  const painel = page.getByRole('region', { name: 'Biblioteca de alimentos personalizados' }).nth(indice);
  await painel.getByRole('button', { name: 'Abrir biblioteca' }).click();
  await expect(painel.getByRole('button', { name: 'Aplicar revisão' })).toBeVisible();
  return { ...fixture, painel, indice };
}

test('FOOD02 detalhe tardio preserva porções e outros itens editados durante a leitura', async ({ context, page }) => {
  const pausa = pausaControlada();
  const { painel, indice } = await abrirBibliotecaFood02(context, page, pausa.aguardar);
  await painel.getByRole('button', { name: 'Aplicar revisão' }).click();
  try {
    await pausa.iniciou;
    await page.getByLabel('Porcao (g)', { exact: true }).nth(indice).fill('42');
    await page.getByLabel('Porcao (g)', { exact: true }).nth(0).fill('21');
    await page.getByRole('button', { name: 'Adicionar alimento', exact: true }).click();
  } finally { pausa.liberar(); }
  await expect(painel.getByRole('status').filter({ hasText: 'aplicado ao item' })).toBeVisible();
  await expect(page.getByLabel('Porcao (g)', { exact: true }).nth(indice)).toHaveValue('42');
  await expect(page.getByLabel('Porcao (g)', { exact: true }).nth(0)).toHaveValue('21');
  await expect(page.getByLabel('Porcao (g)', { exact: true })).toHaveCount(indice + 2);
});

test('FOOD02 detalhe anterior não substitui catálogo escolhido enquanto a leitura estava em voo', async ({ context, page }) => {
  const pausa = pausaControlada();
  const { painel, indice } = await abrirBibliotecaFood02(context, page, pausa.aguardar);
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/alimentos`, route => route.fulfill({ json: {
    itens: [{ id: '00000000-0000-4000-8000-000000000032', nome: 'Catálogo escolhido depois', nutrientesPor100g: { energiaKcal: 90, proteinasG: 3, carboidratosG: 4, gordurasG: 5 }, disponivelParaCalculo: true }], fontes: [], total: 1, pagina: 1, limite: 50
  } }));
  await painel.getByRole('button', { name: 'Aplicar revisão' }).click();
  try {
    await pausa.iniciou;
    await page.getByRole('textbox', { name: 'Buscar no catálogo', exact: true }).nth(indice).fill('Catálogo');
    await page.getByRole('button', { name: 'Catálogo escolhido depois Catálogo nutricional' }).click();
  } finally { pausa.liberar(); }
  await expect(page.getByRole('textbox', { name: 'Alimento', exact: true }).nth(indice)).toHaveValue('Catálogo escolhido depois');
  await expect(painel.getByRole('status').filter({ hasText: 'aplicado ao item' })).toHaveCount(0);
});

test('FOOD02 resposta pendente é invalidada ao perder e retomar posse na mesma aba', async ({ context, page }) => {
  const pausa = pausaControlada();
  const { painel, indice } = await abrirBibliotecaFood02(context, page, pausa.aguardar);
  await painel.getByRole('button', { name: 'Aplicar revisão' }).click();
  const porcao = page.getByLabel('Porcao (g)', { exact: true }).nth(indice);
  try {
    await pausa.iniciou;
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await expect(porcao).toBeDisabled();
    await page.getByRole('button', { name: 'Editar nesta aba' }).click();
    await expect(porcao).toBeEditable();
  } finally { pausa.liberar(); }
  await expect(porcao).toHaveValue('100');
  await expect(painel.getByRole('status').filter({ hasText: 'aplicado ao item' })).toHaveCount(0);
});

test('FOOD02 criação incerta mantém campos bloqueados e repete exatamente pedido e chave', async ({ context, page }) => {
  const { painel } = await abrirBibliotecaFood02(context, page, async () => {});
  const pausa = pausaControlada();
  const pedidos = [];
  await page.route(url => url.pathname === '/api/planos-alimentares/alimentos-personalizados', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    pedidos.push(route.request().postDataJSON());
    if (pedidos.length === 1) { await pausa.aguardar(); return route.abort('failed'); }
    return route.fulfill({ status: 201, json: { id: '00000000-0000-4000-8000-000000000033' } });
  });
  await painel.getByRole('button', { name: 'Cadastrar alimento' }).click();
  const nome = painel.getByLabel('Nome', { exact: true });
  await nome.fill('Cadastro sintético com resposta incerta');
  await painel.getByRole('button', { name: 'Salvar na biblioteca', exact: true }).click();
  try {
    await pausa.iniciou;
    await expect(nome).toBeDisabled();
    await expect(painel.getByRole('button', { name: 'Cadastrar alimento' })).toBeDisabled();
  }
  finally { pausa.liberar(); }
  await expect(painel.getByRole('alert').filter({ hasText: 'O servidor pode ter salvo este alimento' })).toBeVisible();
  await expect(nome).toBeDisabled();
  await expect(painel.getByRole('button', { name: 'Cadastrar alimento' })).toBeDisabled();
  await painel.getByRole('button', { name: 'Repetir cadastro', exact: true }).click();
  await expect.poll(() => pedidos.length).toBe(2);
  expect(pedidos[1]).toEqual(pedidos[0]);
  await expect(painel.getByText('Biblioteca salva.', { exact: false })).toBeVisible();
});
