import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('consentimentos_conquistas')
export class ConsentimentoConquistaOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'paciente_id', type: 'uuid', nullable: false }) pacienteId: string;
  @Column({ name: 'conquista_id', type: 'uuid', nullable: false }) conquistaId: string;
  @Column({ name: 'usuario_id', type: 'uuid', nullable: false }) usuarioId: string;
  @Column({ name: 'geracao', type: 'integer', nullable: false }) geracao: number;
  @Column({ name: 'versao', type: 'integer', nullable: false }) versao: number;
  @Column({ name: 'termo_versao', type: 'varchar', nullable: false }) termoVersao: string;
  @Column({ name: 'aceito_em', type: 'timestamptz', nullable: true }) aceitoEm?: Date | null;
  @Column({ name: 'revogado_em', type: 'timestamptz', nullable: true }) revogadoEm?: Date | null;
}
