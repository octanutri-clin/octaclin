import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('dashboard_alertas_ocultos')
@Index('uq_dashboard_alertas_ocultos_usuario_alerta', ['tenantId', 'usuarioId', 'alertaId'], { unique: true })
export class DashboardAlertaOcultoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'alerta_id', type: 'varchar', length: 240 })
  alertaId: string;

  @Column({ name: 'oculto_ate_em', type: 'timestamptz' })
  ocultoAteEm: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
