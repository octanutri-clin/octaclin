import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Uma faixa de horario da jornada semanal de um profissional (PB-18, Fase
 * 276). Multiplas linhas no mesmo `diaSemana` cobrem intervalo de almoco.
 * Sem nenhuma linha para o profissional, o agendamento publico continua sem
 * restricao de horario (comportamento anterior a esta fase).
 */
@Entity('expedientes_profissionais')
@Index('idx_expedientes_profissionais_tenant_profissional', ['tenantId', 'profissionalId', 'diaSemana'])
export class ExpedienteProfissionalOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  /** 0 = domingo, mesma convencao de `Date.getDay()`. */
  @Column({ name: 'dia_semana', type: 'int' })
  diaSemana: number;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio: string;

  @Column({ name: 'hora_fim', type: 'time' })
  horaFim: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
