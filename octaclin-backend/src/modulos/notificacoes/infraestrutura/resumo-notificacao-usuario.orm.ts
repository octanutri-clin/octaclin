import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type EstadoEmailResumo =
  | 'nao_solicitado'
  | 'pendente'
  | 'reservado'
  | 'enviado'
  | 'incerto'
  | 'falhou'
  | 'cancelado';

@Entity('resumos_notificacao_usuario')
@Index('uq_resumos_notificacao_tenant_usuario_id', ['tenantId', 'usuarioId', 'id'], { unique: true })
export class ResumoNotificacaoUsuarioOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'periodo_inicio_em', type: 'timestamptz' })
  periodoInicioEm: Date;

  @Column({ name: 'periodo_fim_em', type: 'timestamptz' })
  periodoFimEm: Date;

  @CreateDateColumn({ name: 'gerado_em', type: 'timestamptz' })
  geradoEm: Date;

  @Column({ name: 'lido_em', type: 'timestamptz', nullable: true })
  lidoEm?: Date | null;

  @Column({ type: 'jsonb', default: {} })
  contagens: Record<string, number>;

  @Column({ name: 'contagens_email', type: 'jsonb', default: {} })
  contagensEmail: Record<string, number>;

  @Column({ name: 'estado_email', type: 'varchar', length: 20, default: 'nao_solicitado' })
  estadoEmail: EstadoEmailResumo;

  @Column({ name: 'tentativa_email_em', type: 'timestamptz', nullable: true })
  tentativaEmailEm?: Date | null;

  @Column({ name: 'finalizado_email_em', type: 'timestamptz', nullable: true })
  finalizadoEmailEm?: Date | null;
}
