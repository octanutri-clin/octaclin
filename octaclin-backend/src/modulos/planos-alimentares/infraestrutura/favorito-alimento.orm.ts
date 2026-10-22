import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('favoritos_alimentos_profissional')
export class FavoritoAlimentoOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'profissional_id', type: 'uuid' }) profissionalId: string;
  @Column({ name: 'alimento_composicao_id', type: 'uuid', nullable: true }) alimentoComposicaoId?: string;
  @Column({ name: 'alimento_personalizado_id', type: 'uuid', nullable: true }) alimentoPersonalizadoId?: string;
  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' }) criadoEm: Date;
}
