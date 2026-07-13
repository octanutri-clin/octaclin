import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('participacoes_desafio')
export class ParticipacaoDesafioOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'desafio_id', type: 'uuid' })
  desafioId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  pontos: string;

  @Column({ type: 'jsonb', default: {} })
  progresso: Record<string, unknown>;
}
