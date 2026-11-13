import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * FOOD06 P1b. Histórico append-only numerado da restrição (snapshot e justificativa cifrados). O snapshot usa o codec
 * `codec-conteudo-restricao.ts` com finalidade `revisao_restricao` (D2, #531). Nunca retornar cru por HTTP.
 */
@Entity('restricoes_pacientes_revisoes')
export class RevisaoRestricaoPacienteOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'restricao_id', type: 'uuid' }) restricaoId: string;
  @Column({ name: 'numero', type: 'int' }) numero: number;
  @Column({ name: 'evento', type: 'varchar' })
  evento: 'criacao' | 'edicao' | 'confirmacao' | 'rejeicao' | 'reavaliacao' | 'reativacao' | 'inativacao';
  @Column({ name: 'motivo_inativacao', type: 'varchar', nullable: true })
  motivoInativacao?: 'registro_incorreto' | 'informacao_clinica_revisada' | 'solicitacao_fundamentada' | 'outro' | null;
  @Column({ name: 'confirmacao_dois_passos', type: 'boolean', default: false }) confirmacaoDoisPassos?: boolean;
  @Column({ name: 'autor_usuario_id', type: 'uuid' }) autorUsuarioId: string;
  @Column({ name: 'conteudo_criptografado', type: 'bytea' }) conteudoCriptografado: Buffer;
  @Column({ name: 'justificativa_criptografada', type: 'bytea', nullable: true }) justificativaCriptografada?: Buffer | null;
  @Column({ name: 'criado_em', type: 'timestamptz', insert: false, update: false }) criadoEm: Date;
}
