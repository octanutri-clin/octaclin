import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  GRUPOS_NAVEGACAO_CONSOLE,
  MODULOS_CONSOLE,
  modulosConsolePermitidos,
  permissaoExigidaParaRotaConsole
} from '../lib/navegacao-console';

const permissoesCompletas = MODULOS_CONSOLE.map((modulo) => modulo.permissao);

test('catalogo cobre exatamente as paginas operacionais publicadas', () => {
  const rotasEsperadas = [
    '/dashboard',
    '/agenda',
    '/pacientes',
    '/questionarios',
    '/ia',
    '/comunicacoes',
    '/automacoes',
    '/gamificacao',
    '/profissionais',
    '/operacoes'
  ];

  assert.deepEqual(MODULOS_CONSOLE.map((modulo) => modulo.href), rotasEsperadas);
  for (const rota of rotasEsperadas) {
    assert.equal(existsSync(join(process.cwd(), 'app', rota.slice(1), 'page.tsx')), true, `${rota} nao possui page.tsx`);
  }
  assert.ok(!MODULOS_CONSOLE.some((modulo) => modulo.href === '/mobile'));
});

test('arquitetura usa somente Clinica, Relacionamento e Administracao', () => {
  assert.deepEqual(GRUPOS_NAVEGACAO_CONSOLE, ['Clínica', 'Relacionamento', 'Administração']);
  assert.deepEqual([...new Set(MODULOS_CONSOLE.map((modulo) => modulo.grupo))], GRUPOS_NAVEGACAO_CONSOLE);
});

test('papel e permissao precisam concordar para um modulo ficar visivel', () => {
  const profissional = modulosConsolePermitidos({ papel: 'Professional', permissoes: permissoesCompletas });
  const colaborador = modulosConsolePermitidos({ papel: 'Collaborator', permissoes: permissoesCompletas });
  const superAdmin = modulosConsolePermitidos({ papel: 'SuperAdmin', permissoes: permissoesCompletas });

  assert.ok(profissional.some((modulo) => modulo.href === '/dashboard'));
  assert.ok(!profissional.some((modulo) => modulo.href === '/operacoes'));
  assert.ok(!colaborador.some((modulo) => modulo.href === '/dashboard'));
  assert.ok(superAdmin.some((modulo) => modulo.href === '/operacoes'));
  assert.deepEqual(modulosConsolePermitidos({ papel: 'Patient', permissoes: permissoesCompletas }), []);
  assert.deepEqual(modulosConsolePermitidos({ papel: 'Client', permissoes: permissoesCompletas }), []);
  assert.deepEqual(modulosConsolePermitidos({ papel: 'SuperAdmin', permissoes: [] }), []);
});

test('detalhe do paciente exige leitura e listagem exige apenas listar', () => {
  assert.equal(permissaoExigidaParaRotaConsole('/pacientes'), 'pacientes.listar');
  assert.equal(permissaoExigidaParaRotaConsole('/pacientes/paciente-1'), 'pacientes.ler');
  assert.equal(permissaoExigidaParaRotaConsole('/pacientes/novo'), 'pacientes.gerenciar');
  assert.equal(permissaoExigidaParaRotaConsole('/pacientes/paciente-1/editar'), 'pacientes.gerenciar');
  assert.equal(permissaoExigidaParaRotaConsole('/agenda'), 'agenda.consultas.ler');
  assert.equal(permissaoExigidaParaRotaConsole('/portal'), undefined);
});

test('identificadores, rotas e atalhos do catalogo sao unicos', () => {
  const ids = MODULOS_CONSOLE.map((modulo) => modulo.id);
  const rotas = MODULOS_CONSOLE.map((modulo) => modulo.href);
  const atalhos = MODULOS_CONSOLE.map((modulo) => modulo.atalho);

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(rotas).size, rotas.length);
  assert.equal(new Set(atalhos).size, atalhos.length);
});
