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
    configurarEquivalenciaSintetica() {
      const refeicaoId = 'pa07-refeicao-food05';
      const principalId = 'pa07-principal-food05';
      const alternativaId = 'pa07-alternativa-food05';
      const principais = { energiaKcal: 100, proteinasG: 5, carboidratosG: 10, gordurasG: 2 };
      const alternativas = { energiaKcal: 200, proteinasG: 10, carboidratosG: 20, gordurasG: 4 };
      const documentoEdicao = {
        schemaVersao: 1,
        refeicoes: [{ chaveCliente: refeicaoId, nome: 'Lanche sintético', horarioLocal: '10:00', orientacoes: '', itens: [{
          chaveCliente: principalId, alimentoComposicaoId: 'pa07-alimento-principal', descricao: 'Iogurte sintético', quantidade: 1, unidade: 'porção', porcaoGramas: 100,
          nutrientesPor100g: principais, substituicoes: [{ chaveCliente: alternativaId, alimentoComposicaoId: 'pa07-alimento-alternativo', descricao: 'Queijo sintético', quantidade: 1, unidade: 'porção', porcaoGramas: 80,
            nutrientesPor100g: alternativas, liberadaParaPaciente: false, preferida: false }]
        }]}]
      };
      const refeicao = { id: refeicaoId, ordem: 0, nome: 'Lanche sintético', horarioLocal: '10:00', orientacoes: '', itens: [{
        id: principalId, ordem: 0, alimentoComposicaoId: 'pa07-alimento-principal', descricao: 'Iogurte sintético', quantidade: 1, unidade: 'porção', porcaoGramas: 100,
        composicaoSnapshot: { descricao: 'Iogurte sintético', nutrientesPor100g: principais, fonte: { codigo: 'SINTETICA', versao: '1' } },
        substituicoes: [{ id: alternativaId, ordem: 0, alimentoComposicaoId: 'pa07-alimento-alternativo', descricao: 'Queijo sintético', quantidade: 1, unidade: 'porção', porcaoGramas: 80,
          composicaoSnapshot: { descricao: 'Queijo sintético', nutrientesPor100g: alternativas, fonte: { codigo: 'SINTETICA', versao: '1' } }, liberadaParaPaciente: false, preferida: false }]
      }] };
      detalhe = { ...detalhe, draft: { ...detalhe.draft, edicaoEstado: 'materializada', documentoEdicao, refeicoes: [refeicao],
        ativacaoEdicao: [{ chaveCliente: refeicaoId, identidadeId: 'pa07-identidade-sintetica', ativa: true }],
        calculo: { metaEnergeticaKcal: 2000, metasMacronutrientes: { carboidratosG: 250, proteinasG: 100, gordurasG: 66 }, metasAtivas: true }
      } };
    },
    marcarEquivalenciaPendente(estado = 'revisao_pendente') {
      const aplicacaoId = '10000000-0000-4000-8000-000000000159';
      const alternativaId = 'pa07-alternativa-food05';
      const documentoEdicao = structuredClone(detalhe.draft.documentoEdicao);
      documentoEdicao.refeicoes[0].itens[0].substituicoes[0].equivalencia = { aplicacaoId };
      detalhe = { ...detalhe, draft: { ...detalhe.draft, documentoEdicao, equivalenciasEstado: 'disponivel', equivalenciasAplicadas: {
        [alternativaId]: { aplicacaoId, estado, algoritmo: 'equivalencia-nutriente-v1', nutriente: 'energiaKcal', politica: { passoPorcaoGramas: '1' },
          porcaoPrincipalGramas: '100', porcaoEfetivaGramas: '80', fingerprintResolucao: 'b'.repeat(64),
          principal: { descricao: 'Iogurte sintético', baseGramas: '100', nutrientes: { energiaKcal: '100' }, fonte: { codigo: 'SINTETICA', versao: '1' } },
          alternativa: { descricao: 'Queijo sintético', baseGramas: '100', nutrientes: { energiaKcal: '200' }, fonte: { codigo: 'SINTETICA', versao: '1' } },
          resultado: { nutrienteAlvo: '100', obtido: '160', delta: '60', deltaPercentual: '60' } }
      } } };
    },
    definirFalhaLeituraDetalhe: (falhar) => { falharLeituraDetalhe = falhar; },
    revogarAcesso: () => { codigoFalhaDetalhe = 403; falharLeituraDetalhe = true; },
    bloquearProximaEscrita: () => (pausaEscrita = pausaControlada()),
    bloquearProximaLeitura: () => (pausaLeitura = pausaControlada()),
    habilitarOrigem: () => { incluirOrigem = true; },
    marcarOrigemComEquivalencia: () => {
      origem.current.refeicoes = [{ id: 'pa07-refeicao-origem', ordem: 0, nome: 'Refeição com equivalência sintética', itens: [{
        id: 'pa07-item-origem', ordem: 0, descricao: 'Alimento principal sintético', quantidade: 1, unidade: 'porção', porcaoGramas: 100,
        composicaoSnapshot: { descricao: 'Alimento principal sintético', nutrientesPor100g: { energiaKcal: 100, proteinasG: 5, carboidratosG: 10, gordurasG: 2 } },
        substituicoes: [{ id: 'pa07-alternativa-origem', ordem: 0, descricao: 'Alternativa FOOD05 sintética', quantidade: 1, unidade: 'porção', porcaoGramas: 50,
          equivalenciaAplicada: true, composicaoSnapshot: { descricao: 'Alternativa FOOD05 sintética', nutrientesPor100g: { energiaKcal: 200, proteinasG: 10, carboidratosG: 20, gordurasG: 4 } }, liberadaParaPaciente: false, preferida: false }]
      }] }];
    },
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

test('PA07 bloqueia cópia de refeição calculada FOOD05 para não descartar sua proveniência', async ({ context, page }) => {
  const fixture = await preparar(context); fixture.habilitarOrigem(); fixture.marcarOrigemComEquivalencia(); await abrir(page);
  const quantidadeInicial = await page.getByTestId('refeicao-editor').count();
  const copia = page.getByRole('region', { name: 'Copiar uma refeição salva' });
  await copia.getByLabel('Plano de origem').selectOption('pa07-origem');
  await copia.getByRole('button', { name: 'Carregar refeições' }).click();
  await copia.getByRole('combobox', { name: 'Refeição salva', exact: true }).selectOption('pa07-refeicao-origem');
  await copia.getByRole('button', { name: 'Copiar refeição', exact: true }).click();
  await expect(copia.getByRole('alert')).toContainText('A cópia está bloqueada até preservar a proveniência do cálculo.');
  await expect(page.getByTestId('refeicao-editor')).toHaveCount(quantidadeInicial);
  expect(fixture.escritas).toHaveLength(0);
});

