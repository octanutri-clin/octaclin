import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type CategoriaTarefaAcompanhamento = 'meta' | 'tarefa' | 'checkin' | 'orientacao';
export type PrioridadeTarefaAcompanhamento = 'baixa' | 'media' | 'alta';
export type StatusTarefaAcompanhamento = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

@Entity('acompanhamento_tarefas')
export class AcompanhamentoTarefaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ type: 'varchar', length: 180 })
  titulo: string;

  @Column({ name: 'descricao_criptografada', type: 'bytea', nullable: true })
  descricaoCriptografada?: Buffer;

  @Column({ type: 'varchar', length: 40, default: 'tarefa' })
  categoria: CategoriaTarefaAcompanhamento;

  @Column({ type: 'varchar', length: 40, default: 'media' })
  prioridade: PrioridadeTarefaAcompanhamento;

  @Column({ type: 'varchar', length: 40, default: 'pendente' })
  status: StatusTarefaAcompanhamento;

  @Column({ name: 'vencimento_em', type: 'timestamptz', nullable: true })
  vencimentoEm?: Date;

  @Column({ name: 'concluido_em', type: 'timestamptz', nullable: true })
  concluidoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
