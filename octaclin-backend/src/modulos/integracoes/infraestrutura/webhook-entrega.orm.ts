import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { EventoWebhook } from '../dominio/contratos-integracao';

export type StatusWebhookEntrega = 'pendente' | 'processando' | 'entregue' | 'falhou';

@Entity('webhook_entregas')
export class WebhookEntregaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'assinatura_id', type: 'uuid' })
  assinaturaId: string;

  @Column({ type: 'varchar', length: 60 })
  evento: EventoWebhook;

  @Column({ name: 'recurso_tipo', type: 'varchar', length: 60 })
  recursoTipo: string;

  @Column({ name: 'recurso_id', type: 'uuid', nullable: true })
  recursoId?: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: StatusWebhookEntrega;

  @Column({ type: 'integer', default: 0 })
  tentativas: number;

  @Column({ name: 'proxima_tentativa_em', type: 'timestamptz', default: () => 'now()' })
  proximaTentativaEm: Date;

  @Column({ name: 'ultimo_status_http', type: 'integer', nullable: true })
  ultimoStatusHttp?: number;

  @Column({ name: 'ultimo_erro', type: 'varchar', length: 500, nullable: true })
  ultimoErro?: string;

  @Column({ name: 'entregue_em', type: 'timestamptz', nullable: true })
  entregueEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
