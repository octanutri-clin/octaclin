import { MigrationInterface, QueryRunner } from 'typeorm';

export class IsolarIdempotenciaMobilePorPaciente1720000001012 implements MigrationInterface {
  name = 'IsolarIdempotenciaMobilePorPaciente1720000001012';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sincronizacoes_mobile ADD COLUMN IF NOT EXISTS paciente_id uuid`);
    await queryRunner.query(`
      UPDATE sincronizacoes_mobile sincronizacao
      SET paciente_id = COALESCE(
        (SELECT paciente_id FROM logs_diario_rapido WHERE id = sincronizacao.recurso_id),
        (SELECT paciente_id FROM acompanhantes WHERE id = sincronizacao.recurso_id),
        (SELECT paciente_id FROM arquivos_midia WHERE id = sincronizacao.recurso_id)
      )
      WHERE paciente_id IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE sincronizacoes_mobile
      DROP CONSTRAINT IF EXISTS sincronizacoes_mobile_tenant_id_id_local_key
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_mobile_tenant_paciente_local
      ON sincronizacoes_mobile (tenant_id, paciente_id, id_local)
      WHERE paciente_id IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_sync_mobile_tenant_paciente_local');
    await queryRunner.query(`
      DELETE FROM sincronizacoes_mobile duplicada
      USING sincronizacoes_mobile mantida
      WHERE duplicada.tenant_id = mantida.tenant_id
        AND duplicada.id_local = mantida.id_local
        AND (
          duplicada.criado_em < mantida.criado_em
          OR (duplicada.criado_em = mantida.criado_em AND duplicada.id::text < mantida.id::text)
        )
    `);
    await queryRunner.query('ALTER TABLE sincronizacoes_mobile DROP COLUMN IF EXISTS paciente_id');
    await queryRunner.query(`
      ALTER TABLE sincronizacoes_mobile
      ADD CONSTRAINT sincronizacoes_mobile_tenant_id_id_local_key UNIQUE (tenant_id, id_local)
    `);
  }
}
