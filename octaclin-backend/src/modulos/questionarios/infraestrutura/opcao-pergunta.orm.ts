import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('opcoes_pergunta')
export class OpcaoPerguntaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'pergunta_id', type: 'uuid' })
  perguntaId: string;

  @Column({ type: 'varchar', length: 180 })
  rotulo: string;

  @Column({ type: 'varchar', length: 120 })
  valor: string;

  @Column({ name: 'imagem_url', type: 'text', nullable: true })
  imagemUrl?: string;

  @Column({ type: 'integer', default: 0 })
  ordem: number;
}
