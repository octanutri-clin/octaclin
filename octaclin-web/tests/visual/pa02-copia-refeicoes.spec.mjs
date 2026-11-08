import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const errosPagina = new WeakMap();
test.beforeEach(({ page }) => {
  const erros = [];
  errosPagina.set(page, erros);
  page.on('pageerror', erro => erros.push(erro.message));
});
test.afterEach(({ page }) => expect(errosPagina.get(page)).toEqual([]));

const paciente = { id: 'pa02-paciente-sintetico', tenantId: 'pa02-tenant-sintetico', profissionalResponsavelId: 'pa02-profissional', nome: 'Paciente Sintético', statusAdesao: 'aderente', criadoEm: '2026-10-01T12:00:00.000Z' };
const outroPaciente = { ...paciente, id: 'pa02-outra-paciente-sintetica', nome: 'Outra Paciente Sintética' };
const permissoes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'profissionais.ler', 'planos_alimentares.ler', 'planos_alimentares.gerenciar'];
const instante = '2026-10-01T12:00:00.000Z';

function refeicao(id, nome, descricao, orientacoes = '') {
  return {
    id,
    ordem: 0,
    nome,
    horarioLocal: '08:15',
    orientacoes,
    itens: [{
      id: `${id}-item`, ordem: 0, alimentoComposicaoId: `catalogo-${descricao.split(' ')[0].toLowerCase()}`, descricao,
      quantidade: 1, unidade: 'porção', porcaoGramas: 100,
      composicaoSnapshot: { origem: 'catalogo', alimentoComposicaoId: `catalogo-${descricao.split(' ')[0].toLowerCase()}`, descricao, fonte: { nome: 'TACO sintética', versao: '1' }, nutrientesPor100g: { energiaKcal: 110, proteinasG: 4, carboidratosG: 17, gordurasG: 2, fibrasG: 1 }, nutrientesPorcao: { energiaKcal: 110, proteinasG: 4, carboidratosG: 17, gordurasG: 2, fibrasG: 1 } },
      substituicoes: [{
        id: `${id}-alternativa`, ordem: 0, descricao: 'Alternativa sintética', quantidade: 1,
        unidade: 'unidade', porcaoGramas: 30,
        composicaoSnapshot: { origem: 'manual', descricao: 'Alternativa sintética', nutrientesPor100g: { energiaKcal: 80, proteinasG: 2, carboidratosG: 10, gordurasG: 3 }, nutrientesPorcao: { energiaKcal: 24, proteinasG: 0.6, carboidratosG: 3, gordurasG: 0.9 } },
        liberadaParaPaciente: true, preferida: false
      }],
      substituicoesVisiveisInicialmente: 1
    }]
  };
}

function versao({ id, numero, status, refeicoes, objetivos = 'Objetivo sintético' }) {
  return {
    id, numero, status, criadoEm: instante, atualizadoEm: instante, objetivos, observacoes: 'Observação sintética de origem', refeicoes,
    ativoParaPaciente: true, ativacaoRevisao: 1,
    ativacaoRefeicoes: refeicoes.map((item) => ({ refeicaoId: item.id, identidadeId: `identidade-${id}-${item.id}`, ativa: true })),
    ...(status === 'rascunho' ? { ativacaoEdicao: refeicoes.map((item) => ({ chaveCliente: item.id, identidadeId: `identidade-${id}-${item.id}`, ativa: true })) } : {})
  };
}

