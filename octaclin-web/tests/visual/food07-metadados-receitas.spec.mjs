import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pacienteId = 'food07-paciente-sintetico', planoId = 'food07-plano-sintetico';
const receitaId = '10000000-0000-4000-8000-000000000071';
const instante = '2026-10-29T12:00:00.000Z';
const nutrientes = { energiaKcal: 100, proteinasG: 10, carboidratosG: 10, gordurasG: 2 };
const ingrediente = { descricao: 'Ingrediente A sintético', quantidade: 4, unidade: 'medida', porcaoGramas: 500, nutrientesPor100g: nutrientes };
const receita = { id: receitaId, nome: 'Receita sintética FOOD07', origem: 'pessoal', tipo: 'receita', categoria: 'Lanche', versaoAtual: 3, totalItens: 1, atualizadoEm: instante, metadados: { schemaVersao: 1, etiquetas: ['Prático'], baseQuantidades: 'receita_inteira', rendimentoPorcoes: 4, tempoPreparoMinutos: 20 }, itens: [ingrediente], instrucoes: 'Misture 500 g de A.', alimentosIndisponiveis: [] };
const permissoes = ['console.acessar', 'pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar', 'profissionais.ler', 'planos_alimentares.ler', 'planos_alimentares.gerenciar'];
const erros = new WeakMap();
test.beforeEach(({ page }) => { const lista = []; erros.set(page, lista); page.on('pageerror', e => lista.push(e.message)); });
test.afterEach(({ page }) => expect(erros.get(page)).toEqual([]));

