import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { FormaPagamentoConsulta, StatusPagamentoConsulta } from '../dominio/financeiro-consulta';

/**
 * Pacote de sessoes: agrupador **opcional** de consultas (por exemplo "10
 * consultas com validade de 6 meses"), que e como acompanhamento nutricional e
 * vendido no Brasil. O dinheiro do pacote vive aqui; a consulta vinculada entra
 * com valor zero para o mesmo atendimento nao contar duas vezes no faturamento.
 */
@Entity('pacotes_sessao')
export class PacoteSessaoOrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'paciente_id', type: 'uuid' })
  pacienteId: string;

  @Column({ name: 'profissional_id', type: 'uuid', nullable: true })
  profissionalId?: string;

  @Column({ type: 'varchar', length: 180 })
  titulo: string;

  @Column({ name: 'sessoes_contratadas', type: 'int' })
  sessoesContratadas: number;

  @Column({ name: 'valor_total_centavos', type: 'int', default: 0 })
  valorTotalCentavos: number;

  @Column({ name: 'forma_pagamento', type: 'varchar', length: 30, nullable: true })
  formaPagamento?: FormaPagamentoConsulta;

  @Column({ name: 'status_pagamento', type: 'varchar', length: 20, default: 'pendente' })
  statusPagamento: StatusPagamentoConsulta;

  @Column({ name: 'pago_em', type: 'timestamptz', nullable: true })
  pagoEm?: Date;

  /** Data, nao instante: pacote com validade "31/12" vale o dia 31 inteiro. */
  @Column({ name: 'validade_em', type: 'date', nullable: true })
  validadeEm?: Date;

  @Column({ name: 'cancelado_em', type: 'timestamptz', nullable: true })
  canceladoEm?: Date;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm: Date;
}
