import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { EntityManager, In, IsNull } from 'typeorm';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { CriarChaveApiDto, CriarWebhookDto } from './dtos';
import { validarDestinoWebhook } from './seguranca-destino-webhook';
import { ApiChaveOrm } from '../infraestrutura/api-chave.orm';
import { WebhookAssinaturaOrm } from '../infraestrutura/webhook-assinatura.orm';
import { WebhookEntregaOrm } from '../infraestrutura/webhook-entrega.orm';
import { ServicoPermissoesIntegracao } from './servico-permissoes-integracao';
import { estaDentroDaConcessao } from '../dominio/politica-permissoes-integracoes';
import type { DominioPermissaoIntegracao } from '../infraestrutura/permissao-integracao-profissional.orm';

type AcessoProfissional = { usuarioId: string };

@Injectable()
export class ServicoGestaoIntegracoes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly auditoria: ServicoAuditoria,
    private readonly permissoesIntegracao: ServicoPermissoesIntegracao
  ) {}

  async listarChaves(tenantId: string, profissional?: AcessoProfissional) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const escoposPermitidos = profissional
        ? (await this.permissoesIntegracao.obterConcessaoNoGerenciador(gerenciador, tenantId, profissional.usuarioId, 'api')).escoposApi
        : undefined;
      const chaves = await gerenciador.getRepository(ApiChaveOrm).find({
        where: { tenantId, ...(profissional ? { profissionalUsuarioId: profissional.usuarioId } : {}) },
        order: { criadoEm: 'DESC' },
        take: 100
      });
      return chaves
        .filter((chave) => !profissional || (
          chave.profissionalUsuarioId === profissional.usuarioId &&
          estaDentroDaConcessao(chave.escopos, escoposPermitidos ?? [])
        ))
        .map((chave) => this.mapearChave(chave));
    });
  }

  async criarChave(tenantId: string, usuarioId: string, dados: CriarChaveApiDto, profissional?: AcessoProfissional) {
    const expiraEm = dados.expiraEm ? new Date(dados.expiraEm) : undefined;
    if (expiraEm && expiraEm <= new Date()) throw new BadRequestException('A expiracao da chave deve estar no futuro.');

    const resultado = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.validarEscoposNoGerenciador(gerenciador, tenantId, profissional, dados.escopos);
      return this.criarChaveNoGerenciador(gerenciador, tenantId, usuarioId, dados, expiraEm, profissional?.usuarioId);
    });
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

  async rotacionarChave(tenantId: string, usuarioId: string, chaveId: string, profissional?: AcessoProfissional) {
    const resultado = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ApiChaveOrm);
      const atual = await repositorio.findOne({ where: { id: chaveId, tenantId, revogadaEm: IsNull() } });
      if (!atual) throw new NotFoundException('Chave de API ativa nao encontrada.');
      this.exigirTitular(atual.profissionalUsuarioId, profissional);
      await this.validarEscoposNoGerenciador(gerenciador, tenantId, profissional, atual.escopos);
      atual.revogadaEm = new Date();
      await repositorio.save(atual);
      return this.criarChaveNoGerenciador(
        gerenciador,
        tenantId,
        usuarioId,
        { nome: `${atual.nome} (rotacionada)`, escopos: atual.escopos },
        atual.expiraEm && atual.expiraEm > new Date() ? atual.expiraEm : undefined,
        atual.profissionalUsuarioId
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

  async revogarChave(tenantId: string, usuarioId: string, chaveId: string, profissional?: AcessoProfissional) {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ApiChaveOrm);
      const chave = await repositorio.findOne({ where: { id: chaveId, tenantId, revogadaEm: IsNull() }, lock: { mode: 'pessimistic_write' } });
      if (!chave) throw new NotFoundException('Chave de API ativa nao encontrada.');
      this.exigirTitular(chave.profissionalUsuarioId, profissional);
      await this.validarEscoposNoGerenciador(gerenciador, tenantId, profissional, chave.escopos);
      chave.revogadaEm = new Date();
      await repositorio.save(chave);
    });
    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'integracoes.chave.revogar',
      recursoTipo: 'api_chave',
      recursoId: chaveId
    });
  }

  async listarWebhooks(tenantId: string, profissional?: AcessoProfissional) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const eventosPermitidos = profissional
        ? (await this.permissoesIntegracao.obterConcessaoNoGerenciador(gerenciador, tenantId, profissional.usuarioId, 'webhook')).eventosWebhook
        : undefined;
      const webhooks = await gerenciador
        .getRepository(WebhookAssinaturaOrm)
        .find({
          where: { tenantId, ...(profissional ? { profissionalUsuarioId: profissional.usuarioId } : {}) },
          order: { criadoEm: 'DESC' },
          take: 100
        });
      return webhooks
        .filter((webhook) => !profissional || (
          webhook.profissionalUsuarioId === profissional.usuarioId &&
          estaDentroDaConcessao(webhook.eventos, eventosPermitidos ?? [])
        ))
        .map((webhook) => this.mapearWebhook(webhook));
    });
  }

  async criarWebhook(tenantId: string, usuarioId: string, dados: CriarWebhookDto, profissional?: AcessoProfissional) {
    if (profissional) {
      const concessao = await this.permissoesIntegracao.obterAcessoAtual(tenantId, profissional.usuarioId);
      if (!estaDentroDaConcessao(dados.eventos, concessao.eventosWebhook)) {
        throw new NotFoundException('Eventos solicitados não estão disponíveis para esta integração.');
      }
    }
    await validarDestinoWebhook(dados.url);
    const segredo = `whsec_${randomBytes(32).toString('base64url')}`;
    const assinatura = await this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.validarEventosNoGerenciador(gerenciador, tenantId, profissional, dados.eventos);
      const repositorio = gerenciador.getRepository(WebhookAssinaturaOrm);
      return repositorio.save(
        repositorio.create({
          tenantId,
          nome: dados.nome.trim(),
          url: dados.url,
          eventos: [...new Set(dados.eventos)],
          segredoCriptografado: this.criptografia.criptografar(segredo),
          criadoPorUsuarioId: usuarioId,
          profissionalUsuarioId: profissional?.usuarioId,
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

  async rotacionarSegredoWebhook(tenantId: string, usuarioId: string, assinaturaId: string, profissional?: AcessoProfissional) {
    const segredo = `whsec_${randomBytes(32).toString('base64url')}`;
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(WebhookAssinaturaOrm);
      const webhook = await repositorio.findOne({ where: { id: assinaturaId, tenantId }, lock: { mode: 'pessimistic_write' } });
      if (!webhook) throw new NotFoundException('Webhook nao encontrado.');
      this.exigirTitular(webhook.profissionalUsuarioId, profissional);
      await this.validarEventosNoGerenciador(gerenciador, tenantId, profissional, webhook.eventos);
      webhook.segredoCriptografado = this.criptografia.criptografar(segredo);
      await repositorio.save(webhook);
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

  async desativarWebhook(tenantId: string, usuarioId: string, assinaturaId: string, profissional?: AcessoProfissional) {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(WebhookAssinaturaOrm);
      const webhook = await repositorio.findOne({ where: { id: assinaturaId, tenantId, ativo: true }, lock: { mode: 'pessimistic_write' } });
      if (!webhook) throw new NotFoundException('Webhook ativo nao encontrado.');
      this.exigirTitular(webhook.profissionalUsuarioId, profissional);
      await this.validarEventosNoGerenciador(gerenciador, tenantId, profissional, webhook.eventos);
      webhook.ativo = false;
      await repositorio.save(webhook);
    });
    await this.auditoria.registrar({
      tenantId,
      usuarioId,
      acao: 'integracoes.webhook.desativar',
      recursoTipo: 'webhook_assinatura',
      recursoId: assinaturaId
    });
  }

  async listarEntregas(tenantId: string, profissional?: AcessoProfissional) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const webhooks = await gerenciador.getRepository(WebhookAssinaturaOrm).find({
        where: { tenantId, ...(profissional ? { profissionalUsuarioId: profissional.usuarioId } : {}) }
      });
      const eventosPermitidos = profissional
        ? (await this.permissoesIntegracao.obterConcessaoNoGerenciador(gerenciador, tenantId, profissional.usuarioId, 'webhook')).eventosWebhook
        : undefined;
      const assinaturasPermitidas = webhooks.filter((webhook) =>
        !profissional || (
          webhook.profissionalUsuarioId === profissional.usuarioId &&
          estaDentroDaConcessao(webhook.eventos, eventosPermitidos ?? [])
        )
      ).map(({ id }) => id);
      if (!assinaturasPermitidas.length) return [];
      const entregas = await gerenciador.getRepository(WebhookEntregaOrm).find({
        where: { tenantId, assinaturaId: In(assinaturasPermitidas), ...(eventosPermitidos ? { evento: In(eventosPermitidos) } : {}) },
        order: { criadoEm: 'DESC' },
        take: 100
      });
      return entregas.map((entrega) => ({
        id: entrega.id,
        assinaturaId: entrega.assinaturaId,
        evento: entrega.evento,
        status: entrega.status,
        tentativas: entrega.tentativas,
        ultimoStatusHttp: entrega.ultimoStatusHttp,
        ultimoErro: entrega.ultimoErro ? 'A entrega falhou. Consulte o endpoint de destino e tente novamente.' : undefined,
        criadoEm: entrega.criadoEm
      }));
    });
  }

  async reprocessarEntrega(tenantId: string, usuarioId: string, entregaId: string, profissional?: AcessoProfissional) {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const entrega = await gerenciador.getRepository(WebhookEntregaOrm).findOne({
        where: { id: entregaId, tenantId, status: 'falhou' }
      });
      if (!entrega) throw new NotFoundException('Entrega de webhook com falha nao encontrada.');
      const webhook = await gerenciador.getRepository(WebhookAssinaturaOrm).findOne({ where: { id: entrega.assinaturaId, tenantId } });
      if (!webhook) throw new NotFoundException('Webhook da entrega não encontrado.');
      this.exigirTitular(webhook.profissionalUsuarioId, profissional);
      await this.validarEventosNoGerenciador(gerenciador, tenantId, profissional, webhook.eventos);
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

  private async validarEscoposNoGerenciador(
    gerenciador: EntityManager,
    tenantId: string,
    profissional: AcessoProfissional | undefined,
    escopos: readonly string[]
  ) {
    if (!profissional) return;
    const concessao = await this.permissoesIntegracao.obterConcessaoNoGerenciador(gerenciador, tenantId, profissional.usuarioId, 'api');
    if (!estaDentroDaConcessao(escopos, concessao.escoposApi)) {
      throw new NotFoundException('Escopos solicitados não estão disponíveis para esta integração.');
    }
  }

  private exigirTitular(titularUsuarioId: string | undefined, profissional?: AcessoProfissional): void {
    if (profissional && titularUsuarioId !== profissional.usuarioId) {
      throw new NotFoundException('Integração não encontrada.');
    }
  }

  private async validarEventosNoGerenciador(
    gerenciador: EntityManager,
    tenantId: string,
    profissional: AcessoProfissional | undefined,
    eventos: readonly string[]
  ) {
    if (!profissional) return;
    const concessao = await this.permissoesIntegracao.obterConcessaoNoGerenciador(gerenciador, tenantId, profissional.usuarioId, 'webhook');
    if (!estaDentroDaConcessao(eventos, concessao.eventosWebhook)) {
      throw new NotFoundException('Eventos solicitados não estão disponíveis para esta integração.');
    }
  }

  private async criarChaveNoGerenciador(
    gerenciador: EntityManager,
    tenantId: string,
    usuarioId: string,
    dados: CriarChaveApiDto,
    expiraEm?: Date,
    profissionalUsuarioId?: string
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
        profissionalUsuarioId,
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
