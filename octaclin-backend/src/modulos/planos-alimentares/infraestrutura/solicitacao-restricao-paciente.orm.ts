import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { EstadoSolicitacao } from '../dominio/solicitacao-restricao-paciente';

/**
 * FOOD06 P1b (D7-a). Pedido do paciente; nunca altera a restrição. `explicacaoPacienteCriptografada` é o texto
 * visível ao paciente; `justificativaInternaCriptografada` é interna e NUNCA vai ao portal. Nunca retornar cru por HTTP.
 */
@Entity('solicitacoes_restricoes_pacientes')
export class SolicitacaoRestricaoPacienteOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'restricao_id', type: 'uuid', nullable: true }) restricaoId?: string | null;
  @Column({ name: 'tipo', type: 'varchar' }) tipo: 'inclusao' | 'correcao' | 'remocao';
  @Column({ name: 'estado', type: 'varchar' }) estado: EstadoSolicitacao;
  @Column({ name: 'autor_usuario_id', type: 'uuid' }) autorUsuarioId: string;
  @Column({ name: 'chave_criacao', type: 'uuid' }) chaveCriacao: string;
  @Column({ name: 'conteudo_criptografado', type: 'bytea' }) conteudoCriptografado: Buffer;
  @Column({ name: 'explicacao_paciente_criptografada', type: 'bytea', nullable: true }) explicacaoPacienteCriptografada?: Buffer | null;
  @Column({ name: 'justificativa_interna_criptografada', type: 'bytea', nullable: true }) justificativaInternaCriptografada?: Buffer | null;
  /** Desfecho validado por `validarDesfechoSolicitacao` (alterados com revisão resultante e inalterados), cifrado. */
  @Column({ name: 'desfecho_criptografado', type: 'bytea', nullable: true }) desfechoCriptografado?: Buffer | null;
  @Column({ name: 'decidido_por_usuario_id', type: 'uuid', nullable: true }) decididoPorUsuarioId?: string | null;
  @Column({ name: 'decidido_em', type: 'timestamptz', nullable: true }) decididoEm?: Date | null;
  @Column({ name: 'revisao', type: 'int' }) revisao: number;
  @Column({ name: 'criado_em', type: 'timestamptz', insert: false, update: false }) criadoEm: Date;
  @Column({ name: 'atualizado_em', type: 'timestamptz', insert: false }) atualizadoEm: Date;
}
