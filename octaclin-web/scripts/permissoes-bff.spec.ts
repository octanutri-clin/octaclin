import assert from 'node:assert/strict';
import test from 'node:test';
import { sessaoPossuiPermissao } from '../lib/server/permissoes-bff';

test('sessao deve autorizar apenas permissoes presentes no cookie', () => {
  assert.equal(sessaoPossuiPermissao({ permissoes: ['cliente.acessar', 'cliente.usuarios.ler'] }, 'cliente.usuarios.ler'), true);
  assert.equal(sessaoPossuiPermissao({ permissoes: ['cliente.acessar', 'cliente.usuarios.ler'] }, 'cliente.usuarios.desativar'), false);
});

test('sessao sem permissoes deve negar por padrao', () => {
  assert.equal(sessaoPossuiPermissao({}, 'cliente.usuarios.ler'), false);
});
