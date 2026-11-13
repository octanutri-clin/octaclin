import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TABELAS_RESTRICOES_ALIMENTARES } from '../../../infraestrutura/banco-dados/migracoes/1720000001083-RestricoesAlimentares';

/**
 * FOOD06 D2/R4 (#531): guarda TEXTUAL de acesso às sete tabelas de restrições.
 *
 * Regra: todo arquivo de `src/` que cite uma das 7 entidades (por classe, por módulo `.orm`, com aspas simples ou
 * duplas, `import`, `require`, `import()` ou reexport) ou o NOME de uma das 7 tabelas (repositório por string, SQL
 * cru) precisa estar numa lista NOMINAL: `INFRAESTRUTURA` (registro, migração, provas, o próprio codec) ou
 * `CONSUMIDORES` (serviços aprovados em revisão; vazia na P1b). Consumidor de tabela com campo cifrado precisa ainda
 * importar o codec e chamar `cifrarCampo`/`decifrarCampo` (ou os atalhos do conteúdo).
 *
 * Limites declarados: é verificação de texto. Não impede SQL montado por concatenação ofuscada nem acesso fora de
 * `src/`; a prova de que o serviço valida, cifra e autoriza é dos testes comportamentais da P2.
 */
const SRC = join(__dirname, '..', '..', '..');
const ENTIDADES = ['RestricaoPacienteOrm', 'RevisaoRestricaoPacienteOrm', 'AvaliacaoRestricoesPacienteOrm', 'RevisaoAvaliacaoRestricoesOrm',
  'ReconfirmacaoRestricoesOrm', 'SolicitacaoRestricaoPacienteOrm', 'MapeamentoAlimentoAlvoLocalOrm'];
const MODULOS_ORM = ['restricao-paciente', 'revisao-restricao-paciente', 'avaliacao-restricoes-paciente', 'revisao-avaliacao-restricoes',
  'reconfirmacao-restricoes', 'solicitacao-restricao-paciente', 'mapeamento-alimento-alvo-local'];
const TABELAS = [...TABELAS_RESTRICOES_ALIMENTARES];
const TABELAS_SEM_CIFRA = ['avaliacoes_restricoes_pacientes', 'avaliacoes_restricoes_revisoes'];
const ENTIDADES_SEM_CIFRA = ['AvaliacaoRestricoesPacienteOrm', 'RevisaoAvaliacaoRestricoesOrm'];

/** Exceções mínimas, cada uma com motivo. */
const INFRAESTRUTURA: Record<string, string> = {
  'infraestrutura/banco-dados/opcoes-typeorm.ts': 'registro das entidades no TypeORM',
  'infraestrutura/banco-dados/migracoes/1720000001083-RestricoesAlimentares.ts': 'DDL das tabelas',
  'infraestrutura/banco-dados/migracoes/1720000001083-RestricoesAlimentares.spec.ts': 'prova estática da 1083',
  'infraestrutura/banco-dados/migracoes/1720000001083-RestricoesAlimentares.integracao.spec.ts': 'prova em PostgreSQL descartável (grava bytes crus de propósito)',
  'infraestrutura/banco-dados/rls-isolamento-tenant.integracao.spec.ts': 'inventário global de RLS',
  'modulos/planos-alimentares/infraestrutura/codec-conteudo-restricao.ts': 'o próprio codec (registro de campos)',
  'modulos/planos-alimentares/infraestrutura/codec-conteudo-restricao.spec.ts': 'prova do codec',
  'modulos/planos-alimentares/infraestrutura/guarda-escrita-restricoes.spec.ts': 'esta guarda',
  'modulos/planos-alimentares/dominio/conteudo-restricao.ts': 'comentário que nomeia as colunas protegidas'
};
/** Serviços que podem acessar as tabelas. Entram só por revisão (P2 em diante). */
const CONSUMIDORES: Record<string, string> = {};

