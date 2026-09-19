import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AcaoAutomacao } from '../dominio/acoes-automacao';

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
  acoes: AcaoAutomacao[];

  @Column({ type: 'boolean', default: true })
  ativa: boolean;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
