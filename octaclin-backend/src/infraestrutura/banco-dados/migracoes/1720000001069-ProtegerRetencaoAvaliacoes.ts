import { MigrationInterface, QueryRunner } from 'typeorm';
/** @aplicacao fora-de-banda
 * Retenção de avaliações confirmadas, preservando exclusão lógica e snapshots legados. */
export class ProtegerRetencaoAvaliacoes1720000001069 implements MigrationInterface {
  name = 'ProtegerRetencaoAvaliacoes1720000001069';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      create function impedir_exclusao_avaliacao_confirmada() returns trigger language plpgsql as $$
      begin
        if old.chave_criacao is not null then
          raise exception 'Snapshot confirmado exige procedimento de retencao autorizado.';
        end if;
        return old;
      end; $$;
      create trigger trg_avaliacao_confirmada_retencao before delete on avaliacoes_antropometricas
        for each row execute function impedir_exclusao_avaliacao_confirmada();
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('set local row_security = off');
    const [r] = await q.query('select exists(select 1 from avaliacoes_antropometricas where chave_criacao is not null) as existe');
    if (r?.existe) throw new Error('Rollback recusado: manter protecao de retencao com snapshots confirmados.');
    await q.query('drop trigger trg_avaliacao_confirmada_retencao on avaliacoes_antropometricas; drop function impedir_exclusao_avaliacao_confirmada();');
  }
}
