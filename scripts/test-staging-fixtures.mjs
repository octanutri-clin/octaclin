import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const caminho = resolve(
  import.meta.dirname,
  '..',
  'octaclin-backend',
  'src',
  'infraestrutura',
  'banco-dados',
  'seeds',
  'staging-fixtures.json'
);

const fixture = JSON.parse(readFileSync(caminho, 'utf8'));
const fixtureE2E = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      '..',
      'octaclin-backend',
      'src',
      'infraestrutura',
      'banco-dados',
      'seeds',
      'staging-e2e-fixtures.json'
    ),
    'utf8'
  )
);
const ids = new Set();
const emails = [];
const contatos = [];

function registrarId(id, contexto) {
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i, `uuid invalido em ${contexto}`);
  assert.equal(ids.has(id), false, `uuid duplicado: ${id}`);
  ids.add(id);
}

registrarId(fixture.tenant.id, 'tenant');
assert.equal(fixture.tenant.slug, 'octaclin-staging');
assert.ok(fixture.tenant.nome.includes('Staging'));
assert.ok(Array.isArray(fixture.usuarios) && fixture.usuarios.length >= 5);
assert.ok(Array.isArray(fixture.profissionais) && fixture.profissionais.length >= 2);
assert.ok(Array.isArray(fixture.pacientes) && fixture.pacientes.length >= 3);
assert.ok(Array.isArray(fixture.agenda) && fixture.agenda.length >= 2);
assert.ok(Array.isArray(fixture.mensagens) && fixture.mensagens.length >= 2);
assert.ok(Array.isArray(fixture.tarefas) && fixture.tarefas.length >= 2);
assert.ok(Array.isArray(fixture.materiais) && fixture.materiais.length >= 2);

for (const colecao of [
  'usuarios',
  'profissionais',
  'pacientes',
  'canais',
  'templates',
  'agenda',
  'materiais',
  'enviosMaterial',
  'tarefas',
  'mensagens',
  'configuracoesTenant'
]) {
  for (const item of fixture[colecao] ?? []) {
    registrarId(item.id, colecao);
    if (item.email) emails.push(item.email);
    if (item.contato) contatos.push(item.contato);
    if (item.payload?.destino) contatos.push(item.payload.destino);
  }
}

for (const email of emails) {
  assert.match(email, /@octaclin\.test$/i, `email deve usar dominio ficticio octaclin.test: ${email}`);
}

for (const contato of contatos) {
  assert.equal(String(contato).includes('5511992362080'), false, 'fixture nao pode conter telefone real usado nos testes manuais');
}

const jsonSerializado = JSON.stringify(fixture);
for (const dominioReal of ['gmail.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'yahoo.com']) {
  assert.equal(jsonSerializado.includes(dominioReal), false, `fixture contem dominio real: ${dominioReal}`);
}

assert.ok(jsonSerializado.includes('seed_staging'), 'fixture deve identificar origem seed_staging');

assert.equal(fixtureE2E.tenants.length, 2, 'Fase 231 precisa exercitar exatamente dois tenants sinteticos');
assert.match(fixtureE2E.senhaPadrao, /^OctaClinE2E@/);
for (const tenant of fixtureE2E.tenants) {
  registrarId(tenant.id, `tenant E2E ${tenant.slug}`);
  assert.match(tenant.slug, /^octaclin-e2e-/);
  assert.equal(tenant.usuarios.length, 2);
  assert.ok(tenant.usuarios.some((usuario) => usuario.role === 'SuperAdmin'));
  assert.ok(tenant.usuarios.some((usuario) => usuario.role === 'Professional'));
  for (const usuario of tenant.usuarios) {
    registrarId(usuario.id, `usuario E2E ${tenant.slug}`);
    assert.match(usuario.email, /@octaclin\.test$/i);
  }
  registrarId(tenant.profissional.id, `profissional E2E ${tenant.slug}`);
  registrarId(tenant.categoria.id, `categoria E2E ${tenant.slug}`);
  assert.ok(tenant.usuarios.some((usuario) => usuario.id === tenant.profissional.usuarioId));
}

const jsonE2E = JSON.stringify(fixtureE2E);
for (const proibido of ['producao', 'gmail.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'yahoo.com']) {
  assert.equal(jsonE2E.toLowerCase().includes(proibido), false, `fixture E2E contem valor proibido: ${proibido}`);
}