test('FOOD05 apresenta comparação calculada no servidor e confirma somente alternativa selecionada', async ({ context, page }) => {
  const { escritas, configurarEquivalenciaSintetica } = await preparar(context);
  configurarEquivalenciaSintetica();
  let corpoPrevia; let quantidadePrevias = 0;
  const pausaSegundaPrevia = pausaControlada();
  await page.route(url => url.pathname === '/api/profissionais/me/preferencias-equivalencia', route => route.fulfill({ json: {
    preferencias: { schemaVersao: 1, unidades: 'gramas_e_medida_disponivel', casasGramas: 3, casasNutrientes: 2, passoPorcaoGramas: '1', modoComparacao: 'detalhado' }, revisao: 1
  } }));
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}/equivalencias/previa`, async route => {
    corpoPrevia = route.request().postDataJSON();
    quantidadePrevias += 1;
    if (quantidadePrevias === 2) await pausaSegundaPrevia.aguardar();
    const alternativa = corpoPrevia.alternativas[0];
    await route.fulfill({ json: {
      fingerprint: 'a'.repeat(64), rascunhoRevisao: 1, nutriente: 'energiaKcal',
      principal: { descricao: 'Iogurte sintético', baseGramas: '100', nutrientes: { energiaKcal: '100', proteinasG: '5', carboidratosG: '10', gordurasG: '2' }, fonte: { codigo: 'SINTETICA', versao: '1' } },
      alternativas: [{ chaveCliente: alternativa.chaveCliente, alimento: { descricao: 'Queijo sintético', preparacao: 'não informada', baseGramas: '100', nutrientes: { energiaKcal: '200', proteinasG: '10', carboidratosG: '20', gordurasG: '4' }, fonte: { codigo: 'SINTETICA', versao: '1' } },
        fingerprint: 'b'.repeat(64), resultado: { estado: 'calculavel', nutriente: 'energiaKcal', aplicavel: true, motivosAplicacao: [], porcaoMatematica: { numerador: '50', denominador: '1' }, porcaoMatematicaGramas: '50', porcaoMatematicaAproximada: false, porcaoSugeridaGramas: '50', porcaoEfetivaGramas: '50', nutrienteAlvo: '100', obtido: '100', delta: '0', diferencaAbsoluta: '0', deltaPercentual: '0', nutrientesPorcao: { energiaKcal: '100', proteinasG: '5', carboidratosG: '10', gordurasG: '2' }, avisos: [] },
        impacto: { estado: 'completo', antes: { energiaKcal: '100', proteinasG: '5', carboidratosG: '10', gordurasG: '2' }, depois: { energiaKcal: '100', proteinasG: '5', carboidratosG: '10', gordurasG: '2' }, diferencas: { energiaKcal: '0', proteinasG: '0', carboidratosG: '0', gordurasG: '0' } }, comparacaoIndividual: { estado: 'completo', antes: { energiaKcal: '100', proteinasG: '5', carboidratosG: '10', gordurasG: '2' }, depois: { energiaKcal: '100', proteinasG: '5', carboidratosG: '10', gordurasG: '2' }, diferencas: { energiaKcal: '0', proteinasG: '0', carboidratosG: '0', gordurasG: '0' } },
        medidas: { itens: [{ id: '10000000-0000-4000-8000-000000000051', revisao: 1, nome: 'xícara sintética', quantidade: '0.5', aproximada: false, podeAplicarQuantidade: true, gramasAposMedida: '50', quantidadeReferencia: 1, pesoReferenciaGramas: 100 }], total: 1, pagina: 1, limite: 25 }
      }]
    } });
  });
  await page.clock.install();
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  const painel = page.getByRole('region', { name: 'Equivalência por nutriente para Iogurte sintético' });
  await painel.getByRole('button', { name: 'Equivalência por nutriente' }).click();
  await page.getByRole('button', { name: 'Calcular alternativas' }).click();
  await expect(page.getByText('Alvo calculado: Energia. Cada alternativa representa um cenário independente da refeição.')).toBeVisible();
  expect(corpoPrevia.alternativas[0]).not.toHaveProperty('porcaoGramas');
  const acessibilidade = await new AxeBuilder({ page }).include('[aria-label="Equivalência por nutriente para Iogurte sintético"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(acessibilidade.violations).toEqual([]);
  await page.getByRole('checkbox', { name: 'Selecionar Queijo sintético' }).check();
  const medida = painel.getByLabel('Medida caseira');
  try {
    await medida.selectOption({ label: '0.5 xícara sintética (50,000 g)' });
    await expect(page.getByRole('button', { name: 'Aplicar selecionadas' })).toBeDisabled();
    await pausaSegundaPrevia.iniciou;
  } finally { pausaSegundaPrevia.liberar(); }
  await expect.poll(() => quantidadePrevias).toBe(2);
  expect(corpoPrevia.alternativas[0].medidaCaseira).toMatchObject({ id: '10000000-0000-4000-8000-000000000051', revisao: 1 });
  expect(corpoPrevia.alternativas[0].porcaoGramas).toBeUndefined();
  await page.getByRole('button', { name: 'Aplicar selecionadas' }).click();
  await page.clock.fastForward(60_000);
  await expect.poll(() => escritas.length).toBe(1);
  const alternativaAplicada = escritas[0].documento.refeicoes[0].itens[0].substituicoes[0];
  expect(alternativaAplicada.porcaoGramas).toBe('50');
  expect(alternativaAplicada.medidaCaseira).toMatchObject({ id: '10000000-0000-4000-8000-000000000051', revisao: 1 });
  expect(alternativaAplicada.quantidade).toBe('0.5');
  expect(alternativaAplicada.unidade).toBe('xícara sintética');
  expect(alternativaAplicada.equivalencia).toMatchObject({ acao: 'calcular', nutriente: 'energiaKcal', porcaoEfetiva: '50' });
  expect(alternativaAplicada.liberadaParaPaciente).toBe(false);
  expect(alternativaAplicada.preferida).toBe(false);
});

test('FOOD05 impede salvar modelo quando isso descartaria a proveniência da equivalência', async ({ context, page }) => {
  const fixture = await preparar(context);
  fixture.configurarEquivalenciaSintetica();
  fixture.marcarEquivalenciaPendente('calculada_revisada');
  const chamadasModelo = [];
  await page.route(url => url.pathname === '/api/planos-alimentares/modelos', async route => {
    if (route.request().method() === 'POST') chamadasModelo.push(route.request().postDataJSON());
    await route.fulfill({ json: { itens: [], total: 0, pagina: 1, limite: 100 } });
  });
  await abrir(page);
  await page.getByRole('textbox', { name: 'Nome do novo modelo' }).fill('Modelo sintético');
  await page.getByRole('button', { name: 'Salvar modelo' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Plano alimentar' }).getByRole('alert')).toContainText('Salvar ou copiar como modelo ficará disponível quando o modelo preservar a proveniência do cálculo.');
  expect(chamadasModelo).toHaveLength(0);
  expect(fixture.escritas).toHaveLength(0);
});

test('FOOD05 expõe recálculo pendente com contexto preservado e confirmação explícita', async ({ context, page }) => {
  const fixture = await preparar(context);
  fixture.configurarEquivalenciaSintetica();
  fixture.marcarEquivalenciaPendente();
  let pedido;
  await page.route(url => url.pathname === '/api/profissionais/me/preferencias-equivalencia', route => route.fulfill({ json: {
    preferencias: { schemaVersao: 1, unidades: 'gramas', casasGramas: 2, casasNutrientes: 2, passoPorcaoGramas: '1', modoComparacao: 'detalhado' }, revisao: 1
  } }));
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}/equivalencias/previa`, async route => {
    pedido = route.request().postDataJSON();
    const alternativa = pedido.alternativas[0];
    await route.fulfill({ json: {
      fingerprint: 'f'.repeat(64), rascunhoRevisao: 1, nutriente: 'energiaKcal',
      principal: { descricao: 'Iogurte sintético', baseGramas: '100', nutrientes: { energiaKcal: '100' }, fonte: { codigo: 'SINTETICA', versao: '1' } },
      alternativas: [{ chaveCliente: alternativa.chaveCliente, alimento: { descricao: 'Queijo sintético', baseGramas: '100', nutrientes: { energiaKcal: '200' }, fonte: { codigo: 'SINTETICA', versao: '1' } }, fingerprint: 'a'.repeat(64), resultado: {
        estado: 'calculavel', nutriente: 'energiaKcal', aplicavel: true, motivosAplicacao: [], porcaoMatematica: { numerador: '50', denominador: '1' }, porcaoMatematicaGramas: '50', porcaoMatematicaAproximada: false,
        porcaoSugeridaGramas: '50', porcaoEfetivaGramas: '50', nutrienteAlvo: '100', obtido: '100', delta: '0', diferencaAbsoluta: '0', deltaPercentual: '0', nutrientesPorcao: { energiaKcal: '100' }, avisos: []
      } }]
    } });
  });
  await page.clock.install();
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Equivalência — revisão pendente' })).toBeVisible();
  await page.getByText('Detalhes do cálculo salvo').click();
  await expect(page.getByText(/Principal: Iogurte sintético/)).toBeVisible();
  await expect(page.getByText(/Alvo \/ obtido \/ diferença: 100 \/ 160 \/ 60 kcal/)).toBeVisible();
  await page.getByRole('button', { name: 'Recalcular equivalência' }).click();
  const painel = page.getByRole('region', { name: 'Equivalência por nutriente para Iogurte sintético' });
  await expect(painel.getByLabel('Nutriente-alvo')).toHaveValue('energiaKcal');
  await painel.getByRole('button', { name: 'Calcular alternativas' }).click();
  await expect.poll(() => pedido).toBeTruthy();
  expect(pedido.nutriente).toBe('energiaKcal');
  await expect(painel.getByRole('checkbox', { name: 'Selecionar Queijo sintético' })).toBeChecked();
  await painel.getByRole('button', { name: 'Confirmar recálculo' }).click();
  await page.clock.fastForward(60_000);
  await expect.poll(() => fixture.escritas.length).toBe(1);
  expect(fixture.escritas[0].documento.refeicoes[0].itens[0].substituicoes[0].equivalencia).toMatchObject({
    acao: 'recalcular', anteriorAplicacaoId: '10000000-0000-4000-8000-000000000159', nutriente: 'energiaKcal', porcaoEfetiva: '50'
  });
});

