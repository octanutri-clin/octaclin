import { Injectable, NotFoundException } from '@nestjs/common';
import { Between, EntityManager, FindOptionsWhere, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ResultadoGoogleCalendar, ServicoGoogleCalendar } from '../../agenda/aplicacao/servico-google-calendar';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { PlanoSaasId, resolverPlanoSaas } from '../../clientes/dominio/planos-saas';
import { ProcessadorNotificacoes } from '../../comunicacoes/aplicacao/processador-notificacoes';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { SincronizacaoMobileOrm } from '../../mobile/infraestrutura/sincronizacao-mobile.orm';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';

const CHAVE_PLANO_SAAS = 'plano_saas';
const CHAVE_INTERESSE_ASSINATURA = 'assinatura_interesse';

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

export type OrigemFalhaComunicacao = 'mensagem' | 'outbox' | 'google_calendar';
export type CanalFalhaComunicacao = 'email' | 'whatsapp' | 'push' | 'google_calendar' | 'outbox' | 'outro';

export interface FiltrosFalhasComunicacao {
  origem?: OrigemFalhaComunicacao | '';
  canal?: CanalFalhaComunicacao | '';
  tipo?: string;
  inicio?: string;
  fim?: string;
  limite?: number;
  pagina?: number;
}

export interface FalhaComunicacaoOperacional {
  id: string;
  origem: OrigemFalhaComunicacao;
  canal: CanalFalhaComunicacao;
  tipo: string;
  referenciaId: string;
  pacienteId?: string;
  erro?: string;
  tentativas?: number;
  criadoEm: Date;
  reprocessavel: boolean;
  resumo?: string;
}

export interface ResumoFalhasComunicacao {
  total: number;
  email: number;
  whatsapp: number;
  googleCalendar: number;
  outbox: number;
  outras: number;
  reprocessaveis: number;
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

export interface SolicitacaoAssinaturaOperacional {
  tenantId: string;
  acao: 'upgrade' | 'downgrade' | 'revisao_limite';
  status: 'pendente' | 'concluida' | 'cancelada';
  planoAtualId: PlanoSaasId;
  planoAtual: string;
  planoDesejado?: PlanoSaasId;
  observacao?: string;
  solicitadoPorUsuarioId: string;
  solicitadoEm: string;
  planoAplicadoId?: PlanoSaasId;
  resolvidoPorUsuarioId?: string;
  resolvidoEm?: string;
  observacaoResolucao?: string;
}

export interface AplicarPlanoAssinaturaOperacional {
  planoId: PlanoSaasId;
  status?: 'ativa' | 'trial' | 'suspensa' | 'cancelada';
  renovacaoEm?: string;
  observacao?: string;
}

export interface AssinaturaManualOperacional {
  tenantId: string;
  planoId: PlanoSaasId;
  plano: string;
  status: string;
  origem: 'operacao_manual';
  renovacaoEm?: string;
  atualizadoPorUsuarioId: string;
  atualizadoEm: string;
}

export interface ResultadoPaginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  limite: number;
}

export interface ResultadoFalhasComunicacao extends ResultadoPaginado<FalhaComunicacaoOperacional> {
  resumo: ResumoFalhasComunicacao;
}

