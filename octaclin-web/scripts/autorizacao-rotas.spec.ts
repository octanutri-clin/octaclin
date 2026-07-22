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
  assert.deepEqual(decidirAcessoRota('/dashboard', 'Professional', '/dashboard', ['dashboard.ler']), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/cliente', 'Professional', '/agenda'), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
});

test('colaborador deve acessar apenas rotas operacionais autorizadas por permissao', () => {
  const permissoesColaborador = [
    'console.acessar',
    'pacientes.listar',
    'pacientes.ler',
    'questionarios.ler',
    'agenda.consultas.ler',
    'agenda.consultas.criar',
    'comunicacoes.mensagens.ler',
    'comunicacoes.mensagens.enviar'
  ];

  assert.deepEqual(decidirAcessoRota('/agenda', 'Collaborator', '/agenda', permissoesColaborador), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/pacientes/paciente-1', 'Collaborator', '/dashboard', ['pacientes.listar']), {
    permitir: false,
    redirecionarPara: '/dashboard'
  });
  assert.deepEqual(decidirAcessoRota('/dashboard', 'Collaborator', '/agenda', permissoesColaborador), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
  assert.deepEqual(decidirAcessoRota('/comunicacoes', 'Collaborator', '/agenda', permissoesColaborador), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/automacoes', 'Collaborator', '/agenda', permissoesColaborador), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
  assert.deepEqual(decidirAcessoRota('/ia', 'Collaborator', '/agenda', permissoesColaborador), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
  assert.deepEqual(decidirAcessoRota('/profissionais', 'Collaborator', '/agenda', permissoesColaborador), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
});
