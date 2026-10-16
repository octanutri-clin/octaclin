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
      detalhe = { ...detalhe, draft: { ...detalhe.draft, rascunhoRevisao: body.rascunhoRevisaoEsperada + 1, documentoEdicao: body.documento, edicaoEstado: 'pendente' } };
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
    definirSomentePublicada: () => { detalhe = { ...detalhe, current: { ...detalhe.draft, status: 'publicada', publicadaEm: instante }, draft: undefined }; }
  };
}
async function abrir(page) {
  await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeVisible({ timeout: 30_000 });
}

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
