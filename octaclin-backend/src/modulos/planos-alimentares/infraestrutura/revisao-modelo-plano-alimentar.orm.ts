import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('revisoes_modelo_plano_alimentar')
@Index('ux_revisoes_modelo_plano_alimentar_tenant_modelo_numero', ['tenantId', 'modeloId', 'numero'], { unique: true })
export class RevisaoModeloPlanoAlimentarOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'modelo_id', type: 'uuid' })
  modeloId: string;

  @Column({ type: 'integer' })
  numero: number;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  @Column({ name: 'conteudo_criptografado', type: 'bytea' })
  conteudoCriptografado: Buffer;

  @Column({ name: 'total_refeicoes', type: 'integer' })
  totalRefeicoes: number;

  @Column({ name: 'total_itens', type: 'integer' })
  totalItens: number;

  @Column({ name: 'autor_usuario_id', type: 'uuid' })
  autorUsuarioId: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
