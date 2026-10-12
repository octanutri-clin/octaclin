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

  // Piloto317: excluded from legacy ORM reads/serialization.
  @Column({ name: 'modelo_versao', type: 'integer', select: false, nullable: false })
  modeloVersao: number;
  @Column({ name: 'versao_piloto', type: 'integer', select: false, nullable: false })
  versaoPiloto: number;
  @Column({ name: 'autor_usuario_id', type: 'uuid', select: false, nullable: true })
  autorUsuarioId?: string | null;
  @Column({ name: 'profissional_id', type: 'uuid', select: false, nullable: true })
  profissionalId?: string | null;
  @Column({ name: 'snapshot_criptografado', type: 'bytea', select: false, nullable: true })
  snapshotCriptografado?: Buffer | null;
  @Column({ name: 'compartilhado', type: 'boolean', select: false, nullable: false })
  compartilhado: boolean;
  @Column({ name: 'geracao_compartilhamento', type: 'integer', select: false, nullable: false })
  geracaoCompartilhamento: number;
  @Column({ name: 'profissional_compartilhamento_id', type: 'uuid', select: false, nullable: true })
  profissionalCompartilhamentoId?: string | null;
}
