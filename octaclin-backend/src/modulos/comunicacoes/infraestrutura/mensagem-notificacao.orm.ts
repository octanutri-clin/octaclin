import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { StatusMensagemNotificacao } from '../dominio/canal-notificacao';

@Entity('mensagens_notificacao')
export class MensagemNotificacaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid', nullable: true })
  pacienteId?: string;

  @Column({ name: 'canal_id', type: 'uuid', nullable: true })
  canalId?: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId?: string;

  @Column({ type: 'varchar', length: 40, default: 'pendente' })
  status: StatusMensagemNotificacao;

  /**
   * Somente o que a infra roteia, casa e consulta em SQL. O conteudo da mensagem
   * fica em `conteudoCriptografado` — ver `dominio/conteudo-mensagem.ts`.
   */
  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  /** Texto, assunto e nomes. Nulavel: linha gravada antes da Fase 208 nao tem. */
  @Column({ name: 'conteudo_criptografado', type: 'bytea', nullable: true })
  conteudoCriptografado?: Buffer;

  @Column({ type: 'text', nullable: true })
  erro?: string;

  /**
   * Opcional, informada pelo chamador. Indice unico parcial
   * `uq_mensagens_notificacao_tenant_chave_idempotencia` (tenant_id,
   * chave_idempotencia) WHERE chave_idempotencia IS NOT NULL garante que um
   * retry/duplo clique com a mesma chave nunca duplica o envio.
   */
  @Column({ name: 'chave_idempotencia', type: 'varchar', length: 200, nullable: true })
  chaveIdempotencia?: string;

  @Column({ name: 'enviado_em', type: 'timestamptz', nullable: true })
  enviadoEm?: Date;

  /**
   * Status de entrega reportado pelo webhook de status da Meta (sent,
   * delivered, read, failed). Coluna de primeira classe: antes so existia
   * dentro de `payload.ultimoStatusMeta`, ilegivel para filtro/consulta SQL.
   * O JSON continua gravado para o detalhe (erros, recipientId).
   */
  @Column({ name: 'status_entrega_whatsapp', type: 'varchar', length: 20, nullable: true })
  statusEntregaWhatsapp?: string;

  @Column({ name: 'status_entrega_atualizado_em', type: 'timestamptz', nullable: true })
  statusEntregaAtualizadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
