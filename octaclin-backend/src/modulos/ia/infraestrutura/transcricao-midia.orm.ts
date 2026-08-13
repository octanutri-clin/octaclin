import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('transcricoes_midia')
export class TranscricaoMidiaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'arquivo_midia_id', type: 'uuid' })
  arquivoMidiaId: string;

  @Column({ type: 'varchar', length: 80 })
  provedor: string;

  @Column({ type: 'text' })
  texto: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confianca?: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
