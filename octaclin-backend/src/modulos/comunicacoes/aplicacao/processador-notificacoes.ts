import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import { EntityManager, In, IsNull, MoreThanOrEqual } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { OPCOES_WORKER_BULLMQ } from '../../../infraestrutura/processamento/opcoes-worker-bullmq';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { lerReagendamentoAposFalta, prazoReagendamentoVencido } from '../../agenda/dominio/reagendamento-apos-falta';
import { OcorrenciaFollowupAgendaOrm } from '../../agenda/infraestrutura/ocorrencia-followup-agenda.orm';
import { PoliticaFollowupAgendaOrm } from '../../agenda/infraestrutura/politica-followup-agenda.orm';
import { canalPermitido, dentroHorarioPermitido, interpretarPreferenciasComunicacao, preferenciasComunicacaoPadrao } from '../dominio/preferencias-comunicacao';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { registrarNotificacao } from '../../notificacoes/aplicacao/registrar-notificacao';
import { FILA_NOTIFICACOES } from './servico-comunicacoes';
import { AdaptadorEmailSmtp } from '../infraestrutura/adaptadores/adaptador-email-smtp';
import { AdaptadorNotificacao } from '../infraestrutura/adaptadores/adaptador-notificacao';
import { AdaptadorPushPlaceholder } from '../infraestrutura/adaptadores/adaptador-push-placeholder';
import { AdaptadorWhatsAppMeta } from '../infraestrutura/adaptadores/adaptador-whatsapp-meta';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';
import { lerPayloadMensagem } from './cripto-conteudo-mensagem';
import { EVENTO_RETORNO } from '../dominio/politica-retorno';
import { validarOrigemLembreteAcompanhamento, OrigemLembreteAcompanhamento } from './validar-origem-lembrete-acompanhamento';

interface JobEnvioNotificacao {
  tenantId: string;
  mensagemId: string;
}

interface OpcoesProcessamentoNotificacao {
  propagarErro?: boolean;
}

@Injectable()
@Processor(FILA_NOTIFICACOES, OPCOES_WORKER_BULLMQ)
export class ProcessadorNotificacoes extends WorkerHost {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly whatsapp: AdaptadorWhatsAppMeta,
    private readonly email: AdaptadorEmailSmtp,
    private readonly push: AdaptadorPushPlaceholder,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {
    super();
  }

  async process(job: Job<JobEnvioNotificacao>): Promise<void> {
    await this.processarMensagem(job.data.tenantId, job.data.mensagemId);
  }

