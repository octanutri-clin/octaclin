import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('usuarios')
export class UsuarioOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'email_hash', type: 'varchar', length: 128 })
  emailHash: string;

  @Column({ name: 'email_criptografado', type: 'bytea' })
  emailCriptografado: Buffer;

  @Column({ name: 'senha_hash', type: 'varchar', length: 255 })
  senhaHash: string;

  @Column({ type: 'varchar', length: 32 })
  role: 'SuperAdmin' | 'Professional' | 'Collaborator' | 'Patient';

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ name: 'ultimo_login_em', type: 'timestamptz', nullable: true })
  ultimoLoginEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