async function preparar(page, { falharRevalidacaoOrigem = false, alterarVersaoNaColagem = false, alterarSomenteRevisaoNaColagem = false, planosPaginados = false, atrasarLeituraExterna = false, atrasarRevalidacaoOrigem = false, duasRefeicoesDestino = false, limiteRefeicoesDestino = false, manterRefeicoesRecolhidas = false, nutrientesIncompletos = false, refeicaoSemAlimentos = false, atualizarNutrientesAoSalvar = false, documentoInicial } = {}) {
  let leiturasOrigemExterna = 0;
  let leiturasExternasPendentes = 0;
  let liberarLeituraExterna;
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'synthetic', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'synthetic', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ autenticado: true, apiUrl: 'http://localhost:3001', tenantSlug: 'pa02-sintetico', email: 'profissional.sintetico@example.test', expiraEm: instante, papel: 'Professional', permissoes, destinoInicial: '/pacientes' }) }));
  // Estas leituras de fundo não pertencem ao cenário de cópia. Sem mocks,
  // pedidos com cookies sintéticos chegavam ao BFF real e retornavam 401,
  // exibindo estados de sessão expirada fora do escopo deste teste.
  const respostasDeFundo = new Map([
    ['/api/notificacoes', { naoLidas: 0, itens: [], resumos: [] }],
    ['/api/notificacoes/resumos/gerar', { gerado: false }],
    ['/api/pacientes/filtros-salvos', { itens: [] }]
  ]);
  await page.route((url) => respostasDeFundo.has(url.pathname), (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(respostasDeFundo.get(new URL(route.request().url()).pathname))
  }));
  for (const pacienteAtual of [paciente, outroPaciente]) {
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteAtual.id}/prioridade-acompanhamento`, (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ pacienteId: pacienteAtual.id, apurado: false, valorCalculado: { score: 0, faixa: 'baixa', fatores: [] }, valorEfetivo: { faixa: 'baixa', origem: 'calculado' } })
    }));
    const compartilhamentos = `/api/planos-alimentares/receitas/compartilhamentos/pacientes/${pacienteAtual.id}`;
    await page.route((url) => url.pathname === compartilhamentos, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route((url) => url.pathname === `${compartilhamentos}/preferencias`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: false, whatsapp: false, push: false }) }));
  }
  await page.route((url) => url.pathname === '/api/profissionais', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'pa02-profissional', tenantId: 'pa02-tenant-sintetico', nome: 'Profissional Sintético', criadoEm: instante }], total: 1 }) }));
  await page.route((url) => url.pathname === `/api/pacientes/${paciente.id}/prontuario`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ paciente, resumo: { consultas: 0, formulariosPendentes: 0, respostas: 0, checkinsRapidos: 0, mensagens: 0, evolucoes: 0, tarefasPendentes: 0, indicadoresRecentes: [], leituraClinica: { deltaUltimaAvaliacao: [], deltaDesdeInicio: [], condutasVencendo: [] } }, linhaDoTempo: [] }) }));
  await page.route((url) => url.pathname === `/api/pacientes/${outroPaciente.id}/prontuario`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ paciente: outroPaciente, resumo: { consultas: 0, formulariosPendentes: 0, respostas: 0, checkinsRapidos: 0, mensagens: 0, evolucoes: 0, tarefasPendentes: 0, indicadoresRecentes: [], leituraClinica: { deltaUltimaAvaliacao: [], deltaDesdeInicio: [], condutasVencendo: [] } }, linhaDoTempo: [] }) }));
  const avaliacao = { id: 'pa02-avaliacao-sintetica', pacienteId: paciente.id, avaliadaEm: '2026-10-01', protocolo: 'nenhum', medidas: {}, resultado: { protocoloAplicado: 'nenhum', avisos: [] }, metricasCompartilhadasPortal: [], criadoEm: instante };
  await page.route((url) => url.pathname === `/api/pacientes/${paciente.id}/avaliacoes-antropometricas`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ avaliacoes: [avaliacao], deltaUltimas: [] }) }));
  await page.route((url) => url.pathname === `/api/pacientes/${outroPaciente.id}/avaliacoes-antropometricas`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ avaliacoes: [{ ...avaliacao, pacienteId: outroPaciente.id }], deltaUltimas: [] }) }));
  await page.route((url) => url.pathname === '/api/planos-alimentares/modelos' || url.pathname === '/api/planos-alimentares/receitas', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 100 }) }));
  await page.route((url) => url.pathname === '/api/pacientes', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [outroPaciente], total: 1 }) }));

  const destino = versao({ id: 'pa02-draft-destino', numero: 2, status: 'rascunho', objetivos: 'Objetivo exclusivo do destino', refeicoes: [refeicao('destino-r', 'Almoço atual', 'Arroz sintético', 'Manter esta orientação')] });
  destino.rascunhoRevisao = 0;
  destino.edicaoEstado = documentoInicial ? 'pendente' : 'materializada';
  if (documentoInicial) destino.documentoEdicao = documentoInicial;
  if (nutrientesIncompletos) {
    delete destino.refeicoes[0].itens[0].composicaoSnapshot.nutrientesPor100g.proteinasG;
    delete destino.refeicoes[0].itens[0].composicaoSnapshot.nutrientesPorcao.proteinasG;
  }
  if (refeicaoSemAlimentos) destino.refeicoes[0].itens = [];
  if (duasRefeicoesDestino) destino.refeicoes.push(refeicao('destino-r2', 'Jantar destino', 'Batata sintética'));
  if (limiteRefeicoesDestino) {
    for (let indice = 1; indice < 50; indice += 1) {
      const item = refeicao(`destino-limite-${indice}`, `Refeição limite ${indice}`, 'Arroz sintético');
      item.itens[0].substituicoes = [];
      destino.refeicoes.push(item);
    }
  }
  const sourcePublished = versao({ id: 'pa02-publicado-origem', numero: 3, status: 'publicada', refeicoes: [refeicao('origem-pub-r', 'Lanche publicado', 'Banana sintética', 'Orientação publicada')] });
  const sourceDraft = versao({ id: 'pa02-rascunho-origem', numero: 4, status: 'rascunho', refeicoes: [refeicao('origem-draft-r', 'Jantar em rascunho', 'Feijão sintético', 'Orientação do rascunho')] });
  const resumoDestino = { id: 'pa02-plano-destino', pacienteId: paciente.id, profissionalId: 'pa02-profissional', titulo: 'Plano destino', criadoEm: instante, atualizadoEm: instante, draft: { id: destino.id, numero: destino.numero, status: 'rascunho', criadoEm: instante, atualizadoEm: instante }, historicoQuantidade: 1 };
  const resumoDestinoOutro = { ...resumoDestino, id: 'pa02-plano-destino-outro', pacienteId: outroPaciente.id, draft: { ...resumoDestino.draft, id: 'pa02-draft-destino-outro' } };
  const resumoOrigem = { id: 'pa02-plano-origem', pacienteId: paciente.id, profissionalId: 'pa02-profissional', titulo: 'Plano origem salvo', criadoEm: instante, atualizadoEm: instante, current: { id: sourcePublished.id, numero: sourcePublished.numero, status: 'publicada', publicadoEm: instante, criadoEm: instante, atualizadoEm: instante }, draft: { id: sourceDraft.id, numero: sourceDraft.numero, status: 'rascunho', criadoEm: instante, atualizadoEm: instante }, historicoQuantidade: 2 };
  const planoDestino = { ...resumoDestino, ativoParaPaciente: true, ativacaoRevisao: 1, historico: [], draft: { ...destino, calculo: { metaEnergeticaKcal: 2000, metasMacronutrientes: { carboidratosG: 250, proteinasG: 100, gordurasG: 67 } } } };
  const planoDestinoOutro = { ...resumoDestinoOutro, historico: [], draft: { ...destino, id: 'pa02-draft-destino-outro', calculo: { metaEnergeticaKcal: 2000, metasMacronutrientes: { carboidratosG: 250, proteinasG: 100, gordurasG: 67 } } } };

  await page.route((url) => url.pathname === `/api/pacientes/${paciente.id}/planos-alimentares`, (route) => {
    const url = new URL(route.request().url());
    if (planosPaginados && url.searchParams.get('limite') === '25') {
      const ficticios = Array.from({ length: 24 }, (_, indice) => ({ id: `pa02-plano-ficticio-${indice}`, pacienteId: paciente.id, profissionalId: 'pa02-profissional', titulo: `Plano sintético ${indice + 1}`, criadoEm: instante, atualizadoEm: instante, historicoQuantidade: 0 }));
      const pagina = Number(url.searchParams.get('pagina') ?? 1);
      const itens = pagina === 1 ? [resumoDestino, ...ficticios] : [resumoOrigem];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens, total: 26, pagina, limite: 25 }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [resumoDestino, resumoOrigem], total: 2, pagina: 1, limite: 100 }) });
  });
  await page.route((url) => url.pathname === `/api/pacientes/${paciente.id}/planos-alimentares/${resumoDestino.id}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(planoDestino) }));
  await page.route((url) => url.pathname.startsWith(`/api/pacientes/${paciente.id}/planos-alimentares/${resumoOrigem.id}/versoes/`), (route) => {
    const url = new URL(route.request().url());
    const numero = Number(url.pathname.split('/').at(-1));
    const versaoAtual = numero === sourcePublished.numero ? sourcePublished : sourceDraft;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(versaoAtual) });
  });
  await page.route((url) => url.pathname === `/api/pacientes/${outroPaciente.id}/planos-alimentares`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [resumoDestinoOutro, { ...resumoOrigem, pacienteId: outroPaciente.id }], total: 2, pagina: 1, limite: 25 }) }));
  await page.route((url) => url.pathname === `/api/pacientes/${outroPaciente.id}/planos-alimentares/${resumoDestinoOutro.id}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(planoDestinoOutro) }));
  await page.route((url) => url.pathname === `/api/pacientes/${outroPaciente.id}/planos-alimentares/${resumoOrigem.id}/versoes/${sourcePublished.numero}`, async (route) => {
    leiturasOrigemExterna += 1;
    const numeroLeitura = leiturasOrigemExterna;
    if (falharRevalidacaoOrigem && numeroLeitura > 1) {
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Acesso revogado no caso sintético.' }) });
    }
    if ((atrasarLeituraExterna && numeroLeitura === 1) || (atrasarRevalidacaoOrigem && numeroLeitura === 2)) {
      leiturasExternasPendentes += 1;
      await new Promise((resolve) => { liberarLeituraExterna = resolve; });
    }
    const versaoAtual = alterarVersaoNaColagem && numeroLeitura > 1
      ? { ...sourcePublished, atualizadoEm: '2026-10-02T12:00:00.000Z' }
      : atrasarLeituraExterna && numeroLeitura === 1
        ? { ...sourcePublished, refeicoes: [refeicao('externa-obsoleta', 'Origem externa obsoleta', 'Maçã sintética')] }
        : sourcePublished;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(versaoAtual) });
  });
  await page.route((url) => url.pathname === `/api/pacientes/${outroPaciente.id}/planos-alimentares/${resumoOrigem.id}/versoes/${sourceDraft.numero}`, (route) => {
    leiturasOrigemExterna += 1;
    const versaoAtual = alterarVersaoNaColagem && leiturasOrigemExterna > 1
      ? { ...sourceDraft, atualizadoEm: '2026-10-02T12:00:00.000Z' }
      : alterarSomenteRevisaoNaColagem && leiturasOrigemExterna > 1
        ? { ...sourceDraft, rascunhoRevisao: (sourceDraft.rascunhoRevisao ?? 0) + 1 }
      : sourceDraft;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(versaoAtual) });
  });

  let entradaSalva;
  await page.route((url) => url.pathname === `/api/pacientes/${paciente.id}/planos-alimentares/${resumoDestino.id}/rascunho/edicao`, async (route) => {
    const entrada = route.request().postDataJSON();
    entradaSalva = entrada.documento;
    const pendente = !entradaSalva.objetivos?.trim() || entradaSalva.refeicoes.some((refeicao) => !refeicao.nome?.trim());
    const refeicoesMaterializadas = pendente ? [] : entradaSalva.refeicoes.map((entradaRefeicao, indice) => {
      const base = planoDestino.draft.refeicoes[indice] ?? planoDestino.draft.refeicoes[0];
      const refeicaoMaterializada = {
        ...base,
        id: `refeicao-materializada-${indice}`,
        nome: entradaRefeicao.nome,
        horarioLocal: entradaRefeicao.horarioLocal,
        orientacoes: entradaRefeicao.orientacoes,
        itens: base.itens.map((item) => ({ ...item, composicaoSnapshot: structuredClone(item.composicaoSnapshot) }))
      };
      if (atualizarNutrientesAoSalvar) {
        for (const item of refeicaoMaterializada.itens) {
          item.composicaoSnapshot.nutrientesPor100g.energiaKcal = 220;
          item.composicaoSnapshot.nutrientesPorcao.energiaKcal = 220;
        }
      }
      return refeicaoMaterializada;
    });
    const versaoSalva = {
      ...planoDestino.draft,
      rascunhoRevisao: entrada.rascunhoRevisaoEsperada + 1,
      edicaoEstado: pendente ? 'pendente' : 'materializada',
      documentoEdicao: entradaSalva,
      ativacaoEdicao: entradaSalva.refeicoes.map((refeicao) => ({ chaveCliente: refeicao.chaveCliente, identidadeId: `identidade-${refeicao.chaveCliente}`, ativa: true })),
      ...(pendente ? { calculo: undefined, totais: undefined, refeicoes: [] } : {
        refeicoes: refeicoesMaterializadas,
        ativacaoRefeicoes: refeicoesMaterializadas.map((refeicao) => ({ refeicaoId: refeicao.id, identidadeId: `identidade-${refeicao.id}`, ativa: true }))
      })
    };
    planoDestino.draft = versaoSalva;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(versaoSalva) });
  });

  await page.goto(`/pacientes/${paciente.id}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
  // Aguarda a reconferência de posse entre abas antes de interagir com o editor.
  await expect(page.getByLabel('Objetivo clínico')).toBeEnabled({ timeout: 30_000 });
  if (!manterRefeicoesRecolhidas) {
    const expandir = page.getByRole('button', { name: 'Expandir todas' });
    await expandir.focus();
    await expandir.press('Enter');
  }
  return { destino, sourcePublished, sourceDraft, resumoOrigem, resumoDestino, get entradaSalva() { return entradaSalva; }, get leiturasOrigemExterna() { return leiturasOrigemExterna; }, get leiturasExternasPendentes() { return leiturasExternasPendentes; }, liberarLeituraExterna() { liberarLeituraExterna?.(); } };
}

