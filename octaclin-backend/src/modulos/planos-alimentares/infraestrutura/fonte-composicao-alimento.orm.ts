import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fontes_composicao_alimentos')
@Index('ux_fontes_composicao_alimentos_codigo_versao', ['codigo', 'versao'], { unique: true })
export class FonteComposicaoAlimentoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  codigo: string;

  @Column({ type: 'varchar', length: 180 })
  nome: string;

  @Column({ type: 'varchar', length: 80 })
  versao: string;

  @Column({ type: 'text' })
  licenca: string;

  @Column({ name: 'url_fonte', type: 'text', nullable: true })
  urlFonte?: string;

  @Column({ name: 'hash_conteudo', type: 'char', length: 64 })
  hashConteudo: string;

  @Column({ name: 'publicada_em', type: 'date', nullable: true })
  publicadaEm?: string;

  @CreateDateColumn({ name: 'importada_em', type: 'timestamptz' })
  importadaEm: Date;
}
