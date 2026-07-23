import { MigrationInterface, QueryRunner } from 'typeorm';

export class CorrigeConstraintRoleUsuarios1720000000700 implements MigrationInterface {
  name = 'CorrigeConstraintRoleUsuarios1720000000700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table usuarios drop constraint if exists usuarios_role_check;
      alter table usuarios add constraint usuarios_role_check
        check (role in ('SuperAdmin', 'Professional', 'Collaborator', 'Patient', 'Client'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      alter table usuarios drop constraint if exists usuarios_role_check;
      alter table usuarios add constraint usuarios_role_check
        check (role in ('SuperAdmin', 'Professional', 'Collaborator', 'Patient'));
    `);
  }
}
