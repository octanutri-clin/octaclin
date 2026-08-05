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

  @Column({ name: 'enviado_em', type: 'timestamptz', nullable: true })
  enviadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
