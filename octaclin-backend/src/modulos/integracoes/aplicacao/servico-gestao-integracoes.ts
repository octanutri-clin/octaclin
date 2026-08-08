import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { EntityManager, IsNull } from 'typeorm';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { CriarChaveApiDto, CriarWebhookDto } from './dtos';
import { validarDestinoWebhook } from './seguranca-destino-webhook';
import { ApiChaveOrm } from '../infraestrutura/api-chave.orm';
import { WebhookAssinaturaOrm } from '../infraestrutura/webhook-assinatura.orm';
import { WebhookEntregaOrm } from '../infraestrutura/webhook-entrega.orm';

@Injectable()
export class ServicoGestaoIntegracoes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly auditoria: ServicoAuditoria
  ) {}

  async listarChaves(tenantId: string) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const chaves = await gerenciador.getRepository(ApiChaveOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' },
        take: 100
      });
      return chaves.map((chave) => this.mapearChave(chave));
    });
  }

  async criarChave(tenantId: string, usuarioId: string, dados: CriarChaveApiDto) {
    const expiraEm = dados.expiraEm ? new Date(dados.expiraEm) : undefined;
    if (expiraEm && expiraEm <= new Date()) throw new BadRequestException('A expiracao da chave deve estar no futuro.');

    const resultado = await this.executorTenant.executar(tenantId, (gerenciador) =>
      this.criarChaveNoGerenciador(gerenciador, tenantId, usuarioId, dados, expiraEm)
    );
    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'integracoes.chave.criar',
      recursoTipo: 'api_chave',
      recursoId: resultado.chave.id,
      metadados: { escopos: resultado.chave.escopos, possuiExpiracao: Boolean(resultado.chave.expiraEm) }
    });
    return resultado;
  }

  async rotacionarChave(tenantId: string, usuarioId: string, chaveId: string) {
    const resultado = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ApiChaveOrm);
      const atual = await repositorio.findOne({ where: { id: chaveId, tenantId, revogadaEm: IsNull() } });
      if (!atual) throw new NotFoundException('Chave de API ativa nao encontrada.');
      atual.revogadaEm = new Date();
      await repositorio.save(atual);
      return this.criarChaveNoGerenciador(
        gerenciador,
        tenantId,
        usuarioId,
        { nome: `${atual.nome} (rotacionada)`, escopos: atual.escopos },
        atual.expiraEm && atual.expiraEm > new Date() ? atual.expiraEm : undefined
      );
    });
    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'integracoes.chave.rotacionar',
      recursoTipo: 'api_chave',
      recursoId: resultado.chave.id,
      metadados: { chaveAnteriorId: chaveId, escopos: resultado.chave.escopos }
    });
    return resultado;
  }

  async revogarChave(tenantId: string, usuarioId: string, chaveId: string) {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const resultado = await gerenciador.getRepository(ApiChaveOrm).update(
        { id: chaveId, tenantId, revogadaEm: IsNull() },
        { revogadaEm: new Date() }
      );
      if (!resultado.affected) throw new NotFoundException('Chave de API ativa nao encontrada.');
    });
    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'integracoes.chave.revogar',
      recursoTipo: 'api_chave',
      recursoId: chaveId
    });
  }

  async listarWebhooks(tenantId: string) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const webhooks = await gerenciador
        .getRepository(WebhookAssinaturaOrm)
        .find({ where: { tenantId }, order: { criadoEm: 'DESC' }, take: 100 });
      return webhooks.map((webhook) => this.mapearWebhook(webhook));
    });
  }

  async criarWebhook(tenantId: string, usuarioId: string, dados: CriarWebhookDto) {
    await validarDestinoWebhook(dados.url);
    const segredo = `whsec_${randomBytes(32).toString('base64url')}`;
    const assinatura = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(WebhookAssinaturaOrm);
      return repositorio.save(
        repositorio.create({
          tenantId,
          nome: dados.nome.trim(),
          url: dados.url,
          eventos: [...new Set(dados.eventos)],
          segredoCriptografado: this.criptografia.criptografar(segredo),
          criadoPorUsuarioId: usuarioId,
          ativo: true
        })
      );
    });
    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'integracoes.webhook.criar',
      recursoTipo: 'webhook_assinatura',
      recursoId: assinatura.id,
      metadados: { eventos: assinatura.eventos, host: new URL(assinatura.url).hostname }
    });
    return { webhook: this.mapearWebhook(assinatura), segredo };
  }

  async rotacionarSegredoWebhook(tenantId: string, usuarioId: string, assinaturaId: string) {
    const segredo = `whsec_${randomBytes(32).toString('base64url')}`;
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const resultado = await gerenciador.getRepository(WebhookAssinaturaOrm).update(
        { id: assinaturaId, tenantId },
        { segredoCriptografado: this.criptografia.criptografar(segredo) }
      );
      if (!resultado.affected) throw new NotFoundException('Webhook nao encontrado.');
    });
    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'integracoes.webhook.rotacionar_segredo',
      recursoTipo: 'webhook_assinatura',
      recursoId: assinaturaId
    });
    return { segredo };
  }

  async desativarWebhook(tenantId: string, usuarioId: string, assinaturaId: string) {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const resultado = await gerenciador.getRepository(WebhookAssinaturaOrm).update(
        { id: assinaturaId, tenantId, ativo: true },
        { ativo: false }
      );
      if (!resultado.affected) throw new NotFoundException('Webhook ativo nao encontrado.');
    });
    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'integracoes.webhook.desativar',
      recursoTipo: 'webhook_assinatura',
      recursoId: assinaturaId
    });
  }

  async listarEntregas(tenantId: string) {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(WebhookEntregaOrm).find({ where: { tenantId }, order: { criadoEm: 'DESC' }, take: 100 })
    );
  }

  async reprocessarEntrega(tenantId: string, usuarioId: string, entregaId: string) {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const entrega = await gerenciador.getRepository(WebhookEntregaOrm).findOne({
        where: { id: entregaId, tenantId, status: 'falhou' }
      });
      if (!entrega) throw new NotFoundException('Entrega de webhook com falha nao encontrada.');
      entrega.status = 'pendente';
      entrega.tentativas = 0;
      entrega.proximaTentativaEm = new Date();
      entrega.ultimoErro = undefined;
      entrega.ultimoStatusHttp = undefined;
      entrega.entregueEm = undefined;
      await gerenciador.getRepository(WebhookEntregaOrm).save(entrega);
    });
    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'integracoes.webhook.reprocessar',
      recursoTipo: 'webhook_entrega',
      recursoId: entregaId
    });
  }

  private async criarChaveNoGerenciador(
    gerenciador: EntityManager,
    tenantId: string,
    usuarioId: string,
    dados: CriarChaveApiDto,
    expiraEm?: Date
  ) {
    const id = randomUUID();
    const segredo = randomBytes(32).toString('base64url');
    const valor = `octa_live.${tenantId}.${id}.${segredo}`;
    const prefixo = `octa_live_${segredo.slice(0, 10)}`;
    const repositorio = gerenciador.getRepository(ApiChaveOrm);
    const chave = await repositorio.save(
      repositorio.create({
        id,
        tenantId,
        nome: dados.nome.trim(),
        prefixo,
        segredoHash: createHash('sha256').update(segredo).digest('hex'),
        escopos: [...new Set(dados.escopos)],
        criadoPorUsuarioId: usuarioId,
        expiraEm
      })
    );
    return { chave: this.mapearChave(chave), valor };
  }

  private mapearChave(chave: ApiChaveOrm) {
    return {
      id: chave.id,
      nome: chave.nome,
      prefixo: chave.prefixo,
      escopos: chave.escopos,
      expiraEm: chave.expiraEm,
      ultimoUsoEm: chave.ultimoUsoEm,
      revogadaEm: chave.revogadaEm,
      criadoEm: chave.criadoEm
    };
  }

  private mapearWebhook(webhook: WebhookAssinaturaOrm) {
    return {
      id: webhook.id,
      nome: webhook.nome,
      url: webhook.url,
      eventos: webhook.eventos,
      ativo: webhook.ativo,
      criadoEm: webhook.criadoEm,
      atualizadoEm: webhook.atualizadoEm
    };
  }
}
