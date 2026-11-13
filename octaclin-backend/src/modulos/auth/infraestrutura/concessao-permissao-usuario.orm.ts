import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { PermissaoOctaClin } from '../dominio/permissoes';

/** Estado persistido de autorização; não consultar via JWT/matriz de papel. Serviço em Auth-2. */
@Entity('concessoes_permissao_usuario')
export class ConcessaoPermissaoUsuarioOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'usuario_id', type: 'uuid' }) usuarioId: string;
  @Column({ type: 'varchar', length: 80 }) permissao: Extract<PermissaoOctaClin, 'restricoes.confirmar'>;
  @Column({ name: 'concedida_por', type: 'uuid' }) concedidaPor: string;
  @CreateDateColumn({ name: 'concedida_em', type: 'timestamptz' }) concedidaEm: Date;
  @Column({ name: 'revogada_por', type: 'uuid', nullable: true }) revogadaPor: string | null;
  @Column({ name: 'revogada_em', type: 'timestamptz', nullable: true }) revogadaEm: Date | null;
  /** Somente motivação administrativa, sem conteúdo clínico. */
  @Column({ type: 'varchar', length: 160 }) motivo: string;
}