test('FOOD05 desvincula somente após confirmação e preserva a porção salva', async ({ context, page }) => {
  const fixture = await preparar(context);
  fixture.configurarEquivalenciaSintetica();
  fixture.marcarEquivalenciaPendente('calculada_revisada');
  await page.clock.install();
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'porção confirmada 80 g' })).toBeVisible();
  await page.getByRole('button', { name: 'Desvincular equivalência' }).click();
  const modal = page.getByRole('dialog', { name: 'Desvincular equivalência' });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).toHaveCount(0);
  expect(fixture.escritas).toHaveLength(0);
  await page.getByRole('button', { name: 'Desvincular equivalência' }).click();
  await page.getByRole('dialog', { name: 'Desvincular equivalência' }).getByRole('button', { name: 'Desvincular cálculo' }).click();
  await page.clock.fastForward(60_000);
  await expect.poll(() => fixture.escritas.length).toBe(1);
  const alternativa = fixture.escritas[0].documento.refeicoes[0].itens[0].substituicoes[0];
  expect(alternativa.porcaoGramas).toBe(80);
  expect(alternativa.equivalencia).toMatchObject({
    acao: 'desvincular', anteriorAplicacaoId: '10000000-0000-4000-8000-000000000159', fingerprintEsperado: 'b'.repeat(64)
  });
});

test('FOOD05 salva preferências pessoais sem alterar o rascunho do plano', async ({ context, page }) => {
  const fixture = await preparar(context);
  fixture.configurarEquivalenciaSintetica();
  const padrao = { schemaVersao: 1, unidades: 'gramas_e_medida_disponivel', casasGramas: 3, casasNutrientes: 2, passoPorcaoGramas: '1', modoComparacao: 'detalhado' };
  let preferenciasSalvas;
  await page.route(url => url.pathname === '/api/profissionais/me/preferencias-equivalencia', async route => {
    if (route.request().method() === 'PUT') {
      preferenciasSalvas = route.request().postDataJSON();
      return route.fulfill({ json: { preferencias: preferenciasSalvas.preferencias, revisao: preferenciasSalvas.revisaoEsperada + 1 } });
    }
    return route.fulfill({ json: { preferencias: padrao, revisao: 4 } });
  });
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  const painel = page.getByRole('region', { name: 'Equivalência por nutriente para Iogurte sintético' });
  await painel.getByRole('button', { name: 'Equivalência por nutriente' }).click();
  await painel.getByText('Preferências de apresentação').click();
  await painel.getByLabel('Casas decimais de gramas').fill('1');
  await painel.getByLabel('Comparação').selectOption('compacto');
  await painel.getByRole('button', { name: 'Salvar preferências pessoais' }).click();
  await expect.poll(() => preferenciasSalvas).toBeTruthy();
  expect(preferenciasSalvas.revisaoEsperada).toBe(4);
  expect(preferenciasSalvas.preferencias).toMatchObject({ casasGramas: 1, modoComparacao: 'compacto', passoPorcaoGramas: '1' });
  expect(fixture.escritas).toHaveLength(0);
});

test('PA07 segunda aba consulta sem habilitar edição nem autosave; aba original conserva conteúdo local', async ({ context, page }) => {
  const { escritas } = await preparar(context); await abrir(page);
  const objetivo = page.getByRole('textbox', { name: 'Objetivo clínico', exact: true }); await expect(objetivo).toBeEditable();
  await objetivo.fill('Alteração sintética somente local');
  const segunda = await context.newPage(); await abrir(segunda);
  await expect(segunda.getByRole('button', { name: 'Editar nesta aba' })).toBeVisible();
  await segunda.clock.install();
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
  const segunda = await context.newPage(); await abrir(segunda);
  await expect(segunda.getByRole('button', { name: 'Editar nesta aba' })).toBeVisible();
  await segunda.clock.install();
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

test('FOOD04 cria grupo pessoal com porção em gramas e avisa que não declara equivalência', async ({ context, page }) => {
  const fixture = await preparar(context);
  const alimentoId = '10000000-0000-4000-8000-000000000041';
  let corpoCriacao;
  await page.route(url => url.pathname.startsWith('/api/planos-alimentares/grupos-substituicoes'), async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/consulta')) {
      return route.fulfill({ json: { itens: [], total: 0, pagina: 1, limite: 25 } });
    }
    if (route.request().method() === 'POST' && url.pathname === '/api/planos-alimentares/grupos-substituicoes') {
      corpoCriacao = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: '10000000-0000-4000-8000-000000000042' } });
    }
    return route.fulfill({ json: { itens: [], total: 0, pagina: 1, limite: 25 } });
  });
  await page.route(url => url.pathname.endsWith('/planos-alimentares/alimentos'), async route => route.fulfill({ json: {
    itens: [{ id: alimentoId, codigoOrigem: 'SINT-FOOD04', nome: 'Aveia sintética FOOD04', disponivelParaCalculo: true, nutrientesPor100g: { energiaKcal: 380 }, fonte: { codigo: 'SINT', nome: 'Fixture sintética', versao: '1' } }],
    fontes: [], total: 1, pagina: 1, limite: 10
  } }));
  await abrir(page);
  const biblioteca = page.getByRole('region', { name: 'Biblioteca de grupos de substituições' });
  await page.getByText('Biblioteca de grupos de substituições', { exact: true }).click();
  await biblioteca.getByRole('button', { name: 'Novo grupo' }).click();
  await biblioteca.getByLabel('Nome obrigatório').fill('Alternativas sintéticas para aveia');
  await biblioteca.getByLabel('Categoria opcional').fill('Desjejum');
  await biblioteca.getByLabel('Etiquetas separadas por vírgula').fill('teste, sintético');
  await biblioteca.getByLabel('Pesquisar alimento (3 caracteres)').fill('Aveia');
  await expect(biblioteca.getByRole('button', { name: 'Adicionar Aveia sintética FOOD04' })).toBeVisible();
  await biblioteca.getByRole('button', { name: 'Adicionar Aveia sintética FOOD04' }).click();
  await expect(biblioteca.getByText('Aveia sintética FOOD04')).toBeVisible();
  await biblioteca.getByLabel('Pesquisar alimento (3 caracteres)').fill('Aveia');
  await biblioteca.getByRole('button', { name: 'Adicionar Aveia sintética FOOD04' }).click();
  await expect(biblioteca.getByRole('alert')).toContainText('Este alimento já está no grupo com porção de 100 g');
  const acessibilidade = await new AxeBuilder({ page }).include('section[aria-label="Biblioteca de grupos de substituições"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(acessibilidade.violations).toEqual([]);
  await biblioteca.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(biblioteca.getByRole('status')).toContainText('não representam equivalência nutricional');
  expect(corpoCriacao).toMatchObject({
    conteudo: {
      nome: 'Alternativas sintéticas para aveia', categoria: 'Desjejum', etiquetas: ['teste', 'sintético'],
      entradas: [{ origem: 'catalogo', alimentoId, quantidade: 1, unidade: 'porção', porcaoGramas: 100 }]
    }
  });
  expect(corpoCriacao.escopo).toBeUndefined();
  expect(fixture.escritas).toHaveLength(0);
});

