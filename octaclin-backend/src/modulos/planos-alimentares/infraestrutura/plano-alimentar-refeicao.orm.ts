import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('plano_alimentar_refeicoes')
@Index('ux_plano_alimentar_refeicoes_ordem', ['tenantId', 'versaoId', 'ordem'], { unique: true })
export class PlanoAlimentarRefeicaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'versao_id', type: 'uuid' })
  versaoId: string;

  @Column({ type: 'integer' })
  ordem: number;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  @Column({ name: 'horario_local', type: 'time', nullable: true })
  horarioLocal?: string;

  @Column({ name: 'orientacoes_criptografadas', type: 'bytea', nullable: true })
  orientacoesCriptografadas?: Buffer;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
