import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * FOOD06 P2d-3a (R4): guarda TEXTUAL de acesso à tabela de vínculos de representação. Todo arquivo de `src/` que cite a
 * tabela, a entidade ou o módulo `.orm` precisa estar nesta lista nominal, com motivo. Consumidor novo entra só por
 * revisão. Limite: verificação de texto; a prova de autorização é comportamental (unidade e PostgreSQL).
 */
const SRC = join(__dirname, '..', '..', '..');
const PADRAO = /\b(vinculos_representacao_paciente|VinculoRepresentacaoPacienteOrm)\b|vinculo-representacao-paciente\.orm/;
const PERMITIDOS: Record<string, string> = {
  'infraestrutura/banco-dados/migracoes/1720000001085-DelegacoesCarteiraEVinculosRepresentacao.ts': 'DDL',
  'infraestrutura/banco-dados/migracoes/1720000001085-DelegacoesCarteiraEVinculosRepresentacao.spec.ts': 'prova estática da 1085',
  'infraestrutura/banco-dados/migracoes/1720000001085-DelegacoesCarteiraEVinculosRepresentacao.integracao.spec.ts': 'prova em PostgreSQL descartável',
  'infraestrutura/banco-dados/opcoes-typeorm.ts': 'registro da entidade',
  'infraestrutura/banco-dados/rls-isolamento-tenant.integracao.spec.ts': 'inventário de RLS e prova P2d-3a',
  'modulos/pacientes/infraestrutura/vinculo-representacao-paciente.orm.ts': 'a entidade',
  'modulos/pacientes/infraestrutura/guarda-acesso-vinculos.spec.ts': 'esta guarda',
  'modulos/pacientes/aplicacao/servico-vinculos-representacao.ts': 'único escritor: registro, revogação e cascatas, com autorização da equipe sob lock',
  'modulos/pacientes/aplicacao/servico-vinculos-representacao.spec.ts': 'teste unitário sintético',
  'modulos/pacientes/apresentacao/controlador-representantes-paciente.ts': 'só a lista fechada de tipos de verificação',
  'modulos/planos-alimentares/aplicacao/autorizacao-paciente-portal.ts': 'leitura do vínculo vigente sob lock (autorização do portal)',
  'modulos/planos-alimentares/aplicacao/autorizacao-paciente-portal.spec.ts': 'teste unitário sintético',
  'modulos/planos-alimentares/aplicacao/servico-portal-restricoes.ts': 'seletor de pacientes do portal (somente leitura, vínculos vigentes)'
};

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|js|mjs|cjs)$/.test(p) ? [p] : []; });
}

describe('FOOD06 P2d-3a: guarda de acesso aos vínculos de representação', () => {
  const citam = arquivos(SRC).map(p => relative(SRC, p).split('\\').join('/')).filter(rel => PADRAO.test(readFileSync(join(SRC, rel), 'utf8')));
  it('só arquivos nominalmente aprovados citam a tabela ou a entidade', () => {
    expect(citam.filter(rel => !PERMITIDOS[rel])).toEqual([]);
  });
  it('a lista não guarda entradas mortas', () => {
    expect(Object.keys(PERMITIDOS).filter(rel => !citam.includes(rel))).toEqual([]);
  });
  it('o padrão detecta citações por tabela, classe e módulo', () => {
    expect(['from vinculos_representacao_paciente', 'VinculoRepresentacaoPacienteOrm', "import x from '../x/vinculo-representacao-paciente.orm'"]
      .every(f => PADRAO.test(f))).toBe(true);
    expect(PADRAO.test('vinculos_representacao_pacientex')).toBe(false);
  });
});
