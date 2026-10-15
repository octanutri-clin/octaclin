import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pacienteId = 'paciente-pa05-sintetico';
const planoId = 'plano-pa05-sintetico';
const permissoes = [
  'console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar',
  'profissionais.ler', 'planos_alimentares.ler', 'planos_alimentares.gerenciar'
];

const preferencias = (ajustes = {}) => ({
  schemaVersao: 1,
  profissional: { horario: true, macros: true, medidasCaseiras: true, orientacoes: true, substituicoesExpandidas: false, modoCompacto: false },
  paciente: { horario: true, macros: true, medidasCaseiras: true, orientacoes: true, substituicoesExpandidas: false, modoCompacto: false },
  ...ajustes
});

const refeicao = {
  id: 'refeicao-pa05-1', ordem: 0, nome: 'Café sintético', horarioLocal: '08:00', orientacoes: 'Orientação sintética',
  itens: [{
    id: 'item-pa05-1', ordem: 0, descricao: 'Alimento principal', quantidade: 1, unidade: 'porção', porcaoGramas: 100,
    composicaoSnapshot: {
      origem: 'manual', descricao: 'Alimento principal',
      nutrientesPor100g: { energiaKcal: 120, proteinasG: 4, carboidratosG: 20, gordurasG: 2 },
      nutrientesPorcao: { energiaKcal: 120, proteinasG: 4, carboidratosG: 20, gordurasG: 2 }
    },
    substituicoes: [{
      id: 'substituicao-aprovada', ordem: 0, descricao: 'Alternativa aprovada', quantidade: 1, unidade: 'unidade', porcaoGramas: 80,
      liberadaParaPaciente: true, preferida: false,
      composicaoSnapshot: {
        origem: 'manual', descricao: 'Alternativa aprovada',
        nutrientesPor100g: { energiaKcal: 90, proteinasG: 3, carboidratosG: 15, gordurasG: 1 },
        nutrientesPorcao: { energiaKcal: 72, proteinasG: 2.4, carboidratosG: 12, gordurasG: 0.8 }
      }
    }, {
      id: 'substituicao-privada', ordem: 1, descricao: 'Alternativa privada', quantidade: 1, unidade: 'unidade', porcaoGramas: 60, liberadaParaPaciente: false, preferida: false,
      composicaoSnapshot: { origem: 'manual', descricao: 'Alternativa privada', nutrientesPor100g: { energiaKcal: 100, proteinasG: 2, carboidratosG: 20, gordurasG: 1 }, nutrientesPorcao: { energiaKcal: 60, proteinasG: 1.2, carboidratosG: 12, gordurasG: 0.6 } }
    }]
  }]
};

function versao({ id, numero, status, prefs = preferencias() }) {
  return {
    id, numero, status, avaliacaoAntropometricaId: 'avaliacao-pa05', formulaCodigo: 'mifflin_st_jeor_1990',
    objetivos: 'Objetivo sintético do plano.', observacoes: 'Observação sintética.',
    calculo: {
      possuiCondicaoEspecial: false, aplicabilidadeFormulaConfirmada: true,
      fatorAtividade: 1.4, ajusteEnergeticoKcal: 0, metaEnergeticaKcal: 2000,
      metasMacronutrientes: { carboidratosG: 250, proteinasG: 100, gordurasG: 66 },
      distribuicaoMacros: { carboidratosBasisPoints: 5000, proteinasBasisPoints: 2000, gordurasBasisPoints: 3000 }
    },
    totais: { energiaKcal: 120, proteinasG: 4, carboidratosG: 20, gordurasG: 2 },
    apresentacaoEstado: 'configurada', apresentacaoRevisao: 3, preferenciasApresentacao: prefs,
    criadoEm: '2026-10-10T12:00:00.000Z', atualizadoEm: '2026-10-10T12:00:00.000Z',
    publicadaEm: status === 'publicada' ? '2026-10-10T12:00:00.000Z' : undefined,
    refeicoes: [refeicao]
  };
}

