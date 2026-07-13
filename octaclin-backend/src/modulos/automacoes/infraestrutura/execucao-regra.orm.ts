import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('execucoes_regra')
export class ExecucaoRegraOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'regra_id', type: 'uuid' })
  regraId: string;

  @Column({ name: 'paciente_id', type: 'uuid', nullable: true })
  pacienteId?: string;

  @Column({ type: 'varchar', length: 40, default: 'pendente' })
  status: 'pendente' | 'processando' | 'executado' | 'ignorado' | 'falhou';

  @Column({ type: 'jsonb', default: {} })
  resultado: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  erro?: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
