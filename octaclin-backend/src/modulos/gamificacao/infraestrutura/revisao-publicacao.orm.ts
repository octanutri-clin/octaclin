import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('revisoes_publicacao')
export class RevisaoPublicacaoOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'circulo_id', type: 'uuid', nullable: false }) circuloId: string;
  @Column({ name: 'post_id', type: 'uuid', nullable: false }) postId: string;
  @Column({ name: 'comentario_id', type: 'uuid', nullable: true }) comentarioId?: string | null;
  @Column({ name: 'versao', type: 'integer', nullable: false }) versao: number;
  @Column({ name: 'conteudo_criptografado', type: 'bytea', nullable: true }) conteudoCriptografado?: Buffer | null;
  @Column({ name: 'criado_em', type: 'timestamptz', nullable: false }) criadoEm: Date;
  @Column({ name: 'eliminar_em', type: 'timestamptz', nullable: true }) eliminarEm?: Date | null;
}
