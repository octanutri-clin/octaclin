import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMANDOS_PALETA,
  comandosPermitidos,
  filtrarComandos,
  resolverAtalho
} from '../lib/paleta-comandos';

test('filtra comandos por permissao e por papel antes de exibir', () => {
  const permissoes = COMANDOS_PALETA.map((comando) => comando.permissao);
  const profissional = comandosPermitidos({ papel: 'Professional', permissoes });
  const colaborador = comandosPermitidos({ papel: 'Collaborator', permissoes });
  const superAdmin = comandosPermitidos({ papel: 'SuperAdmin', permissoes });

  assert.ok(profissional.some((comando) => comando.id === 'navegar-dashboard'));
  assert.ok(!profissional.some((comando) => comando.id === 'navegar-operacoes'));
  assert.ok(!colaborador.some((comando) => comando.id === 'navegar-dashboard'));
  assert.ok(!colaborador.some((comando) => comando.id === 'navegar-operacoes'));
  assert.ok(superAdmin.some((comando) => comando.id === 'navegar-operacoes'));
});

test('nao oferece acao sem a permissao especifica mesmo que o modulo esteja visivel', () => {
  const comandos = comandosPermitidos({
    papel: 'Professional',
    permissoes: ['agenda.consultas.ler', 'pacientes.listar']
  });

  assert.ok(comandos.some((comando) => comando.id === 'navegar-agenda'));
  assert.ok(comandos.some((comando) => comando.id === 'navegar-pacientes'));
  assert.ok(!comandos.some((comando) => comando.id === 'novo-agendamento'));
  assert.ok(!comandos.some((comando) => comando.id === 'novo-paciente'));
});

test('busca ignora acentos, caixa e procura tambem descricao e termos auxiliares', () => {
  assert.deepEqual(
    filtrarComandos(COMANDOS_PALETA, 'formularios').map((comando) => comando.id),
    ['navegar-questionarios']
  );
  assert.ok(filtrarComandos(COMANDOS_PALETA, 'consulta').some((comando) => comando.id === 'navegar-agenda'));
  assert.ok(filtrarComandos(COMANDOS_PALETA, 'equipe').some((comando) => comando.id === 'navegar-profissionais'));
  assert.ok(!filtrarComandos(COMANDOS_PALETA, 'Ana').some((comando) => comando.id === 'navegar-comunicacoes'));
});

test('resolve somente atalhos completos presentes no catalogo permitido', () => {
  const comandos = comandosPermitidos({
    papel: 'Professional',
    permissoes: ['agenda.consultas.ler', 'agenda.consultas.criar', 'pacientes.listar', 'pacientes.gerenciar']
  });

  assert.equal(resolverAtalho(comandos, ['g', 'a'])?.id, 'navegar-agenda');
  assert.equal(resolverAtalho(comandos, ['n', 'p'])?.id, 'novo-paciente');
  assert.equal(resolverAtalho(comandos, ['g']), undefined);
  assert.equal(resolverAtalho(comandos, ['g', 'o']), undefined);
});

test('atalhos definidos sao unicos para evitar acao ambigua', () => {
  const atalhos = COMANDOS_PALETA.flatMap((comando) => comando.atalho ? [comando.atalho] : []);
  assert.equal(new Set(atalhos).size, atalhos.length);
});
