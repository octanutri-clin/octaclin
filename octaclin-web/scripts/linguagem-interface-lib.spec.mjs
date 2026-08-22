import assert from 'node:assert/strict';
import test from 'node:test';
import { auditarCodigoInterface, corrigirCodigoInterface } from './linguagem-interface-lib.mjs';

test('corrige apenas textos que podem ser apresentados na interface', () => {
  const codigo = `
    const status = 'nao_alterar_contrato';
    const item = { status: 'pendente', titulo: 'Formulario clinico' };
    export function Tela() {
      return <button aria-label="Proxima acao">Nao foi possivel carregar o Dashboard</button>;
    }
  `;
  const corrigido = corrigirCodigoInterface(codigo, 'teste.tsx');

  assert.match(corrigido, /const status = 'nao_alterar_contrato'/);
  assert.match(corrigido, /status: 'pendente'/);
  assert.match(corrigido, /titulo: 'Formulário clínico'/);
  assert.match(corrigido, /aria-label="Próxima ação"/);
  assert.match(corrigido, />Não foi possível carregar o painel clínico</);
  assert.equal(auditarCodigoInterface(corrigido, 'teste.tsx').length, 0);
});

test('preserva caixa ao aplicar acentos', () => {
  const codigo = `export const Tela = () => <p>NAO ha FORMULARIOS; Proximos horarios.</p>`;
  const corrigido = corrigirCodigoInterface(codigo, 'teste.tsx');
  assert.match(corrigido, /NÃO há FORMULÁRIOS; Próximos horários/);
});

test('nao corrige parcialmente palavras derivadas com caracteres Unicode', () => {
  const codigo = `export const Tela = () => <nav aria-label="Paginação de pacientes">Página atual</nav>`;
  const corrigido = corrigirCodigoInterface(codigo, 'teste.tsx');
  assert.match(corrigido, /Paginação de pacientes/);
  assert.doesNotMatch(corrigido, /Páginação/);
  assert.equal(auditarCodigoInterface(corrigido, 'teste.tsx').length, 0);
});

test('corrige textos em expressoes condicionais renderizadas no JSX', () => {
  const codigo = `export const Tela = ({ salvando }) => <button>{salvando ? 'Enviando solicitacao' : 'Confirmar solicitacao'}</button>`;
  const corrigido = corrigirCodigoInterface(codigo, 'teste.tsx');
  assert.match(corrigido, /'Enviando solicitação' : 'Confirmar solicitação'/);
  assert.equal(auditarCodigoInterface(corrigido, 'teste.tsx').length, 0);
});

test('corrige seletores Playwright sem alterar papeis ou rotas', () => {
  const codigo = `
    await page.getByRole('button', { name: 'Confirmar solicitacao' }).click();
    await expect(page.getByText('Nao foi possivel carregar')).toBeVisible();
    await page.goto('/nao-alterar-rota');
  `;
  const corrigido = corrigirCodigoInterface(codigo, 'teste.spec.mjs');
  assert.match(corrigido, /getByRole\('button', \{ name: 'Confirmar solicitação' \}\)/);
  assert.match(corrigido, /getByText\('Não foi possível carregar'\)/);
  assert.match(corrigido, /goto\('\/nao-alterar-rota'\)/);
});

test('corrige alternativas condicionais enviadas para feedback visivel', () => {
  const codigo = `setSucesso(ok ? 'Simulacao concluida' : 'Nao foi possivel concluir')`;
  const corrigido = corrigirCodigoInterface(codigo, 'teste.tsx');
  assert.match(corrigido, /'Simulação concluída' : 'Não foi possível concluir'/);
});

test('preserva identificadores comparados dentro do JSX', () => {
  const codigo = `export const Tela = ({ area }) => <>{area === 'integracoes' ? <p>Configuracoes</p> : null}</>`;
  const corrigido = corrigirCodigoInterface(codigo, 'teste.tsx');
  assert.match(corrigido, /area === 'integracoes'/);
  assert.match(corrigido, />Configurações</);
});

test('corrige alternativas de atributos visiveis sem tocar a condicao', () => {
  const codigo = `export const Tela = ({ visao }) => <button aria-label={visao === 'semana' ? 'Proxima semana' : 'Proximo periodo'} />`;
  const corrigido = corrigirCodigoInterface(codigo, 'teste.tsx');
  assert.match(corrigido, /visao === 'semana'/);
  assert.match(corrigido, /'Próxima semana' : 'Próximo período'/);
});
