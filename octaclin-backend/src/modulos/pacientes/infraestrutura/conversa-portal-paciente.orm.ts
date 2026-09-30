import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type StatusConversaPortalPaciente = 'aguardando_clinica' | 'aguardando_paciente' | 'encerrada';
export type AutorMensagemPortalPaciente = 'paciente' | 'equipe';

@Entity('conversas_portal_paciente')
@Index('IDX_conversas_portal_paciente_fila', ['tenantId', 'status', 'prazoRespostaEm'])
@Index('UQ_conversas_portal_paciente_titular', ['tenantId', 'pacienteId'], { unique: true })
export class ConversaPortalPacienteOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'profissional_responsavel_id', type: 'uuid', nullable: true })
  profissionalResponsavelId?: string;

  @Column({ type: 'varchar', length: 32, default: 'aguardando_clinica' })
  status: StatusConversaPortalPaciente;

  @Column({ name: 'ultima_mensagem_em', type: 'timestamptz' })
  ultimaMensagemEm: Date;

  @Column({ name: 'prazo_resposta_em', type: 'timestamptz', nullable: true })
  prazoRespostaEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}

@Entity('mensagens_portal_paciente')
@Index('IDX_mensagens_portal_conversa_data', ['tenantId', 'conversaId', 'criadoEm'])
@Index('IDX_mensagens_portal_paciente_rate_limit', ['tenantId', 'conversaId', 'autorUsuarioId', 'criadoEm'], {
  where: "autor_tipo = 'paciente'"
})
export class MensagemPortalPacienteOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'conversa_id', type: 'uuid' })
  conversaId: string;

  @Column({ name: 'autor_usuario_id', type: 'uuid' })
  autorUsuarioId: string;

  @Column({ name: 'autor_tipo', type: 'varchar', length: 16 })
  autorTipo: AutorMensagemPortalPaciente;

  @Column({ name: 'conteudo_criptografado', type: 'bytea' })
  conteudoCriptografado: Buffer;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
