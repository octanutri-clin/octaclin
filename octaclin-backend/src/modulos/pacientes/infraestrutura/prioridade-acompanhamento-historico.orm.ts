import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type {
  FaixaPrioridadeAcompanhamento,
  FatorPrioridadeAcompanhamento
} from '../dominio/prioridade-acompanhamento';

export type TipoEventoPrioridadeAcompanhamento =
  | 'calculo'
  | 'override_criado'
  | 'override_alterado'
  | 'override_expirado'
  | 'override_removido';

/**
 * Historico append-only da prioridade de acompanhamento (Fase 265.2): uma
 * linha por evento (calculo novo ou mudanca de override). Protegida por
 * trigger no banco (migration 1046) que rejeita `update`/`delete`/`truncate`
 * mesmo para o dono da tabela -- mesmo mecanismo de `user_action_logs`
 * (migration 1038). Nenhum servico grava aqui ainda; chega com 265.3/265.4.
 */
@Entity('prioridades_acompanhamento_historico')
export class PrioridadeAcompanhamentoHistoricoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'tipo_evento', type: 'varchar', length: 30 })
  tipoEvento: TipoEventoPrioridadeAcompanhamento;

  @Column({ type: 'int', nullable: true })
  score?: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  faixa?: FaixaPrioridadeAcompanhamento;

  @Column({ name: 'versao_formula', type: 'varchar', length: 20, nullable: true })
  versaoFormula?: string;

  @Column({ type: 'jsonb', nullable: true })
  fatores?: FatorPrioridadeAcompanhamento[];

  @Column({ name: 'ator_usuario_id', type: 'uuid', nullable: true })
  atorUsuarioId?: string;

  @Column({ name: 'override_codigo_motivo', type: 'varchar', length: 60, nullable: true })
  overrideCodigoMotivo?: string;

  @Column({ name: 'override_expira_em', type: 'timestamptz', nullable: true })
  overrideExpiraEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
