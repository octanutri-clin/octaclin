import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { MAE, PROPRIA, pedidosExemplo, prepararPortalRestricoes, resumoComItens } from './fixtures/food06-restricoes-portal.mjs';

// FOOD06 P3-2: escrita do portal (informar, pedir correção ou remoção, cancelar) com dados sintéticos e BFF simulado.
// Não prova autorização, idempotência real nem RLS (backend P2 e test:authz); prova o que a tela envia, mostra e anuncia.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const area = (page) => page.getByRole('region', { name: 'Restrições alimentares' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

async function semViolacoes(page) {
  const { violations } = await new AxeBuilder({ page }).include('section[aria-label="Restrições alimentares"]').withTags(TAGS).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(',')}`)).toEqual([]);
}

const enviados = (pedidosAoBff, sufixo) =>
  pedidosAoBff.filter((p) => p.caminho.endsWith(sufixo)).map((p) => JSON.parse(p.corpo ?? '{}'));

test.describe('FOOD06 P3 — portal de restrições (escrita)', () => {
  test('informar: campos obrigatórios por teclado, "Não sei dizer" e confirmação com foco, sem dado extra no envio', async ({ page }) => {
    const { pedidosAoBff } = await prepararPortalRestricoes(page);
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    await regiao.getByRole('button', { name: 'Informar uma restrição' }).click();
    const formulario = regiao.getByRole('form', { name: 'Informar uma restrição' });
    await expect(formulario.getByRole('heading', { name: 'Informar uma restrição' })).toBeFocused();
    await expect(formulario.getByRole('note')).toContainText('procure atendimento de urgência ou ligue 192 (SAMU)');
    await formulario.getByRole('button', { name: 'Enviar informação' }).click();
    await expect(formulario.getByText('Escolha o tipo de restrição.')).toBeVisible();
    await expect(formulario.getByText('Escreva o alimento.')).toBeVisible();
    // PUX-21: o foco vai para o primeiro campo com erro.
    await expect(formulario.getByRole('radio', { name: /Alergia/ })).toBeFocused();
    expect(enviados(pedidosAoBff, '/declarar')).toEqual([]);

    await formulario.getByRole('radio', { name: /Não sei dizer/ }).check();
    await formulario.getByRole('button', { name: 'Enviar informação' }).click();
    await expect(formulario.getByRole('textbox', { name: 'Qual alimento?' })).toBeFocused();
    await formulario.getByRole('textbox', { name: 'Qual alimento?' }).fill('  Leite  ');
    await formulario.getByRole('textbox', { name: 'Qual alimento?' }).press('Enter');
    const aviso = regiao.getByRole('status').filter({ hasText: 'Enviamos a informação.' });
    await expect(aviso).toBeVisible();
    await expect(aviso).toBeFocused();
    await expect(aviso).toContainText('Em caso de dúvida ou sintomas, fale com quem faz seu acompanhamento.');
    // NUX-27: aviso de urgência fixo no formulário e repetido na confirmação de algo clínico.
    await expect(aviso).toContainText('ligue 192 (SAMU)');
    const [corpo] = enviados(pedidosAoBff, '/declarar');
    expect(Object.keys(corpo).sort()).toEqual(['alimento', 'chaveCriacao', 'tipo']);
    expect(corpo).toMatchObject({ tipo: 'nao_sei', alimento: 'Leite' });
    expect(corpo.chaveCriacao).toMatch(UUID);
    // A lista é recarregada depois do envio.
    expect(pedidosAoBff.filter((p) => p.caminho.endsWith('/resumo')).length).toBeGreaterThanOrEqual(2);
  });

  test('resultado incerto: não afirma sucesso e repete com a MESMA chave (idempotência)', async ({ page }) => {
    let vez = 0;
    const { pedidosAoBff } = await prepararPortalRestricoes(page, {
      declarar: () => (++vez === 1 ? 503 : { id: '99999999-0000-4000-8000-000000000001', selo: 'restricoes.portal.informada_por_voce' })
    });
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    await regiao.getByRole('button', { name: 'Informar uma restrição' }).click();
    const formulario = regiao.getByRole('form', { name: 'Informar uma restrição' });
    await formulario.getByRole('radio', { name: /Alergia/ }).check();
    await formulario.getByRole('textbox', { name: 'Qual alimento?' }).fill('Castanha');
    await formulario.getByRole('button', { name: 'Enviar informação' }).click();
    await expect(formulario.getByRole('alert')).toHaveText('Não conseguimos confirmar se o envio foi concluído. Você pode tentar de novo: não vamos registrar duas vezes.');
    await expect(regiao).not.toContainText('Enviamos a informação');
    await expect(regiao).not.toContainText('CANARIO');
    await formulario.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Enviamos a informação.' })).toBeVisible();
    const corpos = enviados(pedidosAoBff, '/declarar');
    expect(corpos).toHaveLength(2);
    expect(corpos[1].chaveCriacao).toBe(corpos[0].chaveCriacao);
  });

  test('pedir remoção de um item: foco no texto, corpo mínimo e mensagem de que a informação continua valendo', async ({ page }) => {
    const { pedidosAoBff } = await prepararPortalRestricoes(page);
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    await regiao.getByRole('button', { name: 'Pedir correção ou remoção de Amendoim' }).click();
    const formulario = regiao.getByRole('form', { name: 'Pedir correção ou remoção de Amendoim' });
    await expect(formulario.getByRole('textbox', { name: 'O que está errado e como deveria ficar?' })).toBeFocused();
    await formulario.getByRole('radio', { name: 'Remover esta informação' }).check();
    await formulario.getByRole('textbox', { name: 'Por que remover esta informação?' }).fill('Fiz o exame e não tenho mais.\nSegue com a nutricionista.');
    await formulario.getByRole('button', { name: 'Enviar pedido' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Pedido enviado. A informação atual continua valendo' })).toBeFocused();
    const [corpo] = enviados(pedidosAoBff, '/pedidos/criar');
    expect(Object.keys(corpo).sort()).toEqual(['chaveCriacao', 'restricaoId', 'texto', 'tipo']);
    expect(corpo).toMatchObject({ tipo: 'remocao', restricaoId: resumoComItens.itens[0].id });
  });

  test('pedido com 409: mensagem genérica, texto digitado preservado, sem eco', async ({ page }) => {
    await prepararPortalRestricoes(page, { criarPedido: () => 409 });
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    await regiao.getByRole('button', { name: 'Pedir correção ou remoção de Lactose' }).click();
    const formulario = regiao.getByRole('form', { name: 'Pedir correção ou remoção de Lactose' });
    await formulario.getByRole('textbox', { name: 'O que está errado e como deveria ficar?' }).fill('Não tenho intolerância.');
    await formulario.getByRole('button', { name: 'Enviar pedido' }).click();
    await expect(formulario.getByRole('alert')).toHaveText('Esta informação mudou ou um limite foi atingido. Recarregue para ver a versão atual.');
    await expect(formulario.getByRole('textbox', { name: 'O que está errado e como deveria ficar?' })).toHaveValue('Não tenho intolerância.');
    await expect(regiao).not.toContainText('CANARIO');
  });

  test('cancelar: confirmação com foco em "manter", Esc não cancela; confirmar envia corpo vazio', async ({ page }) => {
    const { pedidosAoBff } = await prepararPortalRestricoes(page);
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    await regiao.getByRole('button', { name: 'Cancelar pedido' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Cancelar este pedido?' });
    await expect(dialogo).toBeVisible();
    // PUX-06: o foco começa numa opção que não cancela (o modal compartilhado foca o primeiro controle, o "Fechar").
    await expect(dialogo.getByRole('button', { name: 'Sim, cancelar pedido' })).not.toBeFocused();
    const focado = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim());
    expect(['Fechar', 'Fechar janela', 'Não, manter pedido']).toContain(focado);
    await expect(dialogo.getByRole('button', { name: 'Não, manter pedido' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    expect(enviados(pedidosAoBff, '/cancelar')).toEqual([]);
    await regiao.getByRole('button', { name: 'Cancelar pedido' }).click();
    await page.getByRole('dialog', { name: 'Cancelar este pedido?' }).getByRole('button', { name: 'Sim, cancelar pedido' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Pedido cancelado.' })).toBeVisible();
    const cancelados = pedidosAoBff.filter((p) => p.caminho.endsWith('/cancelar'));
    expect(cancelados).toHaveLength(1);
    expect(cancelados[0].caminho).toContain(`/pedidos/${pedidosExemplo.itens[0].id}/cancelar`);
    expect(JSON.parse(cancelados[0].corpo)).toEqual({});
    // Pedido já decidido não tem botão de cancelar.
    await expect(regiao.getByRole('button', { name: 'Cancelar pedido' })).toHaveCount(1);
  });

  test('limites de 50 abertos: avisos visíveis antes de enviar, sem botões de envio', async ({ page }) => {
    const declaracoes = Array.from({ length: 50 }, (_, i) => ({ id: `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`, grupo: 'outras', alimento: `Item ${i}`, chaveSelo: 'restricoes.portal.informada_por_voce' }));
    const abertos = Array.from({ length: 50 }, (_, i) => ({ id: `${String(i).padStart(8, '0')}-2222-4222-8222-222222222222`, tipo: 'correcao', chaveTexto: 'restricoes.solicitacao.enviada', criadoEm: '2026-11-10T10:00:00.000Z', podeCancelar: false }));
    await prepararPortalRestricoes(page, { resumo: () => ({ itens: declaracoes }), pedidos: () => ({ itens: abertos, maisAntigos: false }) });
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    await expect(regiao.getByText('Já há muitas informações aguardando conferência.', { exact: false })).toBeVisible();
    await expect(regiao.getByText('Já há muitos pedidos aguardando análise.', { exact: false })).toBeVisible();
    await expect(regiao.getByRole('button', { name: /Informar uma restrição/ })).toHaveCount(0);
    await expect(regiao.getByRole('button', { name: /Pedir correção ou remoção/ })).toHaveCount(0);
    // PUX-18: mesmo no limite, há um caminho para Mensagens.
    await expect(regiao.getByRole('link', { name: 'Escrever para quem faz seu acompanhamento' })).toHaveCount(3);
  });

  test('representante: textos com o nome da pessoa e axe com os formulários abertos', async ({ page }) => {
    await prepararPortalRestricoes(page, {
      pessoas: [
        { pacienteId: PROPRIA, via: 'propria', nome: 'Marcos Sintético' },
        { pacienteId: MAE, via: 'representante', nome: 'Helena Sintética' }
      ]
    });
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    await regiao.getByRole('radio', { name: /Helena Sintética/ }).check();
    await regiao.getByRole('button', { name: 'Informar uma restrição de Helena Sintética' }).click();
    await regiao.getByRole('button', { name: 'Pedir correção ou remoção de Amendoim' }).click();
    await semViolacoes(page);
    const formulario = regiao.getByRole('form', { name: 'Informar uma restrição de Helena Sintética' });
    await formulario.getByRole('radio', { name: /Evito por escolha/ }).check();
    await formulario.getByRole('textbox', { name: 'Qual alimento?' }).fill('Carne de porco');
    await formulario.getByRole('button', { name: 'Enviar informação' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Enviamos a informação sobre Helena Sintética.' })).toBeVisible();
    // "Evito por escolha" não é clínico: a confirmação não repete o aviso de urgência.
    await expect(regiao.getByRole('status').filter({ hasText: 'Enviamos a informação sobre Helena Sintética.' })).not.toContainText('192');
  });
});