async function preparar(context, { portal = false, librarySize = 1, fingerprints = [] } = {}) {
  const pedidos = [], previas = [], envios = [], gravacoes = [], receitasCriadas = [], receitasAtualizadas = [];
  const refeicao = { id: 'food07-refeicao', nome: 'Lanche sintético', ordem: 0, horarioLocal: '15:00', itens: [{ ...ingrediente, id: 'food07-item', ordem: 0, composicaoSnapshot: { origem: 'manual', descricao: ingrediente.descricao, nutrientesPor100g: nutrientes, nutrientesPorcao: { energiaKcal: 500, proteinasG: 50, carboidratosG: 50, gordurasG: 10 } }, substituicoes: [] }] };
  const refeicaoJantar = { ...refeicao, id: 'food07-refeicao-jantar', nome: 'Jantar sintético', ordem: 1, itens: [{ ...refeicao.itens[0], id: 'food07-item-jantar', descricao: 'Ingrediente do jantar sintético', quantidade: 2, porcaoGramas: 250, composicaoSnapshot: { ...refeicao.itens[0].composicaoSnapshot, descricao: 'Ingrediente do jantar sintético' } }] };
  const draft = { id: 'food07-draft', numero: 1, status: 'rascunho', rascunhoRevisao: 1, objetivos: 'Objetivo sintético', criadoEm: instante, atualizadoEm: instante, refeicoes: [refeicao, refeicaoJantar], ativacaoRefeicoes: [], ativacaoEdicao: [], ativoParaPaciente: true, ativacaoRevisao: 1 };
  const plano = { id: planoId, pacienteId, profissionalId: 'food07-profissional', titulo: 'Plano FOOD07', criadoEm: instante, atualizadoEm: instante, ativoParaPaciente: true, ativacaoRevisao: 1, draft, historico: [] };
  let bibliotecaAtiva = Array.from({ length: librarySize }, (_, indice) => indice === 0 ? receita : { ...receita, id: `00000000-0000-4000-8000-${String(indice).padStart(12, '0')}`, nome: `Receita sintética FOOD07 ${indice + 1}`, versaoAtual: 1, metadados: { ...receita.metadados, etiquetas: [`tag-${indice + 1}`] } });
  await context.addCookies([{ name: 'octaclin_access_token', value: 'synthetic', domain: 'localhost', path: '/' }, { name: 'octaclin_refresh_token', value: 'synthetic', domain: 'localhost', path: '/' }, { name: 'octaclin_papel', value: portal ? 'Patient' : 'Professional', domain: 'localhost', path: '/' }, { name: 'octaclin_destino_inicial', value: encodeURIComponent(portal ? '/portal' : '/pacientes'), domain: 'localhost', path: '/' }]);
  await context.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    let corpo = { itens: [], total: 0, pagina: 1, limite: 25 };
    if (path === '/api/auth/session') corpo = { autenticado: true, tenantSlug: 'food07-sintetico', email: 'sintetico@example.test', papel: portal ? 'Patient' : 'Professional', permissoes, destinoInicial: portal ? '/portal' : '/pacientes', expiraEm: '2026-11-01T12:00:00Z' };
    else if (path.endsWith('/prontuario')) corpo = { paciente: { id: pacienteId, nome: 'Paciente Sintético', tenantId: 'food07-tenant', profissionalResponsavelId: plano.profissionalId, statusAdesao: 'aderente' }, resumo: { consultas: 0, formulariosPendentes: 0, respostas: 0, checkinsRapidos: 0, mensagens: 0, evolucoes: 0, tarefasPendentes: 0, indicadoresRecentes: [], leituraClinica: { deltaUltimaAvaliacao: [], deltaDesdeInicio: [], condutasVencendo: [] } }, linhaDoTempo: [] };
    else if (path.endsWith('/prioridade-acompanhamento')) corpo = { pacienteId, apurado: false, valorCalculado: { score: 0, faixa: 'baixa', fatores: [] }, valorEfetivo: { faixa: 'baixa', origem: 'calculado' } };
    else if (path.endsWith('/avaliacoes-antropometricas')) corpo = { avaliacoes: [], deltaUltimas: [] };
    else if (path === '/api/profissionais') corpo = { itens: [{ id: plano.profissionalId, nome: 'Profissional Sintético' }], total: 1 };
    else if (path === `/api/pacientes/${pacienteId}/planos-alimentares`) corpo = { itens: [plano], total: 1, pagina: 1, limite: 25 };
    else if (path === `/api/pacientes/${pacienteId}/planos-alimentares/${planoId}`) corpo = plano;
    else if (path.endsWith('/acompanhamento')) corpo = null;
    else if (path.endsWith('/rascunho/edicao')) { const p = req.postDataJSON(); gravacoes.push(p); Object.assign(draft, { documentoEdicao: p.documento, rascunhoRevisao: p.rascunhoRevisaoEsperada + 1, edicaoEstado: 'pendente' }); corpo = draft; }
    else if (path === '/api/notificacoes') corpo = { naoLidas: 0, itens: [], resumos: [] };
    else if (path.endsWith('/resumos/gerar')) corpo = { gerado: false };
    else if (path === '/api/planos-alimentares/receitas/consulta' || path === '/api/planos-alimentares/receitas') {
      const consulta = req.method() === 'POST' && path.endsWith('/consulta') ? req.postDataJSON() : {};
      if (req.method() === 'POST' && path.endsWith('/consulta')) pedidos.push(consulta);
      const filtradas = bibliotecaAtiva.filter((item) => (!consulta.categoria || item.categoria === consulta.categoria) && (!consulta.etiqueta || item.metadados.etiquetas.includes(consulta.etiqueta)) && (!consulta.origem || item.origem === consulta.origem) && (!consulta.tipo || item.tipo === consulta.tipo));
      const limite = consulta.limite ?? 25, pagina = consulta.pagina ?? 1;
      if (req.method() === 'POST' && path === '/api/planos-alimentares/receitas') {
        receitasCriadas.push(req.postDataJSON()); corpo = { id: '10000000-0000-4000-8000-000000000073', versaoAtual: 1, totalItens: 1 };
      } else corpo = { itens: filtradas.slice((pagina - 1) * limite, pagina * limite), total: filtradas.length, pagina, limite };
    } else if (path === `/api/planos-alimentares/receitas/${receitaId}` && req.method() === 'PUT') { receitasAtualizadas.push(req.postDataJSON()); corpo = { ...receita, versaoAtual: 4, metadados: { schemaVersao: 1, etiquetas: [] } }; }
    else if (path === `/api/planos-alimentares/receitas/${receitaId}`) corpo = receita;
    else if (path.startsWith('/api/planos-alimentares/receitas/') && req.method() === 'DELETE') {
      const removida = path.split('/').at(-1); bibliotecaAtiva = bibliotecaAtiva.filter((item) => item.id !== removida); corpo = { id: removida, arquivadoEm: instante };
    }
    else if (path.endsWith('/previa-porcionamento')) {
      const p = req.postDataJSON(); previas.push(p); const f = p.porcoesDesejadas / 4;
      corpo = { receitaId, versao: 3, fingerprint: fingerprints.shift() ?? 'a'.repeat(64), estado: 'calculavel', baseQuantidades: 'receita_inteira', rendimentoOriginalPorcoes: 4, porcoesDesejadas: p.porcoesDesejadas, fatorExato: { numerador: '3', denominador: '8' }, itens: [{ ...ingrediente, quantidade: 4*f, porcaoGramas: 500*f }], avisos: [], fontes: [], denominador: { porcoes: p.porcoesDesejadas, descricao: `Totais para ${p.porcoesDesejadas} porções` }, totais: { energiaKcal: { estado: 'conhecido', unidade: 'kcal', valor: 500*f }, proteinasG: { estado: 'conhecido', unidade: 'g', valor: 50*f }, carboidratosG: { estado: 'ausente', unidade: 'g' }, gordurasG: { estado: 'conhecido', unidade: 'g', valor: 10*f } } };
    } else if (path === '/api/planos-alimentares/receitas/compartilhamentos') { envios.push(req.postDataJSON()); corpo = { quantidade: 1, agendadoPara: null, itens: [{ id: '10000000-0000-4000-8000-000000000072', receitaId, status: 'ativo' }] }; }
    else if (path.endsWith('/preferencias') || path.endsWith('/preferencias/receitas')) corpo = { email: false, whatsapp: false, push: false };
    else if (path.includes('/compartilhamentos/pacientes/')) corpo = [];
    else if (path === '/api/portal/paciente') corpo = { paciente: { id: pacienteId, nome: 'Paciente Sintético', statusAdesao: 'aderente' }, perfil: { profissionalResponsavelId: plano.profissionalId, preferenciasContato: {} }, resumo: { consultasProximas: 0, formulariosPendentes: 0, formulariosRespondidos: 0, mensagensRecentes: 0 }, consultasProximas: [], formulariosPendentes: [], formulariosRespondidos: [], mensagensRecentes: [], notificacoesPaciente: [], planoAlimentar: null, linhaDoTempo: [], lgpd: { versaoAtual: '1', documentosLegais: [], consentimentos: [], solicitacoes: [] } };
    else if (path === '/api/portal/paciente/receitas') corpo = [{ id: 'envio-sintetico', nome: receita.nome, enviadoEm: instante }];
    else if (path === '/api/portal/paciente/receitas/envio-sintetico') corpo = { id: 'envio-sintetico', receita: { nome: receita.nome, versao: 3, porcionamento: { porcoesDesejadas: 1.5, rendimentoOriginalPorcoes: 4, ingredientesAjustados: true }, conteudo: { instrucoes: 'Misture 187,5 g de A.', itens: [{ ...ingrediente, quantidade: 1.5, porcaoGramas: 187.5 }], metadados: { schemaVersao: 1, rendimentoPorcoes: 4, tempoPreparoMinutos: 20 } } } };
    await route.fulfill({ json: corpo });
  });
  return { pedidos, previas, envios, gravacoes, receitasCriadas, receitasAtualizadas };
}
async function abrir(page) { await page.goto(`/pacientes/${pacienteId}?aba=plano_alimentar`); await expect(page.getByRole('textbox', { name: 'Objetivo clínico', exact: true })).toBeEditable({ timeout: 30_000 }); }

