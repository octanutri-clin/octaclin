import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type {
  SituacaoFonteComposicao,
  StatusDireitoUsoFonte
} from '../dominio/governanca-fonte-composicao';

@Entity('fontes_composicao_alimentos')
@Index(
  'ux_fontes_composicao_alimentos_catalogo_versao_base',
  ['catalogoId', 'versao', 'baseCodigo'],
  { unique: true }
)
export class FonteComposicaoAlimentoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'catalogo_id', type: 'uuid' })
  catalogoId: string;

  @Column({ type: 'varchar', length: 80 })
  codigo: string;

  @Column({ type: 'varchar', length: 180 })
  nome: string;

  @Column({ type: 'varchar', length: 80 })
  versao: string;

  @Column({ name: 'base_codigo', type: 'varchar', length: 80 })
  baseCodigo: string;

  @Column({ type: 'text' })
  licenca: string;

  @Column({ name: 'url_fonte', type: 'text', nullable: true })
  urlFonte?: string;

  @Column({ name: 'url_artefato', type: 'text', nullable: true })
  urlArtefato?: string;

  @Column({ name: 'checksum_arquivo', type: 'char', length: 64, nullable: true })
  checksumArquivo?: string;

  @Column({ name: 'hash_conteudo', type: 'char', length: 64 })
  hashConteudo: string;

  @Column({ name: 'publicada_em', type: 'date', nullable: true })
  publicadaEm?: string;

  @Column({ name: 'capturada_em', type: 'timestamptz', nullable: true })
  capturadaEm?: Date;

  @Column({ name: 'esquema_versao', type: 'varchar', length: 40, nullable: true })
  esquemaVersao?: string;

  @Column({ name: 'esquema_nutrientes', type: 'jsonb', default: {} })
  esquemaNutrientes: Record<string, unknown>;

  @Column({ name: 'direito_uso_status', type: 'varchar', length: 24, default: 'pendente' })
  direitoUsoStatus: StatusDireitoUsoFonte;

  @Column({ name: 'direito_uso_referencia', type: 'text', nullable: true })
  direitoUsoReferencia?: string;

  @Column({ name: 'direito_uso_aprovado_em', type: 'timestamptz', nullable: true })
  direitoUsoAprovadoEm?: Date;

  @Column({ name: 'responsavel_aprovacao', type: 'varchar', length: 180, nullable: true })
  responsavelAprovacao?: string;

  @Column({ type: 'varchar', length: 20, default: 'em_validacao' })
  situacao: SituacaoFonteComposicao;

  @CreateDateColumn({ name: 'importada_em', type: 'timestamptz' })
  importadaEm: Date;
}
