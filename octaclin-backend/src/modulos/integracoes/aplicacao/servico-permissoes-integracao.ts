import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { EVENTOS_WEBHOOK, ESCOPOS_API_PUBLICA, type EventoWebhook, type EscopoApiPublica } from '../dominio/contratos-integracao';
import { conjuntosEquivalentes } from '../dominio/politica-permissoes-integracoes';
import type { DominioPermissaoIntegracao } from '../infraestrutura/permissao-integracao-profissional.orm';
import { PermissaoIntegracaoProfissionalOrm } from '../infraestrutura/permissao-integracao-profissional.orm';

export interface DefinirPermissoesIntegracao {
  escoposApi: EscopoApiPublica[];
  eventosWebhook: EventoWebhook[];
}

export interface ConcessaoIntegracaoAtual {
  escoposApi: EscopoApiPublica[];
  eventosWebhook: EventoWebhook[];
}

@Injectable()
export class ServicoPermissoesIntegracao {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async listarParaGestor(tenantId: string) {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const profissionais = await gerenciador.getRepository(UsuarioOrm).find({
        where: { tenantId, role: 'Professional', ativo: true },
        order: { criadoEm: 'ASC' }
      });
      if (!profissionais.length) return [];

      const permissoes = await gerenciador.getRepository(PermissaoIntegracaoProfissionalOrm).find({
        where: { tenantId, usuarioId: In(profissionais.map(({ id }) => id)), revogadaEm: IsNull() },
        order: { concedidaEm: 'DESC' }
      });
      const porUsuario = new Map<string, ConcessaoIntegracaoAtual & {
        concedidaApiEm?: Date;
        concedidaWebhookEm?: Date;
        concedidaApiPorUsuarioId?: string;
        concedidaWebhookPorUsuarioId?: string;
      }>();

      for (const profissional of profissionais) {
        porUsuario.set(profissional.id, { escoposApi: [], eventosWebhook: [] });
      }
      for (const permissao of permissoes) {
        const estado = porUsuario.get(permissao.usuarioId);
        if (!estado) continue;
        if (permissao.tipo === 'api' && !estado.escoposApi.length) {
          estado.escoposApi = permissao.escoposApi;
          estado.concedidaApiEm = permissao.concedidaEm;
          estado.concedidaApiPorUsuarioId = permissao.concedidaPorUsuarioId;
        }
        if (permissao.tipo === 'webhook' && !estado.eventosWebhook.length) {
          estado.eventosWebhook = permissao.eventosWebhook;
          estado.concedidaWebhookEm = permissao.concedidaEm;
          estado.concedidaWebhookPorUsuarioId = permissao.concedidaPorUsuarioId;
        }
      }

