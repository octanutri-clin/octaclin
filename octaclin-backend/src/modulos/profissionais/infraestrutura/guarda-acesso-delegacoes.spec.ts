import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * FOOD06 P2d-2 (R4): guarda TEXTUAL de acesso à tabela de delegações de carteira. Todo arquivo de `src/` que cite a
 * tabela, a entidade ou o módulo `.orm` precisa estar nesta lista nominal, com motivo. Serviço novo entra só por
 * revisão. Limite: verificação de texto; a prova de autorização é comportamental (unidade e PostgreSQL).
 */
const SRC = join(__dirname, '..', '..', '..');
const PADRAO = /\b(delegacoes_carteira_profissional|DelegacaoCarteiraProfissionalOrm)\b|delegacao-carteira-profissional\.orm/;
const PERMITIDOS: Record<string, string> = {
  'infraestrutura/banco-dados/migracoes/1720000001085-DelegacoesCarteiraEVinculosRepresentacao.ts': 'DDL',
  'infraestrutura/banco-dados/migracoes/1720000001085-DelegacoesCarteiraEVinculosRepresentacao.spec.ts': 'prova estática da 1085',
  'infraestrutura/banco-dados/migracoes/1720000001085-DelegacoesCarteiraEVinculosRepresentacao.integracao.spec.ts': 'prova em PostgreSQL descartável',
  'infraestrutura/banco-dados/opcoes-typeorm.ts': 'registro da entidade',
  'infraestrutura/banco-dados/rls-isolamento-tenant.integracao.spec.ts': 'inventário de RLS e prova P2d-2',
  'modulos/profissionais/infraestrutura/delegacao-carteira-profissional.orm.ts': 'a entidade',
  'modulos/profissionais/infraestrutura/guarda-acesso-delegacoes.spec.ts': 'esta guarda',
  'modulos/profissionais/aplicacao/servico-delegacoes-carteira.ts': 'único escritor: concessão, revogação, cascata e prova sob lock',
  'modulos/profissionais/aplicacao/servico-delegacoes-carteira.spec.ts': 'teste unitário sintético',
  'modulos/profissionais/aplicacao/servico-profissionais.spec.ts': 'afirma a cascata ao arquivar',
  'modulos/clientes/aplicacao/servico-usuarios-cliente.spec.ts': 'afirma a cascata ao desativar ou trocar papel'
};

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|js|mjs|cjs)$/.test(p) ? [p] : []; });
}

describe('FOOD06 P2d-2: guarda de acesso às delegações de carteira', () => {
  const citam = arquivos(SRC).map(p => relative(SRC, p).split('\\').join('/')).filter(rel => PADRAO.test(readFileSync(join(SRC, rel), 'utf8')));
  it('só arquivos nominalmente aprovados citam a tabela ou a entidade', () => {
    expect(citam.filter(rel => !PERMITIDOS[rel])).toEqual([]);
  });
  it('a lista não guarda entradas mortas', () => {
    expect(Object.keys(PERMITIDOS).filter(rel => !citam.includes(rel))).toEqual([]);
  });
  it('o padrão detecta citações por tabela, classe e módulo', () => {
    expect(['from delegacoes_carteira_profissional', 'DelegacaoCarteiraProfissionalOrm', "import x from '../x/delegacao-carteira-profissional.orm'"]
      .every(f => PADRAO.test(f))).toBe(true);
    expect(PADRAO.test('delegacoes_carteira_profissionalx')).toBe(false);
  });
});
