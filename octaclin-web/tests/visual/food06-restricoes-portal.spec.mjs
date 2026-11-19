import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { FILHO, MAE, PROPRIA, prepararPortalRestricoes } from './fixtures/food06-restricoes-portal.mjs';

// FOOD06 P3-1: leitura do portal de restrições com dados sintéticos e BFF simulado. Não prova authz, RLS nem SQL:
// isso é do backend (P2) e do test:authz. Prova o que a tela mostra, esconde e anuncia.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const area = (page) => page.getByRole('region', { name: 'Restrições alimentares' });

async function semViolacoes(page) {
  const { violations } = await new AxeBuilder({ page }).include('section[aria-label="Restrições alimentares"]').withTags(TAGS).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(',')}`)).toEqual([]);
}

async function nadaClinicoGuardadoNoNavegador(page) {
  const guardado = await page.evaluate(async () => {
    const web = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    const caches = 'caches' in window ? await Promise.all((await window.caches.keys()).map(async (k) => (await (await window.caches.open(k)).keys()).map((r) => r.url))) : [];
    return { web, caches: caches.flat() };
  });
  expect(guardado.web).not.toMatch(/Amendoim|Lactose|restric/i);
  expect(guardado.caches.filter((u) => u.includes('/api/'))).toEqual([]);
}

test.describe('FOOD06 P3 — portal de restrições (leitura)', () => {
  test('área desligada na web: mensagem neutra, sem consultar pessoas nem resumo, e sem link em "Mais"', async ({ page }) => {
    const { pedidosAoBff } = await prepararPortalRestricoes(page, { habilitada: false });
    await page.goto('/portal/restricoes');
    await expect(area(page).getByText('Esta área ainda não está disponível.')).toBeVisible();
    expect(pedidosAoBff.filter((p) => !p.caminho.endsWith('/disponibilidade'))).toEqual([]);
    await page.goto('/portal/mais');
    await expect(page.getByRole('heading', { name: 'Mais opções' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Restrições alimentares' })).toHaveCount(0);
  });

  test('conta própria: grupos, selos e pedidos em texto simples, sem gravidade nem dado interno', async ({ page }) => {
    const { pedidosAoBff } = await prepararPortalRestricoes(page);
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    await expect(regiao.getByRole('heading', { name: 'Suas restrições alimentares' })).toBeVisible();
    await expect(regiao.getByRole('radio')).toHaveCount(0);
    // P3-2: com o pedido disponível, volta o texto aprovado, e há caminho para falar com quem acompanha (NUX-20).
    await expect(regiao.getByText('Solicite uma correção se alguma informação estiver desatualizada.', { exact: false })).toBeVisible();
    await expect(regiao.getByRole('link', { name: 'Escrever para quem faz seu acompanhamento' })).toHaveAttribute('href', '/portal/mensagens');
    for (const grupo of ['Alergias', 'Intolerâncias', 'Outras condições', 'Alimentos que você evita por escolha'])
      await expect(regiao.getByRole('heading', { name: grupo })).toBeVisible();
    const alergias = regiao.getByRole('region', { name: 'Alergias' });
    await expect(alergias.getByRole('listitem')).toContainText('Amendoim');
    await expect(alergias.getByRole('listitem')).toContainText('Restrição registrada no seu acompanhamento');
    await expect(regiao.getByText('Anotado por quem faz seu acompanhamento; ainda será conferido')).toBeVisible();
    await expect(regiao.getByText('Informação enviada pelo portal; ainda será conferida')).toBeVisible();
    await expect(regiao.getByText('Item que ainda não aparece com nome aqui. Pergunte a quem faz seu acompanhamento.')).toBeVisible();
    await expect(regiao.getByText('Última conferência geral por quem faz seu acompanhamento: 12/09/2026.')).toBeVisible();
    await expect(regiao.getByText('As respostas antigas não viram restrição automaticamente.', { exact: false })).toBeVisible();
    await expect(regiao.getByText('Você pediu uma correção')).toBeVisible();
    await expect(regiao.getByText('Sua solicitação foi analisada e não houve alteração')).toBeVisible();
    await expect(regiao.getByText('Conferimos e o registro continua correto.', { exact: false })).toBeVisible();
    const texto = await regiao.innerText();
    for (const proibido of [/CANARIO/, /\bleve\b/i, /gravidade/i, /restricoes\./, /revis[aã]o/i, /seguro|liberad/i])
      expect(texto).not.toMatch(proibido);
    for (const pedido of pedidosAoBff.filter((p) => p.metodo === 'POST')) {
      expect(pedido.corpo).toBe('{}');
      expect(pedido.caminho).not.toMatch(/tenant/i);
    }
    await semViolacoes(page);
    await nadaClinicoGuardadoNoNavegador(page);
  });

  test('representante de várias pessoas: seletor acessível por teclado, nome no lugar de "você" e troca sem misturar respostas', async ({ page }) => {
    await prepararPortalRestricoes(page, {
      pessoas: [
        { pacienteId: PROPRIA, via: 'propria', nome: 'Marcos Sintético' },
        { pacienteId: MAE, via: 'representante', nome: 'Helena Sintética' },
        { pacienteId: FILHO, via: 'representante', nome: 'Pedro Sintético' }
      ],
      // A resposta da mãe chega depois da do filho: a tela nunca pode mostrá-la na vez do filho.
      atrasoResumo: (id) => (id === MAE ? 1500 : 0),
      resumo: (id) => (id === MAE
        ? { itens: [{ id: '44444444-4444-4444-8444-444444444444', grupo: 'alergias', alimento: 'Camarão', chaveSelo: 'restricoes.portal.registrada' }] }
        : id === FILHO
          ? { itens: [{ id: '55555555-5555-4555-8555-555555555555', grupo: 'escolhas', alimento: 'Carne vermelha', chaveSelo: 'restricoes.portal.registrada' }] }
          : { itens: [] }),
      pedidos: (id) => (id === FILHO
        ? { itens: [{ id: '88888888-8888-4888-8888-888888888888', tipo: 'remocao', chaveTexto: 'restricoes.solicitacao.enviada', criadoEm: '2026-11-10T10:00:00.000Z', podeCancelar: false }], maisAntigos: true }
        : { itens: [], maisAntigos: false })
    });
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    const grupo = regiao.getByRole('group', { name: 'De quem você quer ver as informações?' });
    await expect(grupo.getByRole('radio')).toHaveCount(3);
    await expect(grupo.getByText('Você acompanha como responsável')).toHaveCount(2);
    await expect(regiao.getByRole('heading', { name: /restrições alimentares/i, level: 2 })).toHaveCount(0);

    // Teclado (PUX-11): as setas selecionam e o foco precisa continuar no grupo a cada passo, para chegar à terceira
    // pessoa. A mãe é selecionada no caminho e responde atrasada, depois do filho.
    await grupo.getByRole('radio', { name: /Marcos Sintético/ }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(grupo.getByRole('radio', { name: /Helena Sintética/ })).toBeChecked();
    await expect(grupo.getByRole('radio', { name: /Helena Sintética/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(grupo.getByRole('radio', { name: /Pedro Sintético/ })).toBeChecked();
    await expect(grupo.getByRole('radio', { name: /Pedro Sintético/ })).toBeFocused();
    const titulo = regiao.getByRole('heading', { name: 'Restrições alimentares de Pedro Sintético' });
    await expect(titulo).toBeVisible();
    await expect(regiao.getByRole('status').filter({ hasText: 'Mostrando as informações de Pedro Sintético' })).toBeAttached();
    await expect(grupo.getByRole('radio', { name: /Pedro Sintético/ })).toBeFocused();
    await expect(regiao.getByText('Alimentos que Pedro Sintético evita por escolha')).toBeVisible();
    await expect(regiao.getByText('Restrição registrada no acompanhamento de Pedro Sintético')).toBeVisible();
    await expect(regiao.getByText('Pedido de remoção feito por outra pessoa que acompanha Pedro Sintético')).toBeVisible();
    await expect(regiao.getByText('Mostrando os 100 pedidos mais recentes.')).toBeVisible();
    await expect(regiao.getByRole('heading', { name: 'Pedidos sobre Pedro Sintético' })).toBeVisible();
    await page.waitForTimeout(1800);
    await expect(regiao.getByText('Camarão')).toHaveCount(0);
    await expect(regiao.getByText('Você pediu')).toHaveCount(0);
    await semViolacoes(page);
  });

  test('vazio não sugere ausência de risco; erros genéricos sem eco do servidor e com nova tentativa', async ({ page }) => {
    let tentativa = 0;
    await prepararPortalRestricoes(page, {
      resumo: () => (++tentativa === 1 ? 503 : { itens: [] }),
      pedidos: () => ({ itens: [], maisAntigos: false })
    });
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    await expect(regiao.getByText('Não foi possível carregar agora. Tente de novo em instantes.')).toBeVisible();
    await expect(regiao).not.toContainText('CANARIO');
    await regiao.getByRole('button', { name: /tentar novamente/i }).click();
    await expect(regiao.getByText('Isso não quer dizer que você não tenha restrições.', { exact: false })).toBeVisible();
    await expect(regiao.getByText('Nenhum pedido de correção ou remoção.')).toBeVisible();
    await semViolacoes(page);
  });

  test('vazio de quem acompanha como responsável usa o nome da pessoa (PUX-15)', async ({ page }) => {
    await prepararPortalRestricoes(page, {
      pessoas: [
        { pacienteId: PROPRIA, via: 'propria', nome: 'Marcos Sintético' },
        { pacienteId: MAE, via: 'representante', nome: 'Helena Sintética' }
      ],
      resumo: () => ({ itens: [] }),
      pedidos: () => ({ itens: [], maisAntigos: false })
    });
    await page.goto('/portal/restricoes');
    const regiao = area(page);
    await regiao.getByRole('radio', { name: /Helena Sintética/ }).check();
    await expect(regiao.getByText('Nenhuma restrição registrada até agora para Helena Sintética.', { exact: false })).toBeVisible();
    await expect(regiao.getByText(/você não tenha/)).toHaveCount(0);
  });

  for (const [status, esperado] of [
    [409, 'Há muitas informações para mostrar aqui. Fale com quem faz seu acompanhamento.'],
    [403, 'Não foi possível abrir esta informação com esta conta. Se achar que isso está errado, fale com quem faz seu acompanhamento.']
  ]) {
    test(`resumo ${status}: mensagem própria, sem nova tentativa automática nem eco`, async ({ page }) => {
      await prepararPortalRestricoes(page, { resumo: () => status });
      await page.goto('/portal/restricoes');
      const regiao = area(page);
      await expect(regiao.getByText(esperado)).toBeVisible();
      await expect(regiao.getByRole('button', { name: /tentar novamente/i })).toHaveCount(0);
      await expect(regiao).not.toContainText('CANARIO');
    });
  }

  test('a 320 px (equivalente a 400% de zoom) não há rolagem horizontal e o link aparece em "Mais"', async ({ page }) => {
    await prepararPortalRestricoes(page);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/portal/restricoes');
    await expect(area(page).getByRole('heading', { name: 'Suas restrições alimentares' })).toBeVisible();
    const medidas = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vp: document.documentElement.clientWidth }));
    expect(medidas.doc).toBeLessThanOrEqual(medidas.vp + 1);
    await page.goto('/portal/mais');
    await expect(page.getByRole('link', { name: 'Restrições alimentares' })).toBeVisible();
  });
});
