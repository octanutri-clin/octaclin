import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('food_recognition_cache')
export class ReconhecimentoAlimentarOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'arquivo_midia_id', type: 'uuid' })
  arquivoMidiaId: string;

  @Column({ type: 'varchar', length: 80 })
  provedor: string;

  @Column({ name: 'imagem_hash', type: 'varchar', length: 128 })
  imagemHash: string;

  @Column({ name: 'alimentos_detectados', type: 'jsonb', default: [] })
  alimentosDetectados: Array<Record<string, unknown>>;

  @Column({ name: 'peso_estimado_gramas', type: 'numeric', precision: 8, scale: 2, nullable: true })
  pesoEstimadoGramas?: string;

  @Column({ name: 'calorias_estimadas', type: 'numeric', precision: 8, scale: 2, nullable: true })
  caloriasEstimadas?: string;

  @Column({ name: 'confianca_media', type: 'numeric', precision: 5, scale: 2, nullable: true })
  confiancaMedia?: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
