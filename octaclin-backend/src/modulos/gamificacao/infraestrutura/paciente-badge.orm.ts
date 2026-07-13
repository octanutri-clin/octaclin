import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('paciente_badges')
export class PacienteBadgeOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'badge_id', type: 'uuid' })
  badgeId: string;

  @CreateDateColumn({ name: 'conquistado_em', type: 'timestamptz' })
  conquistadoEm: Date;
}
