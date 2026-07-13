import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('moderacoes_post')
export class ModeracaoPostOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @Column({ type: 'varchar', length: 40 })
  status: 'aprovado' | 'pendente' | 'bloqueado';

  @Column({ name: 'pontuacao_risco', type: 'numeric', precision: 5, scale: 2, nullable: true })
  pontuacaoRisco?: string;

  @Column({ type: 'jsonb', default: [] })
  motivos: string[];

  @Column({ name: 'revisado_por_usuario_id', type: 'uuid', nullable: true })
  revisadoPorUsuarioId?: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
