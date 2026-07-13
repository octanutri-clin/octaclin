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
}
