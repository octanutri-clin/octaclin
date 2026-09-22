import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { TipoCondutaTerapeutica } from './conduta-terapeutica.orm';

/**
 * Item reutilizavel de conduta/orientacao, compartilhado no tenant inteiro
 * (sem separacao pessoal/clinica: conhecimento da clinica, nao de um
 * profissional individual). PB-23, Fase 272.
 */
@Entity('biblioteca_condutas')
@Index('idx_biblioteca_condutas_listagem', ['tenantId', 'tipo', 'arquivadoEm', 'atualizadoEm'])
export class BibliotecaCondutaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: TipoCondutaTerapeutica;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  /** Corpo do texto, no mesmo formato aceito por `conteudo` da conduta real. */
  @Column({ name: 'conteudo_criptografado', type: 'bytea' })
  conteudoCriptografado: Buffer;

  // Tamanho em claro: permite listar sem decifrar o conteudo de cada item.
  @Column({ name: 'tamanho_conteudo', type: 'integer' })
  tamanhoConteudo: number;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid' })
  criadoPorUsuarioId: string;

  @Column({ name: 'arquivado_em', type: 'timestamptz', nullable: true })
  arquivadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
