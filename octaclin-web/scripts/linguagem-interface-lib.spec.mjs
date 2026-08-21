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
