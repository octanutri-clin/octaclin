import type { PreferenciasEquivalencia } from '../../planos-alimentares/dominio/preferencias-equivalencia';
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

  @Column({ name: 'preferencias_equivalencia', type: 'jsonb', default: () => `'{"schemaVersao":1,"unidades":"gramas_e_medida_disponivel","casasGramas":3,"casasNutrientes":2,"passoPorcaoGramas":"1","modoComparacao":"detalhado"}'::jsonb` })
  // Projeções legadas podem omitir configuração; a coluna no banco é NOT NULL.
  preferenciasEquivalencia?: PreferenciasEquivalencia;

  @Column({ name: 'preferencias_equivalencia_revisao', type: 'integer', default: 0 })
  preferenciasEquivalenciaRevisao?: number;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
