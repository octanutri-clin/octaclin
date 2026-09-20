import { EntityManager, JsonContains } from 'typeorm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { identificadorDeterministico } from '../dominio/identificador-deterministico';
import { TipoGatilhoAutomacao } from '../dominio/gatilhos-automacao';
import { ExecucaoRegraOrm } from '../infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from '../infraestrutura/regra-automacao.orm';

export const TIPO_OUTBOX_GATILHO_AUTOMACAO = 'automacao.gatilho.disparar';

export interface EventoGatilhoAutomacao {
  tipo: TipoGatilhoAutomacao;
  pacienteId: string;
  /** Identificam o fato de origem (ex.: `envio_questionario`/envioId) para a chave de idempotencia. */
  origemTipo: string;
  origemId: string;
  /** Somente IDs opacos e o tipo do evento. Nunca resposta de formulario ou conteudo clinico. */
  contexto?: Record<string, unknown>;
}

export interface DisparoGatilhoAutomacao {
  execucaoId: string;
  jobId: string;
  contexto: Record<string, unknown>;
}

/**
 * Fundacao duravel dos gatilhos reais (PB-03). Cria a execucao pendente e o
 * evento de outbox correspondente dentro da MESMA transacao do fato de
 * origem — `gerenciador` e do chamador, nao um novo `ExecutorTenant.executar`.
 *
 * A publicacao na fila de automacoes fica a cargo do outbox
 * (`ProcessadorOutboxGatilhosAutomacao`): ele retoma o disparo se a fila
 * estiver indisponivel no momento do commit. O retry nunca duplica execucao
 * nem acao porque a identidade de ambos os registros e deterministica a
 * partir de (regra, origem do evento) — o mesmo par sempre produz o mesmo
 * `execucaoId`/`jobId`, e o insert usa `orIgnore` sobre a chave primaria.
 *
 * Somente regras ativas do tenant, do profissional responsavel pelo
 * paciente, casam com o evento. Paciente sem profissional responsavel (nao
 * deveria ocorrer, mas e defendido aqui) nao dispara nada.
 */
export async function dispararGatilhoAutomacao(
  gerenciador: EntityManager,
  tenantId: string,
  evento: EventoGatilhoAutomacao
): Promise<DisparoGatilhoAutomacao[]> {
  const paciente = await gerenciador.getRepository(PacienteOrm).findOne({
    select: { id: true, profissionalResponsavelId: true },
    where: { id: evento.pacienteId, tenantId }
  });
  if (!paciente?.profissionalResponsavelId) return [];

  const regras = await gerenciador.getRepository(RegraAutomacaoOrm).find({
    where: {
      tenantId,
      ativa: true,
      profissionalId: paciente.profissionalResponsavelId,
      gatilho: JsonContains({ tipo: evento.tipo })
    }
  });
  if (!regras.length) return [];

  const disparos: DisparoGatilhoAutomacao[] = [];
  for (const regra of regras) {
    disparos.push(await dispararParaRegra(gerenciador, tenantId, regra, evento));
  }
  return disparos;
}

/**
 * Nucleo de `dispararGatilhoAutomacao`: cria a execucao e o outbox de UMA
 * regra ja identificada, sem casar por profissional/tipo de gatilho.
 *
 * Exportado a parte para gatilhos cuja elegibilidade depende de parametros
 * proprios da regra (ex.: `checkin.atrasado`, cujo `diasSemCheckin`,
 * `intervaloMinimoDias` e `limitePorExecucao` variam por regra) -- o
 * chamador ja selecionou o candidato PARA ESTA regra especifica, entao
 * repetir o casamento generico por tenant/profissional/tipo de
 * `dispararGatilhoAutomacao` disparia indevidamente outras regras do mesmo
 * profissional e tipo que usem limiares diferentes.
 */
export async function dispararParaRegra(
  gerenciador: EntityManager,
  tenantId: string,
  regra: RegraAutomacaoOrm,
  evento: EventoGatilhoAutomacao
): Promise<DisparoGatilhoAutomacao> {
  const contexto = evento.contexto ?? {};
  const chave = `automacao:gatilho:${regra.id}:${evento.origemTipo}:${evento.origemId}`;
  const execucaoId = identificadorDeterministico('execucao-gatilho-automacao', chave);
  const outboxId = identificadorDeterministico('outbox-gatilho-automacao', chave);
  const jobId = `execucao-regra-${execucaoId}`;

  await gerenciador
    .createQueryBuilder()
    .insert()
    .into(ExecucaoRegraOrm)
    .values({
      id: execucaoId,
      tenantId,
      regraId: regra.id,
      pacienteId: evento.pacienteId,
      status: 'pendente',
      resultado: { contexto }
    })
    .orIgnore()
    .execute();

  await gerenciador
    .createQueryBuilder()
    .insert()
    .into(OutboxEventoOrm)
    .values({
      id: outboxId,
      tenantId,
      tipo: TIPO_OUTBOX_GATILHO_AUTOMACAO,
      status: 'pendente',
      payload: { execucaoId, jobId, contexto }
    })
    .orIgnore()
    .execute();

  return { execucaoId, jobId, contexto };
}
