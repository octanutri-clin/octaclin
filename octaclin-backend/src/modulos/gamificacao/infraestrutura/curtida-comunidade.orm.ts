import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('curtidas_comunidade')
export class CurtidaComunidadeOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'circulo_id', type: 'uuid', nullable: false }) circuloId: string;
  @Column({ name: 'post_id', type: 'uuid', nullable: false }) postId: string;
  @Column({ name: 'comentario_id', type: 'uuid', nullable: true }) comentarioId?: string | null;
  @Column({ name: 'paciente_id', type: 'uuid', nullable: false }) pacienteId: string;
  @Column({ name: 'geracao_membro', type: 'integer', nullable: false }) geracaoMembro: number;
  @Column({ name: 'criado_em', type: 'timestamptz', nullable: false }) criadoEm: Date;
}