async function prepararConsole(page) {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Professional', domain: 'localhost', path: '/' },
    { name: 'octaclin_destino_inicial', value: encodeURIComponent('/pacientes'), domain: 'localhost', path: '/' }
  ]);
  await page.route((url) => url.pathname === '/api/auth/session', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ autenticado: true, apiUrl: 'http://localhost:3001', tenantSlug: 'clinica-sintetica',
      email: 'profissional.sintetico@example.test', expiraEm: '2026-10-30T12:00:00.000Z', papel: 'Professional', permissoes, destinoInicial: '/pacientes' })
  }));
  await page.route((url) => url.pathname === '/api/profissionais', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [{ id: 'profissional-pa05', nome: 'Profissional Sintético' }], total: 1 })
  }));
  await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/prontuario`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      paciente: { id: pacienteId, tenantId: 'tenant-pa05', profissionalResponsavelId: 'profissional-pa05', nome: 'Paciente Sintético', statusAdesao: 'aderente' },
      resumo: { consultas: 0, formulariosPendentes: 0, respostas: 0, checkinsRapidos: 0, mensagens: 0, evolucoes: 0, tarefasPendentes: 0,
        indicadoresRecentes: [], leituraClinica: { deltaUltimaAvaliacao: [], deltaDesdeInicio: [], condutasVencendo: [] } }, linhaDoTempo: []
    })
  }));
  await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/avaliacoes-antropometricas`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ avaliacoes: [{ id: 'avaliacao-pa05', avaliadaEm: '2026-10-09T12:00:00.000Z', medidas: { pesoKg: 70, alturaCm: 170 } }], deltaUltimas: [] })
  }));
  await page.route((url) => url.pathname === '/api/planos-alimentares/modelos', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 100 })
  }));
  await page.route((url) => url.pathname === '/api/planos-alimentares/receitas', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [], total: 0, pagina: 1, limite: 100 })
  }));
}

