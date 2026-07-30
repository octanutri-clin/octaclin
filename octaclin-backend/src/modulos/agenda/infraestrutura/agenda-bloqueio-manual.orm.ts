import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type TipoBloqueioManualAgenda = 'intervalo' | 'reuniao' | 'ferias';

@Entity('agenda_bloqueios_manuais')
export class AgendaBloqueioManualOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoBloqueioManualAgenda;

  @Column({ name: 'inicio_em', type: 'timestamptz' })
  inicioEm: Date;

  @Column({ name: 'fim_em', type: 'timestamptz' })
  fimEm: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
