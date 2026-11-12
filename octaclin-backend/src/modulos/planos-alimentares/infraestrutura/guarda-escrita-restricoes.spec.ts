import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * FOOD06 D2 (#531): nenhum caminho de escrita contorna a validação. Quem importar as entidades com conteúdo clínico
 * de restrição precisa importar também o codec (`codec-conteudo-restricao`), que valida antes de cifrar e confere o
 * vínculo ao decifrar. Exceções nominais: o registro do TypeORM e as provas da migration 1083.
 */
const SRC = join(__dirname, '..', '..', '..');
const ENTIDADES = /from '[^']*\/(restricao-paciente|revisao-restricao-paciente)\.orm'/;
const CODEC = /from '[^']*\/codec-conteudo-restricao'/;
const EXCECOES = new Set([
  'infraestrutura/banco-dados/opcoes-typeorm.ts',
  'infraestrutura/banco-dados/migracoes/1720000001083-RestricoesAlimentares.spec.ts',
  'infraestrutura/banco-dados/migracoes/1720000001083-RestricoesAlimentares.integracao.spec.ts'
]);
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? arquivos(p) : p.endsWith('.ts') ? [p] : []; });
}

it('todo consumidor das entidades de restrição passa pelo codec validado', () => {
  const consumidores = arquivos(SRC).map(p => ({ rel: relative(SRC, p).split('\\').join('/'), fonte: readFileSync(p, 'utf8') }))
    .filter(f => ENTIDADES.test(f.fonte) && !f.rel.endsWith('.orm.ts'));
  // Piso de sanidade: se a varredura quebrar, ela encontraria zero consumidores e ficaria verde por não olhar.
  expect(consumidores.map(c => c.rel)).toEqual(expect.arrayContaining([...EXCECOES]));
  const semCodec = consumidores.filter(c => !EXCECOES.has(c.rel) && !CODEC.test(c.fonte)).map(c => c.rel);
  expect(semCodec).toEqual([]);
});
