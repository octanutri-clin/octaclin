import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TipoMidiaMobile } from '../dominio/validacao-midia';

export type VinculoClinicoArquivo = {
  tipo: 'consulta' | 'avaliacao_antropometrica' | 'documento_emitido' | 'evolucao_fotografica';
  recursoId: string;
};

@Entity('arquivos_midia')
export class ArquivoMidiaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: TipoMidiaMobile;

  @Column({ type: 'varchar', length: 120 })
  bucket: string;

  @Column({ name: 'chave_objeto', type: 'text' })
  chaveObjeto: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType: string;

  @Column({ name: 'tamanho_bytes', type: 'bigint' })
  tamanhoBytes: string;

  @Column({ name: 'hash_conteudo', type: 'varchar', length: 128, nullable: true })
  hashConteudo?: string;

  @Column({ type: 'varchar', length: 20, default: 'pendente' })
  status: 'pendente' | 'confirmado' | 'excluido';

  @Column({ type: 'varchar', length: 20, default: 'documento' })
  categoria: 'exame' | 'documento' | 'foto' | 'diario';

  @Column({ name: 'nome_original_criptografado', type: 'bytea', nullable: true })
  nomeOriginalCriptografado?: Buffer;

  @Column({ name: 'confirmado_em', type: 'timestamptz', nullable: true })
  confirmadoEm?: Date;

  @Column({ name: 'excluido_em', type: 'timestamptz', nullable: true })
  excluidoEm?: Date;

  @Column({ type: 'jsonb', default: {} })
  metadados: Record<string, unknown>;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
