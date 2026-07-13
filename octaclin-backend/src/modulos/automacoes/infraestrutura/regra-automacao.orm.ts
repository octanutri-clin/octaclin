import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('regras_automacao')
export class RegraAutomacaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ type: 'varchar', length: 160 })
  nome: string;

  @Column({ type: 'jsonb' })
  gatilho: Record<string, unknown>;

  @Column({ type: 'jsonb', default: [] })
  condicoes: Array<Record<string, unknown>>;

  @Column({ type: 'jsonb', default: [] })
  acoes: Array<Record<string, unknown>>;

  @Column({ type: 'boolean', default: true })
  ativa: boolean;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
