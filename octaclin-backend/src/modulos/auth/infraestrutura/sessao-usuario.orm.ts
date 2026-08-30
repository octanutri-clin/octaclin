import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type MotivoRevogacaoSessao =
  | 'logout'
  | 'encerrada_pelo_usuario'
  | 'encerrada_outras'
  | 'reuso_detectado'
  | 'senha_redefinida'
  | 'mfa_obrigatorio';

/**
 * Uma sessao equivale a familia de refresh tokens criada por um login.
 * Guarda somente metadados: nenhum token, hash ou material derivado.
 */
@Entity('sessoes_usuario')
export class SessaoUsuarioOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @Column({ name: 'ultima_atividade_em', type: 'timestamptz' })
  ultimaAtividadeEm: Date;

  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm: Date;

  @Column({ name: 'revogado_em', type: 'timestamptz', nullable: true })
  revogadoEm?: Date | null;

  @Column({ name: 'motivo_revogacao', type: 'varchar', length: 40, nullable: true })
  motivoRevogacao?: MotivoRevogacaoSessao | null;

  @Column({ name: 'mfa_verificado_em', type: 'timestamptz', nullable: true })
  mfaVerificadoEm?: Date | null;
}
