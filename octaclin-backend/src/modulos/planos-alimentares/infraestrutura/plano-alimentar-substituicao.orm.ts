import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('plano_alimentar_substituicoes')
@Index('ux_plano_alimentar_substituicoes_ordem', ['tenantId', 'itemId', 'ordem'], { unique: true })
@Index('idx_plano_alimentar_substituicoes_alimento', ['alimentoComposicaoId'], {
  where: 'alimento_composicao_id is not null'
})
export class PlanoAlimentarSubstituicaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'alimento_composicao_id', type: 'uuid', nullable: true })
  alimentoComposicaoId?: string;

  @Column({ type: 'integer' })
  ordem: number;

  @Column({ name: 'descricao_criptografada', type: 'bytea' })
  descricaoCriptografada: Buffer;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  quantidade: string;

  @Column({ type: 'varchar', length: 40 })
  unidade: string;

  @Column({ name: 'porcao_gramas', type: 'numeric', precision: 12, scale: 3 })
  porcaoGramas: string;

  @Column({ name: 'composicao_snapshot_criptografada', type: 'bytea' })
  composicaoSnapshotCriptografada: Buffer;

  @Column({ name: 'motor_calculo_versao', type: 'varchar', length: 40 })
  motorCalculoVersao: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
