import { Injectable, NotFoundException } from '@nestjs/common';
import { Between, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { SincronizacaoMobileOrm } from '../../mobile/infraestrutura/sincronizacao-mobile.orm';

export interface ResumoOperacional {
  outbox: {
    pendente: number;
    processando: number;
    processado: number;
    falhou: number;
  };
  mobile: {
    sincronizado: number;
    erro: number;
  };
}

export interface FiltrosAuditoriaOperacional {
  acao?: string;
  recursoTipo?: string;
  recursoId?: string;
  usuarioId?: string;
  inicio?: string;
  fim?: string;
  limite?: number;
  pagina?: number;
}

export interface FiltrosOutboxOperacional {
  tipo?: string;
  inicio?: string;
  fim?: string;
  limite?: number;
  pagina?: number;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  limite: number;
}

@Injectable()
export class ServicoOperacoes {
  constructor(private readonly executorTenant: ExecutorTenant) {}

  async obterResumo(tenantId: string): Promise<ResumoOperacional> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const outbox = gerenciador.getRepository(OutboxEventoOrm);
      const mobile = gerenciador.getRepository(SincronizacaoMobileOrm);

      const [pendente, processando, processado, falhou, sincronizado, erro] = await Promise.all([
        outbox.count({ where: { tenantId, status: 'pendente' } }),
        outbox.count({ where: { tenantId, status: 'processando' } }),
        outbox.count({ where: { tenantId, status: 'processado' } }),
        outbox.count({ where: { tenantId, status: 'falhou' } }),
        mobile.count({ where: { tenantId, status: 'sincronizado' } }),
        mobile.count({ where: { tenantId, status: 'erro' } })
      ]);

      return {
        outbox: { pendente, processando, processado, falhou },
        mobile: { sincronizado, erro }
      };
    });
  }

  async listarFalhasOutbox(tenantId: string, limite = 50): Promise<OutboxEventoOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(OutboxEventoOrm).find({
        where: { tenantId, status: 'falhou' },
        order: { criadoEm: 'DESC' },
        take: this.normalizarLimite(limite)
      })
    );
  }

  async listarFalhasOutboxPaginado(
    tenantId: string,
    filtros: FiltrosOutboxOperacional = {}
  ): Promise<ResultadoPaginado<OutboxEventoOrm>> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const where = this.criarWhereOutbox(tenantId, filtros);
      const limite = this.normalizarLimite(filtros.limite ?? 50);
      const pagina = this.normalizarPagina(filtros.pagina ?? 1);
      const [itens, total] = await gerenciador.getRepository(OutboxEventoOrm).findAndCount({
        where,
        order: { criadoEm: 'DESC' },
        take: limite,
        skip: (pagina - 1) * limite
      });

      return { itens, total, pagina, limite };
    });
  }

  async reprocessarOutbox(tenantId: string, eventoId: string): Promise<OutboxEventoOrm> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(OutboxEventoOrm);
      const evento = await repositorio.findOne({ where: { id: eventoId, tenantId, status: 'falhou' } });
      if (!evento) throw new NotFoundException('Evento de outbox falho nao encontrado.');

      evento.status = 'pendente';
      evento.erro = undefined;
      evento.processadoEm = undefined;
      return repositorio.save(evento);
    });
  }

  async listarSincronizacoesMobile(tenantId: string, limite = 50): Promise<SincronizacaoMobileOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(SincronizacaoMobileOrm).find({
        where: { tenantId },
        order: { criadoEm: 'DESC' },
        take: this.normalizarLimite(limite)
      })
    );
  }

  async listarAuditoria(tenantId: string, filtros: FiltrosAuditoriaOperacional = {}): Promise<UserActionLogOrm[]> {
    return this.executorTenant.executar(tenantId, (gerenciador) => {
      return gerenciador.getRepository(UserActionLogOrm).find({
        where: this.criarWhereAuditoria(tenantId, filtros),
        order: { criadoEm: 'DESC' },
        take: this.normalizarLimite(filtros.limite ?? 50)
      });
    });
  }

  async listarAuditoriaPaginada(
    tenantId: string,
    filtros: FiltrosAuditoriaOperacional = {}
  ): Promise<ResultadoPaginado<UserActionLogOrm>> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const limite = this.normalizarLimite(filtros.limite ?? 50);
      const pagina = this.normalizarPagina(filtros.pagina ?? 1);
      const [itens, total] = await gerenciador.getRepository(UserActionLogOrm).findAndCount({
        where: this.criarWhereAuditoria(tenantId, filtros),
        order: { criadoEm: 'DESC' },
        take: limite,
        skip: (pagina - 1) * limite
      });

      return { itens, total, pagina, limite };
    });
  }

  async exportarAuditoriaCsv(tenantId: string, filtros: FiltrosAuditoriaOperacional = {}): Promise<string> {
    const eventos = await this.listarAuditoria(tenantId, { ...filtros, limite: this.normalizarLimiteExportacao(filtros.limite) });
    return this.montarCsv(
      ['criadoEm', 'acao', 'recursoTipo', 'recursoId', 'usuarioId', 'ip', 'metadados'],
      eventos.map((evento) => [
        this.serializarData(evento.criadoEm),
        evento.acao,
        evento.recursoTipo ?? '',
        evento.recursoId ?? '',
        evento.usuarioId ?? '',
        evento.ip ?? '',
        this.serializarMetadados(evento.metadados)
      ])
    );
  }

  async exportarFalhasOutboxCsv(tenantId: string, filtros: FiltrosOutboxOperacional = {}): Promise<string> {
    const resultado = await this.listarFalhasOutboxPaginado(tenantId, {
      ...filtros,
      pagina: 1,
      limite: this.normalizarLimiteExportacao(filtros.limite)
    });
    return this.montarCsv(
      ['criadoEm', 'tipo', 'status', 'tentativas', 'erro', 'mensagemId'],
      resultado.itens.map((evento) => [
        this.serializarData(evento.criadoEm),
        evento.tipo,
        evento.status,
        String(evento.tentativas),
        evento.erro ?? '',
        typeof evento.payload?.mensagemId === 'string' ? evento.payload.mensagemId : ''
      ])
    );
  }

  private criarWhereAuditoria(tenantId: string, filtros: FiltrosAuditoriaOperacional): FindOptionsWhere<UserActionLogOrm> {
    const where: FindOptionsWhere<UserActionLogOrm> = { tenantId };
    const intervalo = this.normalizarIntervalo(filtros.inicio, filtros.fim);

    if (filtros.acao) where.acao = filtros.acao;
    if (filtros.recursoTipo) where.recursoTipo = filtros.recursoTipo;
    if (filtros.recursoId) where.recursoId = filtros.recursoId;
    if (filtros.usuarioId) where.usuarioId = filtros.usuarioId;
    if (intervalo) where.criadoEm = intervalo;
    return where;
  }

  private criarWhereOutbox(tenantId: string, filtros: FiltrosOutboxOperacional): FindOptionsWhere<OutboxEventoOrm> {
    const where: FindOptionsWhere<OutboxEventoOrm> = { tenantId, status: 'falhou' };
    const intervalo = this.normalizarIntervalo(filtros.inicio, filtros.fim);

    if (filtros.tipo) where.tipo = filtros.tipo;
    if (intervalo) where.criadoEm = intervalo;
    return where;
  }

  private normalizarLimite(limite: number): number {
    if (!Number.isFinite(limite)) return 50;
    return Math.min(Math.max(Math.trunc(limite), 1), 100);
  }

  private normalizarLimiteExportacao(limite?: number): number {
    if (!limite || !Number.isFinite(limite)) return 500;
    return Math.min(Math.max(Math.trunc(limite), 1), 1000);
  }

  private normalizarPagina(pagina: number): number {
    if (!Number.isFinite(pagina)) return 1;
    return Math.max(Math.trunc(pagina), 1);
  }

  private normalizarIntervalo(inicioValor?: string, fimValor?: string) {
    const inicio = this.normalizarData(inicioValor);
    const fim = this.normalizarData(fimValor);

    if (inicio && fim) return Between(inicio, fim);
    if (inicio) return MoreThanOrEqual(inicio);
    if (fim) return LessThanOrEqual(fim);
    return undefined;
  }

  private normalizarData(valor?: string): Date | undefined {
    if (!valor) return undefined;
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? undefined : data;
  }

  private montarCsv(cabecalho: string[], linhas: unknown[][]): string {
    const conteudo = [cabecalho, ...linhas].map((linha) => linha.map((valor) => this.escaparCsv(valor)).join(',')).join('\n');
    return `${conteudo}\n`;
  }

  private escaparCsv(valor: unknown): string {
    const seguro = String(valor ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
    return `"${seguro}"`;
  }

  private serializarData(valor?: Date): string {
    if (!valor) return '';
    return valor instanceof Date ? valor.toISOString() : String(valor);
  }

  private serializarMetadados(metadados?: Record<string, unknown>): string {
    const pares = Object.entries(metadados ?? {}).filter(([, valor]) => ['string', 'number', 'boolean'].includes(typeof valor));
    return pares.map(([chave, valor]) => `${chave}=${String(valor)}`).join(';');
  }
}