test('FOOD04 aplicação seletiva preserva o principal e mantém alternativa não liberada no rascunho', async ({ context, page }) => {
  const fixture = await preparar(context);
  const principalId = '10000000-0000-4000-8000-000000000051';
  const alternativaId = '10000000-0000-4000-8000-000000000052';
  const grupoId = '10000000-0000-4000-8000-000000000053';
  const entradaId = '10000000-0000-4000-8000-000000000054';
  await page.route(url => url.pathname.endsWith('/planos-alimentares/alimentos'), async route => route.fulfill({ json: {
    itens: [{ id: principalId, codigoOrigem: 'SINT-PRINCIPAL', nome: 'Principal sintético', disponivelParaCalculo: true, nutrientesPor100g: { energiaKcal: 90 }, fonte: { codigo: 'SINT', nome: 'Fixture sintética', versao: '1' } }],
    fontes: [], total: 1, pagina: 1, limite: 20
  } }));
  await page.route(url => url.pathname === '/api/planos-alimentares/grupos-substituicoes/consulta', async route => route.fulfill({ json: {
    itens: [{ id: grupoId, nome: 'Grupo sintético', etiquetas: [], escopo: 'pessoal', estado: 'ativo', revisao: 1, quantidadeEntradas: 2, podeEditar: true, favorito: false }], total: 1, pagina: 1, limite: 25
  } }));
  await page.route(url => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoId}`, async route => route.fulfill({ json: {
    id: grupoId, nome: 'Grupo sintético', etiquetas: [], escopo: 'pessoal', estado: 'ativo', revisao: 1, quantidadeEntradas: 2, podeEditar: true, favorito: false,
    entradas: [
      { id: entradaId, origem: 'catalogo', alimentoId: alternativaId, quantidade: 1, unidade: 'porção', porcaoGramas: 80, disponivel: true, composicao: { descricao: 'Alternativa sintética', nutrientesPor100g: { energiaKcal: 70 } } },
      { id: '10000000-0000-4000-8000-000000000055', origem: 'catalogo', alimentoId: principalId, quantidade: 1, unidade: 'porção', porcaoGramas: 80, disponivel: true, composicao: { descricao: 'Principal sintético', nutrientesPor100g: { energiaKcal: 90 } } }
    ]
  } }));
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await page.getByRole('button', { name: 'Adicionar alimento', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Buscar no catálogo' }).last().fill('Principal');
  await page.getByRole('button', { name: /^Principal sintético/ }).click();
  await page.getByRole('button', { name: /Aplicar grupo de alternativas/ }).click();
  await page.getByLabel('Grupo ativo').selectOption(grupoId);
  const alternativa = page.getByText('Alternativa sintética', { exact: true });
  await expect(alternativa).toBeVisible();
  const modoEquivalencia = page.getByRole('button', { name: 'Calcular por nutriente' });
  await expect(modoEquivalencia).toBeVisible();
  await expect(page.getByText('Não há alternativas disponíveis novas neste grupo')).toHaveCount(0);
  const linhaAlternativa = alternativa.locator('xpath=ancestor::div[contains(@class,"rounded border")]').first();
  await linhaAlternativa.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Acrescentar selecionadas' }).click();
  await expect(page.getByText(/Alternativas acrescentadas ao rascunho e ainda não liberadas ao paciente/)).toBeVisible();
  const desfazer = page.getByRole('button', { name: 'Desfazer', exact: true });
  await expect(desfazer).toBeEnabled();
  await desfazer.click();
  await expect(page.getByText('Alternativa sintética', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Aplicar grupo de alternativas/ }).click();
  await page.getByLabel('Grupo ativo').selectOption(grupoId);
  const alternativaRestaurada = page.getByText('Alternativa sintética', { exact: true });
  await expect(alternativaRestaurada).toBeVisible();
  await alternativaRestaurada.locator('xpath=ancestor::div[contains(@class,"rounded border")]').first().getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Acrescentar selecionadas' }).click();
  await expect(page.getByText(/Alternativas acrescentadas ao rascunho e ainda não liberadas ao paciente/)).toBeVisible();
  const pausaSalvamento = fixture.bloquearProximaEscrita();
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  try {
    await pausaSalvamento.iniciou;
    await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeDisabled();
    await expect.poll(() => fixture.escritas.length).toBe(1);
  } finally { pausaSalvamento.liberar(); }
  await expect.poll(() => fixture.escritas.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Desfazer', exact: true })).toBeDisabled();
  const itemSalvo = fixture.escritas[0].documento.refeicoes[0].itens.find(item => item.alimentoComposicaoId === principalId);
  expect(itemSalvo).toBeTruthy();
  expect(itemSalvo.substituicoes).toHaveLength(1);
  expect(itemSalvo.substituicoes[0]).toMatchObject({ alimentoComposicaoId: alternativaId, porcaoGramas: 80, preferida: false, liberadaParaPaciente: false });
  expect(itemSalvo.substituicoes[0].origemGrupo).toMatchObject({ grupoId, revisao: 1, entradaId });
  expect(itemSalvo.substituicoes[0].origemGrupo.aplicacaoId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(itemSalvo.substituicoes[0].origemGrupo).not.toHaveProperty('schemaVersao');
  expect(itemSalvo.substituicoes[0].origemGrupo).not.toHaveProperty('porcaoAplicadaGramas');
});

test('FOOD05 calcula porções de alternativas FOOD04 com a referência do grupo e preserva ambos os contextos', async ({ context, page }) => {
  const fixture = await preparar(context);
  fixture.configurarEquivalenciaSintetica();
  const grupoId = '10000000-0000-4000-8000-000000000153';
  const entradaId = '10000000-0000-4000-8000-000000000154';
  const alternativaId = '10000000-0000-4000-8000-000000000155';
  let pedidoEquivalenciaGrupo;
  await page.route(url => url.pathname === '/api/planos-alimentares/grupos-substituicoes/consulta', route => route.fulfill({ json: {
    itens: [{ id: grupoId, nome: 'Grupo calculável sintético', etiquetas: [], escopo: 'pessoal', estado: 'ativo', revisao: 3, quantidadeEntradas: 1, podeEditar: true, favorito: false }], total: 1, pagina: 1, limite: 25
  } }));
  await page.route(url => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoId}`, route => route.fulfill({ json: {
    id: grupoId, nome: 'Grupo calculável sintético', etiquetas: [], escopo: 'pessoal', estado: 'ativo', revisao: 3, quantidadeEntradas: 1, podeEditar: true, favorito: false,
    entradas: [{ id: entradaId, origem: 'catalogo', alimentoId: alternativaId, quantidade: 1, unidade: 'porção', porcaoGramas: 80, disponivel: true, composicao: { descricao: 'Alternativa FOOD04 sintética', nutrientesPor100g: { energiaKcal: 150 } } }]
  } }));
  await page.route(url => url.pathname === '/api/profissionais/me/preferencias-equivalencia', route => route.fulfill({ json: {
    preferencias: { schemaVersao: 1, unidades: 'gramas', casasGramas: 2, casasNutrientes: 2, passoPorcaoGramas: '1', modoComparacao: 'detalhado' }, revisao: 1
  } }));
  await page.route(url => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}/equivalencias/previa`, async route => {
    pedidoEquivalenciaGrupo = route.request().postDataJSON();
    const alternativa = pedidoEquivalenciaGrupo.alternativas[0];
    await route.fulfill({ json: {
      fingerprint: 'd'.repeat(64), rascunhoRevisao: 1, nutriente: 'energiaKcal',
      principal: { descricao: 'Iogurte sintético', baseGramas: '100', nutrientes: { energiaKcal: '100', proteinasG: '5', carboidratosG: '10', gordurasG: '2' }, fonte: { codigo: 'SINTETICA', versao: '1' } },
      alternativas: [{ chaveCliente: alternativa.chaveCliente, alimento: { descricao: 'Alternativa FOOD04 sintética', preparacao: 'não informada', baseGramas: '100', nutrientes: { energiaKcal: '150' }, fonte: { codigo: 'SINT', versao: '1' } }, fingerprint: 'e'.repeat(64), resultado: { estado: 'calculavel', nutriente: 'energiaKcal', aplicavel: true, motivosAplicacao: [], porcaoMatematica: { numerador: '10000', denominador: '150' }, porcaoMatematicaGramas: '66.666667', porcaoMatematicaAproximada: true, porcaoSugeridaGramas: '67', porcaoEfetivaGramas: '67', nutrienteAlvo: '100', obtido: '100.5', delta: '0.5', diferencaAbsoluta: '0.5', deltaPercentual: '0.5', nutrientesPorcao: { energiaKcal: '100.5' }, avisos: [] }, impacto: { estado: 'completo', antes: { energiaKcal: '100', proteinasG: '5', carboidratosG: '10', gordurasG: '2' }, depois: { energiaKcal: '100.5', proteinasG: '0', carboidratosG: '0', gordurasG: '0' }, diferencas: { energiaKcal: '0.5', proteinasG: '-5', carboidratosG: '-10', gordurasG: '-2' } }, comparacaoIndividual: { estado: 'completo', antes: { energiaKcal: '100', proteinasG: '5', carboidratosG: '10', gordurasG: '2' }, depois: { energiaKcal: '100.5', proteinasG: '0', carboidratosG: '0', gordurasG: '0' }, diferencas: { energiaKcal: '0.5', proteinasG: '-5', carboidratosG: '-10', gordurasG: '-2' } } }]
    } });
  });
  await page.clock.install();
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await page.getByRole('button', { name: /Aplicar grupo de alternativas/ }).click();
  await page.getByLabel('Grupo ativo').selectOption(grupoId);
  await page.getByRole('button', { name: 'Calcular por nutriente' }).click();
  const painel = page.getByRole('region', { name: 'Prévia da aplicação do grupo' }).getByRole('region', { name: 'Equivalência por nutriente para Iogurte sintético' });
  await painel.getByRole('button', { name: 'Equivalência por nutriente' }).click();
  await painel.getByRole('button', { name: 'Calcular alternativas' }).click();
  await expect.poll(() => pedidoEquivalenciaGrupo).toBeTruthy();
  expect(pedidoEquivalenciaGrupo.alternativas[0].origemGrupo).toMatchObject({ grupoId, revisao: 3, entradaId });
  expect(pedidoEquivalenciaGrupo.alternativas[0]).not.toHaveProperty('porcaoGramas');
  await painel.getByRole('checkbox', { name: 'Selecionar Alternativa FOOD04 sintética' }).check();
  await painel.getByRole('button', { name: 'Aplicar selecionadas' }).click();
  await page.clock.fastForward(60_000);
  await expect.poll(() => fixture.escritas.length).toBe(1);
  const item = fixture.escritas[0].documento.refeicoes[0].itens[0];
  const alternativaSalva = item.substituicoes.find(linha => linha.alimentoComposicaoId === alternativaId);
  expect(alternativaSalva).toMatchObject({ porcaoGramas: '67', unidade: 'g', preferida: false, liberadaParaPaciente: false });
  expect(alternativaSalva.equivalencia).toMatchObject({ acao: 'calcular', nutriente: 'energiaKcal', porcaoEfetiva: '67' });
  expect(alternativaSalva.origemGrupo).toMatchObject({ grupoId, revisao: 3, entradaId });
});

test('FOOD04 resposta tardia após cancelar a prévia não troca o grupo selecionado', async ({ context, page }) => {
  await preparar(context);
  const principalId = '10000000-0000-4000-8000-000000000061';
  const grupoA = '10000000-0000-4000-8000-000000000062';
  const grupoB = '10000000-0000-4000-8000-000000000063';
  const alternativaA = '10000000-0000-4000-8000-000000000064';
  const alternativaB = '10000000-0000-4000-8000-000000000065';
  let liberarA;
  let iniciouA;
  const esperandoA = new Promise(resolve => { liberarA = resolve; });
  const chamadaA = new Promise(resolve => { iniciouA = resolve; });
  await page.route(url => url.pathname.endsWith('/planos-alimentares/alimentos'), async route => route.fulfill({ json: {
    itens: [{ id: principalId, codigoOrigem: 'SINT-PRINCIPAL', nome: 'Principal sintético', disponivelParaCalculo: true, nutrientesPor100g: { energiaKcal: 90 } }],
    fontes: [], total: 1, pagina: 1, limite: 20
  } }));
  await page.route(url => url.pathname === '/api/planos-alimentares/grupos-substituicoes/consulta', async route => route.fulfill({ json: {
    itens: [grupoA, grupoB].map((id, index) => ({ id, nome: `Grupo ${index ? 'B' : 'A'}`, etiquetas: [], escopo: 'pessoal', estado: 'ativo', revisao: 1, quantidadeEntradas: 1, podeEditar: true, favorito: false })),
    total: 2, pagina: 1, limite: 25
  } }));
  await page.route(url => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoA}` || url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoB}`, async route => {
    const a = new URL(route.request().url()).pathname.endsWith(grupoA);
    if (a) { iniciouA(); await esperandoA; }
    const id = a ? grupoA : grupoB;
    const alimentoId = a ? alternativaA : alternativaB;
    return route.fulfill({ json: {
      id, nome: `Grupo ${a ? 'A' : 'B'}`, etiquetas: [], escopo: 'pessoal', estado: 'ativo', revisao: 1, quantidadeEntradas: 1, podeEditar: true, favorito: false,
      entradas: [{ id: a ? '10000000-0000-4000-8000-000000000066' : '10000000-0000-4000-8000-000000000067', origem: 'catalogo', alimentoId, quantidade: 1, unidade: 'porção', porcaoGramas: 80, disponivel: true, composicao: { descricao: `Alternativa ${a ? 'A' : 'B'}`, nutrientesPor100g: { energiaKcal: 70 } } }]
    } }).catch(() => {});
  });
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await page.getByRole('button', { name: 'Adicionar alimento', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Buscar no catálogo' }).last().fill('Principal');
  await page.getByRole('button', { name: /^Principal sintético/ }).click();
  await page.getByRole('button', { name: /Aplicar grupo de alternativas/ }).click();
  await page.getByLabel('Grupo ativo').selectOption(grupoA);
  await chamadaA;
  await page.getByRole('region', { name: 'Prévia da aplicação do grupo' }).getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: /Aplicar grupo de alternativas/ }).click();
  await page.getByLabel('Grupo ativo').selectOption(grupoB);
  await expect(page.getByText('Alternativa B', { exact: true })).toBeVisible();
  liberarA();
  await expect(page.getByText('Alternativa B', { exact: true })).toBeVisible();
  await expect(page.getByText('Alternativa A', { exact: true })).toHaveCount(0);
});

test('FOOD04 perda de posse com prévia aberta bloqueia confirmação e preserva rascunho', async ({ context, page }) => {
  await preparar(context);
  const principalId = '10000000-0000-4000-8000-000000000068';
  const grupoId = '10000000-0000-4000-8000-000000000069';
  const alternativaId = '10000000-0000-4000-8000-000000000070';
  const entradaId = '10000000-0000-4000-8000-000000000074';
  await page.route(url => url.pathname.endsWith('/planos-alimentares/alimentos'), async route => route.fulfill({ json: {
    itens: [{ id: principalId, codigoOrigem: 'SINT-PRINCIPAL', nome: 'Principal posse sintético', disponivelParaCalculo: true, nutrientesPor100g: { energiaKcal: 90 } }],
    fontes: [], total: 1, pagina: 1, limite: 20
  } }));
  await page.route(url => url.pathname === '/api/planos-alimentares/grupos-substituicoes/consulta', async route => route.fulfill({ json: {
    itens: [{ id: grupoId, nome: 'Grupo posse sintético', etiquetas: [], escopo: 'pessoal', estado: 'ativo', revisao: 1, quantidadeEntradas: 1, podeEditar: true, favorito: false }], total: 1, pagina: 1, limite: 25
  } }));
  await page.route(url => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoId}`, async route => route.fulfill({ json: {
    id: grupoId, nome: 'Grupo posse sintético', etiquetas: [], escopo: 'pessoal', estado: 'ativo', revisao: 1, quantidadeEntradas: 1, podeEditar: true, favorito: false,
    entradas: [{ id: entradaId, origem: 'catalogo', alimentoId: alternativaId, quantidade: 1, unidade: 'porção', porcaoGramas: 75, disponivel: true, composicao: { descricao: 'Alternativa posse sintética', nutrientesPor100g: { energiaKcal: 70 } } }]
  } }));
  await abrir(page);
  await page.getByRole('button', { name: 'Expandir todas' }).click();
  await page.getByRole('button', { name: 'Adicionar alimento', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Buscar no catálogo' }).last().fill('Principal posse');
  await page.getByRole('button', { name: /^Principal posse sintético/ }).click();
  await page.getByRole('button', { name: /Aplicar grupo de alternativas/ }).click();
  await page.getByLabel('Grupo ativo').selectOption(grupoId);
  const previa = page.getByRole('region', { name: 'Prévia da aplicação do grupo' });
  await previa.getByRole('checkbox').check();
  const confirmar = previa.getByRole('button', { name: 'Acrescentar selecionadas' });
  await expect(confirmar).toBeEnabled();

  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });

  await expect(page.getByRole('button', { name: 'Editar nesta aba' })).toBeEnabled();
  await expect(confirmar).toBeDisabled();
  await expect(page.getByText('Alternativa posse sintética', { exact: true })).toHaveCount(1);
});

