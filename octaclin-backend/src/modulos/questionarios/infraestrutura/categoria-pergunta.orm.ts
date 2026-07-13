import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categorias_pergunta')
export class CategoriaPerguntaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @Column({ name: 'icone_svg', type: 'text' })
  iconeSvg: string;

  @Column({ name: 'cor_hex', type: 'varchar', length: 7 })
  corHex: string;

  @Column({ type: 'integer', default: 0 })
  ordem: number;
}