function painelCopia(page) {
  return page.getByRole('region', { name: 'Copiar uma refeição salva' });
}


test.describe('PA06 - integridade editorial', () => {
  test('reabre campos vazios sem completar avaliação ou iniciar escrita automática', async ({ page }) => {
    await page.clock.install();
    const documento = { schemaVersao: 1, avaliacaoAntropometricaId: null, fatorAtividade: '-',
      objetivos: '', refeicoes: [{ chaveCliente: 'r-parcial', nome: 'Parcial', itens: [{
        chaveCliente: 'i-parcial', descricao: 'Alimento parcial', quantidade: '', porcaoGramas: '',
        nutrientesPor100g: { energiaKcal: '1,' }, substituicoes: []
      }] }] };
    const contexto = await preparar(page, { documentoInicial: documento });
    await expect(page.getByRole('combobox', { name: 'Avaliação antropométrica', exact: true })).toHaveValue('');
    await expect(page.getByLabel('Fator de atividade', { exact: true })).toHaveValue('-');
    await expect(page.getByLabel('Quantidade', { exact: true }).first()).toHaveValue('');
    await expect(page.getByLabel('Porcao (g)', { exact: true }).first()).toHaveValue('');
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toHaveCount(0);
    await page.clock.fastForward(120_000);
    expect(contexto.entradaSalva).toBeUndefined();
    await page.getByLabel('Quantidade', { exact: true }).first().fill('2');
    await page.getByLabel('Quantidade', { exact: true }).first().fill('');
    await page.getByLabel('Objetivo clínico').fill('Texto parcial');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => contexto.entradaSalva?.objetivos).toBe('Texto parcial');
    expect(contexto.entradaSalva.quantidade).toBeUndefined();
    expect(contexto.entradaSalva.refeicoes[0].itens[0].quantidade).toBe('');
    expect(contexto.entradaSalva.refeicoes[0].itens[0].porcaoGramas).toBe('');
    expect(contexto.entradaSalva.avaliacaoAntropometricaId).toBeNull();
    expect(contexto.entradaSalva.fatorAtividade).toBe('-');
    expect(contexto.entradaSalva.refeicoes[0].itens[0].unidade).toBe('');
    expect(contexto.entradaSalva.refeicoes[0].itens[0].nutrientesPor100g.energiaKcal).toBe('1,');
  });

  test('percentuais preservam separador durante digitação, autosave e reabertura', async ({ page }) => {
    test.setTimeout(60_000);
    await page.clock.install();
    const contexto = await preparar(page);
    const campo = page.getByLabel('Carboidratos (%)', { exact: true });
    await campo.fill('');
    await campo.pressSequentially('1,');
    await expect(campo).toHaveValue('1,');
    await page.clock.fastForward(60_000);
    await expect.poll(() => contexto.entradaSalva?.percentuaisMacrosEdicao?.carboidratosBasisPoints).toBe('1,');
    await campo.pressSequentially('25');
    await expect(campo).toHaveValue('1,25');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => contexto.entradaSalva?.percentuaisMacrosEdicao?.carboidratosBasisPoints).toBe('1,25');
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toHaveCount(0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    // O relógio fica controlado entre navegações; avance a hidratação e os
    // timers de reconciliação antes de procurar campos do editor reidratado.
    await page.clock.runFor(1_000);
    await expect(page.getByRole('heading', { name: 'Plano destino' })).toBeVisible();
    await expect(campo).toHaveValue('1,25');
  });

  test('rejeição de save seguida de retorno ao baseline não inventa ACK nem prende revisão', async ({ page }) => {
    await preparar(page);
    let escritas = 0;
    await page.route((url) => url.pathname.endsWith('/pa02-plano-destino/rascunho/edicao'), route => {
      escritas++;
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Edição rejeitada no cenário sintético.' }) });
    });
    const objetivo = page.getByLabel('Objetivo clínico');
    const original = await objetivo.inputValue();
    await objetivo.fill('Edição rejeitada');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'O salvamento automático foi pausado.' })).toBeVisible();
    await objetivo.fill(original);
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(page.getByRole('button', { name: 'Revisar', exact: true })).toBeEnabled();
    expect(escritas).toBe(1);
    await expect(page.getByText(/Último salvamento confirmado/)).toHaveCount(0);
  });

  test('rejeição temporária da revisão permite retry sem editar conteúdo', async ({ page }) => {
    await preparar(page);
    let revisoes = 0;
    await page.route((url) => url.pathname.endsWith('/pa02-plano-destino/revisao'), route => {
      revisoes++;
      return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ message: 'Revisão temporariamente limitada.' }) });
    });
    await page.getByRole('button', { name: 'Revisar', exact: true }).click();
    await expect.poll(() => revisoes).toBe(1);
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(page.getByRole('button', { name: 'Revisar', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Revisar', exact: true }).click();
    await expect.poll(() => revisoes).toBe(2);
  });

  test('recusa de revisão por validação permite corrigir e salvar novamente', async ({ page }) => {
    const contexto = await preparar(page);
    await page.route((url) => url.pathname.endsWith('/pa02-plano-destino/revisao'), route => route.fulfill({
      status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Confira a justificativa sintética.' })
    }));
    await page.getByRole('button', { name: 'Revisar', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Confira a justificativa sintética.' })).toBeVisible();
    await page.getByLabel('Objetivo clínico').fill('Correção após validação');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => contexto.entradaSalva?.objetivos).toBe('Correção após validação');
  });
});

