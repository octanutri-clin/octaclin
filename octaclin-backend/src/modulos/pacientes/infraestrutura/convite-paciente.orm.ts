import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type StatusConvitePaciente = 'pendente' | 'aceito' | 'revogado' | 'expirado';

@Entity('convites_paciente_acesso')
export class ConvitePacienteOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId?: string;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid' })
  criadoPorUsuarioId: string;

  @Column({ name: 'email_hash', type: 'varchar', length: 128 })
  emailHash: string;

  @Column({ name: 'email_criptografado', type: 'bytea' })
  emailCriptografado: Buffer;

  @Column({ name: 'token_hash', type: 'varchar', length: 128, unique: true })
  tokenHash: string;

  @Column({ type: 'varchar', length: 40, default: 'pendente' })
  status: StatusConvitePaciente;

  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm: Date;

  @Column({ name: 'aceito_em', type: 'timestamptz', nullable: true })
  aceitoEm?: Date;

  @Column({ name: 'revogado_em', type: 'timestamptz', nullable: true })
  revogadoEm?: Date;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
