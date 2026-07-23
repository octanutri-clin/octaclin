import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type StatusEnvioMaterialPaciente = 'enviado' | 'visualizado' | 'arquivado';

@Entity('envios_material_paciente')
export class EnvioMaterialPacienteOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  @Column({ name: 'enviado_por_usuario_id', type: 'uuid' })
  enviadoPorUsuarioId: string;

  @Column({ name: 'observacao_criptografada', type: 'bytea', nullable: true })
  observacaoCriptografada?: Buffer;

  @Column({ type: 'varchar', length: 40, default: 'enviado' })
  status: StatusEnvioMaterialPaciente;

  @Column({ name: 'enviado_em', type: 'timestamptz', nullable: true })
  enviadoEm?: Date;

  @Column({ name: 'visualizado_em', type: 'timestamptz', nullable: true })
  visualizadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
