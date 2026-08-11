import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** O payload inclui marcador, resultado, unidade e faixa de referencia cifrados. */
@Entity('marcadores_exames_laboratoriais')
@Index('idx_marcadores_exames_laboratoriais_coleta', ['tenantId', 'coletaId'])
export class MarcadorExameLaboratorialOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'coleta_id', type: 'uuid' })
  coletaId: string;

  @Column({ name: 'resultado_criptografado', type: 'bytea' })
  resultadoCriptografado: Buffer;

  @Column({ name: 'ordem_exibicao', type: 'int', default: 0 })
  ordemExibicao: number;

  @Column({ name: 'excluido_em', type: 'timestamptz', nullable: true })
  excluidoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
