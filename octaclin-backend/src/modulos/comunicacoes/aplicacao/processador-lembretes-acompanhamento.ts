import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { interpretarConfiguracaoLembretes } from '../../clientes/aplicacao/servico-lembretes-acompanhamento';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { aplicarConteudoMensagem } from './cripto-conteudo-mensagem';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { chaveLembretePlano, chaveLembreteTarefa, cicloLembretePlano, tarefaElegivelParaLembrete } from '../dominio/lembretes-acompanhamento';

const LIMITE_POR_TIPO = 50;

type PlanoPendente = { planoId: string; pacienteId: string; versaoId: string; publicadaEm: Date; ciclo: number };
type TarefaPendente = { tarefaId: string; pacienteId: string; criadoEm: Date; vencimentoEm: Date; status: string };

/** O anti-join por chave evita que os mesmos 50 já enviados bloqueiem os seguintes. */
const SQL_PLANOS = `/* fase296-planos */
  with candidatos as (
    select plano.id as "planoId", plano.paciente_id as "pacienteId",
      versao.id as "versaoId", versao.publicada_em as "publicadaEm",
      floor(extract(epoch from ($2::timestamptz - versao.publicada_em)) / $3::numeric)::integer as ciclo
    from planos_alimentares plano
    join plano_alimentar_versoes versao on versao.tenant_id = plano.tenant_id
      and versao.id = plano.versao_publicada_atual_id and versao.plano_id = plano.id
    join pacientes paciente on paciente.tenant_id = plano.tenant_id and paciente.id = plano.paciente_id
    where plano.tenant_id = $1 and plano.arquivado_em is null and versao.descartada_em is null
      and versao.publicada_em > $4::timestamptz
      and paciente.arquivado_em is null and paciente.status_ciclo_vida = 'ACTIVE'
  )
  select c.* from candidatos c
  where c.ciclo >= 1
    and c."publicadaEm" + (c.ciclo * $3::integer) * interval '1 second' > $2::timestamptz - interval '24 hours'
    and not exists (
      select 1 from mensagens_notificacao mensagem
      where mensagem.tenant_id = $1
        and mensagem.chave_idempotencia = concat('plano-acompanhamento:', c."versaoId", ':', c.ciclo, ':portal')
    )
  order by c."publicadaEm", c."versaoId" limit ${LIMITE_POR_TIPO}`;

const SQL_TAREFAS = `/* fase296-tarefas */
  select tarefa.id as "tarefaId", tarefa.paciente_id as "pacienteId",
    tarefa.criado_em as "criadoEm", tarefa.vencimento_em as "vencimentoEm", tarefa.status
  from acompanhamento_tarefas tarefa
  join pacientes paciente on paciente.tenant_id = tarefa.tenant_id and paciente.id = tarefa.paciente_id
  where tarefa.tenant_id = $1 and tarefa.categoria = 'tarefa'
    and tarefa.status in ('pendente', 'em_andamento')
    and tarefa.criado_em > $3::timestamptz and tarefa.vencimento_em is not null
    and tarefa.vencimento_em <= $2::timestamptz + ($4::integer * interval '1 hour')
    and tarefa.vencimento_em >= $2::timestamptz - (case when $4::integer = 0 then interval '1 hour' else interval '0 seconds' end)
    and paciente.arquivado_em is null and paciente.status_ciclo_vida = 'ACTIVE'
    and not exists (
      select 1 from mensagens_notificacao mensagem
      where mensagem.tenant_id = $1
        and mensagem.chave_idempotencia = concat('tarefa-acompanhamento:', tarefa.id, ':',
          floor(extract(epoch from tarefa.vencimento_em) * 1000)::bigint, ':portal')
    )
  order by tarefa.vencimento_em, tarefa.id limit ${LIMITE_POR_TIPO}`;

