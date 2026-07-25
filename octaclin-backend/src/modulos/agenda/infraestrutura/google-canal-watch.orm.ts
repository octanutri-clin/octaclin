import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('google_canais_watch')
export class GoogleCanalWatchOrm {
  @PrimaryColumn({ name: 'canal_watch_id', type: 'varchar', length: 220 })
  canalWatchId: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
