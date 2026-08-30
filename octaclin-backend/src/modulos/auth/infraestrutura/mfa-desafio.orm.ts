import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type TipoDesafioMfa = 'login_verificar' | 'login_configurar';

@Entity('mfa_desafios')
export class MfaDesafioOrm {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 32 })
  tipo: TipoDesafioMfa;

  @Column({ name: 'expira_em', type: 'timestamptz' })
  expiraEm: Date;

  @Column({ name: 'consumido_em', type: 'timestamptz', nullable: true })
  consumidoEm?: Date | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
