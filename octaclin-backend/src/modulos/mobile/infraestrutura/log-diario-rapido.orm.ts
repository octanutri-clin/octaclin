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

  @Column({ type: 'jsonb' })
  valor: Record<string, unknown>;

  @Column({ name: 'registrado_em', type: 'timestamptz' })
  registradoEm: Date;
}
