import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('outbox_eventos')
export class OutboxEventoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  tipo: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 40, default: 'pendente' })
  status: 'pendente' | 'processando' | 'processado' | 'falhou';

  @Column({ type: 'integer', default: 0 })
  tentativas: number;

  @Column({ type: 'text', nullable: true })
  erro?: string;

  @Column({ name: 'processado_em', type: 'timestamptz', nullable: true })
  processadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
