import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
@Entity('medidas_caseiras_alimentos')
export class MedidaCaseiraOrm {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ name: 'tenant_id', type: 'uuid' })
    tenantId: string;
    @Column({ name: 'alimento_composicao_id', type: 'uuid', nullable: true })
    alimentoComposicaoId?: string | null;
    @Column({ name: 'alimento_personalizado_id', type: 'uuid', nullable: true })
    alimentoPersonalizadoId?: string | null;
    @Column({ name: 'profissional_id', type: 'uuid' })
    profissionalId: string;
    @Column({ name: 'chave_idempotencia', type: 'uuid' })
    chaveIdempotencia: string;
    @Column({ type: 'varchar', length: 10 })
    escopo: 'pessoal' | 'clinica';
    @Column({ name: 'conteudo_criptografado', type: 'bytea' })
    conteudoCriptografado: Buffer;
    @Column({ name: 'criacao_snapshot_criptografado', type: 'bytea' })
    criacaoSnapshotCriptografado: Buffer;
    @Column({ type: 'integer', default: 1 })
    revisao: number;
    @Column({ type: 'boolean', default: true })
    ativa: boolean;
    @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
    criadoEm: Date;
    @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
    atualizadoEm: Date;
}
