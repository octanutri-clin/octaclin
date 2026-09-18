import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type {
  CodigoMotivoOverridePrioridadeAcompanhamento,
  FaixaPrioridadeAcompanhamento,
  FatorPrioridadeAcompanhamento
} from '../dominio/prioridade-acompanhamento';

/**
 * Estado atual da prioridade de acompanhamento de um paciente (Fase 265.2).
 * Uma linha por paciente: e uma projecao recomputavel a qualquer momento a
 * partir de `PrioridadeAcompanhamentoHistoricoOrm` e dos dados de origem,
 * nunca a fonte de verdade. Nenhum servico grava ou le esta entidade ainda
 * -- isso chega com o job idempotente (265.3) e a leitura auditada (265.4).
 */
@Entity('prioridades_acompanhamento_paciente')
export class PrioridadeAcompanhamentoPacienteOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ type: 'int' })
  score: number;

  @Column({ type: 'varchar', length: 10 })
  faixa: FaixaPrioridadeAcompanhamento;

  @Column({ type: 'jsonb' })
  fatores: FatorPrioridadeAcompanhamento[];

  @Column({ name: 'versao_formula', type: 'varchar', length: 20 })
  versaoFormula: string;

  @Column({ name: 'calculado_em', type: 'timestamptz' })
  calculadoEm: Date;

  /**
   * Override "tudo ou nada": os seis campos abaixo existem juntos ou nenhum
   * (check constraint endurecida pela migration 1047). `overrideCodigoMotivo` e validado
   * contra o enum fechado (`CODIGOS_MOTIVO_OVERRIDE_PRIORIDADE_ACOMPANHAMENTO`)
   * na camada de aplicacao (DTO); a coluna continua `varchar(60)` porque o
   * enum aprovado cabe folgado nesse tamanho e nao ha ganho em duplicar a
   * validacao como `check` de banco.
   */
  @Column({ name: 'override_faixa', type: 'varchar', length: 10, nullable: true })
  overrideFaixa?: FaixaPrioridadeAcompanhamento;

  @Column({ name: 'override_codigo_motivo', type: 'varchar', length: 60, nullable: true })
  overrideCodigoMotivo?: CodigoMotivoOverridePrioridadeAcompanhamento;

  @Column({ name: 'override_justificativa_criptografada', type: 'bytea', nullable: true })
  overrideJustificativaCriptografada?: Buffer;

  @Column({ name: 'override_expira_em', type: 'timestamptz', nullable: true })
  overrideExpiraEm?: Date;

  @Column({ name: 'override_ator_usuario_id', type: 'uuid', nullable: true })
  overrideAtorUsuarioId?: string;

  @Column({ name: 'override_criado_em', type: 'timestamptz', nullable: true })
  overrideCriadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
