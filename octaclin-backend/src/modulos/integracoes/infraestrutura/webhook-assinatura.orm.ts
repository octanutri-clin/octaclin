import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { EventoWebhook } from '../dominio/contratos-integracao';

@Entity('webhook_assinaturas')
export class WebhookAssinaturaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text', array: true })
  eventos: EventoWebhook[];

  @Column({ name: 'segredo_criptografado', type: 'bytea' })
  segredoCriptografado: Buffer;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid', nullable: true })
  criadoPorUsuarioId?: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