  async processarMensagem(
    tenantId: string,
    mensagemId: string,
    opcoes: OpcoesProcessamentoNotificacao = {}
  ): Promise<void> {
    let erroProcessamento: unknown;

    // A reserva de contatos automaticos precisa estar COMMITADA antes do adaptador.
    // Se o processo morrer apos a chamada externa, a proxima rodada nao reenvia.
    const reservaFollowup = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repo = gerenciador.getRepository(MensagemNotificacaoOrm);
      const atual = await repo.findOne({ where: { id: mensagemId, tenantId } });
      const lembreteAcompanhamento = atual?.chaveIdempotencia?.startsWith('plano-acompanhamento:') ||
        atual?.chaveIdempotencia?.startsWith('tarefa-acompanhamento:');
      if (!lembreteAcompanhamento && !['agenda.consulta.followup', 'agenda.consulta.reagendamento_proativo', EVENTO_RETORNO].includes(String(atual?.payload?.evento))) return 'legado' as const;
      if (!atual || atual.status !== 'pendente') return 'ignorar' as const;
      const reivindicacao = await repo.update({ id: mensagemId, tenantId, status: 'pendente' }, { status: 'processando', tentativaExternaEm: new Date() });
      return reivindicacao.affected ? 'reservado' as const : 'ignorar' as const;
    });
    if (reservaFollowup === 'ignorar') return;

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioMensagens = gerenciador.getRepository(MensagemNotificacaoOrm);
      if (reservaFollowup === 'legado') {
        const reivindicacao = await repositorioMensagens.update(
          { id: mensagemId, tenantId, status: In(['pendente', 'falhou']) },
          { status: 'processando' }
        );
        if (!reivindicacao.affected) return;
      }

      const mensagem = await repositorioMensagens.findOne({
        where: { id: mensagemId, tenantId }
      });
      if (!mensagem) throw new NotFoundException('Mensagem de notificacao nao encontrada.');

      try {
        const canal = await gerenciador.getRepository(CanalNotificacaoOrm).findOneByOrFail({
          id: mensagem.canalId,
          tenantId
        });
        const template = await gerenciador.getRepository(TemplateMensagemOrm).findOneByOrFail({
          id: mensagem.templateId,
          tenantId
        });
        if (canal.tipo === 'whatsapp' && !template.aprovado) {
          throw new Error('Template WhatsApp nao aprovado para envio.');
        }
        const payload = lerPayloadMensagem(mensagem, this.criptografia);
        if (mensagem.chaveIdempotencia?.startsWith('plano-acompanhamento:') ||
            mensagem.chaveIdempotencia?.startsWith('tarefa-acompanhamento:')) {
          const motivo = await this.motivoSupressaoAcompanhamento(gerenciador, tenantId, mensagem, canal, template, payload);
          if (motivo) {
            mensagem.status = 'cancelado';
            mensagem.erro = motivo;
            await repositorioMensagens.save(mensagem);
            return;
          }
        }
        if (mensagem.payload.evento === 'agenda.consulta.followup') {
          const motivo = await this.motivoSupressaoFollowup(gerenciador, tenantId, mensagem, canal, payload);
          if (motivo) {
            mensagem.status = 'cancelado';
            mensagem.erro = motivo;
            await repositorioMensagens.save(mensagem);
            const ocorrenciaId = payload.followupOcorrenciaId;
            if (typeof ocorrenciaId === 'string') await gerenciador.getRepository(OcorrenciaFollowupAgendaOrm).update({ id: ocorrenciaId, tenantId }, { status: 'suprimida', motivo });
            return;
          }
          if (typeof payload.followupOcorrenciaId === 'string') {
            await gerenciador.getRepository(OcorrenciaFollowupAgendaOrm).update({ id: payload.followupOcorrenciaId, tenantId }, { mensagemId: mensagem.id });
          }
        }
        if (mensagem.payload.evento === 'agenda.consulta.reagendamento_proativo') {
          const motivo = await this.motivoSupressaoReagendamento(gerenciador, tenantId, mensagem, canal, template, payload);
          if (motivo) {
            mensagem.status = 'cancelado';
            mensagem.erro = motivo;
            await repositorioMensagens.save(mensagem);
            return;
          }
        }
        if (mensagem.payload.evento === EVENTO_RETORNO) {
          const motivo = await this.motivoSupressaoRetorno(gerenciador, tenantId, mensagem, canal, template, payload);
          if (motivo) {
            mensagem.status = 'cancelado';
            mensagem.erro = motivo;
            await repositorioMensagens.save(mensagem);
            return;
          }
        }
        const adaptador = this.obterAdaptador(canal.tipo);
        // Payload remontado vai so para o adaptador; a entidade continua com o
        // conteudo cifrado a parte, entao o save abaixo nao o escreve em claro.
        const resultado = await adaptador.enviar({
          canal,
          template,
          payload
        });

        mensagem.status = 'enviado';
        mensagem.enviadoEm = new Date();
        mensagem.payload = {
          ...mensagem.payload,
          resultadoEnvio: resultado
        };
        await repositorioMensagens.save(mensagem);
        if (mensagem.payload.evento === 'agenda.consulta.followup' && typeof payload.followupOcorrenciaId === 'string') {
          await gerenciador.getRepository(OcorrenciaFollowupAgendaOrm).update({ id: payload.followupOcorrenciaId, tenantId }, { status: 'enviada' });
        }
      } catch (erro) {
        mensagem.status = 'falhou';
        mensagem.erro = erro instanceof Error ? erro.message : 'Falha desconhecida no envio.';
        await repositorioMensagens.save(mensagem);
        if (mensagem.payload.evento === 'agenda.consulta.followup') {
          const payload = lerPayloadMensagem(mensagem, this.criptografia);
          if (typeof payload.followupOcorrenciaId === 'string') await gerenciador.getRepository(OcorrenciaFollowupAgendaOrm).update({ id: payload.followupOcorrenciaId, tenantId }, { status: 'falhou', motivo: 'entrega_incerta' });
        }
        // Falha de envio era visivel so para quem abrisse a central de falhas
        // (Fase 112). O lembrete que nao chegou vira consulta perdida.
        await registrarNotificacao(gerenciador, tenantId, {
          tipo: 'falha_envio',
          recursoTipo: 'mensagem_notificacao',
          recursoId: mensagem.id,
          pacienteId: mensagem.pacienteId
        });
        erroProcessamento = erro;
      }
    });

    if (erroProcessamento && opcoes.propagarErro !== false) throw erroProcessamento;
  }

  private async motivoSupressaoAcompanhamento(
    gerenciador: EntityManager, tenantId: string, mensagem: MensagemNotificacaoOrm,
    canal: CanalNotificacaoOrm, template: TemplateMensagemOrm, payload: Record<string, unknown>
  ): Promise<string | undefined> {
    const valor = payload.origemAcompanhamento;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return 'origem_invalida';
    const origem = valor as OrigemLembreteAcompanhamento;
    if ((origem.tipo !== 'plano' && origem.tipo !== 'tarefa') || typeof origem.recursoId !== 'string' ||
        typeof origem.chaveIdempotencia !== 'string' ||
        mensagem.chaveIdempotencia !== `${origem.chaveIdempotencia}:${canal.tipo}`) return 'origem_invalida';
    const codigoEsperado = canal.tipo === 'email'
      ? origem.tipo === 'plano' ? 'octaclin_inicial_lembrete_plano' : 'octaclin_inicial_lembrete_tarefa'
      : origem.tipo === 'plano' ? 'octaclin_lembrete_plano' : 'octaclin_lembrete_tarefa';
    if (!canal.ativo || (canal.tipo !== 'email' && canal.tipo !== 'whatsapp') ||
        template.codigoExterno !== codigoEsperado || template.canal !== canal.tipo) return 'canal_indisponivel';
    const valido = await validarOrigemLembreteAcompanhamento(gerenciador, tenantId, origem);
    if (!valido || valido.pacienteId !== mensagem.pacienteId) return 'origem_indisponivel';
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { id: mensagem.pacienteId, tenantId } });
    if (!paciente) return 'paciente_indisponivel';
    let preferencias;
    try {
      preferencias = paciente.contatoCriptografado
        ? interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado))
        : preferenciasComunicacaoPadrao();
    } catch { return 'contato_ilegivel'; }
    if (!canalPermitido(preferencias, canal.tipo) ||
        !dentroHorarioPermitido(new Date(), preferencias.horarioPermitido) ||
        preferencias.contatos[canal.tipo] !== payload.destino) return 'preferencia_alterada';
    return undefined;
  }

  private async motivoSupressaoFollowup(gerenciador: EntityManager, tenantId: string, mensagem: MensagemNotificacaoOrm, canal: CanalNotificacaoOrm, payload: Record<string, unknown>): Promise<string | undefined> {
    const consultaId = payload.consultaId;
    const ocorrenciaId = payload.followupOcorrenciaId;
    if (typeof consultaId !== 'string' || typeof ocorrenciaId !== 'string' || typeof payload.consultaInicioEm !== 'string') return 'payload_invalido';
    const consulta = await gerenciador.getRepository(AgendaConsultaOrm).findOne({ where: { id: consultaId, tenantId }, lock: { mode: 'pessimistic_read' } });
    if (!consulta || consulta.pacienteId !== mensagem.pacienteId || !['agendada', 'reagendada'].includes(consulta.status) || consulta.inicioEm <= new Date() || consulta.inicioEm.toISOString() !== payload.consultaInicioEm) return 'consulta_alterada';
    const ocorrencia = await gerenciador.getRepository(OcorrenciaFollowupAgendaOrm).findOne({ where: { id: ocorrenciaId, tenantId, consultaId } });
    if (!ocorrencia || !['processando', 'enfileirada'].includes(ocorrencia.status) || ocorrencia.chaveIdempotencia !== mensagem.chaveIdempotencia) return 'etapa_alterada';
    const politica = await gerenciador.getRepository(PoliticaFollowupAgendaOrm).findOne({ where: { id: consulta.followupPoliticaId, tenantId } });
    if (!politica?.ativo || politica.id !== ocorrencia.politicaId || politica.versao !== ocorrencia.politicaVersao) return 'politica_alterada';
    if (ocorrencia.condicao === 'somente_se_nao_confirmada' && (consulta.notificacoes?.confirmacaoPaciente as { status?: string } | undefined)?.status === 'confirmada') return 'consulta_confirmada';
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { id: consulta.pacienteId, tenantId } });
    if (!paciente) return 'paciente_indisponivel';
    let preferencias;
    try {
      preferencias = paciente.contatoCriptografado ? interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado)) : preferenciasComunicacaoPadrao();
    } catch { return 'contato_ilegivel'; }
    if (canal.tipo !== 'email' && canal.tipo !== 'whatsapp') return 'canal_indisponivel';
    if (!canal.ativo || !canalPermitido(preferencias, canal.tipo) || !dentroHorarioPermitido(new Date(), preferencias.horarioPermitido) || preferencias.contatos[canal.tipo] !== payload.destino) return 'preferencia_alterada';
    return undefined;
  }

  private async motivoSupressaoReagendamento(
    gerenciador: EntityManager,
    tenantId: string,
    mensagem: MensagemNotificacaoOrm,
    canal: CanalNotificacaoOrm,
    template: TemplateMensagemOrm,
    payload: Record<string, unknown>
  ): Promise<string | undefined> {
    if (typeof payload.consultaId !== 'string') return 'payload_invalido';
    const agora = new Date();
    const consulta = await gerenciador.getRepository(AgendaConsultaOrm).findOne({
      where: { id: payload.consultaId, tenantId, pacienteId: mensagem.pacienteId, status: 'falta' },
      lock: { mode: 'pessimistic_read' }
    });
    const decisao = lerReagendamentoAposFalta(consulta?.payload);
    if (!consulta || !['aprovado', 'enfileirado'].includes(decisao?.estado ?? '') ||
        consulta.fimEm > agora || prazoReagendamentoVencido(consulta.fimEm, agora)) return 'decisao_expirada';
    const retorno = await gerenciador.getRepository(AgendaConsultaOrm).findOne({
      where: { tenantId, pacienteId: mensagem.pacienteId, status: In(['agendada', 'reagendada']), inicioEm: MoreThanOrEqual(agora) }
    });
    if (retorno) return 'consulta_futura';
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { id: mensagem.pacienteId, tenantId } });
    if (!paciente || paciente.arquivadoEm || ['inativo', 'pausado', 'encerrado', 'fechado'].includes(paciente.statusAdesao)) return 'paciente_indisponivel';
    if (!canal.ativo || (canal.tipo !== 'email' && canal.tipo !== 'whatsapp') ||
        template.conteudo?.evento !== 'agenda.consulta.reagendamento_proativo') return 'canal_indisponivel';
    let preferencias;
    try {
      preferencias = paciente.contatoCriptografado
        ? interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado))
        : preferenciasComunicacaoPadrao();
    } catch { return 'contato_ilegivel'; }
    if (!canalPermitido(preferencias, canal.tipo) || !dentroHorarioPermitido(agora, preferencias.horarioPermitido) ||
        preferencias.contatos[canal.tipo] !== payload.destino) return 'preferencia_alterada';
    return undefined;
  }

  private async motivoSupressaoRetorno(
    gerenciador: EntityManager,
    tenantId: string,
    mensagem: MensagemNotificacaoOrm,
    canal: CanalNotificacaoOrm,
    template: TemplateMensagemOrm,
    payload: Record<string, unknown>
  ): Promise<string | undefined> {
    if (!mensagem.pacienteId) return 'paciente_indisponivel';
    const paciente = await gerenciador.getRepository(PacienteOrm).findOne({ where: { id: mensagem.pacienteId, tenantId } });
    if (!paciente || paciente.arquivadoEm || ['inativo', 'pausado', 'encerrado', 'fechado'].includes(paciente.statusAdesao)) return 'paciente_indisponivel';
    const consulta = await gerenciador.getRepository(AgendaConsultaOrm).findOne({
      select: { id: true },
      where: { tenantId, pacienteId: mensagem.pacienteId, status: In(['agendada', 'reagendada']), inicioEm: MoreThanOrEqual(new Date()) }
    });
    if (consulta) return 'consulta_futura';
    if (!canal.ativo || (canal.tipo !== 'email' && canal.tipo !== 'whatsapp') ||
        template.conteudo?.evento !== EVENTO_RETORNO || (canal.tipo === 'whatsapp' && !template.aprovado)) return 'canal_indisponivel';
    let preferencias;
    try {
      preferencias = paciente.contatoCriptografado
        ? interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado))
        : preferenciasComunicacaoPadrao();
    } catch { return 'contato_ilegivel'; }
    if (!canalPermitido(preferencias, canal.tipo) || !dentroHorarioPermitido(new Date(), preferencias.horarioPermitido) ||
        preferencias.contatos[canal.tipo] !== payload.destino) return 'preferencia_alterada';
    return undefined;
  }

  private obterAdaptador(tipo: CanalNotificacaoOrm['tipo']): AdaptadorNotificacao {
    if (tipo === 'whatsapp') return this.whatsapp;
    if (tipo === 'email') return this.email;
    // Push nao tem envio real (ver AdaptadorPushPlaceholder): antes disto,
    // qualquer canal com tipo nao reconhecido caia aqui e a mensagem virava
    // "enviada" sem sair do banco. Falhar explicitamente evita que a central
    // de falhas minta sobre uma entrega que nao aconteceu.
    throw new Error(`Canal de notificacao "${tipo}" nao possui envio real configurado.`);
  }
}
