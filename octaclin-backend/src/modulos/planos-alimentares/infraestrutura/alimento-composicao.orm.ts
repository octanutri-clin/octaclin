import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('alimentos_composicao')
@Index('ux_alimentos_composicao_fonte_codigo', ['fonteId', 'codigoOrigem'], { unique: true })
@Index('idx_alimentos_composicao_nome', { synchronize: false })
export class AlimentoComposicaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'fonte_id', type: 'uuid' })
  fonteId: string;

  @Column({ name: 'importacao_id', type: 'uuid', nullable: true })
  importacaoId?: string;

  @Column({ name: 'hash_registro', type: 'char', length: 64, nullable: true })
  hashRegistro?: string;

  @Column({ name: 'codigo_origem', type: 'varchar', length: 120 })
  codigoOrigem: string;

  @Column({ type: 'varchar', length: 240 })
  nome: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  preparacao?: string;

  @Column({ name: 'base_gramas', type: 'numeric', precision: 12, scale: 3, default: 100 })
  baseGramas: string;

  @Column({ name: 'energia_kcal', type: 'numeric', precision: 12, scale: 4, nullable: true })
  energiaKcal?: string;

  @Column({ name: 'proteinas_g', type: 'numeric', precision: 12, scale: 4, nullable: true })
  proteinasG?: string;

  @Column({ name: 'carboidratos_g', type: 'numeric', precision: 12, scale: 4, nullable: true })
  carboidratosG?: string;

  @Column({ name: 'lipidios_g', type: 'numeric', precision: 12, scale: 4, nullable: true })
  lipidiosG?: string;

  @Column({ name: 'fibras_g', type: 'numeric', precision: 12, scale: 4, nullable: true })
  fibrasG?: string;

  @Column({ name: 'sodio_mg', type: 'numeric', precision: 12, scale: 4, nullable: true })
  sodioMg?: string;

  @Column({ type: 'jsonb', default: {} })
  micronutrientes: Record<string, unknown>;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
