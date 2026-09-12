import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type TipoEvolucaoClinica = 'consulta' | 'retorno' | 'observacao' | 'ajuste_plano';
export type VisibilidadeEvolucaoClinica = 'privada';

@Entity('evolucoes_clinicas')
export class EvolucaoClinicaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'autor_usuario_id', type: 'uuid' })
  autorUsuarioId: string;

  /**
   * Coluna historica: so continua preenchida em linha anterior a Fase B da
   * criptografia residual (Fase 261). Evolucao nova grava so
   * `tituloCriptografado`.
   */
  @Column({ type: 'varchar', length: 180, nullable: true })
  titulo?: string;

  @Column({ name: 'titulo_criptografado', type: 'bytea', nullable: true })
  tituloCriptografado?: Buffer;

  @Column({ name: 'conteudo_criptografado', type: 'bytea' })
  conteudoCriptografado: Buffer;

  @Column({ type: 'varchar', length: 40, default: 'observacao' })
  tipo: TipoEvolucaoClinica;

  @Column({ type: 'varchar', length: 40, default: 'privada' })
  visibilidade: VisibilidadeEvolucaoClinica;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
