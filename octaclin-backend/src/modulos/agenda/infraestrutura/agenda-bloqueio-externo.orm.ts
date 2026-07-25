import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('agenda_bloqueios_externos')
export class AgendaBloqueioExternoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ name: 'google_event_id', type: 'varchar', length: 220 })
  googleEventId: string;

  @Column({ name: 'inicio_em', type: 'timestamptz' })
  inicioEm: Date;

  @Column({ name: 'fim_em', type: 'timestamptz' })
  fimEm: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
