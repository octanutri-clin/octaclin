import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Torna `registros_analises_factuais` (1081) append-only de forma explícita e
 * indexa a FK de profissional. Achados da revisão R4 independente da #455.
 *
 * Na 1081 a imutabilidade vinha só da ausência de policy de UPDATE/DELETE: sob
 * FORCE RLS a role de runtime não altera linha nenhuma, mas a tentativa termina
 * em "0 linhas" sem erro, e o owner continuava podendo alterar.
 *
 * ## Por que trigger POR INSTRUÇÃO, e não por linha
 *
 * A 1038 usa trigger por linha na trilha de auditoria. Aqui isso não basta: para
 * a role de runtime o RLS filtra todas as linhas antes da trigger, então uma
 * trigger por linha nunca dispara e o "0 linhas" silencioso continua. A trigger
 * `for each statement` dispara antes de qualquer filtragem, para qualquer role
 * (inclusive owner e superusuário), e cobre também `TRUNCATE`. Nenhum caminho do
 * código atualiza ou apaga essa tabela: o serviço só faz `insert`.
 *
 * `REVOKE` fica como defesa em profundidade, condicionado à existência das roles
 * conhecidas (mesmo padrão da 1030/1038). Onde o nome não bate, não faz nada, e
 * a trigger continua sendo o que protege.
 *
 * Limites: o owner ainda pode desabilitar ou remover a trigger no catálogo; isso
 * não é imutabilidade contra o administrador do banco. Eliminação futura de
 * registro (LGPD) exige procedimento fora de banda com role administrativa.
 *
 * @aplicacao fora-de-banda
 */
export class RegistrosFactuaisAppendOnly1720000001082 implements MigrationInterface {
  name = 'RegistrosFactuaisAppendOnly1720000001082';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create or replace function rejeitar_mutacao_registros_factuais()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception
          'registros_analises_factuais e append-only: % rejeitado.', tg_op
          using errcode = '42501';
      end;
      $$;
    `);

    await queryRunner.query(`
      drop trigger if exists trg_registros_factuais_append_only on registros_analises_factuais;
      create trigger trg_registros_factuais_append_only
        before update or delete or truncate on registros_analises_factuais
        for each statement execute function rejeitar_mutacao_registros_factuais();
      alter table registros_analises_factuais
        enable always trigger trg_registros_factuais_append_only;
    `);

    await queryRunner.query(`
      revoke update, delete, truncate on registros_analises_factuais from public;

      do $$
      declare
        papel text;
      begin
        foreach papel in array array['octaclin_runtime_integracao', 'octaclin_app_producao'] loop
          if exists (select 1 from pg_roles where rolname = papel) then
            execute format('revoke update, delete, truncate on registros_analises_factuais from %I', papel);
          end if;
        end loop;
      end;
      $$;
    `);

    // A checagem RESTRICT ao remover um profissional deixa de varrer a tabela.
    await queryRunner.query(`
      create index if not exists idx_registros_analises_profissional
        on registros_analises_factuais (tenant_id, profissional_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Devolve o estado da 1081 de verdade: sem a trigger, UPDATE/DELETE voltam a
    // ser concedidos às roles conhecidas (o RLS sem policy continua barrando a
    // runtime). Nenhuma linha é alterada ou apagada.
    await queryRunner.query('drop index if exists idx_registros_analises_profissional;');
    await queryRunner.query('drop trigger if exists trg_registros_factuais_append_only on registros_analises_factuais;');
    await queryRunner.query('drop function if exists rejeitar_mutacao_registros_factuais();');
    await queryRunner.query(`
      do $$
      declare
        papel text;
      begin
        foreach papel in array array['octaclin_runtime_integracao', 'octaclin_app_producao'] loop
          if exists (select 1 from pg_roles where rolname = papel) then
            execute format('grant update, delete on registros_analises_factuais to %I', papel);
          end if;
        end loop;
      end;
      $$;
    `);
  }
}
