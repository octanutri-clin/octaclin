import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { OrigemModeloEvolucaoClinica, TipoModeloTextoClinico } from '../dominio/modelos-evolucao-clinica';

@Entity('modelos_evolucao_clinica')
@Index('idx_modelos_evolucao_clinica_listagem', ['tenantId', 'origem', 'arquivadoEm', 'atualizadoEm'])
@Index('idx_modelos_evolucao_clinica_profissional', ['tenantId', 'profissionalId', 'arquivadoEm', 'atualizadoEm'], {
  where: 'profissional_id is not null'
})
export class ModeloEvolucaoClinicaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 20 })
  origem: OrigemModeloEvolucaoClinica;

  /** Preenchido apenas na origem `pessoal`; a constraint do banco garante isso. */
  @Column({ name: 'profissional_id', type: 'uuid', nullable: true })
  profissionalId?: string;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  // Finalidade textual em claro para filtro; nome e conteudo seguem cifrados.
  @Column({ type: 'varchar', length: 40 })
  tipo: TipoModeloTextoClinico;

  /** Corpo do texto do modelo, no mesmo formato aceito por `conteudo` da evolucao. */
  @Column({ name: 'conteudo_criptografado', type: 'bytea' })
  conteudoCriptografado: Buffer;

  // Tamanho em claro: permite listar sem decifrar o conteudo de cada modelo.
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
