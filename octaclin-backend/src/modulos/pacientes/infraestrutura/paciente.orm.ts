import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ name: 'status_adesao', type: 'varchar', length: 40, default: 'novo' })
  statusAdesao: string;

  @Column({ name: 'score_risco', type: 'numeric', precision: 5, scale: 2, default: 0 })
  scoreRisco: string;

  @Column({ name: 'ultimo_checkin_em', type: 'timestamptz', nullable: true })
  ultimoCheckinEm?: Date;

  @Column({ name: 'arquivado_em', type: 'timestamptz', nullable: true })
  arquivadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
