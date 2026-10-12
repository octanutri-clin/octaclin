import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('comandos_gamificacao')
export class ComandoGamificacaoOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'usuario_id', type: 'uuid', nullable: false }) usuarioId: string;
  @Column({ name: 'chave', type: 'uuid', nullable: false }) chave: string;
  @Column({ name: 'acao', type: 'varchar', nullable: false }) acao: string;
  @Column({ name: 'fingerprint_criptografado', type: 'bytea', nullable: true }) fingerprintCriptografado: Buffer | null;
  @Column({ name: 'resultado_criptografado', type: 'bytea', nullable: true }) resultadoCriptografado: Buffer | null;
  @Column({ name: 'expirado_em', type: 'timestamptz', nullable: true }) expiradoEm: Date | null;
  @Column({ name: 'criado_em', type: 'timestamptz', nullable: false }) criadoEm: Date;
}
