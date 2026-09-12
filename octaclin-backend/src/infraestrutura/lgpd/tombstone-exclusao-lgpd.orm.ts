import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Marca uma exclusao real de dado (LGPD, Fase 261) por tenant/tabela/registro.
 * Sobrevive independente do registro original: um restore de backup precisa
 * reaplicar (excluir de novo) todo tombstone com `excluidoEm` posterior ao
 * ponto no tempo restaurado, para que dado legitimamente eliminado nao
 * reapareca. Ver RUNBOOK_BACKUP_RESTORE.md.
 */
@Entity('tombstones_exclusao_lgpd')
export class TombstoneExclusaoLgpdOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 80 })
  tabela: string;

  @Column({ name: 'registro_id', type: 'uuid' })
  registroId: string;

  @Column({ type: 'varchar', length: 60 })
  motivo: string;

  @CreateDateColumn({ name: 'excluido_em', type: 'timestamptz' })
  excluidoEm: Date;
}
