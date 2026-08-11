import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Cabecalho imutavel de uma coleta; resultados permanecem nos marcadores cifrados. */
@Entity('coletas_exames_laboratoriais')
@Index('idx_coletas_exames_laboratoriais_serie', ['tenantId', 'pacienteId', 'coletadaEm'])
export class ColetaExameLaboratorialOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'autor_usuario_id', type: 'uuid' })
  autorUsuarioId: string;

  @Column({ name: 'coletada_em', type: 'date' })
  coletadaEm: string;

  @Column({ name: 'recebida_em', type: 'date', nullable: true })
  recebidaEm?: string;

  @Column({ name: 'laboratorio_criptografado', type: 'bytea', nullable: true })
  laboratorioCriptografado?: Buffer;

  @Column({ name: 'observacoes_criptografadas', type: 'bytea', nullable: true })
  observacoesCriptografadas?: Buffer;

  @Column({ name: 'excluida_em', type: 'timestamptz', nullable: true })
  excluidaEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