test('FOOD07 confirma reinterpretação da base e cancela sem alterar ingredientes', async ({ context, page }) => {
  await preparar(context); await abrir(page);
  await page.getByRole('combobox', { name: 'Biblioteca', exact: true }).selectOption({ label: 'Receita sintética FOOD07 - Lanche - Receita - 1 item(ns)' });
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /Base das quantidades/ })).toHaveValue('receita_inteira');
  await page.getByRole('combobox', { name: /Base das quantidades/ }).selectOption('por_porcao');
  const modal = page.getByRole('dialog', { name: 'Confirmar mudança da base' });
  await expect(modal).toContainText('reinterpretada'); await expect(modal).toContainText('500');
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /Base das quantidades/ })).toHaveValue('receita_inteira');
});

test('FOOD07 confirma ao remover a base e envia null para limpar metadados opcionais', async ({ context, page }) => {
  const prova = await preparar(context); await abrir(page);
  await page.getByRole('combobox', { name: 'Biblioteca', exact: true }).selectOption({ label: 'Receita sintética FOOD07 - Lanche - Receita - 1 item(ns)' });
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('combobox', { name: /Base das quantidades/ }).selectOption('');
  const modal = page.getByRole('dialog', { name: 'Confirmar mudança da base' });
  await expect(modal).toContainText('não informada');
  await modal.getByRole('button', { name: 'Confirmar base', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /Base das quantidades/ })).toHaveValue('');
  await page.getByLabel('Rendimento (porções)').fill('');
  await page.getByLabel('Preparo total (minutos)').fill('');
  await page.getByLabel('Etiquetas internas').fill('');
  await page.getByRole('button', { name: 'Salvar nova versão' }).click();
  await expect(page.getByText('Receita salva na biblioteca. Envios anteriores continuam com a versão recebida.', { exact: true })).toBeVisible();
  expect(prova.receitasAtualizadas).toHaveLength(1);
  expect(prova.receitasAtualizadas[0].metadados).toMatchObject({ baseQuantidades: null, rendimentoPorcoes: null, tempoPreparoMinutos: null, etiquetas: [] });
});

