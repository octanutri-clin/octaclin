import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { EscopoApiPublica } from '../dominio/contratos-integracao';

@Entity('api_chaves')
export class ApiChaveOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 120 })
  nome: string;

  @Column({ type: 'varchar', length: 28 })
  prefixo: string;

  @Column({ name: 'segredo_hash', type: 'varchar', length: 64 })
  segredoHash: string;

  @Column({ type: 'text', array: true })
  escopos: EscopoApiPublica[];

  @Column({ name: 'criado_por_usuario_id', type: 'uuid', nullable: true })
  criadoPorUsuarioId?: string;

  @Column({ name: 'expira_em', type: 'timestamptz', nullable: true })
  expiraEm?: Date;

  @Column({ name: 'ultimo_uso_em', type: 'timestamptz', nullable: true })
  ultimoUsoEm?: Date;

  @Column({ name: 'revogada_em', type: 'timestamptz', nullable: true })
  revogadaEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
