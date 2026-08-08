import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createHmac } from 'crypto';
import * as https from 'https';
import { isIP } from 'net';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { executarPorTenantAtivo } from '../../../infraestrutura/processamento/rodada-por-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { validarDestinoWebhook } from './seguranca-destino-webhook';
import { WebhookAssinaturaOrm } from '../infraestrutura/webhook-assinatura.orm';
import { WebhookEntregaOrm } from '../infraestrutura/webhook-entrega.orm';

const MAXIMO_TENTATIVAS = 6;
const ATRASOS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 8 * 3_600_000, 24 * 3_600_000];
const LEASE_PROCESSAMENTO_MS = 10 * 60_000;

interface EntregaReivindicada {
  entrega: WebhookEntregaOrm;
  url: string;
  segredo: string;
}

@Injectable()
export class ProcessadorWebhooks {
  private readonly logger = new Logger(ProcessadorWebhooks.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  @Cron('*/30 * * * * *')
  async processarPendentes(): Promise<void> {
    await executarPorTenantAtivo(
      this.fonteDados,
      this.logger,
      'Webhooks de integracao',
      async (tenantId) => {
        const ids = await this.executorTenant.executar(tenantId, async (gerenciador) => {
          const repositorio = gerenciador.getRepository(WebhookEntregaOrm);
          await repositorio.update(
            {
              tenantId,
              status: 'processando',
              atualizadoEm: LessThanOrEqual(new Date(Date.now() - LEASE_PROCESSAMENTO_MS))
            },
            {
              status: 'pendente',
              proximaTentativaEm: new Date(),
              ultimoErro: 'Entrega recuperada apos interrupcao do processador.'
            }
          );
          const itens = await repositorio.find({
            where: { tenantId, status: 'pendente', proximaTentativaEm: LessThanOrEqual(new Date()) },
            order: { criadoEm: 'ASC' },
            take: 50,
            select: { id: true }
          });
          return itens.map((item) => item.id);
        });
        for (const id of ids) await this.processarUma(tenantId, id);
      },
      { timeoutMs: 25_000 }
    );
  }

  async processarUma(tenantId: string, entregaId: string): Promise<void> {
    const reivindicada = await this.reivindicar(tenantId, entregaId);
    if (!reivindicada) return;

    try {
      const corpo = JSON.stringify({ id: reivindicada.entrega.id, ...reivindicada.entrega.payload });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const assinatura = createHmac('sha256', reivindicada.segredo).update(`${timestamp}.${corpo}`).digest('hex');
      const statusHttp = await this.enviar(reivindicada.url, corpo, {
        'X-OctaClin-Event': reivindicada.entrega.evento,
        'X-OctaClin-Delivery': reivindicada.entrega.id,
        'X-OctaClin-Timestamp': timestamp,
        'X-OctaClin-Signature': `v1=${assinatura}`
      });
      if (statusHttp < 200 || statusHttp >= 300) throw Object.assign(new Error(`HTTP ${statusHttp}`), { statusHttp });
      await this.finalizar(tenantId, reivindicada.entrega.id, { entregue: true, statusHttp });
    } catch (erro) {
      const statusHttp = this.statusHttpDoErro(erro);
      await this.finalizar(tenantId, reivindicada.entrega.id, {
        entregue: false,
        statusHttp,
        erro: this.mensagemSegura(erro)
      });
      this.logger.warn(`Falha na entrega de webhook ${reivindicada.entrega.id}.`);
    }
  }

  private async reivindicar(tenantId: string, entregaId: string): Promise<EntregaReivindicada | null> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(WebhookEntregaOrm);
      const entrega = await repositorio.findOne({ where: { id: entregaId, tenantId, status: 'pendente' } });
      if (!entrega || entrega.proximaTentativaEm > new Date()) return null;
      const resultado = await repositorio.update(
        { id: entrega.id, tenantId, status: 'pendente' },
        { status: 'processando', tentativas: entrega.tentativas + 1 }
      );
      if (!resultado.affected) return null;
      entrega.status = 'processando';
      entrega.tentativas += 1;
      const assinatura = await gerenciador.getRepository(WebhookAssinaturaOrm).findOne({
        where: { id: entrega.assinaturaId, tenantId, ativo: true }
      });
      if (!assinatura) {
        entrega.status = 'falhou';
        entrega.ultimoErro = 'Assinatura de webhook desativada.';
        await repositorio.save(entrega);
        return null;
      }
      return {
        entrega,
        url: assinatura.url,
        segredo: this.criptografia.descriptografar(assinatura.segredoCriptografado)
      };
    });
  }

  private async finalizar(
    tenantId: string,
    entregaId: string,
    resultado: { entregue: boolean; statusHttp?: number; erro?: string }
  ): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(WebhookEntregaOrm);
      const entrega = await repositorio.findOne({ where: { id: entregaId, tenantId, status: 'processando' } });
      if (!entrega) return;
      entrega.ultimoStatusHttp = resultado.statusHttp;
      if (resultado.entregue) {
        entrega.status = 'entregue';
        entrega.entregueEm = new Date();
        entrega.ultimoErro = undefined;
      } else {
        entrega.ultimoErro = resultado.erro;
        entrega.status = entrega.tentativas >= MAXIMO_TENTATIVAS ? 'falhou' : 'pendente';
        entrega.proximaTentativaEm = new Date(Date.now() + ATRASOS_MS[Math.min(entrega.tentativas - 1, ATRASOS_MS.length - 1)]);
      }
      await repositorio.save(entrega);
    });
  }

  private async enviar(urlOriginal: string, corpo: string, cabecalhos: Record<string, string>): Promise<number> {
    const destino = await validarDestinoWebhook(urlOriginal);
    return new Promise<number>((resolver, rejeitar) => {
      const requisicao = https.request(
        {
          protocol: 'https:',
          hostname: destino.hostname,
          port: 443,
          path: `${destino.url.pathname}${destino.url.search}`,
          method: 'POST',
          ...(isIP(destino.hostname) ? {} : { servername: destino.hostname }),
          timeout: 8_000,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(corpo),
            'User-Agent': 'OctaClin-Webhooks/1.0',
            ...cabecalhos
          },
          lookup: (_hostname, _opcoes, callback) => callback(null, destino.endereco, destino.familia)
        },
        (resposta) => {
          let bytes = 0;
          resposta.on('data', (trecho: Buffer) => {
            bytes += trecho.length;
            if (bytes > 64 * 1024) resposta.destroy(new Error('Resposta do webhook excedeu o limite.'));
          });
          resposta.on('end', () => resolver(resposta.statusCode ?? 0));
          resposta.on('error', rejeitar);
        }
      );
      requisicao.on('timeout', () => requisicao.destroy(new Error('Timeout na entrega do webhook.')));
      requisicao.on('error', rejeitar);
      requisicao.end(corpo);
    });
  }

  private statusHttpDoErro(erro: unknown): number | undefined {
    if (!erro || typeof erro !== 'object' || !('statusHttp' in erro)) return undefined;
    const valor = Number((erro as { statusHttp?: unknown }).statusHttp);
    return Number.isInteger(valor) ? valor : undefined;
  }

  private mensagemSegura(erro: unknown): string {
    const mensagem = erro instanceof Error ? erro.message : 'Falha desconhecida.';
    return mensagem.replace(/https?:\/\/[^\s]+/gi, '[url]').slice(0, 500);
  }
}