      return [...porUsuario].map(([usuarioId, concessao]) => ({ usuarioId, ...concessao }));
    });
  }

  async obterAcessoAtual(tenantId: string, usuarioId: string): Promise<ConcessaoIntegracaoAtual> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.obterUsuarioProfissional(gerenciador, tenantId, usuarioId, 'pessimistic_read');
      const permissoes = gerenciador.getRepository(PermissaoIntegracaoProfissionalOrm);
      const [api, webhook] = await Promise.all([
        permissoes.findOne({ where: { tenantId, usuarioId, tipo: 'api', revogadaEm: IsNull() } }),
        permissoes.findOne({ where: { tenantId, usuarioId, tipo: 'webhook', revogadaEm: IsNull() } })
      ]);
      return { escoposApi: api?.escoposApi ?? [], eventosWebhook: webhook?.eventosWebhook ?? [] };
    });
  }

  async exigirAcesso(tenantId: string, usuarioId: string, tipo: DominioPermissaoIntegracao): Promise<void> {
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      await this.obterConcessaoNoGerenciador(gerenciador, tenantId, usuarioId, tipo);
    });
  }

  async obterConcessaoNoGerenciador(
    gerenciador: EntityManager,
    tenantId: string,
    usuarioId: string,
    tipo: DominioPermissaoIntegracao
  ): Promise<PermissaoIntegracaoProfissionalOrm> {
    await this.obterUsuarioProfissional(gerenciador, tenantId, usuarioId, 'pessimistic_read');
    const permissao = await gerenciador.getRepository(PermissaoIntegracaoProfissionalOrm).findOne({
      where: { tenantId, usuarioId, tipo, revogadaEm: IsNull() },
      lock: { mode: 'pessimistic_read' }
    });
    if (!permissao) throw new ForbiddenException('O gestor da clínica ainda não concedeu esse acesso.');
    return permissao;
  }

  async atualizar(
    tenantId: string,
    gestorId: string,
    usuarioId: string,
    dados: DefinirPermissoesIntegracao
  ): Promise<ConcessaoIntegracaoAtual> {
    this.validarConjuntos(dados);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const usuarios = gerenciador.getRepository(UsuarioOrm);
      const gestor = await usuarios.findOne({
        where: { id: gestorId, tenantId, role: 'Client', ativo: true },
        lock: { mode: 'pessimistic_read' }
      });
      if (!gestor) throw new ForbiddenException('Somente o gestor ativo da clínica pode conceder esses acessos.');

      const profissional = await this.obterUsuarioProfissional(gerenciador, tenantId, usuarioId, 'pessimistic_write');
      const escoposApi = [...new Set(dados.escoposApi)];
      const eventosWebhook = [...new Set(dados.eventosWebhook)];

      await this.substituirConcessao(gerenciador, {
        tenantId,
        usuarioId: profissional.id,
        gestorId,
        tipo: 'api',
        escoposApi,
        eventosWebhook: []
      });
      await this.substituirConcessao(gerenciador, {
        tenantId,
        usuarioId: profissional.id,
        gestorId,
        tipo: 'webhook',
        escoposApi: [],
        eventosWebhook
      });

      return { escoposApi, eventosWebhook };
    });
  }

  private async substituirConcessao(
    gerenciador: EntityManager,
    entrada: {
      tenantId: string;
      usuarioId: string;
      gestorId: string;
      tipo: DominioPermissaoIntegracao;
      escoposApi: EscopoApiPublica[];
      eventosWebhook: EventoWebhook[];
    }
  ) {
    const atual = await gerenciador.getRepository(PermissaoIntegracaoProfissionalOrm).findOne({
      where: { tenantId: entrada.tenantId, usuarioId: entrada.usuarioId, tipo: entrada.tipo, revogadaEm: IsNull() },
      lock: { mode: 'pessimistic_write' }
    });
    const novoConjunto = entrada.tipo === 'api' ? entrada.escoposApi : entrada.eventosWebhook;
    const conjuntoAtual = entrada.tipo === 'api' ? (atual?.escoposApi ?? []) : (atual?.eventosWebhook ?? []);
    if (conjuntosEquivalentes(conjuntoAtual, novoConjunto)) return;

    if (atual) {
      atual.revogadaEm = new Date();
      atual.revogadaPorUsuarioId = entrada.gestorId;
      await gerenciador.getRepository(PermissaoIntegracaoProfissionalOrm).save(atual);
      await registrarAuditoriaNaTransacao(gerenciador, {
        tenantId: entrada.tenantId,
        usuarioId: entrada.gestorId,
        acao: 'integracoes.permissao.revogar',
        recursoTipo: 'permissao_integracao_profissional',
        recursoId: atual.id,
        metadados: { tipo: entrada.tipo }
      });
    }
    if (!novoConjunto.length) return;

    const nova = gerenciador.getRepository(PermissaoIntegracaoProfissionalOrm).create({
      tenantId: entrada.tenantId,
      usuarioId: entrada.usuarioId,
      tipo: entrada.tipo,
      escoposApi: entrada.escoposApi,
      eventosWebhook: entrada.eventosWebhook,
      concedidaPorUsuarioId: entrada.gestorId
    });
    const salva = await gerenciador.getRepository(PermissaoIntegracaoProfissionalOrm).save(nova);
    await registrarAuditoriaNaTransacao(gerenciador, {
      tenantId: entrada.tenantId,
      usuarioId: entrada.gestorId,
      acao: 'integracoes.permissao.conceder',
      recursoTipo: 'permissao_integracao_profissional',
      recursoId: salva.id,
      metadados: { tipo: entrada.tipo }
    });
  }

  private async obterUsuarioProfissional(
    gerenciador: EntityManager,
    tenantId: string,
    usuarioId: string,
    modoLock: 'pessimistic_read' | 'pessimistic_write'
  ) {
    const usuario = await gerenciador.getRepository(UsuarioOrm).findOne({
      where: { id: usuarioId, tenantId, role: 'Professional', ativo: true },
      lock: { mode: modoLock }
    });
    if (!usuario) throw new NotFoundException('Profissional ativo deste tenant não encontrado.');
    return usuario;
  }

  private validarConjuntos(dados: DefinirPermissoesIntegracao): void {
    if (!Array.isArray(dados.escoposApi) || !Array.isArray(dados.eventosWebhook)) {
      throw new BadRequestException('Informe os escopos de API e eventos de webhook permitidos.');
    }
    if (
      dados.escoposApi.length > ESCOPOS_API_PUBLICA.length ||
      new Set(dados.escoposApi).size !== dados.escoposApi.length ||
      dados.escoposApi.some((item) => !ESCOPOS_API_PUBLICA.includes(item))
    ) {
      throw new BadRequestException('A lista de escopos de API é inválida.');
    }
    if (
      dados.eventosWebhook.length > EVENTOS_WEBHOOK.length ||
      new Set(dados.eventosWebhook).size !== dados.eventosWebhook.length ||
      dados.eventosWebhook.some((item) => !EVENTOS_WEBHOOK.includes(item))
    ) {
      throw new BadRequestException('A lista de eventos de webhook é inválida.');
    }
  }
}
