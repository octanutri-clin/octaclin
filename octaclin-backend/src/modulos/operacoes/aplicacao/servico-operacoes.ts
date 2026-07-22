import { Injectable, NotFoundException } from '@nestjs/common';
import { Between, EntityManager, FindOptionsWhere, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
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

export type StatusSolicitacaoLgpd = 'recebida' | 'em_tratamento' | 'concluida' | 'indeferida';
export type TipoSolicitacaoLgpd = 'retificacao' | 'exclusao';

export interface FiltrosSolicitacoesLgpd {
  status?: StatusSolicitacaoLgpd | '';
  tipo?: TipoSolicitacaoLgpd | '';
  limite?: number;
  pagina?: number;
}

export interface SolicitacaoLgpdOperacional {
  protocolo: string;
  pacienteId: string;
  usuarioPacienteId: string;
  tipo: TipoSolicitacaoLgpd;
  status: StatusSolicitacaoLgpd;
  detalhes?: string;
  abertoEm: Date;
  atualizadoEm: Date;
  responsavelId?: string;
  ultimaTratativa?: string;
}

export interface EventoSolicitacaoLgpdOperacional {
  id: string;
  tipo: string;
  status: StatusSolicitacaoLgpd;
  detalhes?: string;
  responsavelId?: string;
  criadoEm: Date;
}

export interface DetalheSolicitacaoLgpdOperacional extends SolicitacaoLgpdOperacional {
  historico: EventoSolicitacaoLgpdOperacional[];
}

export interface RespostaSolicitacaoLgpdOperacional {
  protocolo: string;
  pacienteId: string;
  status: StatusSolicitacaoLgpd;
  assuntoEmail: string;
  corpoEmail: string;
  textoWhatsapp: string;
  canaisSugeridos: ('email' | 'whatsapp')[];
  geradoEm: Date;
}

export interface AtualizarSolicitacaoLgpdOperacional {
  status: Exclude<StatusSolicitacaoLgpd, 'recebida'>;
  detalhes?: string;
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

  async listarSolicitacoesLgpd(
    tenantId: string,
    filtros: FiltrosSolicitacoesLgpd = {}
  ): Promise<ResultadoPaginado<SolicitacaoLgpdOperacional>> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const eventos = await this.carregarEventosSolicitacoesLgpd(gerenciador, tenantId);
      const pagina = this.normalizarPagina(filtros.pagina ?? 1);
      const limite = this.normalizarLimite(filtros.limite ?? 25);
      const solicitacoes = this.consolidarSolicitacoesLgpd(eventos)
        .filter((solicitacao) => !filtros.status || solicitacao.status === filtros.status)
        .filter((solicitacao) => !filtros.tipo || solicitacao.tipo === filtros.tipo)
        .sort((a, b) => b.atualizadoEm.getTime() - a.atualizadoEm.getTime());

      return {
        itens: solicitacoes.slice((pagina - 1) * limite, pagina * limite),
        total: solicitacoes.length,
        pagina,
        limite
      };
    });
  }

  async atualizarSolicitacaoLgpd(
    tenantId: string,
    usuarioId: string,
    protocolo: string,
    dados: AtualizarSolicitacaoLgpdOperacional
  ): Promise<SolicitacaoLgpdOperacional> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const eventos = await this.carregarEventosSolicitacoesLgpd(gerenciador, tenantId);
      const solicitacao = this.consolidarSolicitacoesLgpd(eventos).find((item) => item.protocolo === protocolo);
      if (!solicitacao) throw new NotFoundException('Solicitacao LGPD nao encontrada.');

      const agora = new Date();
      const repositorio = gerenciador.getRepository(ConsentimentoLgpdOrm);
      await repositorio.save(
        repositorio.create({
          tenantId,
          usuarioId,
          tipo: 'tratativa_lgpd',
          versao: '2026-09',
          aceitoEm: agora,
          metadados: {
            pacienteId: solicitacao.pacienteId,
            protocolo,
            status: dados.status,
            responsavelId: usuarioId,
            detalhes: dados.detalhes?.trim() || undefined
          }
        })
      );

      return {
        ...solicitacao,
        status: dados.status,
        atualizadoEm: agora,
        responsavelId: usuarioId,
        ultimaTratativa: dados.detalhes?.trim() || solicitacao.ultimaTratativa
      };
    });
  }

  async obterDetalheSolicitacaoLgpd(tenantId: string, protocolo: string): Promise<DetalheSolicitacaoLgpdOperacional> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const eventos = await this.carregarEventosSolicitacoesLgpd(gerenciador, tenantId);
      return this.montarDetalheSolicitacaoLgpd(eventos, protocolo);
    });
  }

  async exportarSolicitacaoLgpdCsv(tenantId: string, protocolo: string): Promise<string> {
    const detalhe = await this.obterDetalheSolicitacaoLgpd(tenantId, protocolo);
    return this.montarCsv(
      ['protocolo', 'pacienteId', 'tipo', 'status', 'criadoEm', 'responsavelId', 'detalhes'],
      detalhe.historico.map((evento) => [
        detalhe.protocolo,
        detalhe.pacienteId,
        detalhe.tipo,
        evento.status,
        this.serializarData(evento.criadoEm),
        evento.responsavelId ?? '',
        evento.detalhes ?? ''
      ])
    );
  }

  async prepararRespostaSolicitacaoLgpd(
    tenantId: string,
    usuarioId: string,
    protocolo: string
  ): Promise<RespostaSolicitacaoLgpdOperacional> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const eventos = await this.carregarEventosSolicitacoesLgpd(gerenciador, tenantId);
      const detalhe = this.montarDetalheSolicitacaoLgpd(eventos, protocolo);
      const resposta = this.montarRespostaSolicitacaoLgpd(detalhe);
      const repositorio = gerenciador.getRepository(ConsentimentoLgpdOrm);

      await repositorio.save(
        repositorio.create({
          tenantId,
          usuarioId,
          tipo: 'resposta_lgpd_preparada',
          versao: '2026-09',
          aceitoEm: resposta.geradoEm,
          metadados: {
            pacienteId: detalhe.pacienteId,
            protocolo,
            status: detalhe.status,
            responsavelId: usuarioId,
            assuntoEmail: resposta.assuntoEmail,
            canaisSugeridos: resposta.canaisSugeridos
          }
        })
      );

      return resposta;
    });
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

  private carregarEventosSolicitacoesLgpd(gerenciador: EntityManager, tenantId: string) {
    return gerenciador.getRepository(ConsentimentoLgpdOrm).find({
      where: {
        tenantId,
        tipo: In(['solicitacao_lgpd_retificacao', 'solicitacao_lgpd_exclusao', 'tratativa_lgpd'])
      },
      order: { aceitoEm: 'DESC' }
    });
  }

  private consolidarSolicitacoesLgpd(eventos: ConsentimentoLgpdOrm[]): SolicitacaoLgpdOperacional[] {
    const solicitacoes = new Map<string, SolicitacaoLgpdOperacional>();
    [...eventos]
      .sort((a, b) => this.timestampData(a.aceitoEm) - this.timestampData(b.aceitoEm))
      .forEach((evento) => {
        const protocolo = this.metadadoTexto(evento.metadados, 'protocolo');
        if (!protocolo) return;

        if (evento.tipo.startsWith('solicitacao_lgpd_')) {
          const tipo = evento.tipo.replace('solicitacao_lgpd_', '') as TipoSolicitacaoLgpd;
          if (tipo !== 'retificacao' && tipo !== 'exclusao') return;

          solicitacoes.set(protocolo, {
            protocolo,
            pacienteId: this.metadadoTexto(evento.metadados, 'pacienteId') ?? '',
            usuarioPacienteId: evento.usuarioId,
            tipo,
            status: this.normalizarStatusLgpd(this.metadadoTexto(evento.metadados, 'status')),
            detalhes: this.metadadoTexto(evento.metadados, 'detalhes'),
            abertoEm: evento.aceitoEm,
            atualizadoEm: evento.aceitoEm
          });
          return;
        }

        if (evento.tipo !== 'tratativa_lgpd') return;
        const solicitacao = solicitacoes.get(protocolo);
        if (!solicitacao) return;

        solicitacao.status = this.normalizarStatusLgpd(this.metadadoTexto(evento.metadados, 'status'));
        solicitacao.atualizadoEm = evento.aceitoEm;
        solicitacao.responsavelId = this.metadadoTexto(evento.metadados, 'responsavelId') ?? evento.usuarioId;
        solicitacao.ultimaTratativa = this.metadadoTexto(evento.metadados, 'detalhes') ?? solicitacao.ultimaTratativa;
      });

    return Array.from(solicitacoes.values());
  }

  private montarDetalheSolicitacaoLgpd(eventos: ConsentimentoLgpdOrm[], protocolo: string): DetalheSolicitacaoLgpdOperacional {
    const solicitacao = this.consolidarSolicitacoesLgpd(eventos).find((item) => item.protocolo === protocolo);
    if (!solicitacao) throw new NotFoundException('Solicitacao LGPD nao encontrada.');

    const historico = [...eventos]
      .filter((evento) => this.metadadoTexto(evento.metadados, 'protocolo') === protocolo)
      .sort((a, b) => this.timestampData(a.aceitoEm) - this.timestampData(b.aceitoEm))
      .map((evento) => ({
        id: evento.id,
        tipo: evento.tipo,
        status: this.normalizarStatusLgpd(this.metadadoTexto(evento.metadados, 'status')),
        detalhes: this.metadadoTexto(evento.metadados, 'detalhes'),
        responsavelId: this.metadadoTexto(evento.metadados, 'responsavelId'),
        criadoEm: evento.aceitoEm
      }));

    return { ...solicitacao, historico };
  }

  private montarRespostaSolicitacaoLgpd(detalhe: DetalheSolicitacaoLgpdOperacional): RespostaSolicitacaoLgpdOperacional {
    const mensagemStatus = this.mensagemRespostaPorStatus(detalhe.status);
    const assuntoEmail = `Atualizacao da solicitacao LGPD ${detalhe.protocolo}`;
    const corpoEmail = [
      `Ola,`,
      '',
      `${mensagemStatus(detalhe.protocolo)}`,
      '',
      `Tipo da solicitacao: ${detalhe.tipo === 'retificacao' ? 'retificacao de dados' : 'exclusao de dados'}.`,
      `Protocolo: ${detalhe.protocolo}.`,
      '',
      'Qualquer duvida, responda esta mensagem para falarmos sobre o atendimento.',
      '',
      'Equipe OctaClin'
    ].join('\n');

    return {
      protocolo: detalhe.protocolo,
      pacienteId: detalhe.pacienteId,
      status: detalhe.status,
      assuntoEmail,
      corpoEmail,
      textoWhatsapp: `${mensagemStatus(detalhe.protocolo)} Protocolo: ${detalhe.protocolo}.`,
      canaisSugeridos: ['email', 'whatsapp'],
      geradoEm: new Date()
    };
  }

  private mensagemRespostaPorStatus(status: StatusSolicitacaoLgpd): (protocolo: string) => string {
    const mensagens: Record<StatusSolicitacaoLgpd, (protocolo: string) => string> = {
      recebida: (protocolo) => `Recebemos seu pedido LGPD ${protocolo} e ele ja esta registrado para atendimento.`,
      em_tratamento: (protocolo) => `Seu pedido LGPD ${protocolo} esta em tratamento.`,
      concluida: (protocolo) => `Seu pedido LGPD ${protocolo} foi concluido.`,
      indeferida: (protocolo) => `Seu pedido LGPD ${protocolo} foi analisado e nao pode ser atendido integralmente neste momento.`
    };
    return mensagens[status];
  }

  private metadadoTexto(metadados: Record<string, unknown> | undefined, chave: string): string | undefined {
    const valor = metadados?.[chave];
    return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
  }

  private normalizarStatusLgpd(status?: string): StatusSolicitacaoLgpd {
    if (status === 'em_tratamento' || status === 'concluida' || status === 'indeferida') return status;
    return 'recebida';
  }

  private timestampData(valor?: Date): number {
    if (!valor) return 0;
    return valor instanceof Date ? valor.getTime() : new Date(valor).getTime();
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
