import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { TipoDocumentoClinico } from '../dominio/documentos-clinicos';

/**
 * Documento emitido para o paciente. Append-only, pelo mesmo motivo da avaliacao
 * antropometrica e por um a mais: **o papel ja saiu da clinica**. Editar o
 * registro depois faria o sistema divergir do documento que esta na mao de
 * terceiro. Errou, cancela e emite outro.
 *
 * Guarda o texto **renderizado**, nao o modelo mais as variaveis: modelo editado
 * ou cadastro corrigido depois nao pode reescrever documento ja entregue.
 */
@Entity('documentos_emitidos')
@Index('idx_documentos_emitidos_paciente', ['tenantId', 'pacienteId', 'emitidoEm'])
export class DocumentoEmitidoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'profissional_id', type: 'uuid', nullable: true })
  profissionalId?: string;

  @Column({ name: 'autor_usuario_id', type: 'uuid' })
  autorUsuarioId: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: TipoDocumentoClinico;

  /** Consulta de origem. Obrigatoria para declaracao de comparecimento. */
  @Column({ name: 'consulta_id', type: 'uuid', nullable: true })
  consultaId?: string;

  /** Titulo renderizado. Fica em claro: nomeia o documento sem descrever o paciente. */
  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ name: 'corpo_criptografado', type: 'bytea' })
  corpoCriptografado: Buffer;

  /** Cabecalho da clinica no momento da emissao, tambem congelado. */
  @Column({ name: 'cabecalho_criptografado', type: 'bytea' })
  cabecalhoCriptografado: Buffer;

  @Column({ name: 'emitido_em', type: 'timestamptz' })
  emitidoEm: Date;

  @Column({ name: 'cancelado_em', type: 'timestamptz', nullable: true })
  canceladoEm?: Date;

  @Column({ name: 'motivo_cancelamento', type: 'varchar', length: 300, nullable: true })
  motivoCancelamento?: string;

  @Column({ name: 'enviado_em', type: 'timestamptz', nullable: true })
  enviadoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}
