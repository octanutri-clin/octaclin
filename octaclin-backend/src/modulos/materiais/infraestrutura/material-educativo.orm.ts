import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type TipoMaterialEducativo = 'link' | 'pdf_url' | 'orientacao';

@Entity('materiais_educativos')
export class MaterialEducativoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid' })
  criadoPorUsuarioId: string;

  @Column({ type: 'varchar', length: 180 })
  titulo: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: TipoMaterialEducativo;

  @Column({ type: 'varchar', length: 80, nullable: true })
  categoria?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  resumo?: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  url?: string;

  @Column({ type: 'text', nullable: true })
  conteudo?: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
