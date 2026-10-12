import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('denuncias_comunidade')
export class DenunciaComunidadeOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'circulo_id', type: 'uuid', nullable: false }) circuloId: string;
  @Column({ name: 'post_id', type: 'uuid', nullable: false }) postId: string;
  @Column({ name: 'comentario_id', type: 'uuid', nullable: true }) comentarioId?: string | null;
  @Column({ name: 'paciente_id', type: 'uuid', nullable: false }) pacienteId: string;
  @Column({ name: 'estado', type: 'varchar', nullable: false }) estado: string;
  @Column({ name: 'versao', type: 'integer', nullable: false }) versao: number;
  @Column({ name: 'evidencia_criptografada', type: 'bytea', nullable: true }) evidenciaCriptografada?: Buffer | null;
  @Column({ name: 'decisao_criptografada', type: 'bytea', nullable: true }) decisaoCriptografada?: Buffer | null;
  @Column({ name: 'revisado_por_usuario_id', type: 'uuid', nullable: true }) revisadoPorUsuarioId?: string | null;
  @Column({ name: 'criado_em', type: 'timestamptz', nullable: false }) criadoEm: Date;
  @Column({ name: 'eliminar_em', type: 'timestamptz', nullable: false }) eliminarEm: Date;
  @Column({ name: 'hold_ate', type: 'timestamptz', nullable: true }) holdAte?: Date | null;
  @Column({ name: 'hold_justificativa_criptografada', type: 'bytea', nullable: true }) holdJustificativaCriptografada?: Buffer | null;
  @Column({ name: 'hold_autor_usuario_id', type: 'uuid', nullable: true }) holdAutorUsuarioId?: string | null;
}
