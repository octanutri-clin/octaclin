import assert from 'node:assert/strict';
import test from 'node:test';
import { decidirAcessoRota } from '../lib/server/autorizacao-rotas';

test('paciente deve acessar apenas o portal e voltar ao portal ao tentar console', () => {
  assert.deepEqual(decidirAcessoRota('/portal', 'Patient', '/portal'), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/agenda', 'Patient', '/portal'), { permitir: false, redirecionarPara: '/portal' });
  assert.deepEqual(decidirAcessoRota('/pacientes/abc', 'Patient', '/portal'), {
    permitir: false,
    redirecionarPara: '/portal'
  });
});

test('perfil operacional deve sair do portal para seu destino operacional', () => {
  assert.deepEqual(decidirAcessoRota('/portal', 'Professional', '/agenda'), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
  assert.deepEqual(decidirAcessoRota('/agenda', 'Professional', '/agenda'), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/operacoes', 'SuperAdmin', '/operacoes'), { permitir: true });
});
