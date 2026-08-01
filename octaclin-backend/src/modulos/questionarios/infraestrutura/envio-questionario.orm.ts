import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { TipoPergunta } from '../dominio/tipos-pergunta';

export interface OpcaoSnapshotQuestionario {
  id: string;
  rotulo: string;
  valor: string;
  imagemUrl?: string;
  ordem: number;
}

export interface PerguntaSnapshotQuestionario {
  id: string;
  categoriaId: string;
  tipo: TipoPergunta;
  enunciado: string;
  peso: string;
  obrigatoria: boolean;
  configuracao: Record<string, unknown>;
  ordem: number;
  opcoes: OpcaoSnapshotQuestionario[];
}

export interface SnapshotEstruturaQuestionario {
  versaoQuestionario: number;
  titulo: string;
  descricao?: string;
  perguntas: PerguntaSnapshotQuestionario[];
}

export interface RespostaRascunhoQuestionario {
  perguntaId: string;
  valor: unknown;
}

@Entity('envios_questionario')
export class EnvioQuestionarioOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'questionario_id', type: 'uuid' })
  questionarioId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'agendamento_id', type: 'uuid', nullable: true })
  agendamentoId?: string;

  @Column({ type: 'varchar', length: 40, default: 'pendente' })
  status: 'pendente' | 'enviado' | 'respondido' | 'expirado';

  @Column({ name: 'enviado_em', type: 'timestamptz', nullable: true })
  enviadoEm?: Date;

  @Column({ name: 'respondido_em', type: 'timestamptz', nullable: true })
  respondidoEm?: Date;

  @Column({ name: 'revisado_em', type: 'timestamptz', nullable: true })
  revisadoEm?: Date;

  @Column({ name: 'revisado_por_usuario_id', type: 'uuid', nullable: true })
  revisadoPorUsuarioId?: string;

  @Column({ name: 'expira_em', type: 'timestamptz', nullable: true })
  expiraEm?: Date;

  @Column({ name: 'snapshot_estrutura', type: 'jsonb', nullable: true })
  snapshotEstrutura?: SnapshotEstruturaQuestionario;

  @Column({ name: 'respostas_rascunho', type: 'jsonb', nullable: true })
  respostasRascunho?: RespostaRascunhoQuestionario[];

  @Column({ name: 'rascunho_atualizado_em', type: 'timestamptz', nullable: true })
  rascunhoAtualizadoEm?: Date;

  @Column({ name: 'rascunho_versao', type: 'integer', default: 0 })
  rascunhoVersao?: number;
}
