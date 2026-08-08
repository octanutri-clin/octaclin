import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('planos_alimentares')
@Index('idx_planos_alimentares_paciente_ativos', ['tenantId', 'pacienteId', 'criadoEm'], {
  where: 'arquivado_em is null'
})
@Index('idx_planos_alimentares_profissional', ['tenantId', 'profissionalId', 'pacienteId'])
export class PlanoAlimentarOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid' })
  criadoPorUsuarioId: string;

  @Column({ name: 'titulo_criptografado', type: 'bytea' })
  tituloCriptografado: Buffer;

  @Column({ name: 'versao_publicada_atual_id', type: 'uuid', nullable: true })
  versaoPublicadaAtualId?: string;

  @Column({ name: 'arquivado_em', type: 'timestamptz', nullable: true })
  arquivadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
