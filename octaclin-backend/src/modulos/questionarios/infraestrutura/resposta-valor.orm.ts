import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('resposta_valores')
export class RespostaValorOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'resposta_checkin_id', type: 'uuid' })
  respostaCheckinId: string;

  @Column({ name: 'pergunta_id', type: 'uuid' })
  perguntaId: string;

  @Column({ type: 'jsonb' })
  valor: unknown;

  @Column({ name: 'score_ponderado', type: 'numeric', precision: 8, scale: 2, nullable: true })
  scorePonderado?: string;
}
