import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('profissionais')
export class ProfissionalOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  @Column({ name: 'registro_profissional', type: 'varchar', length: 80, nullable: true })
  registroProfissional?: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  especialidade?: string;

  @Column({ name: 'arquivado_em', type: 'timestamptz', nullable: true })
  arquivadoEm?: Date | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
