import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('plano_alimentar_versoes')
@Index('ux_plano_alimentar_versoes_numero', ['tenantId', 'planoId', 'numero'], { unique: true })
@Index('ux_plano_alimentar_versao_rascunho', ['tenantId', 'planoId'], {
  unique: true,
  where: 'publicada_em is null and descartada_em is null'
})
@Index('idx_plano_alimentar_versoes_publicadas', ['tenantId', 'planoId', 'publicadaEm'], {
  where: 'publicada_em is not null'
})
export class PlanoAlimentarVersaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'plano_id', type: 'uuid' })
  planoId: string;

  @Column({ type: 'integer' })
  numero: number;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid' })
  criadoPorUsuarioId: string;

  @Column({ name: 'avaliacao_antropometrica_id', type: 'uuid', nullable: true })
  avaliacaoAntropometricaId?: string;

  @Column({ name: 'formula_codigo', type: 'varchar', length: 80, nullable: true })
  formulaCodigo?: string;

  @Column({ name: 'formula_versao', type: 'varchar', length: 40, nullable: true })
  formulaVersao?: string;

  @Column({ name: 'motor_calculo_versao', type: 'varchar', length: 40, nullable: true })
  motorCalculoVersao?: string;

  @Column({ name: 'objetivos_criptografados', type: 'bytea', nullable: true })
  objetivosCriptografados?: Buffer;

  @Column({ name: 'observacoes_criptografadas', type: 'bytea', nullable: true })
  observacoesCriptografadas?: Buffer;

  @Column({ name: 'calculo_snapshot_criptografado', type: 'bytea', nullable: true })
  calculoSnapshotCriptografado?: Buffer;

  @Column({ name: 'totais_snapshot_criptografado', type: 'bytea', nullable: true })
  totaisSnapshotCriptografado?: Buffer;

  @Column({ name: 'hash_conteudo', type: 'char', length: 64, nullable: true })
  hashConteudo?: string;

  @Column({ name: 'revisada_em', type: 'timestamptz', nullable: true })
  revisadaEm?: Date;

  @Column({ name: 'revisada_por_usuario_id', type: 'uuid', nullable: true })
  revisadaPorUsuarioId?: string;

  @Column({ name: 'publicada_em', type: 'timestamptz', nullable: true })
  publicadaEm?: Date;

  @Column({ name: 'descartada_em', type: 'timestamptz', nullable: true })
  descartadaEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
