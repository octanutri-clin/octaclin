import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * FOOD06 P1b (Q9 nível 1). Mapeamento LOCAL do tenant, append-only e versionado. `origem` é sempre
 * `local_profissional` (o banco recusa `global`); liberação (`nao_contem_confirmado`) exige evidência cifrada e,
 * no motor, nunca vira `permitido` silencioso.
 */
@Entity('mapeamentos_alimento_alvo_locais')
export class MapeamentoAlimentoAlvoLocalOrm {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'fonte_id', type: 'varchar' }) fonteId: string;
  @Column({ name: 'codigo_origem', type: 'varchar' }) codigoOrigem: string;
  @Column({ name: 'alvo_id', type: 'varchar' }) alvoId: string;
  @Column({ name: 'versao_mapeamento', type: 'varchar' }) versaoMapeamento: string;
  @Column({ name: 'relacao', type: 'varchar' }) relacao: 'contem' | 'pode_conter' | 'nao_contem_confirmado';
  @Column({ name: 'granularidade', type: 'varchar' }) granularidade: 'alimento' | 'produto' | 'ingrediente';
  @Column({ name: 'origem', type: 'varchar' }) origem: 'local_profissional';
  @Column({ name: 'cobertura', type: 'varchar' }) cobertura: 'suficiente' | 'insuficiente';
  @Column({ name: 'evidencia_criptografada', type: 'bytea', nullable: true }) evidenciaCriptografada?: Buffer | null;
  @Column({ name: 'justificativa_criptografada', type: 'bytea', nullable: true }) justificativaCriptografada?: Buffer | null;
  @Column({ name: 'autor_usuario_id', type: 'uuid' }) autorUsuarioId: string;
  @Column({ name: 'criado_em', type: 'timestamptz', insert: false, update: false }) criadoEm: Date;
}
