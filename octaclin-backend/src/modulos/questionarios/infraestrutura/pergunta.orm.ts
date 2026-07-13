import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TipoPergunta } from '../dominio/tipos-pergunta';

@Entity('perguntas')
export class PerguntaOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'questionario_id', type: 'uuid' })
  questionarioId: string;

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId: string;

  @Column({ type: 'varchar', length: 40 })
  tipo: TipoPergunta;

  @Column({ type: 'text' })
  enunciado: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 1 })
  peso: string;

  @Column({ type: 'boolean', default: true })
  obrigatoria: boolean;

  @Column({ type: 'jsonb', default: {} })
  configuracao: Record<string, unknown>;

  @Column({ type: 'integer', default: 0 })
  ordem: number;
}
