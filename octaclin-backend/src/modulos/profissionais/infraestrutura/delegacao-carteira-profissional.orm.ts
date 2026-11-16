import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * FOOD06 P2d-1: delegação da carteira INTEIRA (atual) de um profissional titular a um colaborador. Sem prazo; vale até
 * revogar. Nunca dá confirmação clínica. Sem serviço nesta etapa (P2d-2). Só a revogação única altera a linha.
 */
@Entity('delegacoes_carteira_profissional')
export class DelegacaoCarteiraProfissionalOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'profissional_id', type: 'uuid' }) profissionalId: string;
  @Column({ name: 'colaborador_usuario_id', type: 'uuid' }) colaboradorUsuarioId: string;
  @Column({ name: 'concedida_por', type: 'uuid' }) concedidaPor: string;
  @CreateDateColumn({ name: 'concedida_em', type: 'timestamptz' }) concedidaEm: Date;
  @Column({ name: 'revogada_por', type: 'uuid', nullable: true }) revogadaPor: string | null;
  @Column({ name: 'revogada_em', type: 'timestamptz', nullable: true }) revogadaEm: Date | null;
}
