import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('logs_diario_rapido')
export class LogDiarioRapidoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: 'refeicao' | 'humor' | 'agua' | 'atividade';

  /**
   * Coluna historica: so continua preenchida em linha anterior a Fase B da
   * criptografia residual (Fase 261). Registro novo grava so
   * `valorCriptografado`.
   */
  @Column({ type: 'jsonb', nullable: true })
  valor?: Record<string, unknown>;

  @Column({ name: 'valor_criptografado', type: 'bytea', nullable: true })
  valorCriptografado?: Buffer;

  @Column({ name: 'registrado_em', type: 'timestamptz' })
  registradoEm: Date;
}
