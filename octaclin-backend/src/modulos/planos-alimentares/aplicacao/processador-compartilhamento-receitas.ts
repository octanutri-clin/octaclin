import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, IsNull, LessThanOrEqual } from 'typeorm';
import * as webpush from 'web-push';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { interpretarPreferenciasComunicacao, preferenciasComunicacaoPadrao, canalAutorizado, dentroHorarioPermitido } from '../../comunicacoes/dominio/preferencias-comunicacao';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { TemplateMensagemOrm } from '../../comunicacoes/infraestrutura/template-mensagem.orm';
import { AdaptadorEmailSmtp } from '../../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { AdaptadorWhatsAppMeta } from '../../comunicacoes/infraestrutura/adaptadores/adaptador-whatsapp-meta';
import { SubscriptionPushPacienteOrm } from '../infraestrutura/subscription-push-paciente.orm';
import { CompartilhamentoReceitaNutricionalOrm } from '../infraestrutura/compartilhamento-receita-nutricional.orm';
import { EntregaCompartilhamentoReceitaOrm } from '../infraestrutura/entrega-compartilhamento-receita.orm';
import { PreferenciaCompartilhamentoReceitaOrm } from '../infraestrutura/preferencia-compartilhamento-receita.orm';
import { deveExecutarProcessadores } from '../../../infraestrutura/processamento/papel-processo';

@Injectable()
export class ProcessadorCompartilhamentoReceitas {
  private readonly logger = new Logger(ProcessadorCompartilhamentoReceitas.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly email: AdaptadorEmailSmtp,
    private readonly whatsapp: AdaptadorWhatsAppMeta
  ) {}

  @Cron('*/30 * * * * *')
  async processarPendentes(): Promise<void> {
    if (!deveExecutarProcessadores()) return;
    await executarPorTenantAtivo(this.fonteDados, this.logger, 'Avisos de receitas compartilhadas', async (tenantId) => {
      const ids = await this.executorTenant.executar(tenantId, async (em) => (await em.getRepository(EntregaCompartilhamentoReceitaOrm).find({
        select: { id: true },
        where: { tenantId, status: 'pendente', agendadoPara: LessThanOrEqual(new Date()) },
        order: { agendadoPara: 'ASC', id: 'ASC' },
        take: 100
      })).map((item) => item.id));
      for (const id of ids) await this.processar(tenantId, id);
    }, { timeoutMs: 25_000 });
  }

