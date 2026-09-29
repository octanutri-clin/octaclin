import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { EtapaFollowup } from '../dominio/calendario-followups';

@Entity('politicas_followup_agenda')
export class PoliticaFollowupAgendaOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'consulta_id', type: 'uuid', nullable: true }) consultaId?: string | null;
  @Column({ type: 'boolean', default: false }) ativo: boolean;
  @Column({ type: 'jsonb', default: [] }) etapas: EtapaFollowup[];
  @Column({ type: 'integer', default: 1 }) versao: number;
  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' }) criadoEm: Date;
  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' }) atualizadoEm: Date;
}
