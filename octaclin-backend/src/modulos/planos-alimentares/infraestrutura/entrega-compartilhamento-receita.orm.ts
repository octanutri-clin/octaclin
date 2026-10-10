import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type CanalEntregaReceita = 'portal' | 'email' | 'whatsapp' | 'push';
export type StatusEntregaReceita = 'pendente' | 'processando' | 'enviado' | 'incerto' | 'falhou' | 'cancelado' | 'suprimido';

@Entity('entregas_compartilhamento_receita')
export class EntregaCompartilhamentoReceitaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'compartilhamento_id', type: 'uuid' })
  compartilhamentoId: string;

  @Column({ type: 'varchar', length: 20 })
  canal: CanalEntregaReceita;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: StatusEntregaReceita;

  @Column({ name: 'agendado_para', type: 'timestamptz' })
  agendadoPara: Date;

  @Column({ name: 'iniciado_em', type: 'timestamptz', nullable: true })
  iniciadoEm?: Date | null;

  @Column({ name: 'confirmado_em', type: 'timestamptz', nullable: true })
  confirmadoEm?: Date | null;

  @Column({ name: 'erro_codigo', type: 'varchar', length: 48, nullable: true })
  erroCodigo?: string | null;

  @Column({ type: 'varchar', length: 160 })
  idempotencia: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
