import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('envios_questionario')
export class EnvioQuestionarioOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'questionario_id', type: 'uuid' })
  questionarioId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'agendamento_id', type: 'uuid', nullable: true })
  agendamentoId?: string;

  @Column({ type: 'varchar', length: 40, default: 'pendente' })
  status: 'pendente' | 'enviado' | 'respondido' | 'expirado';

  @Column({ name: 'enviado_em', type: 'timestamptz', nullable: true })
  enviadoEm?: Date;

  @Column({ name: 'respondido_em', type: 'timestamptz', nullable: true })
  respondidoEm?: Date;

  @Column({ name: 'expira_em', type: 'timestamptz', nullable: true })
  expiraEm?: Date;
}
