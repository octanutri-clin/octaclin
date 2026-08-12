import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Relaciona uma serie clinica a um unico objeto privado confirmado. */
@Entity('evolucoes_fotograficas_arquivos')
@Unique('uq_evolucoes_fotograficas_arquivos_serie_arquivo', ['tenantId', 'evolucaoFotograficaId', 'arquivoMidiaId'])
@Unique('uq_evolucoes_fotograficas_arquivos_arquivo', ['tenantId', 'arquivoMidiaId'])
@Index('idx_evolucoes_fotograficas_arquivos_serie', ['tenantId', 'evolucaoFotograficaId'])
export class EvolucaoFotograficaArquivoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'evolucao_fotografica_id', type: 'uuid' })
  evolucaoFotograficaId: string;

  @Column({ name: 'arquivo_midia_id', type: 'uuid' })
  arquivoMidiaId: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
