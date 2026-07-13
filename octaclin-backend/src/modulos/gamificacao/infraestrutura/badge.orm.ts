import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('badges')
export class BadgeOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao?: string;

  @Column({ name: 'icone_svg', type: 'text' })
  iconeSvg: string;

  @Column({ name: 'regra_conquista', type: 'jsonb' })
  regraConquista: Record<string, unknown>;
}
