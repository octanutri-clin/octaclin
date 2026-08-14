import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('catalogos_composicao_alimentos')
@Index('ux_catalogos_composicao_alimentos_codigo', ['codigo'], { unique: true })
export class CatalogoComposicaoAlimentoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  codigo: string;

  @Column({ type: 'varchar', length: 180 })
  nome: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  instituicao?: string;

  @Column({ name: 'url_oficial', type: 'text', nullable: true })
  urlOficial?: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
