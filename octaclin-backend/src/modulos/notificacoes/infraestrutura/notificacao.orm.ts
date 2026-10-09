import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { TipoNotificacao } from '../dominio/tipo-notificacao';
import type { ModoEntregaNotificacao } from '../dominio/politica-notificacoes';

export type { TipoNotificacao } from '../dominio/tipo-notificacao';

/**
 * Uma linha por usuario destinatario (fan-out na escrita). O texto exibido e
 * derivado de `tipo` na interface: esta tabela nao guarda nome de paciente nem
 * conteudo de mensagem, entao o centro de notificacoes nao e uma segunda copia
 * em claro do que a Fase 208 passou a cifrar.
 */
@Entity('notificacoes')
export class NotificacaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: TipoNotificacao;

  @Column({ name: 'paciente_id', type: 'uuid', nullable: true })
  pacienteId?: string | null;

  @Column({ name: 'recurso_tipo', type: 'varchar', length: 40 })
  recursoTipo: string;

  @Column({ name: 'recurso_id', type: 'uuid' })
  recursoId: string;

  @Column({ name: 'modo_entrega', type: 'varchar', length: 20, default: 'imediato' })
  modoEntrega: ModoEntregaNotificacao;

  @Column({ name: 'timezone_resumo', type: 'varchar', length: 80, nullable: true })
  timezoneResumo?: string | null;

  @Column({ name: 'resumo_previsto_em', type: 'timestamptz', nullable: true })
  resumoPrevistoEm?: Date | null;

  @Column({ name: 'email_resumo', type: 'boolean', default: false })
  emailResumo: boolean;

  @Column({ name: 'email_cancelado_em', type: 'timestamptz', nullable: true })
  emailCanceladoEm?: Date | null;

  @Column({ name: 'resumo_id', type: 'uuid', nullable: true })
  resumoId?: string | null;

  @Column({ name: 'lido_em', type: 'timestamptz', nullable: true })
  lidoEm?: Date | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
