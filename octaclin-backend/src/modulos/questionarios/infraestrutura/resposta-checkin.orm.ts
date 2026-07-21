import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('respostas_checkin')
export class RespostaCheckinOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'envio_questionario_id', type: 'uuid' })
  envioQuestionarioId: string;

  @Column({ name: 'score_final', type: 'numeric', precision: 8, scale: 2, nullable: true })
  scoreFinal?: string;

  @Column({ name: 'finalizado_em', type: 'timestamptz', nullable: true })
  finalizadoEm?: Date;

  @Column({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
