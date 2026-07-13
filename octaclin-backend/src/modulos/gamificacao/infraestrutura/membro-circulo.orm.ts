import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('membros_circulo')
export class MembroCirculoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'circulo_id', type: 'uuid' })
  circuloId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @CreateDateColumn({ name: 'entrou_em', type: 'timestamptz' })
  entrouEm: Date;
}