test.describe('PA03 - subtotal e refeições recolhidas no editor', () => {
  test('inicia recolhida com subtotal e alternar não altera rascunho nem envia requisição', async ({ page }) => {
    await preparar(page, { manterRefeicoesRecolhidas: true });
    const refeicao = page.getByTestId('refeicao-editor').first();
    const alternar = page.getByRole('button', { name: 'Expandir refeição Almoço atual' });
    await expect(alternar).toHaveAttribute('aria-expanded', 'false');
    await expect(refeicao).toContainText('110 kcal · P 4,0 g · C 17,0 g · G 2,0 g');
    await expect(refeicao.getByLabel('Nome da refeição')).toBeHidden();
    const acessibilidade = await new AxeBuilder({ page }).include('[data-testid="refeicao-editor"]').analyze();
    expect(acessibilidade.violations).toEqual([]);
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toHaveCount(0);
    await alternar.click();
    await expect(refeicao.getByLabel('Nome da refeição')).toHaveValue('Almoço atual');
    await expect(page.getByRole('button', { name: 'Recolher refeição Almoço atual' })).toHaveAttribute('aria-expanded', 'true');
    await refeicao.getByRole('button', { name: /^Recolher refeição/ }).click();
    await expect(refeicao.getByLabel('Nome da refeição')).toBeHidden();
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toHaveCount(0);
  });

  test('subtotal parcial mostra ausência sem apagar os demais nutrientes', async ({ page }) => {
    await preparar(page, { manterRefeicoesRecolhidas: true, nutrientesIncompletos: true });
    const refeicao = page.getByTestId('refeicao-editor').first();
    await expect(refeicao).toContainText('110 kcal · P — g · C 17,0 g · G 2,0 g · Dados incompletos');
    await expect(refeicao.getByLabel(/Subtotal da refeição 1.*Proteínas: — gramas/)).toBeAttached();
    await refeicao.getByRole('button', { name: /^Expandir refeição/ }).press('Enter');
    await expect(refeicao.getByLabel(/Porção do alimento Arroz sintético.*Proteínas: — gramas/)).toBeVisible();
  });

  test('subtotais ficam indisponíveis enquanto a edição não foi materializada', async ({ page }) => {
    const contexto = await preparar(page);
    const refeicao = page.getByTestId('refeicao-editor').first();
    await refeicao.getByLabel('Quantidade', { exact: true }).first().fill('2');
    await expect(page.getByRole('region', { name: 'Prévia profissional' }).getByText('Energia', { exact: true })).toHaveCount(0);
    await expect(refeicao).toContainText('Pendente de materialização');
    await refeicao.getByLabel('Porcao (g)', { exact: true }).first().fill('200');
    await refeicao.getByRole('button', { name: /^Recolher refeição/ }).press('Enter');
    await expect(refeicao).toContainText('Pendente de materialização');
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toBeVisible();
    expect(contexto.entradaSalva).toBeUndefined();
  });

  test('refeição sem itens mostra estado vazio, não zeros completos', async ({ page }) => {
    await preparar(page, { manterRefeicoesRecolhidas: true, refeicaoSemAlimentos: true });
    const refeicao = page.getByTestId('refeicao-editor').first();
    await expect(refeicao).toContainText('Sem alimentos');
    await expect(refeicao).not.toContainText('0 kcal');
  });

  test('expandir todas funciona por teclado e a abertura acompanha a chave ao reordenar', async ({ page }) => {
    await preparar(page, { manterRefeicoesRecolhidas: true, duasRefeicoesDestino: true });
    const global = page.getByRole('button', { name: 'Expandir todas' });
    await global.focus();
    await global.press('Enter');
    await expect(page.getByRole('button', { name: /^Recolher refeição/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'Recolher refeição Jantar destino' }).click();
    await page.getByRole('button', { name: 'Mover refeição Almoço atual para baixo' }).click();
    const refeicoes = page.getByTestId('refeicao-editor');
    await expect(refeicoes.nth(0)).toHaveAttribute('aria-label', 'Refeição: Jantar destino');
    await expect(refeicoes.nth(0).getByRole('button', { name: 'Expandir refeição Jantar destino' })).toHaveAttribute('aria-expanded', 'false');
    await expect(refeicoes.nth(1)).toHaveAttribute('aria-label', 'Refeição: Almoço atual');
    await expect(refeicoes.nth(1).getByRole('button', { name: 'Recolher refeição Almoço atual' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toBeVisible();
  });

  test('linha incompleta recolhida pode ser salva como rascunho editorial pendente', async ({ page }) => {
    const contexto = await preparar(page, { manterRefeicoesRecolhidas: true });
    const refeicao = page.getByTestId('refeicao-editor').first();
    await page.getByRole('button', { name: 'Expandir refeição Almoço atual' }).click();
    const nome = refeicao.getByLabel('Nome da refeição');
    await nome.fill('');
    await refeicao.getByRole('button', { name: /^Recolher refeição/ }).click();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => contexto.entradaSalva?.refeicoes[0]?.nome).toBe('');
    await expect(refeicao.getByRole('button', { name: /^Expandir refeição/ })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('status').filter({ hasText: 'Cálculos e subtotais indisponíveis' })).toBeVisible();
  });

  test('nome longo sem espaços cabe no cabeçalho recolhido', async ({ page }) => {
    await preparar(page, { manterRefeicoesRecolhidas: true });
    const refeicao = page.getByTestId('refeicao-editor').first();
    const expandir = refeicao.getByRole('button', { name: /^Expandir refeição/ });
    await expandir.focus();
    await expandir.press('Enter');
    const nome = 'X'.repeat(180);
    await refeicao.getByLabel('Nome da refeição').fill(nome);
    await refeicao.getByRole('button', { name: /^Recolher refeição/ }).press('Enter');
    await expect(refeicao.getByRole('heading')).toContainText(nome);
    await conferirSemOverflow(page);
  });

  test('salva todas as refeições recolhidas e usa a resposta recalculada ao reidratar', async ({ page }) => {
    const contexto = await preparar(page, { manterRefeicoesRecolhidas: true, duasRefeicoesDestino: true, atualizarNutrientesAoSalvar: true });
    await expect(page.getByRole('button', { name: /^Expandir refeição/ })).toHaveCount(2);
    await page.getByLabel('Revisei os dados da avaliação e confirmo a aplicabilidade da fórmula para este paciente.').check();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => contexto.entradaSalva?.refeicoes.map((item) => item.nome)).toEqual(['Almoço atual', 'Jantar destino']);
    expect(contexto.entradaSalva.refeicoes[0].itens[0].substituicoes).toHaveLength(1);
    expect(contexto.entradaSalva.refeicoes[0].orientacoes).toBe('Manter esta orientação');
    await expect(page.getByTestId('refeicao-editor').first().getByText('220 kcal · P 4,0 g · C 17,0 g · G 2,0 g', { exact: true })).toHaveCount(2);
    await expect(page.getByRole('button', { name: /^Expandir refeição/ })).toHaveCount(2);
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toHaveCount(0);
  });

  test('várias refeições incompletas permanecem no documento editorial salvo', async ({ page }) => {
    const contexto = await preparar(page, { duasRefeicoesDestino: true });
    const refeicoes = page.getByTestId('refeicao-editor');
    await refeicoes.nth(0).getByLabel('Nome da refeição').fill('');
    await refeicoes.nth(1).getByLabel('Nome da refeição').fill('');
    await page.getByRole('button', { name: 'Recolher todas' }).press('Enter');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => contexto.entradaSalva?.refeicoes.map((item) => item.nome)).toEqual(['', '']);
    await expect(page.getByRole('button', { name: /^Expandir refeição/ })).toHaveCount(2);
    await expect(page.getByRole('status').filter({ hasText: 'Cálculos e subtotais indisponíveis' })).toBeVisible();
  });
});

async function conferirSemOverflow(page) {
  const largura = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, conteudo: document.documentElement.scrollWidth }));
  expect(largura.conteudo).toBeLessThanOrEqual(largura.viewport);
}

