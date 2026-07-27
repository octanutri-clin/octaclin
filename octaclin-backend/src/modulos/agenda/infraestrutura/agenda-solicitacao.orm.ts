import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type StatusAgendaSolicitacao = 'pendente' | 'processando' | 'aprovada' | 'recusada' | 'expirada';

@Entity('agenda_solicitacoes')
export class AgendaSolicitacaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ name: 'inicio_em', type: 'timestamptz' })
  inicioEm: Date;

  @Column({ name: 'fim_em', type: 'timestamptz' })
  fimEm: Date;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  @Column({ name: 'contato_criptografado', type: 'bytea' })
  contatoCriptografado: Buffer;

  @Column({ name: 'observacao_criptografada', type: 'bytea', nullable: true })
  observacaoCriptografada?: Buffer | null;

  @Column({ type: 'varchar', length: 32, default: 'pendente' })
  status: StatusAgendaSolicitacao;

  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm: Date;

  @Column({ name: 'decidida_em', type: 'timestamptz', nullable: true })
  decididaEm?: Date | null;

  @Column({ name: 'decidida_por_usuario_id', type: 'uuid', nullable: true })
  decididaPorUsuarioId?: string | null;

  @Column({ name: 'paciente_id', type: 'uuid', nullable: true })
  pacienteId?: string | null;

  @Column({ name: 'consulta_id', type: 'uuid', nullable: true })
  consultaId?: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
