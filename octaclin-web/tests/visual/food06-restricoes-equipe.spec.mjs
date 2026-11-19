import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { COLAB_B, DELEGACAO, PACIENTE, REP_MASC, VINCULO_B, prepararEquipe } from './fixtures/food06-restricoes-equipe.mjs';
import { pacienteId as PACIENTE_PRONTUARIO, prepararConsole } from './fixtures/console-pa06.mjs';

// FOOD06 P3-6: telas de equipe com dados sintéticos e BFF simulado. Não prova authz, RLS nem cota: isso é do backend
// (P3-0b) e do test:authz. Prova o que a tela mostra, esconde, confirma e anuncia.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const delegacao = (page) => page.getByRole('region', { name: 'Colaboradores na sua carteira' });
const representantes = (page) => page.getByRole('region', { name: 'Quem acompanha pelo portal' });

async function semViolacoes(page, nome) {
  const { violations } = await new AxeBuilder({ page }).include(`section[aria-label="${nome}"]`).withTags(TAGS).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(',')}`)).toEqual([]);
}

async function nadaGuardadoNoNavegador(page) {
  const guardado = await page.evaluate(async () => {
    const web = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    const caches = 'caches' in window ? await Promise.all((await window.caches.keys()).map(async (k) => (await (await window.caches.open(k)).keys()).map((r) => r.url))) : [];
    return { web, caches: caches.flat() };
  });
  expect(guardado.web).not.toMatch(/example\.test|Sintética|\*\*\*/);
  expect(guardado.caches.filter((u) => u.includes('/api/'))).toEqual([]);
}

test.describe('FOOD06 P3-6 — delegação da carteira', () => {
  test('área desligada: mensagem neutra e nenhuma consulta de pessoas', async ({ page }) => {
    const { pedidos } = await prepararEquipe(page, { disponivel: false });
    await page.goto('/conta/delegacao');
    await expect(delegacao(page).getByText('Esta área ainda não está disponível.')).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.includes('delegacoes-carteira'))).toEqual([]);
  });

  test('titular dá acesso com confirmação que diz "inclusive os futuros"; corpo exato; anúncio do resultado', async ({ page }) => {
    let lista = [{ id: DELEGACAO, colaboradorUsuarioId: '55555555-5555-4555-8555-555555555555', email: 'carla.sintetica@example.test', concedidaEm: '2026-11-10T10:00:00.000Z' }];
    const { pedidos } = await prepararEquipe(page, {
      delegacoes: () => ({ itens: lista }),
      conceder: (corpo) => {
        const nova = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', colaboradorUsuarioId: corpo.colaboradorUsuarioId, email: 'bia.sintetica@example.test', concedidaEm: '2026-11-19T10:00:00.000Z' };
        lista = [nova, ...lista];
        return nova;
      }
    });
    await page.goto('/conta/delegacao');
    const regiao = delegacao(page);
    await expect(regiao.getByText('inclusive os futuros', { exact: false })).toBeVisible();
    await expect(regiao.getByRole('listitem').getByText('carla.sintetica@example.test', { exact: true })).toBeVisible();
    // Quem já tem acesso não aparece de novo para escolha.
    const selecao = regiao.getByLabel('Colaborador da clínica');
    await expect(selecao.locator('option')).toHaveText(['Escolha pelo e-mail', 'bia.sintetica@example.test']);
    await expect(regiao.getByRole('button', { name: 'Dar acesso à carteira' })).toBeDisabled();
    await selecao.selectOption(COLAB_B);
    await regiao.getByRole('button', { name: 'Dar acesso à carteira' }).click();
    const modal = page.getByRole('dialog', { name: 'Dar acesso a bia.sintetica@example.test?' });
    await expect(modal).toContainText('inclusive os futuros');
    await semViolacoesModal(page);
    await modal.getByRole('button', { name: 'Dar acesso' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'bia.sintetica@example.test agora tem acesso à sua carteira.' })).toBeVisible();
    await expect(regiao.getByRole('listitem').getByText('bia.sintetica@example.test', { exact: true })).toBeVisible();
    const concessao = pedidos.find((p) => p.caminho.endsWith('/conceder'));
    expect(JSON.parse(concessao.corpo)).toEqual({ colaboradorUsuarioId: COLAB_B });
    await semViolacoes(page, 'Colaboradores na sua carteira');
    await nadaGuardadoNoNavegador(page);
  });

  test('remover acesso pede confirmação, foco inicial não destrutivo, corpo {} e anúncio', async ({ page }) => {
    const { pedidos } = await prepararEquipe(page);
    await page.goto('/conta/delegacao');
    const regiao = delegacao(page);
    await regiao.getByRole('button', { name: 'Remover acesso: carla.sintetica@example.test' }).click();
    const modal = page.getByRole('dialog', { name: 'Remover o acesso de carla.sintetica@example.test?' });
    await expect(modal).toContainText('O que já foi registrado continua no histórico.');
    await expect(modal.getByRole('button', { name: 'Remover acesso' })).not.toBeFocused();
    await modal.getByRole('button', { name: 'Remover acesso' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'O acesso de carla.sintetica@example.test foi removido.' })).toBeVisible();
    const revogacao = pedidos.find((p) => p.caminho.endsWith(`/${DELEGACAO}/revogar`));
    expect(revogacao.corpo).toBe('{}');
  });

  test('quem não é titular vê texto próprio, sem formulário; 100 acessos desliga a adição com o motivo', async ({ page }) => {
    await prepararEquipe(page, { papel: 'Collaborator', delegacoes: () => 403, candidatos: () => 403 });
    await page.goto('/conta/delegacao');
    await expect(delegacao(page).getByText('Esta página é do profissional responsável pela carteira.')).toBeVisible();
    await expect(delegacao(page).getByRole('combobox')).toHaveCount(0);
    await expect(delegacao(page)).not.toContainText('CANARIO');

    const cheio = Array.from({ length: 100 }, (_, i) => ({ id: `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`,
      colaboradorUsuarioId: `${String(i).padStart(8, '0')}-2222-4222-8222-222222222222`, email: `p${i}@example.test`, concedidaEm: '2026-11-10T10:00:00.000Z' }));
    const pagina2 = await page.context().newPage();
    await prepararEquipe(pagina2, { delegacoes: () => ({ itens: cheio }) });
    await pagina2.goto('/conta/delegacao');
    await expect(delegacao(pagina2).getByText('Você chegou ao limite de 100 colaboradores.', { exact: false })).toBeVisible();
    await expect(delegacao(pagina2).getByRole('combobox')).toHaveCount(0);
  });

  test('erro na concessão: mensagem fixa, lista recarregada, sem eco do servidor', async ({ page }) => {
    const { pedidos } = await prepararEquipe(page, { conceder: () => 409 });
    await page.goto('/conta/delegacao');
    const regiao = delegacao(page);
    await regiao.getByLabel('Colaborador da clínica').selectOption(COLAB_B);
    await regiao.getByRole('button', { name: 'Dar acesso à carteira' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Dar acesso' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Esta informação mudou ou um limite foi atingido.' })).toBeVisible();
    await expect(regiao).not.toContainText('CANARIO');
    await expect.poll(() => pedidos.filter((p) => p.caminho.endsWith('/listar')).length).toBeGreaterThanOrEqual(2);
  });
});

async function semViolacoesModal(page) {
  const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(TAGS).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(',')}`)).toEqual([]);
}

