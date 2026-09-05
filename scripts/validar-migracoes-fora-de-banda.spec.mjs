/**
 * O que estes casos protegem.
 *
 * O gate existe porque uma migration com DDL exige passo humano antes do merge,
 * e o CI nao dizia nada. Um gate assim falha de duas maneiras, e as duas sao
 * silenciosas: aceitando a declaracao errada, e parando de ler o SQL. Os casos
 * abaixo cobrem as duas -- a segunda pelo piso de sanidade, que reprova o gate
 * que passou a achar quase nada em vez de aprovar o vazio.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  avaliarMigracao,
  extrairDdl,
  extrairDeclaracao,
  listarMigracoes,
  validarMigracoes
} from './validar-migracoes-fora-de-banda.mjs';

const CABECALHO = "import { MigrationInterface, QueryRunner } from 'typeorm';\n";

function migracao({ declaracao, sql }) {
  const tag = declaracao ? `/** @aplicacao ${declaracao} */\n` : '';
  return `${CABECALHO}\n${tag}export class Exemplo1 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`${sql}\`);
  }
}\n`;
}

test('le os verbos de DDL que exigem role owner', () => {
  assert.deepEqual(extrairDdl('create table x (id uuid)'), ['create table']);
  assert.deepEqual(extrairDdl('CREATE UNIQUE INDEX idx on x (a)'), ['create index']);
  assert.deepEqual(extrairDdl('create or replace function f() returns void'), ['create function']);
  assert.deepEqual(extrairDdl('create materialized view v as select 1'), ['create view']);
  assert.deepEqual(extrairDdl('alter table x enable always trigger t'), ['alter table']);
});

// `create index` e inofensivo para o dado e mesmo assim exige owner: o criterio
// do gate e privilegio, e nao risco. Uma lista escrita por risco perderia
// exatamente este caso.
test('classifica por privilegio, e nao por risco do comando', () => {
  const avaliacao = avaliarMigracao('m.ts', migracao({ declaracao: 'somente-dados', sql: 'create index i on t (a)' }));
  assert.equal(avaliacao.problemas.length, 1);
  assert.match(avaliacao.problemas[0], /exige aplicacao fora de banda/);
});

test('nao confunde DML com DDL', () => {
  assert.deepEqual(extrairDdl('update t set a = 1'), []);
  assert.deepEqual(extrairDdl('select id from fontes where codigo = $1'), []);
  const avaliacao = avaliarMigracao('m.ts', migracao({ declaracao: 'somente-dados', sql: 'update t set a = 1' }));
  assert.deepEqual(avaliacao.problemas, []);
});

/**
 * Falso positivo assumido, registrado aqui para nao ser "consertado" por engano.
 *
 * O extrator le texto, e nao SQL: um verbo de DDL dentro de literal de string ou
 * de comentario conta como DDL. Escrever um parser de SQL para desfazer isso
 * seria trocar um erro barato por uma dependencia nova e por um segundo lugar
 * onde a leitura pode divergir do banco.
 *
 * O erro so acontece na direcao conservadora: a migration passa a exigir uma
 * declaracao `fora-de-banda` que talvez nao precisasse, e o custo e um
 * procedimento a mais. A direcao perigosa -- DDL de verdade lido como DML -- nao
 * e alcancavel por esta imprecisao.
 */
test('erra para o lado conservador quando o verbo aparece dentro de um literal', () => {
  assert.deepEqual(extrairDdl("update t set a = 1 where b = 'create table'"), ['create table']);
});

test('reprova migration sem declaracao e diz qual linha acrescentar', () => {
  const avaliacao = avaliarMigracao('m.ts', migracao({ declaracao: null, sql: 'create table t (id uuid)' }));
  assert.equal(avaliacao.problemas.length, 1);
  assert.match(avaliacao.problemas[0], /sem declaracao de aplicacao/);
  assert.match(avaliacao.problemas[0], /@aplicacao fora-de-banda/);
});

test('sugere somente-dados quando a migration nao tem DDL', () => {
  const avaliacao = avaliarMigracao('m.ts', migracao({ declaracao: null, sql: 'update t set a = 1' }));
  assert.match(avaliacao.problemas[0], /@aplicacao somente-dados/);
});

test('reprova valor desconhecido em vez de aceitar por parecer uma declaracao', () => {
  const avaliacao = avaliarMigracao('m.ts', migracao({ declaracao: 'manual', sql: 'create table t (id uuid)' }));
  assert.match(avaliacao.problemas[0], /nao e valor conhecido/);
});

test('reprova mais de uma declaracao: a migration tem uma classificacao so', () => {
  const conteudo = `/** @aplicacao fora-de-banda */\n/** @aplicacao somente-dados */\n${migracao({ declaracao: null, sql: 'create table t (id uuid)' })}`;
  const avaliacao = avaliarMigracao('m.ts', conteudo);
  assert.match(avaliacao.problemas[0], /2 declaracoes/);
});

// A direcao conservadora nao reprova -- declarar fora-de-banda sem DDL so manda
// fazer um procedimento a mais --, mas fica registrada, porque e o formato de
// uma migration que perdeu o DDL num rebase.
test('nao reprova a declaracao conservadora, e a registra', () => {
  const avaliacao = avaliarMigracao('m.ts', migracao({ declaracao: 'fora-de-banda', sql: 'update t set a = 1' }));
  assert.deepEqual(avaliacao.problemas, []);
  assert.deepEqual(avaliacao.ddl, []);
});

test('o repositorio esta declarado por inteiro', () => {
  const { nomes, avaliacoes, comDdl, problemas } = validarMigracoes();

  assert.deepEqual(problemas, []);
  assert.equal(avaliacoes.length, nomes.length);
  assert.ok(nomes.length >= 51, `migrations encontradas: ${nomes.length}`);
  assert.ok(
    comDdl.length >= 40,
    `migrations com DDL: ${comDdl.length}; abaixo disso o extrator provavelmente quebrou`
  );
});

test('o piso de sanidade reprova o extrator que parou de ler', () => {
  // Diretorio real de scripts: tem arquivos `.ts`? Nao -- entao a listagem vem
  // vazia e o piso precisa reprovar, em vez de aprovar o nada.
  const { problemas } = validarMigracoes(import.meta.dirname);
  assert.ok(
    problemas.some((problema) => /Piso de sanidade/.test(problema)),
    'o piso de sanidade nao reprovou uma leitura vazia'
  );
});

test('a listagem ignora os proprios specs das migrations', () => {
  assert.ok(listarMigracoes().every((nome) => !nome.endsWith('.spec.ts')));
});

test('a tag e lida em qualquer forma de comentario', () => {
  assert.deepEqual(extrairDeclaracao('/** @aplicacao fora-de-banda */'), ['fora-de-banda']);
  assert.deepEqual(extrairDeclaracao(' * @aplicacao somente-dados\n'), ['somente-dados']);
  assert.deepEqual(extrairDeclaracao('// @aplicacao fora-de-banda'), ['fora-de-banda']);
});
