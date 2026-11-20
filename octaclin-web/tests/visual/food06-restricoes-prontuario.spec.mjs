import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PACIENTE, R_PENDENTE, R_DECLARADA, listaExemplo, prepararAbaRestricoes } from './fixtures/food06-restricoes-prontuario.mjs';

// FOOD06 P3-3: aba "Restrições" do prontuário com dados sintéticos e BFF simulado. Não prova authz, carteira, concessão
// nem RLS: isso é do backend (P2/P3-0a) e do test:authz. Prova o que a tela mostra, esconde, confirma e anuncia.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const aba = (page) => page.getByRole('region', { name: 'Restrições alimentares' });

async function abrirAba(page) {
  await page.goto(`/pacientes/${PACIENTE}`);
  await page.getByRole('tab', { name: 'Plano', exact: true }).click();
  await page.getByRole('tab', { name: 'Restrições', exact: true }).click();
  await expect(aba(page).getByRole('heading', { name: 'Restrições alimentares' })).toBeVisible();
}

async function semViolacoes(page, seletor = 'section[aria-label="Restrições alimentares"]') {
  const { violations } = await new AxeBuilder({ page }).include(seletor).withTags(TAGS).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(',')}`)).toEqual([]);
}

test.describe('FOOD06 P3-3 — aba Restrições no prontuário', () => {
  test('área desligada: a aba não existe na área Plano', async ({ page }) => {
    await prepararAbaRestricoes(page, { disponivel: false });
    // Rota literal (id sintético = PACIENTE) para a matriz de acessibilidade reconhecer a visita.
    await page.goto('/pacientes/paciente-pa06-sintetico');
    await page.getByRole('tab', { name: 'Plano', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Condutas terapêuticas', exact: true })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByRole('tab', { name: 'Restrições', exact: true })).toHaveCount(0);
  });

  test('profissional com permissão clínica: aviso, grupos, marca do paciente, observação e recolhidas', async ({ page }) => {
    await prepararAbaRestricoes(page);
    await abrirAba(page);
    const regiao = aba(page);
    await expect(regiao.getByRole('note')).toHaveText('Estes registros ainda não geram alerta automático no plano alimentar. Confira antes de prescrever.');
    await expect(regiao.getByRole('heading', { name: 'Para conferir (2)' })).toBeVisible();
    await expect(regiao.getByRole('heading', { name: 'Confirmadas (1)' })).toBeVisible();
    await expect(regiao.getByText('Tipo não informado pelo paciente')).toBeVisible();
    await expect(regiao.getByText('Reação relatada na infância (sintético)')).toBeVisible();
    await expect(regiao.getByText('Alergia alimentar · Gravidade: Grave')).toBeVisible();
    // Inativa recolhida, fechada por padrão.
    await expect(regiao.getByText('Inativas e rejeitadas (1)')).toBeVisible();
    await expect(regiao.getByText('Lactose')).toBeHidden();
    // Escolha alimentar não mostra gravidade; confirmadas não têm ações.
    await expect(regiao.getByRole('listitem').getByText('Escolha alimentar', { exact: true })).toBeVisible();
    await expect(regiao.getByRole('button', { name: /Confirmar: escolha alimentar/ })).toHaveCount(0);
    const texto = await regiao.innerText();
    for (const proibido of [/nao_catalogado|declaracao_paciente|alergia_alimentar|CANARIO|[0-9a-f]{8}-[0-9a-f]{4}-/]) expect(texto).not.toMatch(proibido);
    await expect(regiao.getByText('A conferência geral das restrições deste paciente ainda não foi iniciada.')).toBeVisible();
    await semViolacoes(page);
  });

  test('confirmar: diálogo com a descrição, corpo só com a revisão, anúncio e lista recarregada', async ({ page }) => {
    let lista = listaExemplo();
    const { pedidos } = await prepararAbaRestricoes(page, {
      lista: () => lista,
      confirmar: (corpo, id) => {
        lista = { ...lista, itens: lista.itens.map((i) => (i.id === id ? { ...i, confirmacao: 'confirmada', revisao: corpo.revisao + 1 } : i)) };
        return { id, revisao: corpo.revisao + 1, confirmacao: 'confirmada' };
      }
    });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Confirmar: alergia alimentar: Amendoim' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Confirmar alergia alimentar: Amendoim?' });
    await expect(dialogo).toContainText('A restrição passa a valer como confirmada');
    await dialogo.getByRole('button', { name: 'Confirmar' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'alergia alimentar: Amendoim foi confirmada.' })).toBeVisible();
    await expect(regiao.getByRole('heading', { name: 'Confirmadas (2)' })).toBeVisible();
    expect(pedidos.find((p) => p.caminho.endsWith(`/${R_PENDENTE}/confirmar`)).corpo).toEqual({ revisao: 2 });
  });

  test('rejeitar exige justificativa (foco e aviso), manda revisão e justificativa', async ({ page }) => {
    const { pedidos } = await prepararAbaRestricoes(page);
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Rejeitar: outra restrição clínica: Leite' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Rejeitar outra restrição clínica: Leite?' });
    await dialogo.getByRole('button', { name: 'Rejeitar registro' }).click();
    const campo = dialogo.getByLabel('Justificativa (só a equipe vê)');
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await expect(dialogo.getByText('Escreva a justificativa.', { exact: false })).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/rejeitar'))).toEqual([]);
    await campo.fill('Item já registrado em outra restrição (sintético).');
    await semViolacoes(page, '[role="dialog"]');
    await dialogo.getByRole('button', { name: 'Rejeitar registro' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'foi rejeitada.' })).toBeVisible();
    expect(pedidos.find((p) => p.caminho.endsWith(`/${R_DECLARADA}/rejeitar`)).corpo)
      .toEqual({ revisao: 1, justificativa: 'Item já registrado em outra restrição (sintético).' });
  });

  test('registrar: campos obrigatórios com foco, gravidade só em clínica, quebra de linha avisada e corpo exato', async ({ page }) => {
    const { pedidos } = await prepararAbaRestricoes(page);
    await abrirAba(page);
    const regiao = aba(page);
    const registrar = regiao.getByRole('button', { name: 'Registrar para conferência' });
    await registrar.click();
    await expect(regiao.getByLabel('Tipo')).toBeFocused();
    await regiao.getByLabel('Tipo').selectOption('escolha');
    await expect(regiao.getByLabel('Gravidade')).toHaveCount(0);
    await regiao.getByLabel('Tipo').selectOption('intolerancia');
    await expect(regiao.getByLabel('Gravidade')).toHaveValue('nao_informada');
    await registrar.click();
    await expect(regiao.getByLabel('Alimento ou item')).toBeFocused();
    await regiao.getByLabel('Alimento ou item').fill('Glúten');
    await regiao.getByLabel('Gravidade').selectOption('moderada');
    await regiao.getByLabel('Observação (opcional, só a equipe vê)').fill('linha um\nlinha dois');
    await expect(regiao.getByText('As quebras de linha foram trocadas por espaços.', { exact: false })).toBeVisible();
    await registrar.click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Glúten foi registrado para conferência.' })).toBeVisible();
    const envio = pedidos.find((p) => p.caminho.endsWith('/registrar'));
    expect(envio.caminho).toBe(`/api/pacientes/${PACIENTE}/restricoes/registrar`);
    expect(Object.keys(envio.corpo).sort()).toEqual(['alimento', 'chaveCriacao', 'gravidade', 'observacao', 'tipo']);
    expect(envio.corpo).toMatchObject({ tipo: 'intolerancia', alimento: 'Glúten', gravidade: 'moderada', observacao: 'linha um linha dois' });
    await expect(regiao.getByLabel('Alimento ou item')).toHaveValue('');
  });

  test('registro incerto reaproveita a mesma chave ao repetir (sem duplicar)', async ({ page }) => {
    let tentativa = 0;
    const { pedidos } = await prepararAbaRestricoes(page, { registrar: () => (++tentativa === 1 ? 503 : { id: '66666666-6666-4666-8666-666666666666', revisao: 1, estado: 'ativa', confirmacao: 'pendente' }) });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByLabel('Tipo').selectOption('alergia');
    await regiao.getByLabel('Alimento ou item').fill('Camarão');
    await regiao.getByRole('button', { name: 'Registrar para conferência' }).click();
    await expect(regiao.getByRole('alert').filter({ hasText: 'Não conseguimos confirmar se a ação foi concluída.' })).toBeVisible();
    await regiao.getByRole('button', { name: 'Registrar para conferência' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Camarão foi registrado para conferência.' })).toBeVisible();
    const chaves = pedidos.filter((p) => p.caminho.endsWith('/registrar')).map((p) => p.corpo.chaveCriacao);
    expect(chaves).toHaveLength(2);
    expect(chaves[0]).toBe(chaves[1]);
  });

  test('conflito (409) ao confirmar: mensagem fixa, lista recarregada, sem eco', async ({ page }) => {
    const { pedidos } = await prepararAbaRestricoes(page, { confirmar: () => 409 });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Confirmar: alergia alimentar: Amendoim' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Esta informação mudou ou um limite foi atingido.' })).toBeVisible();
    await expect(regiao).not.toContainText('CANARIO');
    await expect.poll(() => pedidos.filter((p) => p.caminho.endsWith('/listar')).length).toBeGreaterThanOrEqual(2);
  });

  test('iniciar a conferência geral e mostrar a situação com as datas', async ({ page }) => {
    let iniciada = false;
    const { pedidos } = await prepararAbaRestricoes(page, {
      avaliacao: () => (iniciada ? { avaliacao: { id: '55555555-5555-4555-8555-555555555555', revisao: 1, situacao: 'nao_informado', confirmadoEm: null, venceEm: null } } : { avaliacao: null }),
      iniciar: () => { iniciada = true; return { id: '55555555-5555-4555-8555-555555555555', revisao: 1, situacao: 'nao_informado' }; }
    });
    await abrirAba(page);
    const regiao = aba(page);
    await regiao.getByRole('button', { name: 'Iniciar conferência' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Conferência iniciada.' })).toBeVisible();
    await expect(regiao.getByText('Restrições ainda não conferidas com o paciente.')).toBeVisible();
    expect(pedidos.find((p) => p.caminho.endsWith('/avaliacao/iniciar')).corpo).toEqual({});

    const outra = await page.context().newPage();
    await prepararAbaRestricoes(outra, { avaliacao: () => ({ avaliacao: { id: '55555555-5555-4555-8555-555555555555', revisao: 2,
      situacao: 'restricoes_registradas', confirmadoEm: '2026-11-10T10:00:00.000Z', venceEm: '2027-05-09T10:00:00.000Z' } }) });
    await abrirAba(outra);
    await expect(aba(outra).getByText('Restrições conferidas em 10/11/2026. Reconferir até 09/05/2027.')).toBeVisible();
  });

  test('colaborador: só os próprios registros, texto próprio de vazio, sem ações de conferência, registro pela rota de colaborador', async ({ page }) => {
    const { pedidos } = await prepararAbaRestricoes(page, { papel: 'Collaborator', lista: () => ({ escopo: 'autoria', itens: [] }) });
    await abrirAba(page);
    const regiao = aba(page);
    await expect(regiao.getByText('Você vê apenas os registros que fez. Outros registros podem existir.').first()).toBeVisible();
    await expect(regiao.getByText('Nenhuma restrição registrada.', { exact: false })).toHaveCount(0);
    await expect(regiao.getByRole('button', { name: /^Confirmar|^Rejeitar|Iniciar conferência/ })).toHaveCount(0);
    expect(pedidos.some((p) => p.caminho.endsWith('/avaliacao'))).toBe(false);
    expect(pedidos.find((p) => p.caminho.endsWith('/listar')).caminho).toBe(`/api/colaborador/pacientes/${PACIENTE}/restricoes/listar`);
    await regiao.getByLabel('Tipo').selectOption('alergia');
    await regiao.getByLabel('Alimento ou item').fill('Castanha');
    await regiao.getByRole('button', { name: 'Registrar para conferência' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Castanha foi registrado para conferência.' })).toBeVisible();
    expect(pedidos.find((p) => p.caminho.endsWith('/registrar')).caminho).toBe(`/api/colaborador/pacientes/${PACIENTE}/restricoes/registrar`);
    await semViolacoes(page);
  });

  test('profissional sem a permissão clínica (escopo de autoria): aviso próprio e nenhuma ação de conferência', async ({ page }) => {
    await prepararAbaRestricoes(page, { lista: () => ({ escopo: 'autoria', itens: [listaExemplo().itens[0]] }) });
    await abrirAba(page);
    const regiao = aba(page);
    await expect(regiao.getByText('Confirmar ou rejeitar restrições exige profissional com permissão clínica.', { exact: false })).toBeVisible();
    await expect(regiao.getByText('Amendoim')).toBeVisible();
    await expect(regiao.getByRole('button', { name: /^Confirmar|^Rejeitar/ })).toHaveCount(0);
  });

  test('a 320 px (equivalente a 400% de zoom) a aba não cria rolagem horizontal', async ({ page }) => {
    await prepararAbaRestricoes(page);
    await page.setViewportSize({ width: 320, height: 720 });
    await abrirAba(page);
    await expect(aba(page).getByText('Amendoim')).toBeVisible();
    const medidas = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vp: document.documentElement.clientWidth }));
    expect(medidas.doc).toBeLessThanOrEqual(medidas.vp + 1);
  });
});