@Injectable()
export class ProcessadorLembretesAcompanhamento {
  private readonly logger = new Logger(ProcessadorLembretesAcompanhamento.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  @Cron('0 */10 * * * *')
  async agendarPendentes(agora = new Date()): Promise<void> {
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Lembretes de acompanhamento', async (tenantId) => {
      await this.executorTenant.executar(tenantId, async (gerenciador) => {
        await gerenciador.query('select pg_advisory_xact_lock(hashtextextended($1, 0))',
          [`lembretes-acompanhamento:${tenantId}`]);
        const linha = await gerenciador.getRepository(TenantConfiguracaoOrm).findOne({
          where: { tenantId, chave: 'lembretes_acompanhamento' }
        });
        const config = interpretarConfiguracaoLembretes(linha?.valor);
        if (!config.plano.ativo && !config.tarefas.ativo) return;
        const mensagens = gerenciador.getRepository(MensagemNotificacaoOrm);
        const outbox = gerenciador.getRepository(OutboxEventoOrm);

        if (config.plano.ativo && config.plano.ativadoEm) {
          const segundos = config.plano.intervaloDias * 24 * 60 * 60;
          const planos = await gerenciador.query<PlanoPendente[]>(SQL_PLANOS, [tenantId, agora, segundos, config.plano.ativadoEm]);
          for (const plano of planos) {
            const ciclo = cicloLembretePlano(plano.publicadaEm, config.plano.ativadoEm, config.plano.intervaloDias, agora);
            if (ciclo === null || ciclo !== Number(plano.ciclo)) continue;
            await this.registrar(mensagens, outbox, tenantId, plano.pacienteId,
              chaveLembretePlano(plano.versaoId, ciclo), 'plano', plano.versaoId,
              'Seu plano alimentar está disponível',
              'Seu plano alimentar continua disponível no portal. Acesse a seção Plano alimentar para consultá-lo.');
          }
        }

        if (config.tarefas.ativo && config.tarefas.ativadoEm) {
          const tarefas = await gerenciador.query<TarefaPendente[]>(SQL_TAREFAS, [
            tenantId, agora, config.tarefas.ativadoEm, config.tarefas.antecedenciaHoras
          ]);
          for (const tarefa of tarefas) {
            if (!tarefaElegivelParaLembrete(tarefa.criadoEm, tarefa.vencimentoEm, tarefa.status,
              config.tarefas.ativadoEm, config.tarefas.antecedenciaHoras, agora)) continue;
            await this.registrar(mensagens, outbox, tenantId, tarefa.pacienteId,
              chaveLembreteTarefa(tarefa.tarefaId, tarefa.vencimentoEm), 'tarefa', tarefa.tarefaId,
              'Você tem uma tarefa de acompanhamento',
              'Uma tarefa de acompanhamento está próxima do vencimento. Acesse a seção Tarefas no portal.');
          }
        }
      });
    }, { timeoutMs: 25_000 });
  }

  private async registrar(
    mensagens: Repository<MensagemNotificacaoOrm>,
    outbox: Repository<OutboxEventoOrm>,
    tenantId: string, pacienteId: string, chave: string, tipo: 'plano' | 'tarefa', recursoId: string,
    assunto: string, texto: string
  ): Promise<void> {
    const chavePortal = `${chave}:portal`;
    const existente = await mensagens.findOne({ select: { id: true }, where: { tenantId, chaveIdempotencia: chavePortal } });
    if (existente) return;
    const aviso = mensagens.create({ tenantId, pacienteId, status: 'enviado', enviadoEm: new Date(), categoria: 'administrativo',
      chaveIdempotencia: chavePortal, payload: {} } as Partial<MensagemNotificacaoOrm>);
    aplicarConteudoMensagem(aviso, { canal: 'portal', evento: `lembrete_${tipo}_portal`, assunto, texto }, this.criptografia);
    await mensagens.save(aviso);
    await outbox.save(outbox.create({ tenantId, tipo: 'acompanhamento.lembrete', status: 'pendente',
      payload: { tipo, recursoId, chaveIdempotencia: chave } }));
  }
}
