import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type FrequenciaAgendaRecorrencia = 'diaria' | 'semanal';
export type CriterioTerminoAgendaRecorrencia = 'contagem' | 'data';

/**
 * Agrupador de uma serie de consulta recorrente (PB-19, Fase 277), no molde
 * de `PacoteSessaoOrm` -- guarda a regra da serie, nao dinheiro. O dia da
 * semana da recorrencia semanal nao e uma coluna propria: e sempre o dia da
 * semana de `inicioPrimeiraOcorrencia`.
 */
@Entity('agenda_recorrencias')
@Index('idx_agenda_recorrencias_tenant_paciente', ['tenantId', 'pacienteId'])
export class AgendaRecorrenciaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'profissional_id', type: 'uuid', nullable: true })
  profissionalId?: string;

  @Column({ type: 'varchar', length: 10 })
  frequencia: FrequenciaAgendaRecorrencia;

  @Column({ name: 'inicio_primeira_ocorrencia', type: 'timestamptz' })
  inicioPrimeiraOcorrencia: Date;

  @Column({ name: 'duracao_minutos', type: 'int' })
  duracaoMinutos: number;

  @Column({ name: 'criterio_termino', type: 'varchar', length: 10 })
  criterioTermino: CriterioTerminoAgendaRecorrencia;

  @Column({ name: 'total_ocorrencias', type: 'int', nullable: true })
  totalOcorrencias?: number;

  @Column({ name: 'termina_em', type: 'timestamptz', nullable: true })
  terminaEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
