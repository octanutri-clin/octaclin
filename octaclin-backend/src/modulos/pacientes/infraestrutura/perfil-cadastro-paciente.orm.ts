import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('pacientes_perfis')
export class PerfilCadastroPacienteOrm {
  @PrimaryColumn({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'identificacao_criptografada', type: 'bytea', nullable: true })
  identificacaoCriptografada?: Buffer;

  @Column({ name: 'contato_criptografado', type: 'bytea', nullable: true })
  contatoCriptografado?: Buffer;

  @Column({ name: 'operacao_criptografada', type: 'bytea', nullable: true })
  operacaoCriptografada?: Buffer;

  @Column({ name: 'fiscal_criptografado', type: 'bytea', nullable: true })
  fiscalCriptografado?: Buffer;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
