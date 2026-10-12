import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('circulos_pacientes')
export class CirculoPacientesOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ type: 'varchar', length: 160 })
  nome: string;

  @Column({ type: 'varchar', length: 160 })
  objetivo: string;

  @Column({ type: 'boolean', default: true })
  privado: boolean;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  // Piloto317: excluded from legacy ORM reads/serialization.
  @Column({ name: 'eliminar_em', type: 'timestamptz', select: false, nullable: true })
  eliminarEm: Date | null;

  @Column({ name: 'modelo_versao', type: 'integer', select: false, nullable: false })
  modeloVersao: number;
  @Column({ name: 'estado_piloto', type: 'varchar', select: false, nullable: false })
  estadoPiloto: string;
  @Column({ name: 'versao_piloto', type: 'integer', select: false, nullable: false })
  versaoPiloto: number;
  @Column({ name: 'snapshot_criptografado', type: 'bytea', select: false, nullable: true })
  snapshotCriptografado?: Buffer | null;
}
