import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { CriarCanalNotificacaoDto, CriarTemplateMensagemDto, DispararMensagemDto } from './dtos';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';

export const FILA_NOTIFICACOES = 'notificacoes';

@Injectable()
export class ServicoComunicacoes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    @InjectQueue(FILA_NOTIFICACOES) private readonly filaNotificacoes: Queue
  ) {}

  async criarCanal(tenantId: string, dados: CriarCanalNotificacaoDto): Promise<CanalNotificacaoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(CanalNotificacaoOrm).save(
        gerenciador.getRepository(CanalNotificacaoOrm).create({
          tenantId,
          tipo: dados.tipo,
          nome: dados.nome,
          configuracao: dados.configuracao,
          ativo: dados.ativo ?? true
        })
      )
    );
  }

  async listarCanais(tenantId: string): Promise<CanalNotificacaoOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(CanalNotificacaoOrm).find({ where: { tenantId }, order: { nome: 'ASC' } })
    );
  }

  async criarTemplate(tenantId: string, dados: CriarTemplateMensagemDto): Promise<TemplateMensagemOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) =>
      gerenciador.getRepository(TemplateMensagemOrm).save(
        gerenciador.getRepository(TemplateMensagemOrm).create({
          tenantId,
          canal: dados.canal,
          codigoExterno: dados.codigoExterno,
          nome: dados.nome,
          conteudo: dados.conteudo,
          aprovado: dados.aprovado ?? false
        })
      )
    );
  }

  async listarTemplates(tenantId: string): Promise<TemplateMensagemOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(TemplateMensagemOrm).find({ where: { tenantId }, order: { nome: 'ASC' } })
    );
  }

  async listarMensagens(tenantId: string): Promise<MensagemNotificacaoOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(MensagemNotificacaoOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' },
        take: 50
      })
    );
  }

  async dispararMensagem(tenantId: string, dados: DispararMensagemDto): Promise<MensagemNotificacaoOrm> {
    const mensagem = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const canal = await gerenciador.getRepository(CanalNotificacaoOrm).findOne({
        where: { id: dados.canalId, tenantId, ativo: true }
      });
      if (!canal) throw new NotFoundException('Canal de notificacao nao encontrado ou inativo.');

      const template = await gerenciador.getRepository(TemplateMensagemOrm).findOne({
        where: { id: dados.templateId, tenantId }
      });
      if (!template) throw new NotFoundException('Template de mensagem nao encontrado.');
      if (template.canal !== canal.tipo) throw new BadRequestException('Template incompativel com o canal.');
      if (canal.tipo === 'whatsapp' && !template.aprovado) {
        throw new BadRequestException('Templates WhatsApp devem estar aprovados antes do disparo.');
      }

      const mensagemCriada = await gerenciador.getRepository(MensagemNotificacaoOrm).save(
        gerenciador.getRepository(MensagemNotificacaoOrm).create({
          tenantId,
          pacienteId: dados.pacienteId,
          canalId: canal.id,
          templateId: template.id,
          status: 'pendente',
          payload: dados.payload
        })
      );

      await gerenciador.getRepository(OutboxEventoOrm).save(
        gerenciador.getRepository(OutboxEventoOrm).create({
          tenantId,
          tipo: 'notificacao.enviar',
          status: 'pendente',
          payload: { mensagemId: mensagemCriada.id }
        })
      );

      return mensagemCriada;
    });

    return mensagem;
  }

  async publicarEventoNotificacao(tenantId: string, mensagemId: string): Promise<void> {
    await this.filaNotificacoes.add(
      'enviar',
      { tenantId, mensagemId },
      {
        jobId: `mensagem:${mensagemId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000
      }
    );
  }
}
