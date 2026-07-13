import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sincronizacoes_mobile')
export class SincronizacaoMobileOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'id_local', type: 'varchar', length: 160 })
  idLocal: string;

  @Column({ type: 'varchar', length: 80 })
  tipo: string;

  @Column({ type: 'varchar', length: 40 })
  status: 'sincronizado' | 'erro';

  @Column({ name: 'recurso_tipo', type: 'varchar', length: 80, nullable: true })
  recursoTipo?: string;

  @Column({ name: 'recurso_id', type: 'uuid', nullable: true })
  recursoId?: string;

  @Column({ type: 'text', nullable: true })
  erro?: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
