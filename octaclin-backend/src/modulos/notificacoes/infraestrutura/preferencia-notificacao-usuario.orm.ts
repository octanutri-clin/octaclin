import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { ModoEntregaNotificacao } from '../dominio/politica-notificacoes';

@Entity('preferencias_notificacao_usuario')
export class PreferenciaNotificacaoUsuarioOrm {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @PrimaryColumn({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'modo_formulario_respondido', type: 'varchar', length: 20, nullable: true })
  modoFormularioRespondido?: ModoEntregaNotificacao | null;

  @Column({ name: 'modo_tarefa_concluida', type: 'varchar', length: 20, nullable: true })
  modoTarefaConcluida?: ModoEntregaNotificacao | null;

  @Column({ name: 'modo_automacao_executada', type: 'varchar', length: 20, nullable: true })
  modoAutomacaoExecutada?: ModoEntregaNotificacao | null;

  @Column({ type: 'varchar', length: 80, default: 'America/Sao_Paulo' })
  timezone: string;

  @Column({ name: 'email_resumo', type: 'boolean', default: false })
  emailResumo: boolean;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
