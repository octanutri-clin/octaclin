import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type TipoCondutaTerapeutica = 'meta' | 'orientacao' | 'suplemento' | 'produto' | 'formula_manipulada';

@Entity('condutas_terapeuticas')
@Index('idx_condutas_terapeuticas_paciente', ['tenantId', 'pacienteId', 'arquivadaEm', 'atualizadoEm'])
export class CondutaTerapeuticaOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'profissional_id', type: 'uuid' }) profissionalId: string;
  @Column({ type: 'varchar', length: 40 }) tipo: TipoCondutaTerapeutica;
  @Column({ name: 'arquivada_em', type: 'timestamptz', nullable: true }) arquivadaEm?: Date;
  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' }) criadoEm: Date;
  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' }) atualizadoEm: Date;
}