test('FOOD07 prévia fracionária identifica denominador, ausência, destino e cancelamento', async ({ context, page }) => {
  const prova = await preparar(context); await abrir(page);
  await page.getByRole('combobox', { name: 'Biblioteca', exact: true }).selectOption({ label: 'Receita sintética FOOD07 - Lanche - Receita - 1 item(ns)' });
  await page.getByLabel(/Porções para inserir/).fill('1.5');
  await page.getByRole('button', { name: 'Inserir', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Conferir inserção da receita' });
  await expect(modal).toContainText('Totais para 1,5 porções'); await expect(modal).toContainText('187,5');
  await expect(modal).toContainText('Dados incompletos'); await expect(modal).toContainText('Lanche sintético');
  await page.keyboard.press('Shift+Tab');
  await expect(modal.getByRole('button', { name: 'Confirmar e inserir' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'Fechar' })).toBeFocused();
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(prova.gravacoes).toHaveLength(0); expect(prova.previas).toHaveLength(1);
});

test('FOOD07 revalida a prévia e insere somente após confirmação', async ({ context, page }) => {
  const prova = await preparar(context); await abrir(page);
  await page.getByRole('combobox', { name: 'Biblioteca', exact: true }).selectOption({ label: 'Receita sintética FOOD07 - Lanche - Receita - 1 item(ns)' });
  await page.getByLabel(/Porções para inserir/).fill('1.5');
  await page.getByRole('button', { name: 'Inserir', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Conferir inserção da receita' });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Confirmar e inserir' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByText(/Receita inserida no rascunho para 1,5 porções/)).toBeVisible();
  expect(prova.previas).toHaveLength(2);
  expect(prova.gravacoes).toHaveLength(0);
});

test('FOOD07 portal comunica quantidades ajustadas sem repetir o texto original', async ({ context, page }) => {
  await preparar(context, { portal: true });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/portal/receitas');
  await page.evaluate(() => {
    const portador = Array.from(document.querySelectorAll('script, style, link')).find(
      (elemento) => elemento.nonce
    );
    if (!portador) throw new Error('Nonce CSP não encontrado para simular ampliação de texto.');
    const estilo = document.createElement('style');
    estilo.nonce = portador.nonce;
    estilo.textContent = 'html { font-size: 200% !important; }';
    document.head.appendChild(estilo);
  });
  await page.getByRole('button', { name: 'Abrir receita' }).click();
  await expect(page.getByText('Os ingredientes abaixo já estão nas quantidades para 1,5 porções.', { exact: true })).toBeVisible();
  await expect(page.getByText(/A preparação original rendia 4 porções/)).toBeVisible();
  await expect(page.getByText('Misture 187,5 g de A.', { exact: true })).toBeVisible();
  await expect(page.getByText('Misture 500 g de A.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('1,5 medida (187,5 g)', { exact: true })).toBeVisible();
  await expect(page.getByText('Prático', { exact: true })).toHaveCount(0);
  const portalReceitas = page.getByRole('region', { name: 'Receitas compartilhadas' }).last();
  const largura = await portalReceitas.evaluate((element) => ({ conteudo: element.scrollWidth, viewport: element.clientWidth }));
  expect(largura.conteudo).toBeLessThanOrEqual(largura.viewport + 1);
  const itensNav = await page.getByRole('navigation', { name: 'Navegacao mobile do portal' }).locator('a').evaluateAll((links) => links.map((link) => {
    const label = link.querySelector('span');
    if (!label) return { semLabel: true };
    const linkRect = link.getBoundingClientRect(); const labelRect = label.getBoundingClientRect();
    return { label: label.textContent, excedeItem: labelRect.right > linkRect.right + 1 || labelRect.left < linkRect.left - 1 };
  }));
  expect(itensNav.filter((item) => !item.semLabel && item.excedeItem)).toEqual([]);
  const quantidade = page.getByText('1,5 medida (187,5 g)', { exact: true });
  await quantidade.scrollIntoViewIfNeeded();
  const posicao = await page.evaluate(() => {
    const alvo = [...document.querySelectorAll('body *')].find(el => el.textContent?.trim() === '1,5 medida (187,5 g)');
    const nav = document.querySelector('nav[aria-label="Navegacao mobile do portal"]');
    if (!alvo || !nav) return null;
    return { alvo: alvo.getBoundingClientRect().toJSON(), nav: nav.getBoundingClientRect().toJSON() };
  });
  expect(posicao).not.toBeNull();
  expect(posicao.alvo.bottom).toBeLessThanOrEqual(posicao.nav.top);
  expect((await new AxeBuilder({ page }).include('section[aria-label="Receitas compartilhadas"]:last-of-type').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});

test('FOOD07 pagina mais de cem receitas e preserva a seleção do lote entre páginas', async ({ context, page }) => {
  await preparar(context, { librarySize: 101 }); await abrir(page);
  await expect(page.getByText('101 receita(s) · página 1 de 5')).toBeVisible();
  await page.getByRole('checkbox', { name: /Receita sintética FOOD07 · Lanche · versão 3/ }).check();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByText('101 receita(s) · página 2 de 5')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Receita sintética FOOD07 26 · Lanche · versão 1/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Resumo das receitas selecionadas para envio' })).toContainText('Receita sintética FOOD07');
});

test('FOOD07 filtra por etiqueta interna e limpa filtros sem perder a página inicial', async ({ context, page }) => {
  const prova = await preparar(context, { librarySize: 101 }); await abrir(page);
  await page.getByLabel(/Filtrar por etiqueta interna/).fill('Prático');
  await expect(page.getByText('1 receita(s) · página 1 de 1')).toBeVisible();
  expect(prova.pedidos.at(-1)).toMatchObject({ pagina: 1, etiqueta: 'Prático' });
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.getByText('101 receita(s) · página 1 de 5')).toBeVisible();
});

test('FOOD07 ao arquivar o último item da página volta para a página disponível', async ({ context, page }) => {
  await preparar(context, { librarySize: 26 }); await abrir(page);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByText('26 receita(s) · página 2 de 2')).toBeVisible();
  await page.getByRole('combobox', { name: 'Biblioteca', exact: true }).selectOption({ label: 'Receita sintética FOOD07 26 - Lanche - Receita - 1 item(ns)' });
  await page.getByRole('button', { name: 'Arquivar item selecionado da biblioteca' }).click();
  await page.getByRole('dialog', { name: 'Arquivar item da biblioteca' }).getByRole('button', { name: 'Arquivar', exact: true }).click();
  await expect(page.getByText('25 receita(s) · página 1 de 1')).toBeVisible();
});

test('FOOD07 envia porção e instruções personalizadas somente após conferência por receita', async ({ context, page }) => {
  const prova = await preparar(context); await abrir(page);
  await page.getByRole('checkbox', { name: /Receita sintética FOOD07 · Lanche · versão 3/ }).check();
  const grupo = page.getByRole('group', { name: 'Quantidade para Receita sintética FOOD07' });
  await grupo.getByRole('radio', { name: 'Ajustar quantidades por porções' }).check();
  await grupo.getByLabel('Porções para este envio').fill('1.5');
  await grupo.getByRole('button', { name: 'Pré-visualizar quantidades' }).click();
  await expect(grupo.getByRole('list')).toContainText('187,5 g');
  await expect(grupo.getByRole('textbox', { name: /Instruções desta cópia do envio/ })).toHaveValue('Misture 500 g de A.');
  await grupo.getByRole('checkbox', { name: /Conferi as quantidades e as instruções/ }).check();
  await grupo.getByRole('textbox', { name: /Instruções desta cópia do envio/ }).fill('Misture 187,5 g de A.');
  await expect(grupo.getByRole('checkbox', { name: /Conferi as quantidades e as instruções/ })).not.toBeChecked();
  await grupo.getByRole('checkbox', { name: 'Conferi as quantidades e as instruções desta cópia do envio.' }).check();
  await page.getByRole('checkbox', { name: 'Confirmo que revisei o conteúdo para este paciente.' }).check();
  await page.getByRole('button', { name: /Revisar e compartilhar/ }).click();
  const confirmacao = page.getByRole('dialog', { name: 'Confirmar compartilhamento' });
  await expect(confirmacao).toContainText('Quantidades ajustadas para 1,5 porções');
  await expect(confirmacao).toContainText('Misture 187,5 g de A.');
  await confirmacao.getByRole('button', { name: 'Compartilhar agora' }).click();
  await expect(page.getByText(/receita\(s\) compartilhada\(s\) no portal/)).toBeVisible();
  expect(prova.envios).toHaveLength(1);
  expect(prova.envios[0].porcionamentos).toMatchObject([{ receitaId, porcoesDesejadas: 1.5, instrucoesPersonalizadas: 'Misture 187,5 g de A.', confirmacaoConferenciaInstrucoes: true }]);
});

test('FOOD07 reinterpreta 2,5 porções a partir dos valores originais sem compor erro de arredondamento', async ({ context, page }) => {
  const prova = await preparar(context); await abrir(page);
  await page.getByRole('combobox', { name: 'Biblioteca', exact: true }).selectOption({ label: 'Receita sintética FOOD07 - Lanche - Receita - 1 item(ns)' });
  await page.getByLabel(/Porções para inserir/).fill('2.5');
  await page.getByRole('button', { name: 'Inserir', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Conferir inserção da receita' });
  await expect(modal).toContainText('Totais para 2,5 porções');
  await expect(modal).toContainText('312,5 g');
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(prova.previas).toHaveLength(1);
  expect(prova.previas[0].porcoesDesejadas).toBe(2.5);
  expect(prova.gravacoes).toHaveLength(0);
});

test('FOOD07 ignora uma prévia tardia após trocar a receita selecionada', async ({ context, page }) => {
  await preparar(context); await abrir(page);
  await page.getByRole('combobox', { name: 'Biblioteca', exact: true }).selectOption({ label: 'Receita sintética FOOD07 - Lanche - Receita - 1 item(ns)' });
  await page.getByLabel(/Porções para inserir/).fill('1.5');
  let liberar;
  let chegou;
  const requisicaoIniciada = new Promise((resolve) => { chegou = resolve; });
  const respostaLiberada = new Promise((resolve) => { liberar = resolve; });
  await page.route('**/previa-porcionamento', async (route) => { chegou(); await respostaLiberada; await route.fulfill({ json: {} }); });
  await page.getByRole('button', { name: 'Inserir', exact: true }).click();
  await requisicaoIniciada;
  await context.clearCookies(); await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);
  liberar();
  await expect(page.getByRole('dialog', { name: 'Conferir inserção da receita' })).toHaveCount(0);
  await expect(page.getByText(/inserida no rascunho/)).toHaveCount(0);
});

test('FOOD07 bloqueia confirmação quando a fingerprint muda após a prévia', async ({ context, page }) => {
  await preparar(context, { fingerprints: ['a'.repeat(64), 'b'.repeat(64)] }); await abrir(page);
  await page.getByRole('combobox', { name: 'Biblioteca', exact: true }).selectOption({ label: 'Receita sintética FOOD07 - Lanche - Receita - 1 item(ns)' });
  await page.getByLabel(/Porções para inserir/).fill('1.5');
  await page.getByRole('button', { name: 'Inserir', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Conferir inserção da receita' });
  await modal.getByRole('button', { name: 'Confirmar e inserir' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Plano alimentar' }).getByRole('alert')).toContainText('Os dados da receita mudaram desde a prévia');
  await expect(page.getByText(/inserida no rascunho/)).toHaveCount(0);
});

test('FOOD07 salva base e etiquetas internas explicitamente e não infere metadados legados', async ({ context, page }) => {
  const prova = await preparar(context); await abrir(page);
  await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Receita nova sintética');
  await page.getByRole('textbox', { name: 'Categoria interna' }).fill('Lanche');
  await page.getByLabel('Refeição de origem').selectOption({ label: 'Jantar sintético' });
  await expect(page.getByLabel('Inserir na refeição')).toHaveValue('food07-refeicao');
  await page.getByRole('combobox', { name: 'Base das quantidades' }).selectOption('receita_inteira');
  const confirmacaoBase = page.getByRole('dialog', { name: 'Confirmar mudança da base' });
  await expect(confirmacaoBase).toContainText('receita inteira'); await expect(confirmacaoBase).toContainText('250 g');
  await confirmacaoBase.getByRole('button', { name: 'Confirmar base', exact: true }).click();
  await page.getByLabel('Rendimento (porções)').fill('4');
  await page.getByLabel('Preparo total (minutos)').fill('20');
  await page.getByLabel('Etiquetas internas').fill('prático, lanche');
  await page.getByRole('button', { name: 'Salvar na biblioteca' }).click();
  await expect(page.getByText('Receita salva na biblioteca. Envios anteriores continuam com a versão recebida.', { exact: true })).toBeVisible();
  expect(prova.receitasCriadas).toHaveLength(1);
  expect(prova.receitasCriadas[0].metadados).toMatchObject({ baseQuantidades: 'receita_inteira', rendimentoPorcoes: 4, tempoPreparoMinutos: 20, etiquetas: ['prático', 'lanche'] });
  expect(prova.receitasCriadas[0].itens[0].descricao).toBe('Ingrediente do jantar sintético');
});
