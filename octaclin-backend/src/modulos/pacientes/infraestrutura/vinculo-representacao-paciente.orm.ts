import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const TIPOS_VERIFICACAO_REPRESENTACAO = ['documento_apresentado', 'presencial', 'procuracao', 'outro'] as const;
export type TipoVerificacaoRepresentacao = typeof TIPOS_VERIFICACAO_REPRESENTACAO[number];

/**
 * FOOD06 P2d-1: vínculo de representação de UM paciente por UMA conta (uma conta pode representar vários pacientes).
 * Separado de `pacientes.usuario_id`, que continua sendo a conta do próprio paciente. A equipe registra e a
 * verificação fica só registrada (tipo, quem, quando), sem documento. Sem serviço nesta etapa (P2d-3).
 */
@Entity('vinculos_representacao_paciente')
export class VinculoRepresentacaoPacienteOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'representante_usuario_id', type: 'uuid' }) representanteUsuarioId: string;
  @Column({ name: 'verificado_por', type: 'uuid' }) verificadoPor: string;
  @CreateDateColumn({ name: 'verificado_em', type: 'timestamptz' }) verificadoEm: Date;
  @Column({ name: 'tipo_verificacao', type: 'varchar', length: 24 }) tipoVerificacao: TipoVerificacaoRepresentacao;
  @Column({ name: 'revogado_por', type: 'uuid', nullable: true }) revogadoPor: string | null;
  @Column({ name: 'revogado_em', type: 'timestamptz', nullable: true }) revogadoEm: Date | null;
}
