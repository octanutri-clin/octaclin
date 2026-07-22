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

  @Column({ type: 'varchar', length: 180 })
  titulo: string;

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
