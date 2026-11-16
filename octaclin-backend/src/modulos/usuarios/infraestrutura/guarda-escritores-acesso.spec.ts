import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * FOOD06 P2d-3a (R4): delegação de carteira e vínculo de representação "caem" quando a conta é desativada ou muda de papel
 * porque cada escritor de `usuarios.ativo`/`role` chama a revogação em cascata. Esta guarda TEXTUAL impede que um caminho
 * novo esqueça: todo arquivo de produção que cite `UsuarioOrm` e desative conta, troque papel ou faça `update usuarios`
 * precisa estar na lista nominal; quem tem `cascata: true` precisa chamar a cascata no próprio arquivo. Limite: é texto;
 * a autorização relê `ativo` e `role` sob lock, que continua sendo a garantia real.
 */
const SRC = join(__dirname, '..', '..', '..');
const ESCRITA = /ativo: *false|\.role *= |update usuarios|role: *dados\.role/;
const CASCATA = /await\s+(this\.revogarAcessosAtivos|revogarDelegacoesPorAlteracaoAcesso|revogarVinculosPorAlteracaoAcesso)\(/;
const ESCRITORES: Record<string, { cascata: boolean; motivo: string }> = {
  'modulos/clientes/aplicacao/servico-usuarios-cliente.ts': { cascata: true, motivo: 'desativar, revogar convite e trocar papel: revogarAcessosAtivos' },
  'modulos/profissionais/aplicacao/servico-profissionais.ts': { cascata: true, motivo: 'arquivar profissional revoga delegações (restaurar não revive)' },
  'modulos/pacientes/aplicacao/servico-pacientes.ts': { cascata: true, motivo: 'desativar conta do paciente revoga as representações dela e as dele' },
  'modulos/operacoes/aplicacao/servico-ciclo-vida-tenant.ts': { cascata: false, motivo: 'encerramento terminal do tenant: todas as contas inativas; a autorização relê ativo' }
};

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? arquivos(p) : /\.ts$/.test(p) && !/\.spec\.ts$/.test(p) ? [p] : []; });
}

describe('FOOD06: escritores de ativo/papel de conta chamam a cascata de revogação', () => {
  const fontes = arquivos(SRC).map(p => ({ rel: relative(SRC, p).split('\\').join('/'), fonte: readFileSync(p, 'utf8') }))
    .filter(f => !f.rel.startsWith('infraestrutura/banco-dados/migracoes/') && !f.rel.startsWith('infraestrutura/banco-dados/seeds/'));
  const escritores = fontes.filter(f => /\bUsuarioOrm\b/.test(f.fonte) && ESCRITA.test(f.fonte));
  it('todo escritor está na lista nominal', () => {
    expect(escritores.map(f => f.rel).filter(rel => !ESCRITORES[rel])).toEqual([]);
  });
  it('a lista não guarda entradas mortas', () => {
    expect(Object.keys(ESCRITORES).filter(rel => !escritores.some(f => f.rel === rel))).toEqual([]);
  });
  it('quem deve cascatear chama a revogação no próprio arquivo', () => {
    expect(escritores.filter(f => ESCRITORES[f.rel]?.cascata && !CASCATA.test(f.fonte)).map(f => f.rel)).toEqual([]);
  });
  it('o padrão reconhece as formas de escrita', () => {
    expect(["{ ativo: false }", "usuario.role = dados.role", "update usuarios set ativo=false", "role: dados.role"].every(t => ESCRITA.test(t))).toBe(true);
    expect(ESCRITA.test('{ ativo: true }')).toBe(false);
  });
});
