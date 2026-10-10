import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('gestacoes_pacientes')
export class GestacaoPacienteOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'autor_usuario_id', type: 'uuid' }) autorUsuarioId: string;
  @Column({ name: 'chave_criacao', type: 'uuid' }) chaveCriacao: string;
  @Column({ name: 'criacao_criptografada', type: 'bytea' }) criacaoCriptografada: Buffer;
  @Column({ name: 'status', type: 'varchar' }) status: 'ativa' | 'encerrada';
  @Column({ name: 'versao', type: 'int' }) versao: number;
  @Column({ name: 'compartilhada', type: 'boolean' }) compartilhada: boolean;
  @Column({ name: 'geracao_compartilhamento', type: 'int' }) geracaoCompartilhamento: number;
  @Column({ name: 'compartilhada_por_usuario_id', type: 'uuid', nullable: true }) compartilhadaPorUsuarioId?: string;
  @Column({ name: 'compartilhada_em', type: 'timestamptz', nullable: true }) compartilhadaEm?: Date;
  @Column({ name: 'criado_em', type: 'timestamptz' }) criadoEm: Date;
  @Column({ name: 'atualizado_em', type: 'timestamptz' }) atualizadoEm: Date;
}
