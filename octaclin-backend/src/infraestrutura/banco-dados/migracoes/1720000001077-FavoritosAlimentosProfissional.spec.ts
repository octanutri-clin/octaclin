import { FavoritosAlimentosProfissional1720000001077 } from './1720000001077-FavoritosAlimentosProfissional';
import { criarOpcoesTypeOrm } from '../opcoes-typeorm';
import { FavoritoAlimentoOrm } from '../../../modulos/planos-alimentares/infraestrutura/favorito-alimento.orm';

describe('FOOD03 favoritos profissionais', () => {
  it('cria preferências isoladas, com identidade exclusiva e sem vínculo com paciente/plano', async () => {
    const query = jest.fn(async (_sql: string) => []);
    await new FavoritosAlimentosProfissional1720000001077().up({ query } as any);
    const sql = query.mock.calls.map(([s]) => s).join('\n').toLowerCase();
    for (const trecho of [
      'create table favoritos_alimentos_profissional',
      'foreign key (tenant_id, profissional_id)',
      'foreign key (tenant_id, alimento_personalizado_id)',
      '(alimento_composicao_id is null) <> (alimento_personalizado_id is null)',
      'nulls not distinct',
      'enable row level security',
      'force row level security',
      "current_setting('app.tenant_id',true)"
    ]) expect(sql).toContain(trecho);
    expect(sql).not.toMatch(/paciente_id|plano_id|update\s+plano_alimentar|preferida/);
    await expect(new FavoritosAlimentosProfissional1720000001077().down({ query } as any)).rejects.toThrow(/rollback recusado/i);
  });

  it('registra uma migration e a entidade sem ativar sincronização automática', () => {
    const opcoes = criarOpcoesTypeOrm();
    expect((opcoes.migrations as any[]).filter((m) => m.name === 'FavoritosAlimentosProfissional1720000001077')).toHaveLength(1);
    expect((opcoes.entities as any[]).filter((e) => e === FavoritoAlimentoOrm)).toHaveLength(1);
    expect(opcoes.synchronize).toBe(false);
  });
});
