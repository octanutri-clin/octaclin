import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('consentimentos_gestacao')
export class ConsentimentoGestacaoOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid' }) pacienteId: string;
  @Column({ name: 'gestacao_id', type: 'uuid' }) gestacaoId: string;
  @Column({ name: 'usuario_id', type: 'uuid' }) usuarioId: string;
  @Column({ name: 'geracao', type: 'int' }) geracao: number;
  @Column({ name: 'termo_versao', type: 'varchar' }) termoVersao: string;
  @Column({ name: 'versao', type: 'int' }) versao: number;
  @Column({ name: 'aceito_em', type: 'timestamptz' }) aceitoEm: Date;
  @Column({ name: 'revogado_em', type: 'timestamptz', nullable: true }) revogadoEm?: Date | null;
}