  private async processar(tenantId: string, entregaId: string): Promise<void> {
    const tarefa = await this.executorTenant.executar(tenantId, async (em) => {
      const entregas = em.getRepository(EntregaCompartilhamentoReceitaOrm);
      const entrega = await entregas.findOne({ where: { tenantId, id: entregaId }, lock: { mode: 'pessimistic_write' } });
      if (!entrega || entrega.status !== 'pendente' || entrega.agendadoPara > new Date()) return undefined;
      const share = await em.getRepository(CompartilhamentoReceitaNutricionalOrm).findOne({ where: { tenantId, id: entrega.compartilhamentoId }, lock: { mode: 'pessimistic_write' } });
      if (!share || !['agendado', 'ativo'].includes(share.status)) {
        entrega.status = 'cancelado';
        await entregas.save(entrega);
        return undefined;
      }
      if (share.status === 'agendado') {
        await em.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`receita-share:${tenantId}:${share.pacienteId}:${share.receitaId}`]);
        await em.getRepository(CompartilhamentoReceitaNutricionalOrm).update(
          { tenantId, pacienteId: share.pacienteId, receitaId: share.receitaId, status: 'ativo' },
          { status: 'substituido', atualizadoEm: new Date() }
        );
        share.status = 'ativo';
        share.enviadoEm = new Date();
        await em.getRepository(CompartilhamentoReceitaNutricionalOrm).save(share);
      }
      if (entrega.canal === 'portal') {
        entrega.status = 'enviado';
        entrega.confirmadoEm = new Date();
        await entregas.save(entrega);
        return undefined;
      }
      const paciente = await em.getRepository(PacienteOrm).findOne({ where: { tenantId, id: share.pacienteId, arquivadoEm: IsNull() } });
      const consentimento = await em.getRepository(PreferenciaCompartilhamentoReceitaOrm).findOne({ where: { tenantId, pacienteId: share.pacienteId } });
      if (!paciente || !paciente.usuarioId || !consentimento || !this.optIn(consentimento, entrega.canal)) {
        entrega.status = 'suprimido';
        entrega.erroCodigo = 'consentimento_ausente';
        await entregas.save(entrega);
        return undefined;
      }
      if (entrega.canal === 'push') {
        let preferenciasPush;
        try {
          preferenciasPush = paciente.contatoCriptografado
            ? interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado))
            : preferenciasComunicacaoPadrao();
        } catch {
          entrega.status = 'suprimido'; entrega.erroCodigo = 'contato_ilegivel'; await entregas.save(entrega); return undefined;
        }
        if (!dentroHorarioPermitido(new Date(), preferenciasPush.horarioPermitido)) {
          entrega.status = 'suprimido'; entrega.erroCodigo = 'fora_janela_contato'; await entregas.save(entrega); return undefined;
        }
        const subscriptions = await em.getRepository(SubscriptionPushPacienteOrm).find({ where: { tenantId, pacienteId: paciente.id, usuarioId: paciente.usuarioId, revogadaEm: IsNull() } });
        if (!subscriptions.length) {
          entrega.status = 'suprimido';
          entrega.erroCodigo = 'subscription_ausente';
          await entregas.save(entrega);
          return undefined;
        }
        entrega.status = 'processando';
        entrega.iniciadoEm = new Date();
        await entregas.save(entrega);
        return { tipo: 'push' as const, entregaId, pacienteId: paciente.id, subscriptions: subscriptions.map((sub) => ({ id: sub.id, json: this.criptografia.descriptografar(sub.endpointCriptografado) })) };
      }

      let preferencias;
      try { preferencias = paciente.contatoCriptografado ? interpretarPreferenciasComunicacao(this.criptografia.descriptografar(paciente.contatoCriptografado)) : undefined; }
      catch { preferencias = undefined; }
      if (!preferencias || !canalAutorizado(preferencias, entrega.canal) || !preferencias.contatos[entrega.canal] || !dentroHorarioPermitido(new Date(), preferencias.horarioPermitido)) {
        entrega.status = 'suprimido';
        entrega.erroCodigo = 'preferencia_ou_janela_alterada';
        await entregas.save(entrega);
        return undefined;
      }
      const [canal, template] = await Promise.all([
        em.getRepository(CanalNotificacaoOrm).findOne({ where: { tenantId, ativo: true, tipo: entrega.canal } }),
        em.getRepository(TemplateMensagemOrm).findOne({ where: { tenantId, canal: entrega.canal, codigoExterno: 'octaclin_aviso_receita_disponivel' } })
      ]);
      if (!canal || !template || (entrega.canal === 'whatsapp' && (
        !template.aprovado || template.conteudo?.avisoReceitaGenerico !== true || template.conteudo?.avisoReceitaUrlNoBody !== true
      ))) {
        entrega.status = 'falhou';
        entrega.erroCodigo = 'template_indisponivel';
        await entregas.save(entrega);
        return undefined;
      }
      entrega.status = 'processando';
      entrega.iniciadoEm = new Date();
      await entregas.save(entrega);
      return { tipo: entrega.canal as 'email' | 'whatsapp', entregaId, pacienteId: paciente.id, destino: preferencias.contatos[entrega.canal]!, canal, template };
    });

    if (!tarefa) return;
    let envioIniciado = false;
    try {
      if (tarefa.tipo === 'push') {
        const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
        const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
        const subject = process.env.WEB_PUSH_VAPID_SUBJECT;
        if (!publicKey || !privateKey || !subject) throw new Error('push_provider_unconfigured');
        webpush.setVapidDetails(subject, publicKey, privateKey);
        let aceitos = 0;
        for (const subscription of tarefa.subscriptions) {
          try {
            const payload = JSON.stringify({ title: 'Nova receita disponível', body: 'Acesse o portal OctaClin para consultar.', url: '/portal/receitas' });
            const registro = JSON.parse(subscription.json) as webpush.PushSubscription;
            envioIniciado = true;
            await webpush.sendNotification(registro, payload);
            aceitos += 1;
          } catch (erro) {
            const statusCode = (erro as { statusCode?: number })?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              await this.executorTenant.executar(tenantId, (em) => em.getRepository(SubscriptionPushPacienteOrm).update({ id: subscription.id, tenantId, revogadaEm: IsNull() }, { revogadaEm: new Date() }));
            }
            throw erro;
          }
        }
        if (!aceitos) throw new Error('push_delivery_unconfirmed');
      } else if (tarefa.tipo === 'email') {
        const url = this.urlPortalReceitas();
        envioIniciado = true;
        await this.email.enviar({ canal: tarefa.canal, template: tarefa.template, payload: { destino: tarefa.destino, assunto: 'Você recebeu uma receita no portal OctaClin', texto: `Acesse sua conta autenticada para consultar: ${url}` } });
      } else {
        const url = this.urlPortalReceitas();
        envioIniciado = true;
        await this.whatsapp.enviar({ canal: tarefa.canal, template: tarefa.template, payload: {
          destino: tarefa.destino,
          components: [{ type: 'body', parameters: [{ type: 'text', text: url }] }]
        } });
      }
      await this.finalizar(tenantId, tarefa.entregaId, 'enviado', null);
    } catch (erro) {
      // Uma falha depois de iniciar a chamada pode ocorrer após a entrega. Não repetir evita aviso duplicado.
      this.logger.warn(`Entrega de aviso de receita sem confirmação (${tarefa.tipo}).`);
      await this.finalizar(tenantId, tarefa.entregaId, envioIniciado ? 'incerto' : 'falhou', envioIniciado ? 'entrega_nao_confirmada' : 'configuracao_indisponivel');
    }
  }

  private optIn(preferencia: PreferenciaCompartilhamentoReceitaOrm, canal: string) {
    if (canal === 'email') return preferencia.emailAtivo && Boolean(preferencia.emailConsentidoEm);
    if (canal === 'whatsapp') return preferencia.whatsappAtivo && Boolean(preferencia.whatsappConsentidoEm);
    return canal === 'push' && preferencia.pushAtivo && Boolean(preferencia.pushConsentidoEm);
  }

  private urlPortalReceitas(): string {
    const base = (process.env.OCTACLIN_WEB_URL ?? process.env.WEB_URL ?? 'http://localhost:3000').trim();
    const url = new URL('/portal/receitas', base);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('portal_url_insecure');
    return url.toString();
  }

  private async finalizar(tenantId: string, entregaId: string, status: 'enviado' | 'incerto' | 'falhou', erroCodigo: string | null) {
    await this.executorTenant.executar(tenantId, async (em) => {
      const repo = em.getRepository(EntregaCompartilhamentoReceitaOrm);
      const row = await repo.findOne({ where: { tenantId, id: entregaId, status: 'processando' }, lock: { mode: 'pessimistic_write' } });
      if (!row) return;
      row.status = status;
      row.erroCodigo = erroCodigo;
      row.confirmadoEm = status === 'enviado' ? new Date() : null;
      await repo.save(row);
    });
  }
}
