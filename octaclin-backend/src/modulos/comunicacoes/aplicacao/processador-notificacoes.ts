import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import { In } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
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

interface JobEnvioNotificacao {
  tenantId: string;
  mensagemId: string;
}

interface OpcoesProcessamentoNotificacao {
  propagarErro?: boolean;
}

@Injectable()
@Processor(FILA_NOTIFICACOES)
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

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorioMensagens = gerenciador.getRepository(MensagemNotificacaoOrm);
      const reivindicacao = await repositorioMensagens.update(
        { id: mensagemId, tenantId, status: In(['pendente', 'falhou']) },
        { status: 'processando' }
      );
      if (!reivindicacao.affected) return;

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
        const adaptador = this.obterAdaptador(canal.tipo);
        // Payload remontado vai so para o adaptador; a entidade continua com o
        // conteudo cifrado a parte, entao o save abaixo nao o escreve em claro.
        const resultado = await adaptador.enviar({
          canal,
          template,
          payload: lerPayloadMensagem(mensagem, this.criptografia)
        });

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

  private obterAdaptador(tipo: CanalNotificacaoOrm['tipo']): AdaptadorNotificacao {
    if (tipo === 'whatsapp') return this.whatsapp;
    if (tipo === 'email') return this.email;
    return this.push;
  }
}
