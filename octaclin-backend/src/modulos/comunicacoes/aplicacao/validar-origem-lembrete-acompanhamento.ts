import { EntityManager, IsNull, Not } from 'typeorm';
import { interpretarConfiguracaoLembretes } from '../../clientes/aplicacao/servico-lembretes-acompanhamento';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { AcompanhamentoTarefaOrm } from '../../pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { PlanoAlimentarOrm } from '../../planos-alimentares/infraestrutura/plano-alimentar.orm';
import { PlanoAlimentarVersaoOrm } from '../../planos-alimentares/infraestrutura/plano-alimentar-versao.orm';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { chaveLembretePlano, chaveLembreteTarefa, cicloLembretePlano, tarefaElegivelParaLembrete } from '../dominio/lembretes-acompanhamento';

export interface OrigemLembreteAcompanhamento {
  tipo: 'plano' | 'tarefa';
  recursoId: string;
  chaveIdempotencia: string;
}

/** Fonte de verdade no momento de enfileirar e imediatamente antes do adaptador. */
export async function validarOrigemLembreteAcompanhamento(
  gerenciador: EntityManager, tenantId: string, origem: OrigemLembreteAcompanhamento, agora = new Date()
): Promise<{ pacienteId: string } | null> {
  const linha = await gerenciador.getRepository(TenantConfiguracaoOrm).findOne({
    where: { tenantId, chave: 'lembretes_acompanhamento' }
  });
  const config = interpretarConfiguracaoLembretes(linha?.valor);
  let pacienteId: string | undefined;
  if (origem.tipo === 'plano' && config.plano.ativo && config.plano.ativadoEm) {
    const versao = await gerenciador.getRepository(PlanoAlimentarVersaoOrm).findOne({
      where: { id: origem.recursoId, tenantId, publicadaEm: Not(IsNull()), descartadaEm: IsNull() }
    });
    if (!versao?.publicadaEm) return null;
    const plano = await gerenciador.getRepository(PlanoAlimentarOrm).findOne({
      where: { id: versao.planoId, tenantId, versaoPublicadaAtualId: versao.id, arquivadoEm: IsNull() }
    });
    const ciclo = cicloLembretePlano(versao.publicadaEm, config.plano.ativadoEm, config.plano.intervaloDias, agora);
    if (!plano || ciclo === null || origem.chaveIdempotencia !== chaveLembretePlano(versao.id, ciclo)) return null;
    pacienteId = plano.pacienteId;
  } else if (origem.tipo === 'tarefa' && config.tarefas.ativo && config.tarefas.ativadoEm) {
    const tarefa = await gerenciador.getRepository(AcompanhamentoTarefaOrm).findOne({
      where: { id: origem.recursoId, tenantId }
    });
    if (!tarefa?.vencimentoEm || tarefa.categoria !== 'tarefa' ||
        !tarefaElegivelParaLembrete(tarefa.criadoEm, tarefa.vencimentoEm, tarefa.status,
          config.tarefas.ativadoEm, config.tarefas.antecedenciaHoras, agora) ||
        origem.chaveIdempotencia !== chaveLembreteTarefa(tarefa.id, tarefa.vencimentoEm)) return null;
    pacienteId = tarefa.pacienteId;
  } else return null;

  const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
    where: { id: pacienteId, tenantId, arquivadoEm: IsNull(), statusCicloVida: 'ACTIVE' }
  });
  return paciente ? { pacienteId: paciente.id } : null;
}
