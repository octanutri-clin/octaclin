import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Catalogo de tipos de atendimento por tenant (PB-18, Fase 276), no molde da biblioteca de condutas. */
@Entity('tipos_atendimento')
@Index('idx_tipos_atendimento_tenant_ativo', ['tenantId', 'ativo'])
export class TipoAtendimentoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @Column({ name: 'duracao_minutos', type: 'int' })
  duracaoMinutos: number;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
