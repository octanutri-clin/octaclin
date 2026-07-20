import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('consentimentos_lgpd')
export class ConsentimentoLgpdOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 80 })
  tipo: string;

  @Column({ type: 'varchar', length: 40 })
  versao: string;

  @Column({ name: 'aceito_em', type: 'timestamptz' })
  aceitoEm: Date;

  @Column({ type: 'inet', nullable: true })
  ip?: string;

  @Column({ type: 'jsonb', default: {} })
  metadados: Record<string, unknown>;
}
