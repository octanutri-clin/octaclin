import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('membros_circulo')
export class MembroCirculoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'circulo_id', type: 'uuid' })
  circuloId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @CreateDateColumn({ name: 'entrou_em', type: 'timestamptz' })
  entrouEm: Date;

  // Piloto317: excluded from legacy ORM reads/serialization.
  @Column({ name: 'estado_piloto', type: 'varchar', select: false, nullable: false })
  estadoPiloto: string;
  @Column({ name: 'geracao', type: 'integer', select: false, nullable: false })
  geracao: number;
  @Column({ name: 'versao_piloto', type: 'integer', select: false, nullable: false })
  versaoPiloto: number;
  @Column({ name: 'convite_expira_em', type: 'timestamptz', select: false, nullable: true })
  conviteExpiraEm?: Date | null;
  @Column({ name: 'autor_convite_usuario_id', type: 'uuid', select: false, nullable: true })
  autorConviteUsuarioId?: string | null;
  @Column({ name: 'usuario_aceite_id', type: 'uuid', select: false, nullable: true })
  usuarioAceiteId?: string | null;
  @Column({ name: 'termo_versao', type: 'varchar', select: false, nullable: true })
  termoVersao?: string | null;
  @Column({ name: 'aceito_em', type: 'timestamptz', select: false, nullable: true })
  aceitoEm?: Date | null;
  @Column({ name: 'revogado_em', type: 'timestamptz', select: false, nullable: true })
  revogadoEm?: Date | null;
  @Column({ name: 'nome_criptografado', type: 'bytea', select: false, nullable: true })
  nomeCriptografado?: Buffer | null;
  @Column({ name: 'eliminar_em', type: 'timestamptz', select: false, nullable: true })
  eliminarEm?: Date | null;
}
