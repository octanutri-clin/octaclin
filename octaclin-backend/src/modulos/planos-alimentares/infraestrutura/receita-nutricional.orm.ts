import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { OrigemReceitaNutricional, TipoReceitaNutricional } from '../dominio/receitas-nutricionais';

@Entity('receitas_nutricionais')
@Index('idx_receitas_nutricionais_listagem', ['tenantId', 'origem', 'tipo', 'arquivadoEm', 'atualizadoEm'])
@Index('idx_receitas_nutricionais_profissional', ['tenantId', 'profissionalId', 'arquivadoEm', 'atualizadoEm'], {
  where: 'profissional_id is not null'
})
export class ReceitaNutricionalOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 20 })
  origem: OrigemReceitaNutricional;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoReceitaNutricional;

  @Column({ name: 'profissional_id', type: 'uuid', nullable: true })
  profissionalId?: string;

  @Column({ name: 'nome_criptografado', type: 'bytea' })
  nomeCriptografado: Buffer;

  /** Instrucoes e itens do preparo, serializados juntos em snapshot cifrado. */
  @Column({ name: 'conteudo_criptografado', type: 'bytea' })
  conteudoCriptografado: Buffer;

  @Column({ name: 'total_itens', type: 'integer' })
  totalItens: number;

  @Column({ name: 'criado_por_usuario_id', type: 'uuid' })
  criadoPorUsuarioId: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;

  @Column({ name: 'arquivado_em', type: 'timestamptz', nullable: true })
  arquivadoEm?: Date;
}
