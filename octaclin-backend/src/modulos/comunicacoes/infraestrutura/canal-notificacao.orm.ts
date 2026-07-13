import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TipoCanalNotificacao } from '../dominio/canal-notificacao';

@Entity('canais_notificacao')
export class CanalNotificacaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: TipoCanalNotificacao;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @Column({ type: 'jsonb' })
  configuracao: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;
}