test('FOOD04 edita, arquiva e restaura grupo próprio mantendo revisão', async ({ context, page }) => {
  await preparar(context);
  const grupoId = '10000000-0000-4000-8000-000000000071';
  const alimentoId = '10000000-0000-4000-8000-000000000072';
  let grupo = {
    id: grupoId, nome: 'Grupo editável sintético', descricao: 'Descrição sintética', categoria: 'Lanche', etiquetas: ['sintético'],
    escopo: 'pessoal', estado: 'ativo', revisao: 1, quantidadeEntradas: 1, podeEditar: true, favorito: false,
    entradas: [{ id: '10000000-0000-4000-8000-000000000073', origem: 'catalogo', alimentoId, quantidade: 1, unidade: 'porção', porcaoGramas: 100, disponivel: true, composicao: { descricao: 'Alimento sintético para grupo', nutrientesPor100g: { energiaKcal: 100 } } }]
  };
  const patchs = [];
  await page.route(url => url.pathname === '/api/planos-alimentares/grupos-substituicoes/consulta', async route => {
    const consulta = route.request().postDataJSON();
    const visivel = consulta.estado === 'todos' || grupo.estado === 'ativo' && consulta.estado !== 'arquivado' || grupo.estado === 'arquivado' && consulta.estado === 'arquivado';
    const resumo = {
      id: grupo.id, nome: grupo.nome, descricao: grupo.descricao, categoria: grupo.categoria, etiquetas: grupo.etiquetas,
      escopo: grupo.escopo, estado: grupo.estado, revisao: grupo.revisao, quantidadeEntradas: grupo.quantidadeEntradas,
      podeEditar: grupo.podeEditar, favorito: grupo.favorito
    };
    await route.fulfill({ json: { itens: visivel ? [resumo] : [], total: visivel ? 1 : 0, pagina: 1, limite: 25 } });
  });
  await page.route(url => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoId}`, async route => {
    if (route.request().method() === 'PATCH') {
      const corpo = route.request().postDataJSON(); patchs.push(corpo);
      grupo = { ...grupo, ...(corpo.conteudo ?? {}), ...(corpo.estado ? { estado: corpo.estado } : {}), revisao: grupo.revisao + 1 };
    }
    await route.fulfill({ json: grupo });
  });
  await abrir(page);
  const biblioteca = page.getByRole('region', { name: 'Biblioteca de grupos de substituições' });
  await page.getByText('Biblioteca de grupos de substituições', { exact: true }).click();
  await biblioteca.getByRole('button', { name: 'Abrir' }).click();
  await biblioteca.getByRole('button', { name: 'Editar' }).click();
  await biblioteca.getByLabel('Nome obrigatório').fill('Grupo atualizado sintético');
  await biblioteca.getByLabel('Categoria opcional').fill('Refeição');
  await biblioteca.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(biblioteca.getByRole('status')).toContainText('não representam equivalência nutricional');
  expect(patchs[0]).toMatchObject({ revisaoEsperada: 1, conteudo: { nome: 'Grupo atualizado sintético', categoria: 'Refeição' } });
  await biblioteca.getByRole('button', { name: 'Abrir' }).click();
  await biblioteca.getByRole('button', { name: 'Arquivar' }).click();
  await biblioteca.getByRole('group', { name: 'Confirmar arquivamento' }).getByRole('button', { name: 'Confirmar arquivamento' }).click();
  expect(patchs[1]).toEqual({ revisaoEsperada: 2, estado: 'arquivado' });
  await biblioteca.getByLabel('Estado').selectOption('arquivado');
  await biblioteca.getByRole('button', { name: 'Abrir' }).click();
  await biblioteca.getByRole('button', { name: 'Restaurar' }).click();
  expect(patchs[2]).toEqual({ revisaoEsperada: 3, estado: 'ativo' });
  expect(grupo).toMatchObject({ nome: 'Grupo atualizado sintético', estado: 'ativo', revisao: 4 });
});

test('FOOD04 favorita grupo da clínica e duplica cópia pessoal independente', async ({ context, page }) => {
  await preparar(context);
  const grupoId = '10000000-0000-4000-8000-000000000081';
  const alimentoId = '10000000-0000-4000-8000-000000000082';
  const entradaId = '10000000-0000-4000-8000-000000000083';
  let favorito = false;
  let duplicacao;
  const grupo = {
    id: grupoId, nome: 'Grupo compartilhado sintético', descricao: 'Descrição da clínica', categoria: 'Lanche', etiquetas: ['clínica'],
    escopo: 'clinica', estado: 'ativo', revisao: 3, quantidadeEntradas: 1, podeEditar: false, favorito,
    entradas: [{ id: entradaId, origem: 'catalogo', alimentoId, quantidade: 1, unidade: 'porção', porcaoGramas: 75, disponivel: true, composicao: { descricao: 'Alimento da clínica sintético', nutrientesPor100g: { energiaKcal: 100 } } }]
  };
  await page.route(url => url.pathname === '/api/planos-alimentares/grupos-substituicoes/consulta', async route => await route.fulfill({ json: {
    itens: [{ ...grupo, entradas: undefined, favorito }], total: 1, pagina: 1, limite: 25
  } }));
  await page.route(url => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoId}`, async route => await route.fulfill({ json: { ...grupo, favorito } }));
  await page.route(url => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoId}/favorito`, async route => {
    favorito = true;
    await route.fulfill({ json: { grupoId, favorito } });
  });
  await page.route(url => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoId}/duplicar`, async route => {
    duplicacao = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { id: '10000000-0000-4000-8000-000000000084' } });
  });
  await abrir(page);
  const biblioteca = page.getByRole('region', { name: 'Biblioteca de grupos de substituições' });
  await page.getByText('Biblioteca de grupos de substituições', { exact: true }).click();
  await biblioteca.getByRole('button', { name: 'Adicionar aos favoritos' }).click();
  await expect(biblioteca.getByRole('button', { name: 'Remover dos favoritos' })).toBeVisible();
  await biblioteca.getByRole('button', { name: 'Abrir' }).click();
  await biblioteca.getByRole('button', { name: 'Duplicar para pessoal' }).click();
  await biblioteca.getByLabel('Nome obrigatório').fill('Minha cópia independente');
  await biblioteca.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(biblioteca.getByRole('status')).toContainText('não representam equivalência nutricional');
  expect(duplicacao).toMatchObject({
    revisaoEsperada: 3,
    conteudo: { nome: 'Minha cópia independente', categoria: 'Lanche', etiquetas: ['clínica'], entradas: [{ alimentoId, quantidade: 1, unidade: 'porção', porcaoGramas: 75 }] }
  });
  expect(duplicacao.escopo).toBeUndefined();
  expect(grupo).toMatchObject({ nome: 'Grupo compartilhado sintético', escopo: 'clinica', revisao: 3 });
});

