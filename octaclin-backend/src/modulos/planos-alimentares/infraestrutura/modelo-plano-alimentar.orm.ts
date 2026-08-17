import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { OrigemModeloPlanoAlimentar } from '../dominio/modelos-plano-alimentar';

@Entity('modelos_plano_alimentar')
@Index('idx_modelos_plano_alimentar_listagem', ['tenantId', 'origem', 'arquivadoEm', 'atualizadoEm'])
@Index('idx_modelos_plano_alimentar_profissional', ['tenantId', 'profissionalId', 'arquivadoEm', 'atualizadoEm'], {
  where: 'profissional_id is not null'
})
export class ModeloPlanoAlimentarOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 20 })
  origem: OrigemModeloPlanoAlimentar;

  /** Preenchido apenas na origem `pessoal`; a constraint do banco garante isso. */
  @Column({ name: 'profissional_id', type: 'uuid', nullable: true })
  profissionalId?: string;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  /** Snapshot das refeicoes em JSON, no mesmo formato aceito pelo rascunho. */
  @Column({ name: 'conteudo_criptografado', type: 'bytea' })
  conteudoCriptografado: Buffer;

  // Contagens em claro: permitem listar "5 refeicoes, 23 itens" sem
  // descriptografar o conteudo inteiro de cada modelo da lista.
  @Column({ name: 'total_refeicoes', type: 'integer' })
  totalRefeicoes: number;

  @Column({ name: 'total_itens', type: 'integer' })
  totalItens: number;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid' })
  criadoPorUsuarioId: string;

  @Column({ name: 'arquivado_em', type: 'timestamptz', nullable: true })
  arquivadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
