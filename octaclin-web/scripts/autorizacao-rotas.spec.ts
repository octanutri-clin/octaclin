import assert from 'node:assert/strict';
import test from 'node:test';
import { decidirAcessoRota, sanitizarDestinoInicial } from '../lib/server/autorizacao-rotas';

test('destino interno recusa esquemas, barras invertidas, APIs e caracteres de controle', () => {
  for (const destinoHostil of [
    'https://ataque.example/roubo',
    '//ataque.example/roubo',
    '/\\\\ataque.example/roubo',
    '/api/auth/sair',
    '/agenda\r\nLocation: https://ataque.example'
  ]) {
    assert.equal(sanitizarDestinoInicial(destinoHostil), '/dashboard');
  }

  assert.equal(sanitizarDestinoInicial('/agenda?pacienteId=sintetico#novo-agendamento'), '/agenda?pacienteId=sintetico#novo-agendamento');
});

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
  assert.deepEqual(decidirAcessoRota('/portal', 'Professional', '/agenda', ['agenda.consultas.ler']), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
  assert.deepEqual(decidirAcessoRota('/agenda', 'Professional', '/agenda', ['agenda.consultas.ler']), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/operacoes', 'SuperAdmin', '/operacoes', ['operacoes.auditoria.ler']), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/dashboard', 'Professional', '/dashboard', ['dashboard.ler']), { permitir: true });
  assert.deepEqual(decidirAcessoRota('/cliente', 'Professional', '/agenda', ['agenda.consultas.ler']), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
});

test('permissao isolada nao deve contornar restricao de papel', () => {
  assert.deepEqual(decidirAcessoRota('/operacoes', 'Professional', '/agenda', ['operacoes.auditoria.ler']), {
    permitir: false,
    redirecionarPara: '/login'
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
    redirecionarPara: '/pacientes'
  });
  assert.deepEqual(decidirAcessoRota('/dashboard', 'Collaborator', '/dashboard', permissoesColaborador), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
  assert.deepEqual(decidirAcessoRota('/dashboard', 'Collaborator', '/agenda', permissoesColaborador), {
    permitir: false,
    redirecionarPara: '/agenda'
  });
  assert.deepEqual(decidirAcessoRota('/dashboard', 'Collaborator', '/agenda', [...permissoesColaborador, 'dashboard.ler']), {
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

test('fallback operacional ignora destino inicial sem permissao e escolhe rota permitida', () => {
  assert.deepEqual(
    decidirAcessoRota('/operacoes', 'Professional', '/operacoes', ['questionarios.ler']),
    { permitir: false, redirecionarPara: '/questionarios' }
  );
  assert.deepEqual(
    decidirAcessoRota('/dashboard', 'Professional', '/dashboard', ['agenda.consultas.ler']),
    { permitir: false, redirecionarPara: '/agenda' }
  );
  assert.deepEqual(
    decidirAcessoRota('/dashboard', 'Collaborator', '/dashboard', []),
    { permitir: false, redirecionarPara: '/login' }
  );
});

test('cadastro e edicao de paciente exigem gerenciar antes de renderizar', () => {
  assert.deepEqual(
    decidirAcessoRota('/pacientes/novo', 'Collaborator', '/pacientes', ['pacientes.listar', 'pacientes.ler']),
    { permitir: false, redirecionarPara: '/pacientes' }
  );
  assert.deepEqual(
    decidirAcessoRota('/pacientes/paciente-1/editar', 'Collaborator', '/pacientes', ['pacientes.listar', 'pacientes.ler']),
    { permitir: false, redirecionarPara: '/pacientes' }
  );
  assert.deepEqual(
    decidirAcessoRota('/pacientes/novo', 'Professional', '/pacientes', ['pacientes.listar', 'pacientes.gerenciar']),
    { permitir: true }
  );
});

test('sessoes da propria conta ficam acessiveis a qualquer papel autenticado', () => {
  for (const papel of ['SuperAdmin', 'Professional', 'Collaborator', 'Patient', 'Client']) {
    assert.deepEqual(decidirAcessoRota('/conta/sessoes', papel, '/dashboard', []), { permitir: true });
  }
});

test('rota de conta nao abre outras areas para paciente e cliente', () => {
  assert.deepEqual(decidirAcessoRota('/contabilidade', 'Patient', '/portal'), {
    permitir: false,
    redirecionarPara: '/portal'
  });
  assert.deepEqual(decidirAcessoRota('/agenda', 'Patient', '/portal'), {
    permitir: false,
    redirecionarPara: '/portal'
  });
});
