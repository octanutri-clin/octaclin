import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Trilha append-only das trocas registradas pelo paciente.
 *
 * Sem `@UpdateDateColumn` e sem indice unico de proposito: a escolha vigente de
 * um item e a ultima linha, e nao a unica. Sobrescrever a anterior apagaria o
 * historico que torna o evento auditavel.
 */
@Entity('plano_alimentar_escolhas_paciente')
@Index('idx_plano_alimentar_escolhas_paciente_vigente', ['tenantId', 'itemId', 'criadoEm'])
@Index('idx_plano_alimentar_escolhas_paciente_versao', ['tenantId', 'versaoId', 'criadoEm'])
export class PlanoAlimentarEscolhaPacienteOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'versao_id', type: 'uuid' })
  versaoId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  /** Nulo registra o retorno ao alimento principal, que tambem e uma decisao. */
  @Column({ name: 'substituicao_id', type: 'uuid', nullable: true })
  substituicaoId?: string;

  @Column({ name: 'escolhido_por_usuario_id', type: 'uuid' })
  escolhidoPorUsuarioId: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
