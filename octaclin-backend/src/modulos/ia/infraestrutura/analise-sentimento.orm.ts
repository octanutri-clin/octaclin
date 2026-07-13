import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_sentiment_analysis')
export class AnaliseSentimentoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'resposta_checkin_id', type: 'uuid', nullable: true })
  respostaCheckinId?: string;

  @Column({ name: 'transcricao_midia_id', type: 'uuid', nullable: true })
  transcricaoMidiaId?: string;

  @Column({ type: 'varchar', length: 120 })
  modelo: string;

  @Column({ name: 'ansiedade_score', type: 'numeric', precision: 5, scale: 2 })
  ansiedadeScore: string;

  @Column({ name: 'frustracao_score', type: 'numeric', precision: 5, scale: 2 })
  frustracaoScore: string;

  @Column({ name: 'motivacao_score', type: 'numeric', precision: 5, scale: 2 })
  motivacaoScore: string;

  @Column({ name: 'confusao_score', type: 'numeric', precision: 5, scale: 2 })
  confusaoScore: string;

  @Column({ type: 'jsonb', default: {} })
  explicacao: Record<string, unknown>;

  @Column({ name: 'alerta_disparado', type: 'boolean', default: false })
  alertaDisparado: boolean;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
