import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type StatusCicloVidaPaciente = 'ACTIVE' | 'ARCHIVED' | 'RETENTION_HELD' | 'DELETION_PENDING' | 'DELETED';

@Entity('pacientes')
export class PacienteOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId?: string;

  @Column({ name: 'profissional_responsavel_id', type: 'uuid' })
  profissionalResponsavelId: string;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  @Column({ name: 'contato_criptografado', type: 'bytea', nullable: true })
  contatoCriptografado?: Buffer;

  @Column({ name: 'busca_hashes', type: 'text', array: true, default: () => "'{}'::text[]" })
  buscaHashes: string[];

  @Column({ name: 'data_nascimento', type: 'date', nullable: true })
  dataNascimento?: string;

  @Column({ name: 'referencia_externa', type: 'varchar', length: 180, nullable: true })
  referenciaExterna?: string;

  @Column({ name: 'status_adesao', type: 'varchar', length: 40, default: 'novo' })
  statusAdesao: string;

  @Column({ name: 'score_risco', type: 'numeric', precision: 5, scale: 2, default: 0 })
  scoreRisco: string;

  @Column({ name: 'ultimo_checkin_em', type: 'timestamptz', nullable: true })
  ultimoCheckinEm?: Date;

  @Column({ name: 'arquivado_em', type: 'timestamptz', nullable: true })
  arquivadoEm?: Date | null;

  /**
   * Modelo de ciclo de vida LGPD (Fase 261). `ARCHIVED` e o estado
   * operacional de `arquivadoEm` (encerrar acompanhamento); os outros tres
   * pertencem so ao fluxo de solicitacao de eliminacao de dados, nunca ao
   * "arquivar paciente" da tela de cadastro. Ver DESENHO_RETENCAO_LGPD_FASE261.
   */
  @Column({ name: 'status_ciclo_vida', type: 'varchar', length: 30, default: 'ACTIVE' })
  statusCicloVida?: StatusCicloVidaPaciente;

  @Column({ name: 'deletion_requested_at', type: 'timestamptz', nullable: true })
  deletionRequestedAt?: Date;

  @Column({ name: 'retention_reason', type: 'varchar', length: 60, nullable: true })
  retentionReason?: string;

  @Column({ name: 'retention_until', type: 'timestamptz', nullable: true })
  retentionUntil?: Date;

  @Column({ name: 'legal_basis', type: 'varchar', length: 60, nullable: true })
  legalBasis?: string;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
