import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenants')
export class TenantOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  nome: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 32, default: 'ativo' })
  status: string;

  @Column({ name: 'provisionamento_referencia', type: 'varchar', length: 120, nullable: true, unique: true })
  provisionamentoReferencia?: string;

  @Column({ name: 'ciclo_vida_status', type: 'varchar', length: 40, default: 'ativo' })
  cicloVidaStatus:
    | 'ativo_assistido'
    | 'primeiro_uso_validado'
    | 'acompanhamento_48h'
    | 'ativo'
    | 'suspenso'
    | 'encerramento_pendente'
    | 'encerrado';

  @Column({ name: 'encerrado_em', type: 'timestamptz', nullable: true })
  encerradoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
