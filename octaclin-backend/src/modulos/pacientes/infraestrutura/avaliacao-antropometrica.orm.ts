import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ProtocoloComposicao, SexoBiologico } from '../dominio/antropometria';

/**
 * Avaliacao antropometrica seriada. Registro append-only: nao ha edicao, so
 * nova avaliacao ou exclusao logica. Medida corrigida depois de gravada deixaria
 * de bater com a formula e o protocolo carimbados no proprio registro, e o
 * historico clinico perderia a reprodutibilidade que justifica guardar tudo isso.
 */
@Entity('avaliacoes_antropometricas')
@Index('idx_avaliacoes_antropometricas_serie', ['tenantId', 'pacienteId', 'avaliadaEm'])
export class AvaliacaoAntropometricaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'autor_usuario_id', type: 'uuid' })
  autorUsuarioId: string;

  /** Data civil da avaliacao, no fuso da clinica. Ordena a serie temporal. */
  @Column({ name: 'avaliada_em', type: 'date' })
  avaliadaEm: string;

  @Column({ type: 'varchar', length: 20, default: 'nenhum' })
  protocolo: ProtocoloComposicao;

  /**
   * Sexo e idade sao snapshot do momento da avaliacao, nao consulta ao cadastro:
   * as equacoes dependem dos dois e o resultado precisa continuar reproduzivel
   * mesmo que o cadastro mude depois.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  sexo?: SexoBiologico;

  @Column({ name: 'idade_anos', type: 'int', nullable: true })
  idadeAnos?: number;

  /** JSON com peso, altura, circunferencias e dobras. Dado clinico: criptografado. */
  @Column({ name: 'medidas_criptografadas', type: 'bytea' })
  medidasCriptografadas: Buffer;

  /** JSON com IMC, RCQ, composicao, classificacoes e avisos. */
  @Column({ name: 'resultado_criptografado', type: 'bytea' })
  resultadoCriptografado: Buffer;

  /**
   * Equacao aplicada, em texto. Fica em claro de proposito: descreve o metodo,
   * nao o paciente, e precisa ser auditavel sem descriptografar nada.
   */
  @Column({ name: 'formula_aplicada', type: 'text', nullable: true })
  formulaAplicada?: string;

  @Column({ name: 'observacoes_criptografadas', type: 'bytea', nullable: true })
  observacoesCriptografadas?: Buffer;

  /** Exclusao logica: mesmo padrao de `arquivado_em` em pacientes. */
  @Column({ name: 'excluida_em', type: 'timestamptz', nullable: true })
  excluidaEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
