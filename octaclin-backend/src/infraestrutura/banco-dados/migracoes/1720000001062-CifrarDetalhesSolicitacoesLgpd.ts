import { MigrationInterface, QueryRunner } from 'typeorm';

/** @aplicacao fora-de-banda, antes do runtime que le a nova coluna */
export class CifrarDetalhesSolicitacoesLgpd1720000001062 implements MigrationInterface {
  name = 'CifrarDetalhesSolicitacoesLgpd1720000001062';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table consentimentos_lgpd
      add column if not exists detalhes_criptografados bytea
    `);
    await queryRunner.query(`
      create index if not exists idx_consentimentos_lgpd_protocolo
      on consentimentos_lgpd (tenant_id, (metadados->>'protocolo'), aceito_em desc)
      where metadados ? 'protocolo'
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // A coluna pode conter o unico exemplar de um pedido: RLS nao permite
    // comprovar com uma contagem global que sua remocao seria segura.
    throw new Error('Rollback recusado: preserve os detalhes LGPD cifrados e reverta apenas o runtime.');
  }
}
