import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * FOOD06 P1b (Q10). Atestação append-only de reconfirmação: paciente, profissional, data e hora, meio, resultado
 * (cifrado) e a revisão real da avaliação. O sistema não verifica que a pergunta ocorreu. Nunca retornar cru por HTTP.
 */
@Entity('reconfirmacoes_restricoes')
export class ReconfirmacaoRestricoesOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'avaliacao_id', type: 'uuid' }) avaliacaoId: string;
  @Column({ name: 'revisao_avaliacao', type: 'int' }) revisaoAvaliacao: number;
  @Column({ name: 'restricao_id', type: 'uuid', nullable: true }) restricaoId?: string | null;
  @Column({ name: 'revisao_restricao', type: 'int', nullable: true }) revisaoRestricao?: number | null;
  @Column({ name: 'atestado_por_usuario_id', type: 'uuid' }) atestadoPorUsuarioId: string;
  @Column({ name: 'atestado_em', type: 'timestamptz' }) atestadoEm: Date;
  @Column({ name: 'meio', type: 'varchar' }) meio: 'presencial' | 'teleconsulta' | 'portal' | 'contato_documentado';
  @Column({ name: 'resultado_criptografado', type: 'bytea' }) resultadoCriptografado: Buffer;
  @Column({ name: 'vence_em', type: 'timestamptz' }) venceEm: Date;
  @Column({ name: 'chave_idempotencia', type: 'uuid' }) chaveIdempotencia: string;
  @Column({ name: 'criado_em', type: 'timestamptz', insert: false, update: false }) criadoEm: Date;
}
