import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrige a invariavel "tudo ou nada" criada pela migration 1046: a
 * justificativa cifrada e o sexto campo obrigatorio de um override. A
 * migration 1046 permanece imutavel no historico; esta alteracao aditiva
 * substitui somente a constraint, sem reescrever ou remover dados.
 *
 * O nome da constraint antiga foi gerado automaticamente pelo PostgreSQL.
 * Por isso, a remocao a identifica pela definicao em vez de assumir um nome
 * que pode variar entre bancos.
 *
 * @aplicacao fora-de-banda
 */
export class EndurecerIntegridadeOverridePrioridade1720000001047 implements MigrationInterface {
  name = 'EndurecerIntegridadeOverridePrioridade1720000001047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      do $$
      declare
        constraint_legada record;
      begin
        for constraint_legada in
          select conname
          from pg_constraint
          where conrelid = 'prioridades_acompanhamento_paciente'::regclass
            and contype = 'c'
            and pg_get_constraintdef(oid) like '%override_faixa IS NULL%'
            and pg_get_constraintdef(oid) not like '%override_justificativa_criptografada%'
        loop
          execute format(
            'alter table prioridades_acompanhamento_paciente drop constraint %I',
            constraint_legada.conname
          );
        end loop;
      end $$;

      alter table prioridades_acompanhamento_paciente
        add constraint prioridades_acompanhamento_override_completo_check
        check (
          (
            override_faixa is null
            and override_codigo_motivo is null
            and override_justificativa_criptografada is null
            and override_expira_em is null
            and override_ator_usuario_id is null
            and override_criado_em is null
          )
          or
          (
            override_faixa is not null
            and override_codigo_motivo is not null
            and override_justificativa_criptografada is not null
            and override_expira_em is not null
            and override_ator_usuario_id is not null
            and override_criado_em is not null
          )
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table prioridades_acompanhamento_paciente
        drop constraint if exists prioridades_acompanhamento_override_completo_check;

      alter table prioridades_acompanhamento_paciente
        add constraint prioridades_acompanhamento_override_legado_check
        check (
          (
            override_faixa is null
            and override_codigo_motivo is null
            and override_expira_em is null
            and override_ator_usuario_id is null
            and override_criado_em is null
          )
          or
          (
            override_faixa is not null
            and override_codigo_motivo is not null
            and override_expira_em is not null
            and override_ator_usuario_id is not null
            and override_criado_em is not null
          )
        );
    `);
  }
}
