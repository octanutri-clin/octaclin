import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('desafios')
export class DesafioOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ type: 'varchar', length: 160 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string;

  @Column({ name: 'regra_pontuacao', type: 'jsonb' })
  regraPontuacao: Record<string, unknown>;

  @Column({ name: 'inicia_em', type: 'timestamptz' })
  iniciaEm: Date;

  @Column({ name: 'termina_em', type: 'timestamptz' })
  terminaEm: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
