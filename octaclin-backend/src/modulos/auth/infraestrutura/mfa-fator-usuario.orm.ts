import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('mfa_fatores_usuario')
export class MfaFatorUsuarioOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'segredo_criptografado', type: 'bytea', nullable: true })
  segredoCriptografado?: Buffer | null;

  @Column({ name: 'segredo_pendente_criptografado', type: 'bytea', nullable: true })
  segredoPendenteCriptografado?: Buffer | null;

  @Column({ name: 'pendente_expira_em', type: 'timestamptz', nullable: true })
  pendenteExpiraEm?: Date | null;

  @Column({ name: 'habilitado_em', type: 'timestamptz', nullable: true })
  habilitadoEm?: Date | null;

  @Column({ name: 'ultimo_contador_totp', type: 'bigint', nullable: true })
  ultimoContadorTotp?: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
