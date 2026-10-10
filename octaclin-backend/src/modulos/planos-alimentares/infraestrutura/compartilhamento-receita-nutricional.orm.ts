import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type StatusCompartilhamentoReceita = 'agendado' | 'ativo' | 'substituido' | 'retirado';

@Entity('compartilhamentos_receita_nutricional')
export class CompartilhamentoReceitaNutricionalOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'receita_id', type: 'uuid' })
  receitaId: string;

  @Column({ type: 'varchar', length: 160 })
  idempotencia: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'enviado_por_usuario_id', type: 'uuid' })
  enviadoPorUsuarioId: string;

  @Column({ name: 'versao_origem', type: 'integer' })
  versaoOrigem: number;

  @Column({ name: 'snapshot_criptografado', type: 'bytea' })
  snapshotCriptografado: Buffer;

  @Column({ type: 'varchar', length: 20 })
  status: StatusCompartilhamentoReceita;

  @Column({ name: 'agendado_para', type: 'timestamptz', nullable: true })
  agendadoPara?: Date | null;

  @Column({ name: 'enviado_em', type: 'timestamptz', nullable: true })
  enviadoEm?: Date | null;

  @Column({ name: 'visualizado_em', type: 'timestamptz', nullable: true })
  visualizadoEm?: Date | null;

  @Column({ name: 'retirado_em', type: 'timestamptz', nullable: true })
  retiradoEm?: Date | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
