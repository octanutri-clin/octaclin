import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { detalheGestacao, episodioId } from './fixtures-gestacoes.mjs';

test.describe('portal gestacional - Fase 313', () => {

test('Fase 313: portal exige aceite e limpa dados ao revogar ou perder autorizacao', async ({ page }) => {
  await page.context().addCookies([
    { name: 'octaclin_access_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_refresh_token', value: 'fake', domain: 'localhost', path: '/' },
    { name: 'octaclin_papel', value: 'Patient', domain: 'localhost', path: '/' }
  ]);
  await page.route('**/api/portal/paciente', route => route.fulfill({ json: {
    paciente: { id: 'paciente-313', nome: 'Paciente Teste', statusAdesao: 'aderente' },
    perfil: { email: 'paciente@example.test', preferenciasContato: { email: false, whatsapp: false } },
    resumo: { consultasProximas: 0, formulariosPendentes: 0, formulariosRespondidos: 0, mensagensRecentes: 0 },
    consultasProximas: [], formulariosPendentes: [], formulariosRespondidos: [], mensagensRecentes: [], diariosRecentes: [],
    lgpd: { versaoAtual: '2026-08', documentosLegais: [], consentimentos: [], solicitacoes: [] }
  } }));
  let aceito = false, versao = 0, leituras = 0, negar = false;
  await page.route('**/api/portal/paciente/gestacoes**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/consentimento')) {
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({ confirmar: true, geracao: 1, versao, termoVersao: 'acompanhamento_gestacional_v1' });
      aceito = body.aceitar; versao++;
      return route.fulfill({ json: { aceito, versao } });
    }
    if (url.pathname.endsWith('/gestacoes')) return route.fulfill({ json: { itens: [{ id: episodioId, geracao: 1, termoVersao: 'acompanhamento_gestacional_v1', termo: 'Autorizo a visualização do acompanhamento gestacional compartilhado pelo profissional. Posso revogar meu aceite.', consentimentoVersao: versao, aceito }], proximoCursor: null } });
    leituras++;
    if (negar) return route.fulfill({ status: 403, json: { message: 'Acompanhamento nao autorizado.' } });
    return route.fulfill({ json: { ...detalheGestacao(), proximoCursor: null } });
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/portal');
  await expect(page.getByRole('button', { name: 'Ler e aceitar' })).toBeVisible();
  expect(leituras).toBe(0);
  await expect(page.getByRole('table', { name: /Avaliações da referência/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ler e aceitar' }).click();
  await page.getByRole('button', { name: 'Ver acompanhamento' }).click();
  await expect(page.getByRole('table', { name: 'Avaliações da referência 1' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Revogar aceite' }).click();
  await expect(page.getByRole('button', { name: 'Ler e aceitar' })).toBeVisible();
  await expect(page.getByRole('table', { name: /Avaliações da referência/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ler e aceitar' }).click();
  negar = true;
  await page.getByRole('button', { name: 'Ver acompanhamento' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'O acompanhamento está indisponível' })).toBeVisible();
  await expect(page.getByRole('table', { name: /Avaliações da referência/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

});
