import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('agendamentos_questionario')
export class AgendamentoQuestionarioOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'questionario_id', type: 'uuid' })
  questionarioId: string;

  @Column({ name: 'paciente_id', type: 'uuid', nullable: true })
  pacienteId?: string;

  @Column({ name: 'regra_cron', type: 'varchar', length: 120, nullable: true })
  regraCron?: string;

  @Column({ name: 'data_fixa', type: 'timestamptz', nullable: true })
  dataFixa?: Date;

  @Column({ type: 'varchar', length: 80, default: 'America/Sao_Paulo' })
  timezone: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ name: 'ultima_execucao_em', type: 'timestamptz', nullable: true })
  ultimaExecucaoEm?: Date;

  @Column({ name: 'proxima_execucao_em', type: 'timestamptz', nullable: true })
  proximaExecucaoEm?: Date | null;

  @Column({ type: 'integer', default: 1 })
  revisao: number;

  @Column({ name: 'pausado_em', type: 'timestamptz', nullable: true })
  pausadoEm?: Date | null;

  // Ator da autorização atual; nunca preencher autoria histórica por inferência.
  @Column({ name: 'autorizado_por_usuario_id', type: 'uuid', nullable: true })
  autorizadoPorUsuarioId?: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
