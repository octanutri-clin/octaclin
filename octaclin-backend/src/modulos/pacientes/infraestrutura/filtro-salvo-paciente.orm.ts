import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { CriteriosFiltroSalvo, OrigemFiltroSalvo } from '../dominio/filtros-salvos';

@Entity('filtros_salvos_pacientes')
@Index('idx_filtros_salvos_pacientes_listagem', ['tenantId', 'origem', 'arquivadoEm', 'atualizadoEm'])
@Index('idx_filtros_salvos_pacientes_profissional', ['tenantId', 'profissionalId', 'arquivadoEm', 'atualizadoEm'], {
  where: 'profissional_id is not null'
})
export class FiltroSalvoPacienteOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 20 })
  origem: OrigemFiltroSalvo;

  @Column({ name: 'profissional_id', type: 'uuid', nullable: true })
  profissionalId?: string;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  /** Somente criterio estruturado; texto livre de busca nunca e persistido. */
  @Column({ type: 'jsonb' })
  criterios: CriteriosFiltroSalvo;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid' })
  criadoPorUsuarioId: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;

  @Column({ name: 'arquivado_em', type: 'timestamptz', nullable: true })
  arquivadoEm?: Date;
}
