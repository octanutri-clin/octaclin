import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Definicao reutilizavel do tenant; o nome e a faixa ficam cifrados. */
@Entity('catalogo_marcadores_exames')
@Index('idx_catalogo_marcadores_exames_listagem', ['tenantId', 'arquivadoEm', 'atualizadoEm'])
export class CatalogoMarcadorExameOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'definicao_criptografada', type: 'bytea' })
  definicaoCriptografada: Buffer;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid' })
  criadoPorUsuarioId: string;

  @Column({ name: 'arquivado_em', type: 'timestamptz', nullable: true })
  arquivadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
