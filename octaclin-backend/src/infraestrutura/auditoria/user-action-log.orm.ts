import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_action_logs')
export class UserActionLogOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId?: string;

  @Column({ type: 'varchar', length: 120 })
  acao: string;

  @Column({ name: 'recurso_tipo', type: 'varchar', length: 120, nullable: true })
  recursoTipo?: string;

  @Column({ name: 'recurso_id', type: 'uuid', nullable: true })
  recursoId?: string;

  @Column({ type: 'inet', nullable: true })
  ip?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'jsonb', default: {} })
  metadados: Record<string, unknown>;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
