import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { FILA_NOTIFICACOES } from './servico-comunicacoes';
import { AdaptadorEmailSmtp } from '../infraestrutura/adaptadores/adaptador-email-smtp';
import { AdaptadorNotificacao } from '../infraestrutura/adaptadores/adaptador-notificacao';
import { AdaptadorPushPlaceholder } from '../infraestrutura/adaptadores/adaptador-push-placeholder';
import { AdaptadorWhatsAppMeta } from '../infraestrutura/adaptadores/adaptador-whatsapp-meta';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';

interface JobEnvioNotificacao {
  tenantId: string;
  mensagemId: string;
}

@Injectable()
@Processor(FILA_NOTIFICACOES)
export class ProcessadorNotificacoes extends WorkerHost {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly whatsapp: AdaptadorWhatsAppMeta,
    private readonly email: AdaptadorEmailSmtp,
    private readonly push: AdaptadorPushPlaceholder
  ) {
    super();
  }

  async process(job: Job<JobEnvioNotificacao>): Promise<void> {
    await this.processarMensagem(job.data.tenantId, job.data.mensagemId);
  }

  async processarMensagem(tenantId: string, mensagemId: string): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioMensagens = gerenciador.getRepository(MensagemNotificacaoOrm);
      const mensagem = await repositorioMensagens.findOne({
        where: { id: mensagemId, tenantId }
      });
      if (!mensagem) throw new NotFoundException('Mensagem de notificacao nao encontrada.');

      mensagem.status = 'processando';
      await repositorioMensagens.save(mensagem);

      try {
        const canal = await gerenciador.getRepository(CanalNotificacaoOrm).findOneByOrFail({
          id: mensagem.canalId,
          tenantId
        });
        const template = await gerenciador.getRepository(TemplateMensagemOrm).findOneByOrFail({
          id: mensagem.templateId,
          tenantId
        });
        const adaptador = this.obterAdaptador(canal.tipo);
        const resultado = await adaptador.enviar({ canal, template, payload: mensagem.payload });

        mensagem.status = 'enviado';
        mensagem.enviadoEm = new Date();
        mensagem.payload = {
          ...mensagem.payload,
          resultadoEnvio: resultado
        };
        await repositorioMensagens.save(mensagem);
      } catch (erro) {
        mensagem.status = 'falhou';
        mensagem.erro = erro instanceof Error ? erro.message : 'Falha desconhecida no envio.';
        await repositorioMensagens.save(mensagem);
        throw erro;
      }
    });
  }

  private obterAdaptador(tipo: CanalNotificacaoOrm['tipo']): AdaptadorNotificacao {
    if (tipo === 'whatsapp') return this.whatsapp;
    if (tipo === 'email') return this.email;
    return this.push;
  }
}