test.describe('PA02 - copiar refeições sem substituir o plano de destino', () => {
  async function selecionarOrigemExterna(page) {
    const painel = painelCopia(page);
    await painel.getByLabel('Buscar outro paciente autorizado (opcional)').fill('Outra');
    await painel.getByRole('button', { name: 'Buscar paciente' }).click();
    await painel.getByLabel('Paciente de origem').selectOption(outroPaciente.id);
    await painel.getByLabel('Plano de origem').selectOption('pa02-plano-origem');
    await painel.getByRole('button', { name: 'Carregar refeições' }).click();
    await painel.getByLabel('Refeição salva').selectOption({ label: 'Lanche publicado (1 alimentos)' });
    return painel;
  }

  test('não anuncia sucesso quando a refeição de destino é removida durante a cópia', async ({ page }) => {
    const contexto = await preparar(page, { atrasarRevalidacaoOrigem: true, duasRefeicoesDestino: true });
    const painel = await selecionarOrigemExterna(page);
    await painel.getByLabel('Acrescentar alimentos a uma refeição').check();
    await painel.getByLabel('Refeição de destino').selectOption({ label: 'Jantar destino' });
    await painel.getByRole('button', { name: 'Copiar refeição' }).click();
    await expect.poll(() => contexto.leiturasExternasPendentes).toBe(1);
    await page.getByRole('button', { name: 'Remover', exact: true }).nth(1).click();
    contexto.liberarLeituraExterna();
    await expect(page.getByRole('alert').filter({ hasText: 'A refeição de destino não está mais disponível.' })).toBeVisible();
    await expect(painel.getByRole('status')).toHaveCount(0);
    await expect(painel.getByLabel('Refeição salva')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Nome da refeição' })).toHaveCount(1);
  });

  test('impede salvar enquanto a revalidação da cópia está pendente', async ({ page }) => {
    const contexto = await preparar(page, { atrasarRevalidacaoOrigem: true });
    await page.getByLabel('Revisei os dados da avaliação e confirmo a aplicabilidade da fórmula para este paciente.').check();
    const painel = await selecionarOrigemExterna(page);
    await painel.getByRole('button', { name: 'Copiar refeição' }).click();
    await expect.poll(() => contexto.leiturasExternasPendentes).toBe(1);
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
    await page.getByRole('button', { name: 'Salvar rascunho' }).evaluate((botao) => botao.form.requestSubmit());
    expect(contexto.entradaSalva).toBeUndefined();
    contexto.liberarLeituraExterna();
    await expect(page.getByRole('textbox', { name: 'Nome da refeição' })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled();
    await page.getByLabel('Revisei os dados da avaliação e confirmo a aplicabilidade da fórmula para este paciente.').check();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => contexto.entradaSalva?.refeicoes.map((item) => item.nome)).toEqual(['Almoço atual', 'Lanche publicado']);
    await expect(page.getByRole('status').filter({ hasText: 'Cálculos e subtotais indisponíveis' })).toBeVisible();
  });

  test('recusa uma nova refeição no limite sem anunciar sucesso nem perder a origem', async ({ page }) => {
    await preparar(page, { limiteRefeicoesDestino: true });
    const painel = await selecionarOrigemExterna(page);
    await painel.getByRole('button', { name: 'Copiar refeição' }).click();
    await expect(painel.getByRole('alert')).toContainText('limite de 50 refeições');
    await expect(painel.getByRole('status')).toHaveCount(0);
    await expect(painel.getByLabel('Refeição salva')).toHaveValue('origem-pub-r');
    await expect(page.getByRole('textbox', { name: 'Nome da refeição' })).toHaveCount(50);
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled();
  });

  test('duplica a refeição local não salva com chaves novas e edição independente', async ({ page }) => {
    await preparar(page);
    const nomes = page.getByRole('textbox', { name: 'Nome da refeição' });
    await nomes.first().fill('Café editado localmente');
    const duplicar = page.getByRole('button', { name: 'Duplicar refeição Café editado localmente' });
    await duplicar.focus();
    await duplicar.press('Enter');
    await expect(nomes).toHaveCount(2);
    await expect(nomes.nth(1)).toHaveValue('Café editado localmente');
    await page.getByRole('textbox', { name: 'Alimento' }).nth(1).fill('Cópia editada');
    await expect(page.getByRole('textbox', { name: 'Alimento' }).first()).toHaveValue('Arroz sintético');
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toBeVisible();
    await conferirSemOverflow(page);
  });

  test('pagina planos de origem e não oferece o próprio plano de destino como origem', async ({ page }) => {
    await preparar(page, { planosPaginados: true });
    const painel = painelCopia(page);
    await expect(painel.getByText('Página 1 de 2')).toBeVisible();
    await expect(painel.getByLabel('Plano de origem').getByRole('option', { name: /Plano destino/ })).toHaveCount(0);
    await painel.getByRole('button', { name: 'Mais planos' }).click();
    await expect(painel.getByText('Página 2 de 2')).toBeVisible();
    await expect(painel.getByLabel('Plano de origem').getByRole('option', { name: 'Plano origem salvo' })).toHaveCount(1);
    await painel.getByLabel('Plano de origem').selectOption('pa02-plano-origem');
    await expect(painel.getByLabel('Versão salva')).toHaveValue('publicada');
    await painel.getByRole('button', { name: 'Carregar refeições' }).click();
    await painel.getByLabel('Refeição salva').selectOption({ label: 'Lanche publicado (1 alimentos)' });
    await painel.getByRole('button', { name: 'Planos anteriores' }).click();
    await expect(painel.getByText('Página 1 de 2')).toBeVisible();
    await expect(painel.getByLabel('Refeição salva')).toHaveCount(0);
    await expect(painel.getByRole('button', { name: 'Copiar refeição' })).toHaveCount(0);
  });

  test('descarta resposta atrasada da origem anterior após trocar o paciente', async ({ page }) => {
    const contexto = await preparar(page, { atrasarLeituraExterna: true });
    const painel = painelCopia(page);
    await painel.getByLabel('Buscar outro paciente autorizado (opcional)').fill('Outra');
    await painel.getByRole('button', { name: 'Buscar paciente' }).click();
    await painel.getByLabel('Paciente de origem').selectOption(outroPaciente.id);
    await painel.getByLabel('Plano de origem').selectOption('pa02-plano-origem');
    await painel.getByRole('button', { name: 'Carregar refeições' }).click();
    await expect.poll(() => contexto.leiturasExternasPendentes).toBe(1);

    await page.evaluate(() => { window.__pa02NavegacaoSintetica = true; });
    await page.getByRole('link', { name: 'Voltar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Abrir prontuário', exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: 'Abrir prontuário', exact: true }).click();
    await page.getByRole('tab', { name: 'Plano', exact: true }).click();
    await page.getByRole('tab', { name: 'Plano alimentar', exact: true }).click();
    expect(await page.evaluate(() => window.__pa02NavegacaoSintetica)).toBe(true);
    const painelNovoPaciente = painelCopia(page);
    await expect(painelNovoPaciente.getByLabel('Paciente de origem')).toBeEnabled();
    contexto.liberarLeituraExterna();
    await painelNovoPaciente.getByLabel('Paciente de origem').selectOption(outroPaciente.id);
    await painelNovoPaciente.getByLabel('Plano de origem').selectOption('pa02-plano-origem');
    await painelNovoPaciente.getByRole('button', { name: 'Carregar refeições' }).click();
    await expect(painelNovoPaciente.getByLabel('Refeição salva')).not.toContainText('Origem externa obsoleta');
    await expect(painelNovoPaciente.getByLabel('Refeição salva')).toContainText('Lanche publicado');
  });

  test('copia uma refeição publicada de outro paciente, revalida a origem e salva só no rascunho de destino', async ({ page }) => {
    const contexto = await preparar(page);
    const painel = painelCopia(page);
    await painel.getByLabel('Buscar outro paciente autorizado (opcional)').fill('Outra');
    await painel.getByRole('button', { name: 'Buscar paciente' }).click();
    await painel.getByLabel('Paciente de origem').selectOption(outroPaciente.id);
    await painel.getByLabel('Plano de origem').selectOption('pa02-plano-origem');
    await expect(painel.getByLabel('Versão salva')).toHaveValue('publicada');
    await painel.getByRole('button', { name: 'Carregar refeições' }).click();
    await painel.getByLabel('Refeição salva').selectOption({ label: 'Lanche publicado (1 alimentos)' });
    await painel.getByRole('button', { name: 'Copiar refeição' }).click();

    await expect(page.getByRole('textbox', { name: 'Nome da refeição' })).toHaveCount(2);
    await expect(page.getByRole('textbox', { name: 'Nome da refeição' }).nth(1)).toHaveValue('Lanche publicado');
    await expect(page.getByLabel('Objetivo clínico')).toHaveValue('Objetivo exclusivo do destino');
    await expect(page.getByText('Cópia não substitui itens existentes', { exact: false })).toHaveCount(0);
    expect(contexto.leiturasOrigemExterna).toBe(2);
    const acessibilidade = await new AxeBuilder({ page }).include('section[aria-labelledby]').analyze();
    expect(acessibilidade.violations).toEqual([]);

    await page.getByLabel('Revisei os dados da avaliação e confirmo a aplicabilidade da fórmula para este paciente.').check();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => contexto.entradaSalva).toBeTruthy();
    const entrada = contexto.entradaSalva;
    expect(entrada.avaliacaoAntropometricaId).toBe('pa02-avaliacao-sintetica');
    expect(entrada.objetivos).toBe('Objetivo exclusivo do destino');
    expect(entrada.refeicoes.map((refeicao) => refeicao.nome)).toEqual(['Almoço atual', 'Lanche publicado']);
    expect(entrada.refeicoes[0].itens[0].alimentoComposicaoId).toBe('catalogo-arroz');
    expect(entrada.refeicoes[1].itens[0].alimentoComposicaoId).toBe('catalogo-banana');
    expect(JSON.stringify(entrada)).not.toContain('origem-pub-r');
    expect(JSON.stringify(entrada)).not.toContain('origem-pub-r-item');
    expect(JSON.stringify(entrada)).not.toContain('pa02-publicado-origem');
    expect(contexto.sourcePublished.refeicoes[0].itens[0].descricao).toBe('Banana sintética');
    expect(contexto.sourceDraft.refeicoes[0].nome).toBe('Jantar em rascunho');
  });

  test('acrescenta alimentos e alternativas sem alterar nome, horário, orientação ou alimento atual', async ({ page }) => {
    await preparar(page);
    const painel = painelCopia(page);
    await painel.getByLabel('Paciente de origem').selectOption(paciente.id);
    await painel.getByLabel('Plano de origem').selectOption('pa02-plano-origem');
    await painel.getByLabel('Versão salva').selectOption('rascunho');
    await painel.getByRole('button', { name: 'Carregar refeições' }).click();
    await painel.getByLabel('Refeição salva').selectOption({ label: 'Jantar em rascunho (1 alimentos)' });
    await painel.getByLabel('Acrescentar alimentos a uma refeição').check();
    await painel.getByLabel('Refeição de destino').selectOption({ label: 'Almoço atual' });
    await painel.getByRole('button', { name: 'Copiar refeição' }).click();
    const nomes = page.getByRole('textbox', { name: 'Nome da refeição' });
    await expect(nomes).toHaveCount(1);
    await expect(nomes.first()).toHaveValue('Almoço atual');
    await expect(page.getByLabel('Horário', { exact: true }).first()).toHaveValue('08:15');
    await expect(page.getByLabel('Orientações da refeição')).toHaveValue('Manter esta orientação');
    const alimentos = page.getByRole('textbox', { name: 'Alimento' });
    await expect(alimentos).toHaveCount(4);
    await expect(alimentos.nth(0)).toHaveValue('Arroz sintético');
    await expect(alimentos.nth(1)).toHaveValue('Alternativa sintética');
    await expect(alimentos.nth(2)).toHaveValue('Feijão sintético');
    await expect(alimentos.nth(3)).toHaveValue('Alternativa sintética');
    await conferirSemOverflow(page);
  });

  test('se a autorização da origem for revogada, mantém o rascunho de destino intacto', async ({ page }) => {
    const contexto = await preparar(page, { falharRevalidacaoOrigem: true });
    const painel = painelCopia(page);
    await painel.getByLabel('Buscar outro paciente autorizado (opcional)').fill('Outra');
    await painel.getByRole('button', { name: 'Buscar paciente' }).click();
    await painel.getByLabel('Paciente de origem').selectOption(outroPaciente.id);
    await painel.getByLabel('Plano de origem').selectOption('pa02-plano-origem');
    await painel.getByRole('button', { name: 'Carregar refeições' }).click();
    await painel.getByLabel('Refeição salva').selectOption({ label: 'Lanche publicado (1 alimentos)' });
    await painel.getByRole('button', { name: 'Copiar refeição' }).click();

    await expect(painel.getByRole('alert')).toContainText('Seu perfil não possui permissão para acessar este conteúdo.');
    await expect(page.getByRole('textbox', { name: 'Nome da refeição' })).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Nome da refeição' }).first()).toHaveValue('Almoço atual');
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toHaveCount(0);
    expect(contexto.leiturasOrigemExterna).toBe(2);
  });

  test('se o rascunho salvo mudar após a seleção, exige carregá-lo novamente', async ({ page }) => {
    await preparar(page, { alterarVersaoNaColagem: true });
    const painel = painelCopia(page);
    await painel.getByLabel('Buscar outro paciente autorizado (opcional)').fill('Outra');
    await painel.getByRole('button', { name: 'Buscar paciente' }).click();
    await painel.getByLabel('Paciente de origem').selectOption(outroPaciente.id);
    await painel.getByLabel('Plano de origem').selectOption('pa02-plano-origem');
    await painel.getByLabel('Versão salva').selectOption('rascunho');
    await painel.getByRole('button', { name: 'Carregar refeições' }).click();
    await painel.getByLabel('Refeição salva').selectOption({ label: 'Jantar em rascunho (1 alimentos)' });
    await painel.getByLabel('Criar nova refeição').check();
    await painel.getByRole('button', { name: 'Copiar refeição' }).click();

    await expect(painel.getByRole('alert')).toContainText('A versão de origem foi alterada. Carregue-a novamente antes de copiar.');
    await expect(page.getByRole('textbox', { name: 'Nome da refeição' })).toHaveCount(1);
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toHaveCount(0);
  });

  test('se só a revisão editorial da origem mudar, exige nova conferência sem copiar dados obsoletos', async ({ page }) => {
    await preparar(page, { alterarSomenteRevisaoNaColagem: true });
    const painel = painelCopia(page);
    await painel.getByLabel('Buscar outro paciente autorizado (opcional)').fill('Outra');
    await painel.getByRole('button', { name: 'Buscar paciente' }).click();
    await painel.getByLabel('Paciente de origem').selectOption(outroPaciente.id);
    await painel.getByLabel('Plano de origem').selectOption('pa02-plano-origem');
    await painel.getByLabel('Versão salva').selectOption('rascunho');
    await painel.getByRole('button', { name: 'Carregar refeições' }).click();
    await painel.getByLabel('Refeição salva').selectOption({ label: 'Jantar em rascunho (1 alimentos)' });
    await painel.getByLabel('Criar nova refeição').check();
    await painel.getByRole('button', { name: 'Copiar refeição' }).click();

    await expect(painel.getByRole('alert')).toContainText('A versão de origem foi alterada. Carregue-a novamente antes de copiar.');
    await expect(page.getByRole('textbox', { name: 'Nome da refeição' })).toHaveCount(1);
    await expect(page.getByText('Existem alterações não salvas neste rascunho.')).toHaveCount(0);
  });
});
