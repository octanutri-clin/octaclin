import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('profissionais_google_conexao')
export class ProfissionalGoogleConexaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'profissional_id', type: 'uuid' })
  profissionalId: string;

  @Column({ name: 'refresh_token_criptografado', type: 'bytea' })
  refreshTokenCriptografado: Buffer;

  @Column({ name: 'calendar_id', type: 'varchar', length: 220, default: 'primary' })
  calendarId: string;

  @Column({ name: 'escopos_concedidos', type: 'varchar', length: 500, nullable: true })
  escoposConcedidos?: string;

  @Column({ name: 'conectado_em', type: 'timestamptz' })
  conectadoEm: Date;

  @Column({ name: 'desconectado_em', type: 'timestamptz', nullable: true })
  desconectadoEm?: Date;

  @Column({ name: 'ultimo_sync_token', type: 'varchar', length: 500, nullable: true })
  ultimoSyncToken?: string;

  @Column({ name: 'canal_watch_id', type: 'varchar', length: 220, nullable: true })
  canalWatchId?: string;

  @Column({ name: 'canal_recurso_id', type: 'varchar', length: 220, nullable: true })
  canalRecursoId?: string;

  @Column({ name: 'canal_expira_em', type: 'timestamptz', nullable: true })
  canalExpiraEm?: Date;

  @Column({ name: 'falhas_consecutivas_sincronizacao', type: 'int', default: 0 })
  falhasConsecutivasSincronizacao: number;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
