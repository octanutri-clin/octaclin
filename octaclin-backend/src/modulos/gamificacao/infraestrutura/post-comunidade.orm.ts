import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('posts_comunidade')
export class PostComunidadeOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'circulo_id', type: 'uuid' })
  circuloId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ type: 'text' })
  conteudo: string;

  @Column({ type: 'varchar', length: 40, default: 'publicado' })
  status: 'publicado' | 'pendente_moderacao' | 'bloqueado';

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  // Piloto317: excluded from legacy ORM reads/serialization.
  @Column({ name: 'modelo_versao', type: 'integer', select: false, nullable: false })
  modeloVersao: number;
  @Column({ name: 'versao_piloto', type: 'integer', select: false, nullable: false })
  versaoPiloto: number;
  @Column({ name: 'geracao_membro', type: 'integer', select: false, nullable: true })
  geracaoMembro?: number | null;
  @Column({ name: 'autor_usuario_id', type: 'uuid', select: false, nullable: true })
  autorUsuarioId?: string | null;
  @Column({ name: 'conteudo_criptografado', type: 'bytea', select: false, nullable: true })
  conteudoCriptografado?: Buffer | null;
  @Column({ name: 'retirado_em', type: 'timestamptz', select: false, nullable: true })
  retiradoEm?: Date | null;
  @Column({ name: 'eliminar_em', type: 'timestamptz', select: false, nullable: true })
  eliminarEm?: Date | null;
}
