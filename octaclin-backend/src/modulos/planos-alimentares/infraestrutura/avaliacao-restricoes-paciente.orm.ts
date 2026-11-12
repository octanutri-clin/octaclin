import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** FOOD06 P1b. Avaliação global de restrições do paciente (uma por paciente). Vence a avaliação, nunca a restrição (Q2). */
@Entity('avaliacoes_restricoes_pacientes')
export class AvaliacaoRestricoesPacienteOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'situacao', type: 'varchar' }) situacao: 'nao_informado' | 'sem_restricoes_confirmadas' | 'restricoes_registradas';
  @Column({ name: 'confirmado_por_usuario_id', type: 'uuid', nullable: true }) confirmadoPorUsuarioId?: string | null;
  @Column({ name: 'confirmado_em', type: 'timestamptz', nullable: true }) confirmadoEm?: Date | null;
  @Column({ name: 'vence_em', type: 'timestamptz', nullable: true }) venceEm?: Date | null;
  @Column({ name: 'revisao', type: 'int' }) revisao: number;
  @Column({ name: 'criado_em', type: 'timestamptz', insert: false, update: false }) criadoEm: Date;
  @Column({ name: 'atualizado_em', type: 'timestamptz', insert: false }) atualizadoEm: Date;
}
