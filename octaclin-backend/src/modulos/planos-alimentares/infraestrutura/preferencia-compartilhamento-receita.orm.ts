import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('preferencias_compartilhamento_receita')
export class PreferenciaCompartilhamentoReceitaOrm {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @PrimaryColumn({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'email_ativo', type: 'boolean', default: false })
  emailAtivo: boolean;

  @Column({ name: 'email_consentido_em', type: 'timestamptz', nullable: true })
  emailConsentidoEm?: Date | null;

  @Column({ name: 'email_revogado_em', type: 'timestamptz', nullable: true })
  emailRevogadoEm?: Date | null;

  @Column({ name: 'whatsapp_ativo', type: 'boolean', default: false })
  whatsappAtivo: boolean;

  @Column({ name: 'whatsapp_consentido_em', type: 'timestamptz', nullable: true })
  whatsappConsentidoEm?: Date | null;

  @Column({ name: 'whatsapp_revogado_em', type: 'timestamptz', nullable: true })
  whatsappRevogadoEm?: Date | null;

  @Column({ name: 'push_ativo', type: 'boolean', default: false })
  pushAtivo: boolean;

  @Column({ name: 'push_consentido_em', type: 'timestamptz', nullable: true })
  pushConsentidoEm?: Date | null;

  @Column({ name: 'push_revogado_em', type: 'timestamptz', nullable: true })
  pushRevogadoEm?: Date | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
