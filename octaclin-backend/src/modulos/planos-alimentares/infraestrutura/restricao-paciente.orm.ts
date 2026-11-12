import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * FOOD06 P1b. Estado atual de uma restrição do paciente; o conteúdo clínico (natureza, subtipo, alvo, gravidade,
 * observação) fica só em `conteudoCriptografado`. Sem `razao` (Q4). Nunca retornar entidade crua por HTTP.
 */
@Entity('restricoes_pacientes')
export class RestricaoPacienteOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'autor_usuario_id', type: 'uuid' }) autorUsuarioId: string;
  @Column({ name: 'chave_criacao', type: 'uuid' }) chaveCriacao: string;
  @Column({ name: 'origem', type: 'varchar' }) origem: 'profissional' | 'colaborador' | 'declaracao_paciente' | 'questionario_legado';
  @Column({ name: 'estado', type: 'varchar' }) estado: 'ativa' | 'em_reavaliacao' | 'inativa';
  @Column({ name: 'confirmacao', type: 'varchar' }) confirmacao: 'pendente' | 'confirmada' | 'rejeitada';
  @Column({ name: 'confirmado_por_usuario_id', type: 'uuid', nullable: true }) confirmadoPorUsuarioId?: string | null;
  @Column({ name: 'confirmado_em', type: 'timestamptz', nullable: true }) confirmadoEm?: Date | null;
  @Column({ name: 'conteudo_criptografado', type: 'bytea' }) conteudoCriptografado: Buffer;
  @Column({ name: 'revisao', type: 'int' }) revisao: number;
  @Column({ name: 'criado_em', type: 'timestamptz', insert: false, update: false }) criadoEm: Date;
  @Column({ name: 'atualizado_em', type: 'timestamptz', insert: false }) atualizadoEm: Date;
}
