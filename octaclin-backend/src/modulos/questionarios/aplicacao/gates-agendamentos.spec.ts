import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('gate oficial de recorrências',()=>{
  it('inclui as duas provas PostgreSQL no runner real, sem depender da suíte padrão que as ignora',()=>{
    const runner=readFileSync(resolve(__dirname,'../../../../scripts/test-rls-testcontainers.mjs'),'utf8');
    const corpo=runner.match(/const argumentosJest\s*=\s*\[([\s\S]*?)\];/)?.[1];
    expect(corpo).toBeDefined();
    const argumentos=[...(corpo??'').matchAll(/'([^']+)'/g)].map(m=>m[1]);
    for(const caminho of [
      'src/modulos/questionarios/aplicacao/controle-agendamentos.integracao.spec.ts',
      'src/infraestrutura/banco-dados/migracoes/1720000001088-ControleAgendamentosQuestionario.integracao.spec.ts',
    ])expect(argumentos.filter(a=>a===caminho)).toHaveLength(1);
    expect(runner).toMatch(/RLS_TESTCONTAINERS:\s*'true'/);
  });
});