test.describe('PA05 apresentação versionada', () => {
  test('salva os dois conjuntos de preferências com identidade e revisão do rascunho', async ({ page }) => {
    await prepararConsole(page);
    let draft = { ...versao({ id: 'draft-pa05', numero: 2, status: 'rascunho' }), apresentacaoEstado: 'indisponivel', preferenciasApresentacao: undefined };
    const current = versao({ id: 'current-pa05', numero: 1, status: 'publicada' });
    let payloadSalvo;
    let salvamentos = 0;
    let detalhe = { id: planoId, pacienteId, profissionalId: 'profissional-pa05', titulo: 'Plano sintético', criadoEm: '2026-10-10T12:00:00.000Z', atualizadoEm: '2026-10-10T12:00:00.000Z', current, draft, historico: [{ id: current.id, numero: 1, status: 'publicada', publicadaEm: current.publicadaEm }] };
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares`, (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [detalhe], total: 1, pagina: 1, limite: 25 })
    }));
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detalhe) }));
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}/rascunho`, async (route) => {
      if (route.request().method() !== 'PUT') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(draft) });
      salvamentos += 1;
      payloadSalvo = route.request().postDataJSON();
      if (salvamentos > 1) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ statusCode: 409, message: 'Rascunho alterado por outra sessão.' }) });
      draft = { ...draft, apresentacaoRevisao: 4, preferenciasApresentacao: payloadSalvo.preferenciasApresentacao };
      detalhe = { ...detalhe, draft };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(draft) });
    });

    await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Preferências de exibição' })).toBeVisible();
    const acessibilidade = await new AxeBuilder({ page }).include('[data-pa05-preferencias]').analyze();
    expect(acessibilidade.violations).toEqual([]);
    await expect(page.getByText(/configuração de exibição salva não pode ser lida/)).toBeVisible();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(page.getByText(/Revise e altere uma preferência/)).toBeVisible();
    expect(salvamentos).toBe(0);
    const horariosProfissional = page.getByRole('group', { name: 'Visualização do profissional' }).getByLabel('Horários');
    await horariosProfissional.focus();
    await expect(horariosProfissional).toBeFocused();
    await page.keyboard.press('Space');
    await expect(horariosProfissional).not.toBeChecked();
    await page.getByRole('group', { name: 'Portal e impressão/PDF do paciente' }).getByLabel('Medidas caseiras').uncheck();
    const previaProfissional = page.getByRole('region', { name: 'Prévia profissional' });
    await expect(previaProfissional.getByText('Café sintético')).toBeVisible();
    await expect(previaProfissional.getByText('08:00')).toHaveCount(0);
    await expect(previaProfissional.getByText(/1 porção \(100 g\)/)).toBeVisible();
    await page.getByRole('group', { name: 'Visualização do profissional' }).getByLabel('Medidas caseiras').uncheck();
    await page.getByRole('group', { name: 'Visualização do profissional' }).getByLabel('Substituições abertas inicialmente').check();
    const alternativaProfissional = previaProfissional.locator('details li').filter({ hasText: 'Alternativa aprovada' });
    await expect(alternativaProfissional).toBeVisible();
    await expect(alternativaProfissional).not.toContainText('unidade');
    await expect(alternativaProfissional).toContainText('80 g');
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();

    await expect.poll(() => payloadSalvo).toBeTruthy();
    expect(payloadSalvo.rascunhoIdEsperado).toBe('draft-pa05');
    expect(payloadSalvo.apresentacaoRevisaoEsperada).toBe(3);
    expect(payloadSalvo.preferenciasApresentacao.profissional.horario).toBe(false);
    expect(payloadSalvo.preferenciasApresentacao.paciente.medidasCaseiras).toBe(false);
    await expect(page.getByRole('group', { name: 'Visualização do profissional' }).getByLabel('Horários')).not.toBeChecked();
    await expect(page.getByRole('group', { name: 'Portal e impressão/PDF do paciente' }).getByLabel('Medidas caseiras')).not.toBeChecked();

    await page.getByRole('group', { name: 'Portal e impressão/PDF do paciente' }).getByLabel('Horários').uncheck();
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect.poll(() => salvamentos).toBe(2);
    await expect(page.getByRole('group', { name: 'Portal e impressão/PDF do paciente' }).getByLabel('Horários')).not.toBeChecked();
    await expect(page.getByText(/Rascunho alterado por outra sessão/)).toBeVisible();
    const medidasViewport = await page.evaluate(() => ({ documento: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(medidasViewport.documento).toBeLessThanOrEqual(medidasViewport.viewport + 1);
  });

  test('prévia do rascunho e impressão usam somente a projeção paciente', async ({ page }) => {
    await prepararConsole(page);
    const draft = versao({ id: 'draft-pa05', numero: 2, status: 'rascunho' });
    const current = versao({ id: 'current-pa05', numero: 1, status: 'publicada' });
    const detalhe = { id: planoId, pacienteId, profissionalId: 'profissional-pa05', titulo: 'Plano sintético', criadoEm: '2026-10-10T12:00:00.000Z', atualizadoEm: '2026-10-10T12:00:00.000Z', current, draft, historico: [{ id: current.id, numero: 1, status: 'publicada', publicadaEm: current.publicadaEm }] };
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [detalhe], total: 1, pagina: 1, limite: 25 }) }));
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detalhe) }));
    const projeção = (status) => ({
      id: planoId, titulo: 'Plano sintético', numeroVersao: status === 'publicada' ? 1 : 2, status,
      publicadoEm: status === 'publicada' ? current.publicadaEm : undefined,
      apresentacaoEstado: 'configurada', preferenciasApresentacao: { ...preferencias().paciente, medidasCaseiras: false },
      objetivo: 'Objetivo do paciente', metaEnergeticaKcal: 2000,
      macros: { carboidratosG: 250, proteinasG: 100, gordurasG: 66 },
      refeicoes: [{ id: 'refeicao-projecao', nome: 'Café sintético', horarioLocal: '08:00', orientacoes: 'Orientação do paciente', itens: [{
        id: 'item-projecao', descricao: 'Alimento principal', quantidade: 1, unidade: 'porção', porcaoGramas: 100,
        substituicoesVisiveisInicialmente: 1, escolhaAtualSubstituicaoId: undefined,
        substituicoes: [{ id: 'aprovada', descricao: 'Alternativa aprovada', quantidade: 1, unidade: 'unidade', porcaoGramas: 80, preferida: true }]
      }]}]
    });
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}/versoes/2/apresentacao-paciente`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projeção('rascunho')) }));
    let falhaImpressao = false;
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}/versoes/1/apresentacao-paciente`, (route) => falhaImpressao
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, message: 'Prévia indisponível.' }) })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projeção('publicada')) }));
    await page.addInitScript(() => { window.__pa05Impressao = 0; window.print = () => { window.__pa05Impressao += 1; }; });

    await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Prévia do paciente' }).click();
    const preview = page.getByRole('region', { name: 'Prévia do paciente' });
    await expect(preview.getByText('Prévia do rascunho salvo — ainda não publicado')).toBeVisible();
    await expect(preview.getByText('Alimento principal', { exact: true })).toBeVisible();
    await expect(preview.getByRole('list', { name: 'Itens de Café sintético' }).getByText('100 g', { exact: true })).toBeVisible();
    await expect(preview.getByRole('button', { name: /Alternativa aprovada/ })).toHaveCount(0);
    await expect(preview.getByRole('button', { name: /Ver substituições/ })).toBeVisible();
    await expect(preview.getByRole('button', { name: 'Confirmar troca' })).toHaveCount(0);
    await preview.getByRole('button', { name: /Ver substituições/ }).click();
    await expect(preview.locator('ul[class~="print:hidden"]').getByText(/Alternativa aprovada - 80 g/)).toBeVisible();

    await page.getByRole('button', { name: 'Fechar prévia' }).click();
    await page.getByRole('button', { name: 'Imprimir' }).click();
    await expect.poll(() => page.evaluate(() => window.__pa05Impressao)).toBe(1);
    await page.emulateMedia({ media: 'print' });
    const folha = page.locator('[data-impressao-paciente-chave]');
    await expect(folha.getByText(/Alternativa aprovada — 80 g/)).toBeVisible();
    await expect(folha.getByText(/rascunho salvo/)).toHaveCount(0);
    expect(await folha.innerText()).not.toContain('Alternativa privada');
    await expect(page.getByRole('region', { name: 'Prévia profissional' })).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    falhaImpressao = true;
    await page.getByRole('button', { name: 'Imprimir' }).click();
    await expect(page.getByText(/Nenhum conteúdo foi enviado à impressão/)).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__pa05Impressao)).toBe(1);
    await expect(page.locator('[data-impressao-paciente-chave]')).toHaveCount(0);
  });

  for (const acao of ['troca', 'edicao']) {
  test(acao === 'troca' ? 'troca de plano durante a busca da impressão descarta a resposta obsoleta' : 'edição durante a busca da prévia descarta a resposta obsoleta', async ({ page }) => {
    await prepararConsole(page);
    const current = versao({ id: 'current-pa05', numero: 1, status: 'publicada' });
    const draft = versao({ id: 'draft-pa05', numero: 2, status: 'rascunho' });
    const detalhe = { id: planoId, pacienteId, profissionalId: 'profissional-pa05', titulo: 'Plano sintético', criadoEm: '2026-10-10T12:00:00.000Z', atualizadoEm: '2026-10-10T12:00:00.000Z', current, draft, historico: [{ id: current.id, numero: 1, status: 'publicada', publicadaEm: current.publicadaEm }] };
    const idAlternativo = 'plano-pa05-alternativo';
    const detalheAlternativo = {
      ...detalhe,
      id: idAlternativo,
      titulo: 'Plano sintético alternativo',
      current: { ...current, id: 'current-pa05-alternativo' },
      draft: { ...draft, id: 'draft-pa05-alternativo' }
    };
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares`, (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ itens: [detalhe, detalheAlternativo], total: 2, pagina: 1, limite: 25 })
    }));
    await page.route((url) => url.pathname.startsWith(`/api/pacientes/${pacienteId}/planos-alimentares/`) && !url.pathname.endsWith('/rascunho'), (route) => {
      const id = new URL(route.request().url()).pathname.split('/')[5];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(id === idAlternativo ? detalheAlternativo : detalhe) });
    });
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/avaliacoes-antropometricas`, (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ avaliacoes: [], deltaUltimas: [] })
    }));
    await page.route((url) => url.pathname.endsWith('/versoes/1/acompanhamento'), (route) => {
      const id = new URL(route.request().url()).pathname.split('/')[5];
      const versaoId = id === idAlternativo ? detalheAlternativo.current.id : current.id;
      return route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({
        versao: { id: versaoId, numero: 1 }, periodo: { inicioEm: '2026-10-10T12:00:00.000Z' },
        checkins: { itens: [], total: 0, pagina: 1, limite: 25 },
        questionariosSemResposta: { itens: [], total: 0, pagina: 1, limite: 25, semReferenciaTemporal: 0 },
        escolhas: { itens: [], total: 0, pagina: 1, limite: 25 }
      })
      });
    });
    let iniciarResposta;
    let liberarResposta;
    const requisicaoIniciada = new Promise((resolve) => { iniciarResposta = resolve; });
    const respostaLiberada = new Promise((resolve) => { liberarResposta = resolve; });
    const numero = acao === 'troca' ? 1 : 2;
    await page.route((url) => url.pathname === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}/versoes/${numero}/apresentacao-paciente`, async (route) => {
      iniciarResposta();
      await respostaLiberada;
      try {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: planoId, titulo: 'Projeção sintética obsoleta', numeroVersao: numero, status: acao === 'troca' ? 'publicada' : 'rascunho', apresentacaoEstado: 'configurada', refeicoes: [] }) });
      } catch {
        // A troca do plano deve abortar esta requisição antes de a resposta chegar.
      }
    });
    await page.addInitScript(() => { window.__pa05ImpressaoObsoleta = 0; window.print = () => { window.__pa05ImpressaoObsoleta += 1; }; });

    await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: acao === 'troca' ? 'Imprimir' : 'Prévia do paciente' }).click();
    await requisicaoIniciada;
    if (acao === 'troca') {
      await page.getByRole('button', { name: 'Plano sintético alternativo' }).click();
      await expect(page.getByRole('button', { name: 'Plano sintético alternativo' })).toHaveAttribute('aria-current', 'true');
    } else {
      await page.getByRole('group', { name: 'Visualização do profissional' }).getByLabel('Horários').uncheck();
    }
    liberarResposta();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__pa05ImpressaoObsoleta)).toBe(0);
    await expect(page.locator('[data-impressao-paciente-chave]')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Prévia do paciente' })).toHaveCount(0);
  });
  }
});
