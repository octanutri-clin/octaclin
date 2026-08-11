import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Serie de fotos; os objetos privados permanecem em arquivos_midia. */
@Entity('evolucoes_fotograficas')
@Index('idx_evolucoes_fotograficas_serie', ['tenantId', 'pacienteId', 'capturadaEm'])
export class EvolucaoFotograficaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'consentimento_id', type: 'uuid' })
  consentimentoId: string;

  @Column({ name: 'autor_usuario_id', type: 'uuid' })
  autorUsuarioId: string;

  @Column({ name: 'protocolo_criptografado', type: 'bytea' })
  protocoloCriptografado: Buffer;

  @Column({ name: 'capturada_em', type: 'date' })
  capturadaEm: string;

  @Column({ name: 'observacoes_criptografadas', type: 'bytea', nullable: true })
  observacoesCriptografadas?: Buffer;

  @Column({ name: 'excluida_em', type: 'timestamptz', nullable: true })
  excluidaEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
