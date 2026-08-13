import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('condutas_terapeuticas_versoes')
@Index('idx_condutas_terapeuticas_versoes_conduta', ['tenantId', 'condutaTerapeuticaId', 'numero'])
export class CondutaTerapeuticaVersaoOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'conduta_terapeutica_id', type: 'uuid' }) condutaTerapeuticaId: string;
  @Column({ type: 'integer' }) numero: number;
  @Column({ name: 'titulo_criptografado', type: 'bytea' }) tituloCriptografado: Buffer;
  @Column({ name: 'conteudo_criptografado', type: 'bytea' }) conteudoCriptografado: Buffer;
  @Column({ name: 'validade_inicio', type: 'date', nullable: true }) validadeInicio?: string;
  @Column({ name: 'validade_fim', type: 'date', nullable: true }) validadeFim?: string;
  @Column({ name: 'criado_por_usuario_id', type: 'uuid' }) criadoPorUsuarioId: string;
  @Column({ name: 'revisada_em', type: 'timestamptz', nullable: true }) revisadaEm?: Date;
  @Column({ name: 'revisada_por_usuario_id', type: 'uuid', nullable: true }) revisadaPorUsuarioId?: string;
  @Column({ name: 'publicada_em', type: 'timestamptz', nullable: true }) publicadaEm?: Date;
  @Column({ name: 'descartada_em', type: 'timestamptz', nullable: true }) descartadaEm?: Date;
  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' }) criadoEm: Date;
  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' }) atualizadoEm: Date;
}