@Injectable()
export class ServicoOperacoes {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly processadorNotificacoes: ProcessadorNotificacoes,
    private readonly googleCalendar: ServicoGoogleCalendar
  ) {}

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

  async listarSolicitacoesAssinatura(
    tenantId: string,
    filtros: { pagina?: number; limite?: number } = {}
  ): Promise<ResultadoPaginado<SolicitacaoAssinaturaOperacional>> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const limite = this.normalizarLimite(filtros.limite ?? 25);
      const pagina = this.normalizarPagina(filtros.pagina ?? 1);
      const registros = await gerenciador.getRepository(TenantConfiguracaoOrm).find({
        where: { tenantId, chave: CHAVE_INTERESSE_ASSINATURA },
        order: { criadoEm: 'DESC' },
        take: limite,
        skip: (pagina - 1) * limite
      });

      return {
        itens: registros.map((registro) => this.mapearSolicitacaoAssinatura(tenantId, registro.valor)),
        total: registros.length,
        pagina,
        limite
      };
    });
  }

  async aplicarPlanoAssinatura(
    tenantId: string,
    usuarioId: string,
    dados: AplicarPlanoAssinaturaOperacional
  ): Promise<AssinaturaManualOperacional> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(TenantConfiguracaoOrm);
      const [configuracaoAtual, interesseAtual] = await Promise.all([
        repositorio.findOne({ where: { tenantId, chave: CHAVE_PLANO_SAAS } }),
        repositorio.findOne({ where: { tenantId, chave: CHAVE_INTERESSE_ASSINATURA } })
      ]);
      const plano = resolverPlanoSaas(dados.planoId);
      const atualizadoEm = new Date().toISOString();
      const renovacaoEm = this.textoOpcional(dados.renovacaoEm);
      const observacaoResolucao = this.textoOpcional(dados.observacao);
      const assinatura: AssinaturaManualOperacional = {
        tenantId,
        planoId: plano.id,
        plano: plano.nome,
        status: dados.status ?? 'ativa',
        origem: 'operacao_manual',
        ...(renovacaoEm ? { renovacaoEm } : {}),
        atualizadoPorUsuarioId: usuarioId,
        atualizadoEm
      };

      await repositorio.save(
        repositorio.create({
          id: configuracaoAtual?.id,
          tenantId,
          chave: CHAVE_PLANO_SAAS,
          valor: { ...assinatura },
          criadoEm: configuracaoAtual?.criadoEm
        })
      );

      if (interesseAtual) {
        const solicitacao = this.mapearSolicitacaoAssinatura(tenantId, interesseAtual.valor);
        await repositorio.save(
          repositorio.create({
            id: interesseAtual.id,
            tenantId,
            chave: CHAVE_INTERESSE_ASSINATURA,
            valor: {
              ...solicitacao,
              status: 'concluida',
              planoAplicadoId: plano.id,
              resolvidoPorUsuarioId: usuarioId,
              resolvidoEm: atualizadoEm,
              ...(observacaoResolucao ? { observacaoResolucao } : {})
            },
            criadoEm: interesseAtual.criadoEm
          })
        );
      }

      return assinatura;
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

  async listarFalhasComunicacao(
    tenantId: string,
    filtros: FiltrosFalhasComunicacao = {}
  ): Promise<ResultadoFalhasComunicacao> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const limite = this.normalizarLimite(filtros.limite ?? 25);
      const pagina = this.normalizarPagina(filtros.pagina ?? 1);
      const falhas = (await this.carregarFalhasComunicacao(gerenciador, tenantId, filtros)).sort(
        (a, b) => this.timestampData(b.criadoEm) - this.timestampData(a.criadoEm)
      );

      return {
        itens: falhas.slice((pagina - 1) * limite, pagina * limite),
        total: falhas.length,
        pagina,
        limite,
        resumo: this.resumirFalhasComunicacao(falhas)
      };
    });
  }

  async reprocessarFalhaComunicacao(tenantId: string, id: string): Promise<FalhaComunicacaoOperacional> {
    const [origem, referenciaId] = id.split(':');
    if (origem === 'mensagem') return this.reprocessarMensagemFalha(tenantId, referenciaId);
    if (origem === 'outbox') return this.mapearFalhaOutbox(await this.reprocessarOutbox(tenantId, referenciaId));
    if (origem === 'google_calendar') return this.reprocessarGoogleCalendar(tenantId, referenciaId);
    throw new NotFoundException('Falha de comunicacao nao encontrada.');
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

  private async carregarFalhasComunicacao(
    gerenciador: EntityManager,
    tenantId: string,
    filtros: FiltrosFalhasComunicacao
  ): Promise<FalhaComunicacaoOperacional[]> {
    const intervalo = this.normalizarIntervalo(filtros.inicio, filtros.fim);
    const [mensagens, outbox, consultas] = await Promise.all([
      gerenciador.getRepository(MensagemNotificacaoOrm).find({
        where: { tenantId, status: 'falhou', ...(intervalo ? { criadoEm: intervalo } : {}) },
        order: { criadoEm: 'DESC' },
        take: 500
      }),
      gerenciador.getRepository(OutboxEventoOrm).find({
        where: { tenantId, status: 'falhou', ...(intervalo ? { criadoEm: intervalo } : {}) },
        order: { criadoEm: 'DESC' },
        take: 500
      }),
      gerenciador.getRepository(AgendaConsultaOrm).find({
        where: { tenantId, ...(intervalo ? { atualizadoEm: intervalo } : {}) },
        order: { atualizadoEm: 'DESC' },
        take: 500
      })
    ]);
    const canalIds = mensagens.map((mensagem) => mensagem.canalId).filter((id): id is string => Boolean(id));
    const canais = canalIds.length
      ? await gerenciador.getRepository(CanalNotificacaoOrm).find({ where: { tenantId, id: In(canalIds) } })
      : [];
    const canaisPorId = new Map(canais.map((canal) => [canal.id, canal]));

    return [
      ...mensagens.map((mensagem) => this.mapearFalhaMensagem(mensagem, canaisPorId.get(mensagem.canalId ?? ''))),
      ...outbox.map((evento) => this.mapearFalhaOutbox(evento)),
      ...consultas.flatMap((consulta) => this.mapearFalhasGoogleCalendar(consulta))
    ]
      .filter((falha) => !filtros.origem || falha.origem === filtros.origem)
      .filter((falha) => !filtros.canal || falha.canal === filtros.canal)
      .filter((falha) => !filtros.tipo || falha.tipo === filtros.tipo);
  }

  private mapearFalhaMensagem(mensagem: MensagemNotificacaoOrm, canal?: CanalNotificacaoOrm): FalhaComunicacaoOperacional {
    return {
      id: `mensagem:${mensagem.id}`,
      origem: 'mensagem',
      canal: this.normalizarCanalFalha(canal?.tipo),
      tipo: this.textoPayload(mensagem.payload, 'evento') ?? 'mensagem_notificacao',
      referenciaId: mensagem.id,
      pacienteId: mensagem.pacienteId,
      erro: mensagem.erro,
      criadoEm: mensagem.criadoEm,
      reprocessavel: Boolean(mensagem.canalId && mensagem.templateId),
      resumo: this.resumirPayloadComunicacao(mensagem.payload)
    };
  }

  private mapearFalhaOutbox(evento: OutboxEventoOrm): FalhaComunicacaoOperacional {
    return {
      id: `outbox:${evento.id}`,
      origem: 'outbox',
      canal: 'outbox',
      tipo: evento.tipo,
      referenciaId: evento.id,
      erro: evento.erro,
      tentativas: evento.tentativas,
      criadoEm: evento.criadoEm,
      reprocessavel: true,
      resumo: this.resumirPayloadComunicacao(evento.payload)
    };
  }

  private mapearFalhasGoogleCalendar(consulta: AgendaConsultaOrm): FalhaComunicacaoOperacional[] {
    const google = this.objeto(consulta.notificacoes?.googleCalendar ?? consulta.payload?.googleCalendar);
    if (google.sincronizado !== false) return [];

    const motivo = typeof google.motivo === 'string' ? google.motivo : 'google_calendar';
    if (motivo === 'evento_google_ausente') return [];

    return [
      {
        id: `google_calendar:${consulta.id}`,
        origem: 'google_calendar',
        canal: 'google_calendar',
        tipo: motivo,
        referenciaId: consulta.id,
        pacienteId: consulta.pacienteId,
        erro: typeof google.erro === 'string' ? google.erro : motivo,
        criadoEm: consulta.atualizadoEm ?? consulta.criadoEm,
        reprocessavel: true,
        resumo: consulta.titulo
      }
    ];
  }

  private resumirFalhasComunicacao(falhas: FalhaComunicacaoOperacional[]): ResumoFalhasComunicacao {
    return falhas.reduce<ResumoFalhasComunicacao>(
      (resumo, falha) => {
        resumo.total += 1;
        resumo.reprocessaveis += falha.reprocessavel ? 1 : 0;
        if (falha.canal === 'email') resumo.email += 1;
        else if (falha.canal === 'whatsapp') resumo.whatsapp += 1;
        else if (falha.canal === 'google_calendar') resumo.googleCalendar += 1;
        else if (falha.canal === 'outbox') resumo.outbox += 1;
        else resumo.outras += 1;
        return resumo;
      },
      { total: 0, email: 0, whatsapp: 0, googleCalendar: 0, outbox: 0, outras: 0, reprocessaveis: 0 }
    );
  }

  private async reprocessarMensagemFalha(tenantId: string, mensagemId: string): Promise<FalhaComunicacaoOperacional> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(MensagemNotificacaoOrm);
      const mensagem = await repositorio.findOne({ where: { id: mensagemId, tenantId, status: 'falhou' } });
      if (!mensagem) throw new NotFoundException('Mensagem falha nao encontrada.');

      mensagem.status = 'pendente';
      mensagem.erro = undefined;
      mensagem.enviadoEm = undefined;
      await repositorio.save(mensagem);
      await this.processadorNotificacoes.processarMensagem(tenantId, mensagem.id, { propagarErro: false });

      const canal = mensagem.canalId
        ? await gerenciador.getRepository(CanalNotificacaoOrm).findOne({ where: { id: mensagem.canalId, tenantId } })
        : undefined;
      return this.mapearFalhaMensagem(mensagem, canal ?? undefined);
    });
  }

  private async reprocessarGoogleCalendar(tenantId: string, consultaId: string): Promise<FalhaComunicacaoOperacional> {
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(AgendaConsultaOrm);
      const consulta = await repositorio.findOne({ where: { id: consultaId, tenantId } });
      if (!consulta) throw new NotFoundException('Falha de Google Calendar nao encontrada.');

      const google = await this.executarSincronizacaoGoogle(consulta);
      if (google.sincronizado) {
        consulta.googleCalendarId = google.calendarId;
        consulta.googleEventId = google.eventId;
        consulta.googleEventHtmlLink = google.htmlLink ?? consulta.googleEventHtmlLink;
      }
      consulta.notificacoes = { ...(consulta.notificacoes ?? {}), googleCalendar: google };
      consulta.payload = { ...(consulta.payload ?? {}), googleCalendar: google };
      const salvo = await repositorio.save(consulta);
      return (
        this.mapearFalhasGoogleCalendar(salvo)[0] ?? {
          id: `google_calendar:${salvo.id}`,
          origem: 'google_calendar',
          canal: 'google_calendar',
          tipo: 'google_calendar_reprocessado',
          referenciaId: salvo.id,
          pacienteId: salvo.pacienteId,
          criadoEm: salvo.atualizadoEm ?? new Date(),
          reprocessavel: false,
          resumo: salvo.titulo
        }
      );
    });
  }

  private executarSincronizacaoGoogle(consulta: AgendaConsultaOrm): Promise<ResultadoGoogleCalendar> {
    const entrada = {
      resumo: consulta.titulo,
      descricao: this.montarDescricaoGoogleOperacional(consulta),
      inicioEm: consulta.inicioEm,
      fimEm: consulta.fimEm,
      timezone: consulta.timezone,
      local: consulta.local
    };
    if (consulta.status === 'cancelada' && consulta.googleCalendarId && consulta.googleEventId) {
      return this.googleCalendar.cancelarEvento({ calendarId: consulta.googleCalendarId, eventId: consulta.googleEventId });
    }
    if (consulta.googleCalendarId && consulta.googleEventId) {
      return this.googleCalendar.atualizarEvento({
        ...entrada,
        calendarId: consulta.googleCalendarId,
        eventId: consulta.googleEventId
      });
    }
    return this.googleCalendar.criarEvento(entrada);
  }

  private montarDescricaoGoogleOperacional(consulta: AgendaConsultaOrm): string {
    const pacienteNome = this.textoPayload(consulta.payload, 'pacienteNome');
    const profissionalNome = this.textoPayload(consulta.payload, 'profissionalNome');
    return [
      'Consulta registrada no OctaClin.',
      pacienteNome ? `Paciente: ${pacienteNome}` : undefined,
      profissionalNome ? `Profissional: ${profissionalNome}` : undefined,
      consulta.observacoes ? `Observacoes: ${consulta.observacoes}` : undefined
    ]
      .filter((linha): linha is string => Boolean(linha))
      .join('\n');
  }

  private normalizarCanalFalha(valor?: string): CanalFalhaComunicacao {
    if (valor === 'email' || valor === 'whatsapp' || valor === 'push') return valor;
    return 'outro';
  }

  private resumirPayloadComunicacao(payload: Record<string, unknown>): string | undefined {
    return (
      this.textoPayload(payload, 'evento') ??
      this.textoPayload(payload, 'mensagemId') ??
      this.textoPayload(payload, 'consultaId') ??
      this.textoPayload(payload, 'destino')
    );
  }

  private textoPayload(payload: Record<string, unknown> | undefined, chave: string): string | undefined {
    const valor = payload?.[chave];
    return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
  }

  private objeto(valor: unknown): Record<string, unknown> {
    return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
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

  private textoOpcional(valor: unknown): string | undefined {
    return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
  }

  private mapearSolicitacaoAssinatura(
    tenantId: string,
    valor?: Record<string, unknown>
  ): SolicitacaoAssinaturaOperacional {
    const planoAtual = resolverPlanoSaas(this.planoOpcional(valor?.planoAtualId) ?? 'gratuito');
    const planoDesejado = this.planoOpcional(valor?.planoDesejado);
    const planoAplicadoId = this.planoOpcional(valor?.planoAplicadoId);
    const status = valor?.status === 'concluida' || valor?.status === 'cancelada' ? valor.status : 'pendente';
    const observacao = this.metadadoTexto(valor, 'observacao');
    const resolvidoPorUsuarioId = this.metadadoTexto(valor, 'resolvidoPorUsuarioId');
    const resolvidoEm = this.metadadoTexto(valor, 'resolvidoEm');
    const observacaoResolucao = this.metadadoTexto(valor, 'observacaoResolucao');

    return {
      tenantId,
      acao: this.acaoAssinatura(valor?.acao),
      status,
      planoAtualId: planoAtual.id,
      planoAtual: this.metadadoTexto(valor, 'planoAtual') ?? planoAtual.nome,
      ...(planoDesejado ? { planoDesejado } : {}),
      ...(observacao ? { observacao } : {}),
      solicitadoPorUsuarioId: this.metadadoTexto(valor, 'solicitadoPorUsuarioId') ?? '',
      solicitadoEm: this.metadadoTexto(valor, 'solicitadoEm') ?? '',
      ...(planoAplicadoId ? { planoAplicadoId } : {}),
      ...(resolvidoPorUsuarioId ? { resolvidoPorUsuarioId } : {}),
      ...(resolvidoEm ? { resolvidoEm } : {}),
      ...(observacaoResolucao ? { observacaoResolucao } : {})
    };
  }

  private acaoAssinatura(valor: unknown): SolicitacaoAssinaturaOperacional['acao'] {
    if (valor === 'downgrade' || valor === 'revisao_limite') return valor;
    return 'upgrade';
  }

  private planoOpcional(valor: unknown): PlanoSaasId | undefined {
    if (valor === 'gratuito' || valor === 'profissional' || valor === 'clinica' || valor === 'enterprise') return valor;
    return undefined;
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