test('FOOD04 compartilhar grupo pessoal exige confirmação e registra a revisão esperada', async ({ context, page }) => {
  await preparar(context);
  const grupoId = '10000000-0000-4000-8000-000000000091';
  const grupo = {
    id: grupoId, nome: 'Grupo pessoal para compartilhar', descricao: 'Fixture sintética', categoria: 'Lanche', etiquetas: [],
    escopo: 'pessoal', estado: 'ativo', revisao: 3, quantidadeEntradas: 1, podeEditar: true, favorito: false,
    entradas: [{ id: '10000000-0000-4000-8000-000000000092', origem: 'catalogo', alimentoId: '10000000-0000-4000-8000-000000000093', quantidade: 1, unidade: 'porção', porcaoGramas: 100, disponivel: true, composicao: { descricao: 'Alimento sintético', nutrientesPor100g: { energiaKcal: 100 } } }]
  };
  let compartilhamento;
  await page.route(url => url.pathname === '/api/planos-alimentares/grupos-substituicoes/consulta', async route => route.fulfill({ json: {
    itens: [{ id: grupo.id, nome: grupo.nome, descricao: grupo.descricao, categoria: grupo.categoria, etiquetas: grupo.etiquetas, escopo: grupo.escopo, estado: grupo.estado, revisao: grupo.revisao, quantidadeEntradas: grupo.quantidadeEntradas, podeEditar: true, favorito: false }], total: 1, pagina: 1, limite: 25
  } }));
  await page.route(url => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoId}`, async route => {
    if (route.request().method() === 'PATCH') compartilhamento = route.request().postDataJSON();
    await route.fulfill({ json: grupo });
  });
  await abrir(page);
  const biblioteca = page.getByRole('region', { name: 'Biblioteca de grupos de substituições' });
  await page.getByText('Biblioteca de grupos de substituições', { exact: true }).click();
  await biblioteca.getByRole('button', { name: 'Abrir' }).click();
  await biblioteca.getByRole('button', { name: 'Compartilhar com clínica' }).click();
  const confirmacao = biblioteca.getByRole('group', { name: 'Confirmar compartilhamento' });
  await expect(confirmacao).toBeVisible();
  await expect(confirmacao).toContainText('Profissionais autorizados e administradores da clínica poderão consultar');
  await confirmacao.getByRole('button', { name: 'Confirmar compartilhamento' }).click();
  await expect.poll(() => compartilhamento).toEqual({ revisaoEsperada: 3, escopo: 'clinica' });
  expect(compartilhamento).toEqual({ revisaoEsperada: 3, escopo: 'clinica' });
});

test('FOOD04 trocar de grupo durante edição não redireciona conteúdo pessoal para outro grupo', async ({ context, page }) => {
  await preparar(context);
  const grupoA = '10000000-0000-4000-8000-000000000094';
  const grupoB = '10000000-0000-4000-8000-000000000095';
  const alimentoId = '10000000-0000-4000-8000-000000000096';
  const grupos = [
    { id: grupoA, nome: 'Grupo pessoal A', escopo: 'pessoal', podeEditar: true },
    { id: grupoB, nome: 'Grupo compartilhado B', escopo: 'clinica', podeEditar: true }
  ];
  const detalhe = (grupo) => ({
    ...grupo, descricao: 'Descrição sintética', categoria: 'Lanche', etiquetas: [], estado: 'ativo',
    revisao: 1, quantidadeEntradas: 1, favorito: false,
    entradas: [{ id: `${grupo.id}-entrada`, origem: 'catalogo', alimentoId, quantidade: 1, unidade: 'porção', porcaoGramas: 100, disponivel: true,
      composicao: { descricao: 'Alimento sintético do grupo', nutrientesPor100g: { energiaKcal: 100 } } }]
  });
  const patches = [];
  await page.route(url => url.pathname === '/api/planos-alimentares/grupos-substituicoes/consulta', async route => route.fulfill({ json: {
    itens: grupos.map(grupo => ({ ...grupo, etiquetas: [], estado: 'ativo', revisao: 1, quantidadeEntradas: 1, favorito: false })),
    total: grupos.length, pagina: 1, limite: 25
  } }));
  await page.route(url => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoA}` || url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupoB}`, async route => {
    if (route.request().method() === 'PATCH') patches.push({ id: new URL(route.request().url()).pathname.split('/').at(-1), body: route.request().postDataJSON() });
    const grupo = grupos.find(item => item.id === new URL(route.request().url()).pathname.split('/').at(-1));
    await route.fulfill({ json: detalhe(grupo) });
  });
  await abrir(page);
  const biblioteca = page.getByRole('region', { name: 'Biblioteca de grupos de substituições' });
  await page.getByText('Biblioteca de grupos de substituições', { exact: true }).click();
  await biblioteca.getByRole('button', { name: 'Abrir' }).nth(0).click();
  await biblioteca.getByRole('button', { name: 'Editar' }).click();
  await biblioteca.getByLabel('Nome obrigatório').fill('Conteúdo pessoal A revisado');
  await expect(biblioteca.getByRole('button', { name: 'Abrir' }).nth(1)).toBeDisabled();
  await biblioteca.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toMatchObject({ id: grupoA, body: { revisaoEsperada: 1, conteudo: { nome: 'Conteúdo pessoal A revisado' } } });
  expect(patches[0].id).not.toBe(grupoB);
});

test('FOOD04 troca de grupo invalida confirmações pendentes do grupo anterior', async ({ context, page }) => {
  await preparar(context);
  const grupos = [
    { id: '10000000-0000-4000-8000-000000000097', nome: 'Grupo pessoal A', escopo: 'pessoal', podeEditar: true },
    { id: '10000000-0000-4000-8000-000000000098', nome: 'Grupo pessoal B', escopo: 'pessoal', podeEditar: true }
  ];
  const detalhe = grupo => ({
    ...grupo, descricao: 'Descrição sintética', categoria: 'Lanche', etiquetas: [], estado: 'ativo', revisao: 1,
    quantidadeEntradas: 1, favorito: false,
    entradas: [{ id: `${grupo.id}-entrada`, origem: 'catalogo', alimentoId: '10000000-0000-4000-8000-000000000099', quantidade: 1, unidade: 'porção', porcaoGramas: 100, disponivel: true,
      composicao: { descricao: 'Alimento sintético', nutrientesPor100g: { energiaKcal: 100 } } }]
  });
  await page.route(url => url.pathname === '/api/planos-alimentares/grupos-substituicoes/consulta', async route => route.fulfill({ json: {
    itens: grupos.map(grupo => ({ ...grupo, etiquetas: [], estado: 'ativo', revisao: 1, quantidadeEntradas: 1, favorito: false })), total: 2, pagina: 1, limite: 25
  } }));
  await page.route(url => grupos.some(grupo => url.pathname === `/api/planos-alimentares/grupos-substituicoes/${grupo.id}`), async route => {
    const caminho = new URL(route.request().url()).pathname;
    const grupo = grupos.find(item => caminho.endsWith(item.id)); await route.fulfill({ json: detalhe(grupo) });
  });
  await abrir(page);
  const biblioteca = page.getByRole('region', { name: 'Biblioteca de grupos de substituições' });
  await page.getByText('Biblioteca de grupos de substituições', { exact: true }).click();
  await biblioteca.getByRole('button', { name: 'Abrir' }).nth(0).click();
  await biblioteca.getByRole('button', { name: 'Compartilhar com clínica' }).click();
  await expect(biblioteca.getByRole('group', { name: 'Confirmar compartilhamento' })).toBeVisible();
  await expect(biblioteca.getByRole('button', { name: 'Abrir' }).nth(1)).toBeEnabled();
  await biblioteca.getByRole('button', { name: 'Abrir' }).nth(1).click();
  await expect(biblioteca.getByRole('group', { name: 'Confirmar compartilhamento' })).toHaveCount(0);
  await biblioteca.getByRole('button', { name: 'Arquivar' }).click();
  await expect(biblioteca.getByRole('group', { name: 'Confirmar arquivamento' })).toBeVisible();
  await biblioteca.getByRole('button', { name: 'Abrir' }).nth(0).click();
  await expect(biblioteca.getByRole('group', { name: 'Confirmar arquivamento' })).toHaveCount(0);
});

test('FOOD04 cancelar aplicacao aguardando save impede acrescentar alternativas apos o ACK', async ({ context, page }) => {
  test.setTimeout(60_000);
  const fixture=await preparar(context);
  const principalId='10000000-0000-4000-8000-000000000161',grupoId='10000000-0000-4000-8000-000000000162',alternativaId='10000000-0000-4000-8000-000000000163';
  await page.route(url=>url.pathname.endsWith('/planos-alimentares/alimentos'),route=>route.fulfill({json:{itens:[{id:principalId,nome:'Principal cancelamento',codigoOrigem:'SINT',disponivelParaCalculo:true,nutrientesPor100g:{energiaKcal:100,proteinasG:5,carboidratosG:10,gordurasG:2}}],fontes:[],total:1,pagina:1,limite:20}}));
  await page.route(url=>url.pathname==='/api/planos-alimentares/grupos-substituicoes/consulta',route=>route.fulfill({json:{itens:[{id:grupoId,nome:'Grupo cancelamento',etiquetas:[],escopo:'pessoal',estado:'ativo',revisao:1,quantidadeEntradas:1,podeEditar:true,favorito:false}],total:1,pagina:1,limite:25}}));
  await page.route(url=>url.pathname===`/api/planos-alimentares/grupos-substituicoes/${grupoId}`,route=>route.fulfill({json:{id:grupoId,nome:'Grupo cancelamento',etiquetas:[],escopo:'pessoal',estado:'ativo',revisao:1,quantidadeEntradas:1,podeEditar:true,favorito:false,entradas:[{id:'10000000-0000-4000-8000-000000000164',origem:'catalogo',alimentoId:alternativaId,quantidade:1,unidade:'porção',porcaoGramas:80,disponivel:true,composicao:{descricao:'Alternativa cancelada',nutrientesPor100g:{energiaKcal:90}}}]}}));
  await abrir(page);await page.getByRole('button',{name:'Expandir todas'}).click();
  await page.getByRole('button',{name:'Adicionar alimento',exact:true}).first().click();
  await page.getByRole('textbox',{name:'Buscar no catálogo'}).last().fill('Principal');
  await page.getByRole('button',{name:/^Principal cancelamento/}).click();
  await page.getByRole('button',{name:/Aplicar grupo de alternativas/}).click();
  await page.getByLabel('Grupo ativo').selectOption(grupoId);
  const previa=page.getByRole('region',{name:'Prévia da aplicação do grupo'});await previa.getByRole('checkbox').check();
  const pausa=fixture.bloquearProximaEscrita();
  try {
    await page.getByRole('button',{name:'Salvar rascunho'}).click();await pausa.iniciou;
    await previa.getByRole('button',{name:'Acrescentar selecionadas'}).click();
    await expect(previa).toHaveAttribute('aria-busy','true');
    await previa.getByRole('button',{name:'Cancelar',exact:true}).click();
  } finally {pausa.liberar();}
  await expect(page.getByRole('button',{name:'Salvar rascunho'})).toBeEnabled();
  await expect(page.getByRole('status').filter({hasText:'Alternativas acrescentadas'})).toHaveCount(0);
  await page.getByRole('textbox',{name:'Objetivo clínico',exact:true}).fill('Depois do cancelamento');
  await page.getByRole('button',{name:'Salvar rascunho'}).click();
  await expect.poll(()=>fixture.escritas.length).toBe(2);
  expect(fixture.escritas[1].documento.refeicoes[0].itens[0].substituicoes).toHaveLength(0);
});