test.describe('FOOD06 P3-6 — quem acompanha pelo portal', () => {
  test('lista mostra nome da ficha ou e-mail mascarado e a verificação, nunca ids', async ({ page }) => {
    await prepararEquipe(page);
    // Rota literal (id sintético = PACIENTE) para a matriz de acessibilidade reconhecer a visita.
    await page.goto('/pacientes/44444444-4444-4444-8444-444444444444/representantes');
    const regiao = representantes(page);
    await expect(regiao.getByText('Helena Sintética')).toBeVisible();
    await expect(regiao.getByText('Conta p***@e***.test')).toBeVisible();
    await expect(regiao.getByText('Presencial em 10/11/2026')).toBeVisible();
    await expect(regiao.getByText('Procuração em 10/11/2026')).toBeVisible();
    const texto = await regiao.innerText();
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-|nome_ficha|email_mascarado|procuracao\b/);
    // O titular vê o atalho para a delegação; a volta ao prontuário existe.
    await expect(regiao.getByRole('link', { name: 'Dar acesso a toda a sua carteira para um colaborador' })).toBeVisible();
    await expect(regiao.getByRole('link', { name: 'Voltar ao prontuário' })).toBeVisible();
    await semViolacoes(page, 'Quem acompanha pelo portal');
  });

  test('colaborador não vê o atalho da delegação', async ({ page }) => {
    await prepararEquipe(page, { papel: 'Collaborator' });
    await page.goto(`/pacientes/${PACIENTE}/representantes`);
    await expect(representantes(page).getByText('Helena Sintética')).toBeVisible();
    await expect(representantes(page).getByRole('link', { name: /Dar acesso a toda a sua carteira/ })).toHaveCount(0);
  });

  test('e-mail inválido: foco no campo, aviso no texto de ajuda e nenhum pedido', async ({ page }) => {
    const { pedidos } = await prepararEquipe(page);
    await page.goto(`/pacientes/${PACIENTE}/representantes`);
    const regiao = representantes(page);
    const campo = regiao.getByLabel('E-mail da conta da pessoa');
    await campo.fill('sem-arroba');
    await regiao.getByRole('button', { name: 'Buscar conta' }).click();
    await expect(campo).toBeFocused();
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await expect(regiao.getByText('Digite um e-mail completo', { exact: false })).toBeVisible();
    expect(pedidos.filter((p) => p.caminho.endsWith('/buscar'))).toEqual([]);
  });

  test('não encontrado: mensagem única; o e-mail vai só no corpo, nunca na URL', async ({ page }) => {
    const { pedidos } = await prepararEquipe(page, { buscar: () => ({ candidato: null }) });
    await page.goto(`/pacientes/${PACIENTE}/representantes`);
    const regiao = representantes(page);
    await regiao.getByLabel('E-mail da conta da pessoa').fill('Pessoa.Sintetica@Example.test');
    await regiao.getByRole('button', { name: 'Buscar conta' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Não encontramos uma conta que possa ser adicionada com este e-mail.' })).toBeVisible();
    const busca = pedidos.find((p) => p.caminho.endsWith('/buscar'));
    expect(JSON.parse(busca.corpo)).toEqual({ email: 'Pessoa.Sintetica@Example.test' });
    expect(busca.url).not.toMatch(/example|@|pessoa/i);
    await expect(regiao.getByRole('button', { name: 'Registrar como responsável' })).toHaveCount(0);
  });

  test('encontrado: escolhe a verificação, registra com corpo exato, limpa o e-mail e anuncia', async ({ page }) => {
    const { pedidos } = await prepararEquipe(page, {
      buscar: () => ({ candidato: { usuarioId: REP_MASC, identificacao: { tipo: 'email_mascarado', email: 'n***@e***.test' } } })
    });
    await page.goto(`/pacientes/${PACIENTE}/representantes`);
    const regiao = representantes(page);
    const campo = regiao.getByLabel('E-mail da conta da pessoa');
    await campo.fill('nova.sintetica@example.test');
    await page.keyboard.press('Enter');
    await expect(regiao.getByRole('status').filter({ hasText: 'Conta encontrada: Conta n***@e***.test' })).toBeVisible();
    const registrar = regiao.getByRole('button', { name: 'Registrar como responsável' });
    await expect(registrar).toBeDisabled();
    await regiao.getByLabel('Como você conferiu a identidade e o vínculo?').selectOption('documento_apresentado');
    await registrar.click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Conta n***@e***.test agora acompanha este paciente pelo portal.' })).toBeVisible();
    await expect(campo).toHaveValue('');
    const registro = pedidos.find((p) => p.caminho.endsWith('/registrar'));
    expect(JSON.parse(registro.corpo)).toEqual({ representanteUsuarioId: REP_MASC, tipoVerificacao: 'documento_apresentado' });
    await semViolacoes(page, 'Quem acompanha pelo portal');
    await nadaGuardadoNoNavegador(page);
  });

  test('muitas buscas (429): mensagem fixa, sem eco', async ({ page }) => {
    await prepararEquipe(page, { buscar: () => 429 });
    await page.goto(`/pacientes/${PACIENTE}/representantes`);
    const regiao = representantes(page);
    await regiao.getByLabel('E-mail da conta da pessoa').fill('x@example.test');
    await regiao.getByRole('button', { name: 'Buscar conta' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Muitas buscas seguidas. Aguarde alguns minutos e tente de novo.' })).toBeVisible();
    await expect(regiao).not.toContainText('CANARIO');
  });

  test('remover pede confirmação, manda {} e anuncia; sem acesso (403) mostra texto neutro', async ({ page }) => {
    const { pedidos } = await prepararEquipe(page);
    await page.goto(`/pacientes/${PACIENTE}/representantes`);
    const regiao = representantes(page);
    await regiao.getByRole('button', { name: 'Remover: Conta p***@e***.test' }).click();
    const modal = page.getByRole('dialog', { name: 'Remover Conta p***@e***.test?' });
    await expect(modal).toContainText('A pessoa deixa de ver as informações deste paciente no portal.');
    await modal.getByRole('button', { name: 'Remover' }).click();
    await expect(regiao.getByRole('status').filter({ hasText: 'Conta p***@e***.test não acompanha mais este paciente pelo portal.' })).toBeVisible();
    expect(pedidos.find((p) => p.caminho.endsWith(`/${VINCULO_B}/revogar`)).corpo).toBe('{}');

    const outra = await page.context().newPage();
    await prepararEquipe(outra, { representantes: () => 403 });
    await outra.goto(`/pacientes/${PACIENTE}/representantes`);
    await expect(representantes(outra).getByText('Não foi possível abrir esta informação com esta conta.')).toBeVisible();
    await expect(representantes(outra)).not.toContainText('CANARIO');
  });

  test('a 320 px (equivalente a 400% de zoom) não há rolagem horizontal', async ({ page }) => {
    await prepararEquipe(page);
    await page.setViewportSize({ width: 320, height: 720 });
    for (const rota of [`/pacientes/${PACIENTE}/representantes`, '/conta/delegacao']) {
      await page.goto(rota);
      await expect(page.getByRole('region', { name: rota.includes('delegacao') ? 'Colaboradores na sua carteira' : 'Quem acompanha pelo portal' }).getByRole('heading').first()).toBeVisible();
      const medidas = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vp: document.documentElement.clientWidth }));
      expect(medidas.doc, rota).toBeLessThanOrEqual(medidas.vp + 1);
    }
  });
});

test.describe('FOOD06 P3-6 — atalho no prontuário', () => {
  for (const disponivel of [true, false]) {
    test(`atalho "Quem acompanha pelo portal" ${disponivel ? 'aparece' : 'não aparece'} com a área ${disponivel ? 'ligada' : 'desligada'}`, async ({ page }) => {
      await prepararConsole(page);
      await page.route((url) => url.pathname === '/api/restricoes/equipe/disponibilidade', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ habilitada: disponivel }) }));
      await page.goto(`/pacientes/${PACIENTE_PRONTUARIO}`);
      const acoes = page.getByRole('navigation', { name: 'Ações rápidas do paciente' });
      await expect(acoes).toBeVisible();
      const link = acoes.getByRole('link', { name: 'Quem acompanha pelo portal' });
      if (disponivel) await expect(link).toHaveAttribute('href', `/pacientes/${PACIENTE_PRONTUARIO}/representantes`);
      else {
        await page.waitForTimeout(500);
        await expect(link).toHaveCount(0);
      }
    });
  }
});
