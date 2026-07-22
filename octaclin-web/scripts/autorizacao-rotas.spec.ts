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

test('cliente deve acessar apenas o portal do cliente e voltar ao cliente ao tentar outras areas', () => {
  assert.deepEqual(decidirAcessoRota('/cliente', 'Client', '/cliente'), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/cliente/assinatura', 'Client', '/cliente'), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/portal', 'Client', '/cliente'), { permitir: false, redirecionarPara: '/cliente' });
  assert.deepEqual(decidirAcessoRota('/agenda', 'Client', '/cliente'), { permitir: false, redirecionarPara: '/cliente' });
});

test('perfil operacional deve sair do portal para seu destino operacional', () => {
  assert.deepEqual(decidirAcessoRota('/portal', 'Professional', '/agenda'), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
  assert.deepEqual(decidirAcessoRota('/agenda', 'Professional', '/agenda'), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/operacoes', 'SuperAdmin', '/operacoes'), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/cliente', 'Professional', '/agenda'), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
});
