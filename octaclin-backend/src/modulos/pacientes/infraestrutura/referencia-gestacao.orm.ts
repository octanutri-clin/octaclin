import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('referencias_gestacao')
export class ReferenciaGestacaoOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'gestacao_id', type: 'uuid' }) gestacaoId: string;
  @Column({ name: 'numero', type: 'int' }) numero: number;
  @Column({ name: 'autor_usuario_id', type: 'uuid' }) autorUsuarioId: string;
  @Column({ name: 'contexto_criptografado', type: 'bytea' }) contextoCriptografado: Buffer;
  @Column({ name: 'criado_em', type: 'timestamptz' }) criadoEm: Date;
}
