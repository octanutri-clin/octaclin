import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TipoCanalNotificacao } from '../dominio/canal-notificacao';

@Entity('templates_mensagem')
export class TemplateMensagemOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 40 })
  canal: TipoCanalNotificacao;

  @Column({ name: 'codigo_externo', type: 'varchar', length: 160, nullable: true })
  codigoExterno?: string;

  @Column({ type: 'varchar', length: 160 })
  nome: string;

  @Column({ type: 'jsonb' })
  conteudo: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  aprovado: boolean;
}
