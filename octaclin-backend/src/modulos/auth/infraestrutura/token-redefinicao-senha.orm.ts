import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type StatusTokenRedefinicaoSenha = 'pendente' | 'usado' | 'expirado' | 'revogado';

@Entity('tokens_redefinicao_senha')
export class TokenRedefinicaoSenhaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'email_hash', type: 'varchar', length: 128 })
  emailHash: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 128, unique: true })
  tokenHash: string;

  @Column({ type: 'varchar', length: 40, default: 'pendente' })
  status: StatusTokenRedefinicaoSenha;

  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm: Date;

  @Column({ name: 'usado_em', type: 'timestamptz', nullable: true })
  usadoEm?: Date;

  @Column({ name: 'revogado_em', type: 'timestamptz', nullable: true })
  revogadoEm?: Date;

  @Column({ name: 'ip_solicitacao', type: 'varchar', length: 80, nullable: true })
  ipSolicitacao?: string;

  @Column({ name: 'user_agent_solicitacao', type: 'text', nullable: true })
  userAgentSolicitacao?: string;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
