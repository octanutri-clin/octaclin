import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type StatusAgendaConsulta = 'agendada' | 'cancelada';

@Entity('agenda_consultas')
export class AgendaConsultaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'profissional_id', type: 'uuid', nullable: true })
  profissionalId?: string;

  @Column({ type: 'varchar', length: 180 })
  titulo: string;

  @Column({ name: 'inicio_em', type: 'timestamptz' })
  inicioEm: Date;

  @Column({ name: 'fim_em', type: 'timestamptz' })
  fimEm: Date;

  @Column({ type: 'varchar', length: 80, default: 'America/Sao_Paulo' })
  timezone: string;

  @Column({ type: 'varchar', length: 40, default: 'agendada' })
  status: StatusAgendaConsulta;

  @Column({ type: 'varchar', length: 180, nullable: true })
  local?: string;

  @Column({ type: 'text', nullable: true })
  observacoes?: string;

  @Column({ name: 'google_calendar_id', type: 'varchar', length: 220, nullable: true })
  googleCalendarId?: string;

  @Column({ name: 'google_event_id', type: 'varchar', length: 220, nullable: true })
  googleEventId?: string;

  @Column({ name: 'google_event_html_link', type: 'text', nullable: true })
  googleEventHtmlLink?: string;

  @Column({ type: 'jsonb', default: {} })
  notificacoes: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
