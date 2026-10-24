import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
@Entity('grupos_substituicoes')
export class GrupoSubstituicoesOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'profissional_id', type: 'uuid' }) profissionalId: string;
  @Column({ name: 'criado_por_usuario_id', type: 'uuid' }) criadoPorUsuarioId: string;
  @Column({ name: 'alterado_por_usuario_id', type: 'uuid' }) alteradoPorUsuarioId: string;
  @Column({ name: 'chave_idempotencia', type: 'uuid' }) chaveIdempotencia: string;
  @Column({ type: 'varchar', length: 10 }) escopo: 'pessoal' | 'clinica';
  @Column({ type: 'varchar', length: 10, default: 'ativo' }) estado: 'ativo' | 'arquivado';
  @Column({ type: 'integer', default: 1 }) revisao: number;
  @Column({ name: 'conteudo_criptografado', type: 'bytea' }) conteudoCriptografado: Buffer;
  @Column({ name: 'criacao_snapshot_criptografado', type: 'bytea' }) criacaoSnapshotCriptografado: Buffer;
  @Column({ name: 'busca_hashes', type: 'text', array: true, default: '{}' }) buscaHashes: string[];
  @Column({ name: 'categoria_hash', type: 'text', nullable: true }) categoriaHash?: string | null;
  @Column({ name: 'etiquetas_hashes', type: 'text', array: true, default: '{}' }) etiquetasHashes: string[];
  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' }) criadoEm: Date;
  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' }) atualizadoEm: Date;
}
@Entity('favoritos_grupos_substituicoes')
export class FavoritoGrupoSubstituicoesOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'profissional_id', type: 'uuid' }) profissionalId: string;
  @Column({ name: 'grupo_id', type: 'uuid' }) grupoId: string;
  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' }) criadoEm: Date;
}
