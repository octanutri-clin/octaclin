import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { CondicaoFollowup } from '../dominio/calendario-followups';

export type StatusOcorrenciaFollowup = 'pendente' | 'processando' | 'enfileirada' | 'enviada' | 'suprimida' | 'falhou';

@Entity('ocorrencias_followup_agenda')
export class OcorrenciaFollowupAgendaOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'consulta_id', type: 'uuid' }) consultaId: string;
  @Column({ name: 'politica_id', type: 'uuid' }) politicaId: string;
  @Column({ name: 'inicio_consulta_em', type: 'timestamptz' }) inicioConsultaEm: Date;
  @Column({ type: 'integer' }) indice: number;
  @Column({ type: 'varchar', length: 40 }) condicao: CondicaoFollowup;
  @Column({ name: 'envio_em', type: 'timestamptz' }) envioEm: Date;
  @Column({ name: 'disponivel_em', type: 'timestamptz' }) disponivelEm: Date;
  @Column({ type: 'varchar', length: 24, default: 'pendente' }) status: StatusOcorrenciaFollowup;
  @Column({ name: 'politica_versao', type: 'integer' }) politicaVersao: number;
  @Column({ name: 'chave_idempotencia', type: 'varchar', length: 200 }) chaveIdempotencia: string;
  @Column({ name: 'mensagem_id', type: 'uuid', nullable: true }) mensagemId?: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) motivo?: string;
  @Column({ name: 'reivindicado_em', type: 'timestamptz', nullable: true }) reivindicadoEm?: Date;
  @Column({ type: 'integer', default: 0 }) tentativas: number;
  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' }) criadoEm: Date;
}
