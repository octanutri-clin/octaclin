import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('subscriptions_push_paciente')
export class SubscriptionPushPacienteOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'endpoint_hash', type: 'char', length: 64 })
  endpointHash: string;

  @Column({ name: 'endpoint_criptografado', type: 'bytea' })
  endpointCriptografado: Buffer;

  @CreateDateColumn({ name: 'criada_em', type: 'timestamptz' })
  criadaEm: Date;

  @Column({ name: 'usada_em', type: 'timestamptz', nullable: true })
  usadaEm?: Date | null;

  @Column({ name: 'revogada_em', type: 'timestamptz', nullable: true })
  revogadaEm?: Date | null;
}
