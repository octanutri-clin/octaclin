import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('comentarios_comunidade')
export class ComentarioComunidadeOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'circulo_id', type: 'uuid', nullable: false }) circuloId: string;
  @Column({ name: 'post_id', type: 'uuid', nullable: false }) postId: string;
  @Column({ name: 'paciente_id', type: 'uuid', nullable: false }) pacienteId: string;
  @Column({ name: 'autor_usuario_id', type: 'uuid', nullable: false }) autorUsuarioId: string;
  @Column({ name: 'geracao_membro', type: 'integer', nullable: false }) geracaoMembro: number;
  @Column({ name: 'versao', type: 'integer', nullable: false }) versao: number;
  @Column({ name: 'estado', type: 'varchar', nullable: false }) estado: string;
  @Column({ name: 'conteudo_criptografado', type: 'bytea', nullable: true }) conteudoCriptografado?: Buffer | null;
  @Column({ name: 'criado_em', type: 'timestamptz', nullable: false }) criadoEm: Date;
  @Column({ name: 'retirado_em', type: 'timestamptz', nullable: true }) retiradoEm?: Date | null;
  @Column({ name: 'eliminar_em', type: 'timestamptz', nullable: true }) eliminarEm?: Date | null;
}
