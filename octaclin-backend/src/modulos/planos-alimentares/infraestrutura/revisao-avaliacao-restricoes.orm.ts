import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** FOOD06 P1b. Histórico append-only numerado da avaliação de restrições. */
@Entity('avaliacoes_restricoes_revisoes')
export class RevisaoAvaliacaoRestricoesOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'avaliacao_id', type: 'uuid' }) avaliacaoId: string;
  @Column({ name: 'numero', type: 'int' }) numero: number;
  @Column({ name: 'situacao', type: 'varchar' }) situacao: 'nao_informado' | 'sem_restricoes_confirmadas' | 'restricoes_registradas';
  @Column({ name: 'autor_usuario_id', type: 'uuid' }) autorUsuarioId: string;
  @Column({ name: 'vence_em', type: 'timestamptz', nullable: true }) venceEm?: Date | null;
  @Column({ name: 'criado_em', type: 'timestamptz', insert: false, update: false }) criadoEm: Date;
}
