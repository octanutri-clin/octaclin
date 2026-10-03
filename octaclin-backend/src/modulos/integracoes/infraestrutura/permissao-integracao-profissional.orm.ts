import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { EventoWebhook, EscopoApiPublica } from '../dominio/contratos-integracao';

export type DominioPermissaoIntegracao = 'api' | 'webhook';

@Entity('permissoes_integracao_profissional')
export class PermissaoIntegracaoProfissionalOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 16 })
  tipo: DominioPermissaoIntegracao;

  @Column({ name: 'escopos_api', type: 'text', array: true, default: () => "'{}'" })
  escoposApi: EscopoApiPublica[];

  @Column({ name: 'eventos_webhook', type: 'text', array: true, default: () => "'{}'" })
  eventosWebhook: EventoWebhook[];

  @Column({ name: 'concedida_por_usuario_id', type: 'uuid' })
  concedidaPorUsuarioId: string;

  @CreateDateColumn({ name: 'concedida_em', type: 'timestamptz' })
  concedidaEm: Date;

  @Column({ name: 'revogada_por_usuario_id', type: 'uuid', nullable: true })
  revogadaPorUsuarioId?: string;

  @Column({ name: 'revogada_em', type: 'timestamptz', nullable: true })
  revogadaEm?: Date;
}
