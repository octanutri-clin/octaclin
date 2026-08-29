import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('refresh_tokens')
export class RefreshTokenOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash: string;

  @Column({ name: 'familia_token', type: 'varchar', length: 80 })
  familiaToken: string;

  @Column({ name: 'sessao_id', type: 'uuid', nullable: true })
  sessaoId?: string | null;

  /** Marca de uso unico: preenchida no momento em que o token e rotacionado. */
  @Column({ name: 'consumido_em', type: 'timestamptz', nullable: true })
  consumidoEm?: Date | null;

  @Column({ name: 'revogado_em', type: 'timestamptz', nullable: true })
  revogadoEm?: Date | null;

  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
