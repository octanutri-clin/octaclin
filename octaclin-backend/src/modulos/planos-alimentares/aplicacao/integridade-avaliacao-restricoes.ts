import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../infraestrutura/revisao-avaliacao-restricoes.orm';

function instanteOuNulo(valor: Date | null | undefined): number | null {
  if (valor == null) return null;
  if (!(valor instanceof Date) || !Number.isFinite(valor.getTime())) throw new ConflictException('Avaliação indisponível.');
  return valor.getTime();
}

export async function exigirReadCommitted(g: EntityManager): Promise<void> {
  const isolamento: Array<{ transaction_isolation?: string }> = await g.query('show transaction_isolation');
  if (isolamento.length !== 1 || isolamento[0].transaction_isolation !== 'read committed') throw new ConflictException('Operação indisponível.');
}

export async function exigirHistoricoConsistente(g: EntityManager, tenantId: string, pacienteId: string, avaliacao: AvaliacaoRestricoesPacienteOrm): Promise<void> {
  const revisao = await g.getRepository(RevisaoAvaliacaoRestricoesOrm).findOne({ where: { tenantId, pacienteId, avaliacaoId: avaliacao.id, numero: avaliacao.revisao } });
  if (!revisao || revisao.situacao !== avaliacao.situacao || instanteOuNulo(revisao.venceEm) !== instanteOuNulo(avaliacao.venceEm)) {
    throw new ConflictException('Avaliação alterada ou indisponível.');
  }
  // Date perde microssegundos; compare também os valores exatos no PostgreSQL.
  const consistencia: Array<{ consistente: boolean }> = await g.query(`select
    (r.situacao = a.situacao and r.vence_em is not distinct from a.vence_em) as consistente
    from avaliacoes_restricoes_pacientes a
    join avaliacoes_restricoes_revisoes r on r.tenant_id=a.tenant_id and r.paciente_id=a.paciente_id and r.avaliacao_id=a.id and r.numero=a.revisao
    where a.tenant_id=$1 and a.paciente_id=$2 and a.id=$3 and a.revisao=$4`, [tenantId, pacienteId, avaliacao.id, avaliacao.revisao]);
  if (consistencia.length !== 1 || consistencia[0].consistente !== true) throw new ConflictException('Avaliação alterada ou indisponível.');
}
