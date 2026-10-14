import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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
  return { id, numero, status, criadoEm: instante, atualizadoEm: instante, objetivos, observacoes: 'Observação sintética de origem', refeicoes };
}

async function preparar(page, { falharRevalidacaoOrigem = false, alterarVersaoNaColagem = false, planosPaginados = false } = {}) {
  let leiturasOrigemExterna = 0;
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'synthetic', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'synthetic', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ autenticado: true, apiUrl: 'http://localhost:3001', tenantSlug: 'pa02-sintetico', email: 'profissional.sintetico@example.test', expiraEm: instante, papel: 'Professional', permissoes, destinoInicial: '/pacientes' }) }));
  await page.route((url) => url.pathname === '/api/profissionais', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'pa02-profissional', tenantId: 'pa02-tenant-sintetico', nome: 'Profissional Sintético', criadoEm: instante }], total: 1 }) }));
  await page.route((url) => url.pathname === `/api/pacientes/${paciente.id}/prontuario`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ paciente, resumo: { consultas: 0, formulariosPendentes: 0, respostas: 0, checkinsRapidos: 0, mensagens: 0, evolucoes: 0, tarefasPendentes: 0, indicadoresRecentes: [], leituraClinica: { deltaUltimaAvaliacao: [], deltaDesdeInicio: [], condutasVencendo: [] } }, linhaDoTempo: [] }) }));
  const avaliacao = { id: 'pa02-avaliacao-sintetica', pacienteId: paciente.id, avaliadaEm: '2026-10-01', protocolo: 'nenhum', medidas: {}, resultado: { protocoloAplicado: 'nenhum', avisos: [] }, metricasCompartilhadasPortal: [], criadoEm: instante };
  await page.route((url) => url.pathname === `/api/pacientes/${paciente.id}/avaliacoes-antropometricas`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ avaliacoes: [avaliacao], deltaUltimas: [] }) }));
  await page.route((url) => url.pathname === '/api/planos-alimentares/modelos' || url.pathname === '/api/planos-alimentares/receitas', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 100 }) }));
  await page.route((url) => url.pathname === '/api/pacientes', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [outroPaciente], total: 1 }) }));

  const destino = versao({ id: 'pa02-draft-destino', numero: 2, status: 'rascunho', objetivos: 'Objetivo exclusivo do destino', refeicoes: [refeicao('destino-r', 'Almoço atual', 'Arroz sintético', 'Manter esta orientação')] });
  const sourcePublished = versao({ id: 'pa02-publicado-origem', numero: 3, status: 'publicada', refeicoes: [refeicao('origem-pub-r', 'Lanche publicado', 'Banana sintética', 'Orientação publicada')] });
  const sourceDraft = versao({ id: 'pa02-rascunho-origem', numero: 4, status: 'rascunho', refeicoes: [refeicao('origem-draft-r', 'Jantar em rascunho', 'Feijão sintético', 'Orientação do rascunho')] });
  const resumoDestino = { id: 'pa02-plano-destino', pacienteId: paciente.id, profissionalId: 'pa02-profissional', titulo: 'Plano destino', criadoEm: instante, atualizadoEm: instante, draft: { id: destino.id, numero: destino.numero, status: 'rascunho', criadoEm: instante, atualizadoEm: instante }, historicoQuantidade: 1 };
  const resumoOrigem = { id: 'pa02-plano-origem', pacienteId: paciente.id, profissionalId: 'pa02-profissional', titulo: 'Plano origem salvo', criadoEm: instante, atualizadoEm: instante, current: { id: sourcePublished.id, numero: sourcePublished.numero, status: 'publicada', publicadoEm: instante, criadoEm: instante, atualizadoEm: instante }, draft: { id: sourceDraft.id, numero: sourceDraft.numero, status: 'rascunho', criadoEm: instante, atualizadoEm: instante }, historicoQuantidade: 2 };
  const planoDestino = { ...resumoDestino, historico: [], draft: { ...destino, calculo: { metaEnergeticaKcal: 2000, metasMacronutrientes: { carboidratosG: 250, proteinasG: 100, gordurasG: 67 } } } };

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
  await page.route((url) => url.pathname === `/api/pacientes/${outroPaciente.id}/planos-alimentares`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ ...resumoOrigem, pacienteId: outroPaciente.id }], total: 1, pagina: 1, limite: 25 }) }));
  await page.route((url) => url.pathname === `/api/pacientes/${outroPaciente.id}/planos-alimentares/${resumoOrigem.id}/versoes/${sourcePublished.numero}`, (route) => {
    leiturasOrigemExterna += 1;
    if (falharRevalidacaoOrigem && leiturasOrigemExterna > 1) {
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Acesso revogado no caso sintético.' }) });
    }
    const versaoAtual = alterarVersaoNaColagem && leiturasOrigemExterna > 1
      ? { ...sourcePublished, atualizadoEm: '2026-10-02T12:00:00.000Z' }
      : sourcePublished;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(versaoAtual) });
  });
  await page.route((url) => url.pathname === `/api/pacientes/${outroPaciente.id}/planos-alimentares/${resumoOrigem.id}/versoes/${sourceDraft.numero}`, (route) => {
    leiturasOrigemExterna += 1;
    const versaoAtual = alterarVersaoNaColagem && leiturasOrigemExterna > 1
      ? { ...sourceDraft, atualizadoEm: '2026-10-02T12:00:00.000Z' }
      : sourceDraft;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(versaoAtual) });
  });

  let entradaSalva;
  await page.route((url) => url.pathname === `/api/pacientes/${paciente.id}/planos-alimentares/${resumoDestino.id}/rascunho`, async (route) => {
    entradaSalva = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(planoDestino) });
  });

  await page.goto(`/pacientes/${paciente.id}?aba=plano_alimentar`);
  return { destino, sourcePublished, sourceDraft, resumoOrigem, resumoDestino, get entradaSalva() { return entradaSalva; }, get leiturasOrigemExterna() { return leiturasOrigemExterna; } };
}

function painelCopia(page) {
  return page.getByRole('region', { name: 'Copiar uma refeição salva' });
}

async function conferirSemOverflow(page) {
  const largura = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, conteudo: document.documentElement.scrollWidth }));
  expect(largura.conteudo).toBeLessThanOrEqual(largura.viewport);
}

test.describe('PA02 - copiar refeições sem substituir o plano de destino', () => {
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
    await expect(page.getByLabel('Horário').first()).toHaveValue('08:15');
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
});
