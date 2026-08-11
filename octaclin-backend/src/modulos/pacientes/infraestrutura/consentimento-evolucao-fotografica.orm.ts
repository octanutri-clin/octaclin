import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Consentimento separado para imagens clinicas, com versao e prazo de retencao. */
@Entity('consentimentos_evolucao_fotografica')
@Index('idx_consentimentos_evolucao_fotografica_ativo', ['tenantId', 'pacienteId', 'revogadoEm'])
export class ConsentimentoEvolucaoFotograficaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'registrado_por_usuario_id', type: 'uuid' })
  registradoPorUsuarioId: string;

  @Column({ type: 'varchar', length: 40 })
  versao: string;

  @Column({ name: 'consentido_em', type: 'timestamptz' })
  consentidoEm: Date;

  @Column({ name: 'retencao_ate', type: 'date' })
  retencaoAte: string;

  @Column({ name: 'evidencia_criptografada', type: 'bytea', nullable: true })
  evidenciaCriptografada?: Buffer;

  @Column({ name: 'revogado_em', type: 'timestamptz', nullable: true })
  revogadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