const re = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PADRAO_ENTIDADE = new RegExp(`\\b(${ENTIDADES.join('|')})\\b`);
const PADRAO_MODULO = new RegExp(`['"\`][^'"\`]*\\/(${MODULOS_ORM.map(re).join('|')})\\.orm(\\.ts)?['"\`]`);
const PADRAO_TABELA = new RegExp(`\\b(${TABELAS.join('|')})\\b`);
const PADRAO_CODEC_IMPORT = /['"`][^'"`]*\/codec-conteudo-restricao(\.ts)?['"`]/;
const PADRAO_CODEC_USO = /\b(cifrarCampo|decifrarCampo|cifrarConteudoRestricao|decifrarConteudoRestricao)\s*\(/;

export function citaRestricoes(fonte: string): boolean {
  return PADRAO_ENTIDADE.test(fonte) || PADRAO_MODULO.test(fonte) || PADRAO_TABELA.test(fonte);
}
function citaSoTabelasSemCifra(fonte: string): boolean {
  const ents = [...fonte.matchAll(new RegExp(PADRAO_ENTIDADE, 'g'))].map(m => m[1]);
  const tabs = [...fonte.matchAll(new RegExp(PADRAO_TABELA, 'g'))].map(m => m[1]);
  const mods = [...fonte.matchAll(new RegExp(PADRAO_MODULO, 'g'))].map(m => m[1]);
  return ents.every(e => ENTIDADES_SEM_CIFRA.includes(e)) && tabs.every(t => TABELAS_SEM_CIFRA.includes(t)) &&
    mods.every(m => ['avaliacao-restricoes-paciente', 'revisao-avaliacao-restricoes'].includes(m));
}
export function usaCodec(fonte: string): boolean { return PADRAO_CODEC_IMPORT.test(fonte) && PADRAO_CODEC_USO.test(fonte); }

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|js|mjs|cjs)$/.test(p) ? [p] : []; });
}
const ORM = (rel: string) => MODULOS_ORM.some(m => rel === `modulos/planos-alimentares/infraestrutura/${m}.orm.ts`);

describe('FOOD06 R4: guarda de acesso às tabelas de restrições', () => {
  const todos = arquivos(SRC).map(p => ({ rel: relative(SRC, p).split('\\').join('/'), fonte: readFileSync(p, 'utf8') }));
  const citam = todos.filter(f => citaRestricoes(f.fonte) && !ORM(f.rel));

  it('nenhum arquivo fora das listas nominais cita as entidades ou as tabelas', () => {
    expect(citam.map(f => f.rel).filter(r => !(r in INFRAESTRUTURA) && !(r in CONSUMIDORES))).toEqual([]);
  });
  it('as exceções existem de fato (piso contra varredura quebrada) e a lista de consumidores está vazia na P1b', () => {
    const citamRel = new Set(citam.map(f => f.rel));
    for (const e of Object.keys(INFRAESTRUTURA)) expect(citamRel.has(e)).toBe(true);
    expect(Object.keys(CONSUMIDORES)).toEqual([]);
    expect(todos.filter(f => ORM(f.rel))).toHaveLength(7);
  });
  it('consumidor de tabela com campo cifrado importa e usa o codec', () => {
    const semCodec = citam.filter(f => f.rel in CONSUMIDORES && !citaSoTabelasSemCifra(f.fonte) && !usaCodec(f.fonte)).map(f => f.rel);
    expect(semCodec).toEqual([]);
  });
});

describe('FOOD06 R4: regressão das formas de contorno conhecidas', () => {
  it.each([
    ['aspas simples', "import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';"],
    ['aspas duplas', 'import { X } from "../infraestrutura/solicitacao-restricao-paciente.orm";'],
    ['require', "const m = require('../infraestrutura/reconfirmacao-restricoes.orm');"],
    ['import dinâmico', "const m = await import(`../infraestrutura/mapeamento-alimento-alvo-local.orm`);"],
    ['reexport por barrel', "export * from './revisao-restricao-paciente.orm';"],
    ['classe vinda de barrel', "import { SolicitacaoRestricaoPacienteOrm } from './index';"],
    ['repositório por string', "m.getRepository('restricoes_pacientes')"],
    ['SQL cru', 'await m.query(`insert into solicitacoes_restricoes_pacientes (tenant_id) values ($1)`)'],
    ['SQL cru com aspas duplas', 'q.query("update mapeamentos_alimento_alvo_locais set x = 1")']
  ])('detecta %s', (_nome, fonte) => { expect(citaRestricoes(fonte)).toBe(true); });
  it('não acusa nome parecido que não é a tabela nem a entidade', () => {
    expect(citaRestricoes("const restricoes_pacientes_view = 1; import { RestricaoPaciente } from './dominio';")).toBe(false);
  });
  it('codec importado mas não chamado não conta como uso', () => {
    expect(usaCodec("import { cifrarCampo } from './codec-conteudo-restricao';")).toBe(false);
    expect(usaCodec("import { cifrarCampo } from './codec-conteudo-restricao';\nconst b = cifrarCampo(c, k, v, x);")).toBe(true);
    expect(usaCodec('const b = cifrarCampo(c, k, v, x);')).toBe(false);
  });
});
