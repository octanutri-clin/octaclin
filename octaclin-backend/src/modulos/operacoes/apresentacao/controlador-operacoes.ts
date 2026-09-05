import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoOperacoes } from '../aplicacao/servico-operacoes';
import { AtualizarCicloVidaTenantDto, ProvisionarTenantDto } from '../aplicacao/dtos-ciclo-vida-tenant';
import { ServicoCicloVidaTenant } from '../aplicacao/servico-ciclo-vida-tenant';
import { ServicoRolloutOperacional } from '../aplicacao/servico-rollout-operacional';
import { ServicoFeatureFlags } from '../../../infraestrutura/feature-flags/servico-feature-flags';
import { ServicoMenorPrivilegioProviders } from '../../../infraestrutura/seguranca/servico-menor-privilegio-providers';
import { contarLinhasCsv } from '../../../infraestrutura/exportacao/csv';

class AtualizarSolicitacaoLgpdOperacionalDto {
  @IsIn(['em_tratamento', 'concluida', 'indeferida'])
  status: 'em_tratamento' | 'concluida' | 'indeferida';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detalhes?: string;
}

class AplicarPlanoAssinaturaOperacionalDto {
  @IsIn(['gratuito', 'profissional', 'clinica', 'enterprise'])
  planoId: 'gratuito' | 'profissional' | 'clinica' | 'enterprise';

  @IsOptional()
  @IsIn(['ativa', 'trial', 'suspensa', 'cancelada'])
  status?: 'ativa' | 'trial' | 'suspensa' | 'cancelada';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  renovacaoEm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}

class AtualizarFeatureFlagsDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsBoolean()
  iaClinica?: boolean;

  @IsOptional()
  @IsBoolean()
  mobileSync?: boolean;
}

@Controller('operacoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin')
@Permissoes('operacoes.auditoria.ler')
export class ControladorOperacoes {
  constructor(
    private readonly servicoOperacoes: ServicoOperacoes,
    private readonly cicloVidaTenant: ServicoCicloVidaTenant,
    private readonly auditoria: ServicoAuditoria,
    private readonly rollout: ServicoRolloutOperacional,
    private readonly featureFlags: ServicoFeatureFlags,
    private readonly menorPrivilegio: ServicoMenorPrivilegioProviders
  ) {}

  @Get('resumo')
  obterResumo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoOperacoes.obterResumo(usuario.tenantId);
  }

  /**
   * Estado de menor privilegio dos providers (PR 51), medido no processo real.
   *
   * Fica aqui, atras de SuperAdmin, e nao em `/health/detalhado`, porque aquele
   * endpoint e publico: dizer a um anonimo que a role do runtime tem BYPASSRLS
   * seria entregar o mapa. A avaliacao e refeita a cada chamada para que a
   * evidencia acompanhe a configuracao corrente, nao a do ultimo boot.
   */
  @Get('providers')
  obterMenorPrivilegioProviders() {
    return this.menorPrivilegio.avaliar();
  }

  @Get('alertas')
  listarAlertasOperacionais(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoOperacoes.listarAlertasOperacionais(usuario.tenantId);
  }

  @Get('rollout')
  obterRollout(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.rollout.obter(usuario.tenantId);
  }

  @Post('feature-flags')
  @Permissoes('operacoes.tenants.gerenciar')
  async atualizarFeatureFlags(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AtualizarFeatureFlagsDto
  ) {
    const resultado = await this.featureFlags.atualizar(dados.tenantId, {
      ...(dados.iaClinica !== undefined ? { 'ia.clinica': dados.iaClinica } : {}),
      ...(dados.mobileSync !== undefined ? { 'mobile.sync': dados.mobileSync } : {})
    });
    await this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'operacoes.feature_flags.atualizar',
      recursoTipo: 'tenant',
      recursoId: dados.tenantId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        tenantAlvoId: dados.tenantId,
        flagsAlteradas: Object.keys({
          ...(dados.iaClinica !== undefined ? { 'ia.clinica': dados.iaClinica } : {}),
          ...(dados.mobileSync !== undefined ? { 'mobile.sync': dados.mobileSync } : {})
        })
      }
    });
    return resultado;
  }

  @Get('feature-flags/:tenantId')
  @Permissoes('operacoes.tenants.gerenciar')
  listarFeatureFlags(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.featureFlags.listar(tenantId);
  }

  @Get('outbox/falhas')
  listarFalhasOutbox(@UsuarioAtual() usuario: UsuarioAutenticado, @Query('limite') limite?: string) {
    return this.servicoOperacoes.listarFalhasOutbox(usuario.tenantId, Number(limite ?? 50));
  }

  @Get('outbox/falhas/paginada')
  listarFalhasOutboxPaginadas(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('tipo') tipo?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.servicoOperacoes.listarFalhasOutboxPaginado(usuario.tenantId, {
      tipo,
      inicio,
      fim,
      pagina: Number(pagina ?? 1),
      limite: Number(limite ?? 50)
    });
  }

  @Get('outbox/falhas/exportar.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="octaclin-outbox-falhas.csv"')
  async exportarFalhasOutboxCsv(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Query('tipo') tipo?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('limite') limite?: string
  ) {
    const csv = await this.servicoOperacoes.exportarFalhasOutboxCsv(usuario.tenantId, {
      tipo,
      inicio,
      fim,
      limite: Number(limite ?? 500)
    });
    await this.registrarExportacao(requisicao, usuario, 'operacoes.outbox_falhas.exportar_csv', 'outbox_evento', csv, {
      filtroTipo: tipo ?? null,
      periodoInicio: inicio ?? null,
      periodoFim: fim ?? null,
      limiteSolicitado: Number(limite ?? 500)
    });
    return csv;
  }

  @Post('outbox/:id/reprocessar')
  @Permissoes('operacoes.outbox.reprocessar')
  async reprocessarOutbox(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id') id: string
  ) {
    const evento = await this.servicoOperacoes.reprocessarOutbox(usuario.tenantId, id);
    await this.registrarAuditoria(requisicao, usuario, 'operacoes.outbox.reprocessar', 'outbox_evento', id, {
      tipo: evento.tipo,
      status: evento.status,
      tentativas: evento.tentativas
    });
    return evento;
  }

  @Get('comunicacoes/falhas')
  listarFalhasComunicacao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('origem') origem?: 'mensagem' | 'outbox' | 'google_calendar',
    @Query('canal') canal?: 'email' | 'whatsapp' | 'push' | 'google_calendar' | 'outbox' | 'outro',
    @Query('tipo') tipo?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.servicoOperacoes.listarFalhasComunicacao(usuario.tenantId, {
      origem,
      canal,
      tipo,
      inicio,
      fim,
      pagina: Number(pagina ?? 1),
      limite: Number(limite ?? 25)
    });
  }

  @Post('comunicacoes/falhas/:id/reprocessar')
  @Permissoes('operacoes.outbox.reprocessar')
  async reprocessarFalhaComunicacao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id') id: string
  ) {
    const falha = await this.servicoOperacoes.reprocessarFalhaComunicacao(usuario.tenantId, id);
    await this.registrarAuditoria(
      requisicao,
      usuario,
      'operacoes.comunicacoes_falha.reprocessar',
      'falha_comunicacao',
      id,
      {
        origem: falha.origem,
        canal: falha.canal,
        tipo: falha.tipo,
        referenciaId: falha.referenciaId,
        pacienteId: falha.pacienteId,
        tentativas: falha.tentativas
      }
    );
    return falha;
  }

  @Get('mobile/sincronizacoes')
  listarSincronizacoesMobile(@UsuarioAtual() usuario: UsuarioAutenticado, @Query('limite') limite?: string) {
    return this.servicoOperacoes.listarSincronizacoesMobile(usuario.tenantId, Number(limite ?? 50));
  }

  @Get('assinaturas/solicitacoes')
  listarSolicitacoesAssinatura(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.servicoOperacoes.listarSolicitacoesAssinatura(usuario.tenantId, {
      pagina: Number(pagina ?? 1),
      limite: Number(limite ?? 25)
    });
  }

  @Post('assinaturas/plano')
  async aplicarPlanoAssinatura(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AplicarPlanoAssinaturaOperacionalDto
  ) {
    const assinatura = await this.servicoOperacoes.aplicarPlanoAssinatura(usuario.tenantId, usuario.usuarioId, dados);
    await this.registrarAuditoria(requisicao, usuario, 'operacoes.assinatura.aplicar_plano', 'tenant', usuario.tenantId, {
      planoId: assinatura.planoId,
      status: assinatura.status,
      origem: assinatura.origem,
      renovacaoEm: assinatura.renovacaoEm,
      // So o fato de haver observacao; o texto e livre e escrito por operador.
      houveTextoLivre: Boolean(dados.observacao?.trim())
    });
    return assinatura;
  }

  @Get('tenants')
  @Permissoes('operacoes.tenants.gerenciar')
  listarTenants() {
    return this.cicloVidaTenant.listar();
  }

  @Post('tenants')
  @Permissoes('operacoes.tenants.gerenciar')
  async provisionarTenant(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: ProvisionarTenantDto
  ) {
    const resultado = await this.cicloVidaTenant.provisionar(dados, usuario.usuarioId);
    await this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: resultado.reutilizado ? 'operacoes.tenant.provisionamento_reutilizado' : 'operacoes.tenant.provisionar',
      recursoTipo: 'tenant',
      recursoId: resultado.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        tenantAlvoId: resultado.id,
        planoId: resultado.planoId,
        cicloVidaStatus: resultado.cicloVidaStatus,
        conviteStatus: resultado.convite?.status
      }
    });
    return resultado;
  }

  @Post('tenants/:id/ciclo-vida')
  @Permissoes('operacoes.tenants.gerenciar')
  async atualizarCicloVidaTenant(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) tenantId: string,
    @Body() dados: AtualizarCicloVidaTenantDto
  ) {
    const resultado = await this.cicloVidaTenant.atualizarCicloVida(tenantId, usuario.usuarioId, dados);
    await this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: `operacoes.tenant.${dados.acao}`,
      recursoTipo: 'tenant',
      recursoId: tenantId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        tenantAlvoId: tenantId,
        cicloVidaStatus: resultado.cicloVidaStatus,
        exportacaoConfirmada: dados.acao === 'encerrar' ? dados.exportacaoConfirmada === true : undefined,
        protocoloExportacao: dados.acao === 'encerrar' ? dados.protocoloExportacao : undefined,
        motivoInformado: Boolean(dados.motivo?.trim())
      }
    });
    return resultado;
  }

  @Get('lgpd/solicitacoes')
  listarSolicitacoesLgpd(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('status') status?: 'recebida' | 'em_tratamento' | 'concluida' | 'indeferida',
    @Query('tipo') tipo?: 'retificacao' | 'exclusao',
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.servicoOperacoes.listarSolicitacoesLgpd(usuario.tenantId, {
      status,
      tipo,
      pagina: Number(pagina ?? 1),
      limite: Number(limite ?? 25)
    });
  }

  @Get('lgpd/retencao')
  obterRetencaoDados(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoOperacoes.obterRetencaoDados(usuario.tenantId);
  }

  @Post('lgpd/retencao/programar')
  async programarRetencaoDados(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request) {
    const programacao = await this.servicoOperacoes.programarRetencaoDados(usuario.tenantId, usuario.usuarioId);
    await this.registrarAuditoria(
      requisicao,
      usuario,
      'operacoes.lgpd_retencao.programar',
      'retencao_dados',
      programacao.protocolo,
      {
        protocolo: programacao.protocolo,
        status: programacao.status,
        totalItensVencidos: programacao.totalItensVencidos
      }
    );
    return programacao;
  }

  @Post('lgpd/solicitacoes/:protocolo/status')
  async atualizarSolicitacaoLgpd(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('protocolo') protocolo: string,
    @Body() dados: AtualizarSolicitacaoLgpdOperacionalDto
  ) {
    const solicitacao = await this.servicoOperacoes.atualizarSolicitacaoLgpd(
      usuario.tenantId,
      usuario.usuarioId,
      protocolo,
      dados
    );
    await this.registrarAuditoria(
      requisicao,
      usuario,
      'operacoes.lgpd_solicitacao.atualizar_status',
      'solicitacao_lgpd',
      protocolo,
      {
        protocolo,
        pacienteId: solicitacao.pacienteId,
        tipo: solicitacao.tipo,
        status: solicitacao.status,
        // O texto da tratativa fica na solicitacao, nao na trilha: e redacao
        // livre do operador sobre o caso clinico de um titular identificado.
        detalhesInformados: Boolean(dados.detalhes?.trim())
      }
    );
    return solicitacao;
  }

  @Get('lgpd/solicitacoes/:protocolo')
  obterDetalheSolicitacaoLgpd(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('protocolo') protocolo: string) {
    return this.servicoOperacoes.obterDetalheSolicitacaoLgpd(usuario.tenantId, protocolo);
  }

  @Get('lgpd/solicitacoes/:protocolo/exportar.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportarSolicitacaoLgpdCsv(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('protocolo') protocolo: string
  ) {
    const csv = await this.servicoOperacoes.exportarSolicitacaoLgpdCsv(usuario.tenantId, protocolo);
    await this.registrarExportacao(
      requisicao,
      usuario,
      'operacoes.lgpd_solicitacao.exportar_csv',
      'solicitacao_lgpd',
      csv,
      { protocolo }
    );
    return csv;
  }

  @Post('lgpd/solicitacoes/:protocolo/resposta')
  async prepararRespostaSolicitacaoLgpd(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('protocolo') protocolo: string
  ) {
    const resposta = await this.servicoOperacoes.prepararRespostaSolicitacaoLgpd(
      usuario.tenantId,
      usuario.usuarioId,
      protocolo
    );
    await this.registrarAuditoria(
      requisicao,
      usuario,
      'operacoes.lgpd_solicitacao.preparar_resposta',
      'solicitacao_lgpd',
      protocolo,
      {
        protocolo,
        pacienteId: resposta.pacienteId,
        status: resposta.status,
        canaisSugeridos: resposta.canaisSugeridos
        // `assuntoEmail`, `corpoEmail` e `textoWhatsapp` ficam de fora: sao a
        // comunicacao pronta para o titular, com o caso dele por extenso.
      }
    );
    return resposta;
  }

  /**
   * Decisao de escopo (PR 52, fase 1c): a leitura paginada da trilha nao e
   * auditada; a exportacao e.
   *
   * Auditar toda abertura de tela de console produziria uma linha por refresh
   * de painel, e o volume dessas linhas afogaria o evento que importa. O sinal
   * de exfiltracao nao esta em olhar a tela: esta em levar o arquivo. Por isso
   * `GET auditoria` e `GET auditoria/paginada` seguem sem registro, e
   * `exportar.csv` -- abaixo -- registra volume e filtros.
   */
  @Get('auditoria')
  listarAuditoria(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('acao') acao?: string,
    @Query('recursoTipo') recursoTipo?: string,
    @Query('recursoId') recursoId?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('limite') limite?: string
  ) {
    return this.servicoOperacoes.listarAuditoria(usuario.tenantId, {
      acao,
      recursoTipo,
      recursoId,
      usuarioId,
      inicio,
      fim,
      limite: Number(limite ?? 50)
    });
  }

  @Get('auditoria/paginada')
  listarAuditoriaPaginada(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('acao') acao?: string,
    @Query('recursoTipo') recursoTipo?: string,
    @Query('recursoId') recursoId?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string
  ) {
    return this.servicoOperacoes.listarAuditoriaPaginada(usuario.tenantId, {
      acao,
      recursoTipo,
      recursoId,
      usuarioId,
      inicio,
      fim,
      pagina: Number(pagina ?? 1),
      limite: Number(limite ?? 50)
    });
  }

  /**
   * Exportacao da propria trilha -- e o unico endpoint do sistema em que deixar
   * de auditar apaga o rastro de quem levou o rastro de todo mundo.
   *
   * Sem este registro, um SuperAdmin baixa `user_action_logs` inteiro e a
   * unica coisa que a trilha guarda sobre o episodio e o silencio. O evento
   * gravado aqui e recursivo de proposito: ele entra na mesma tabela que
   * acabou de ser exportada, e portanto aparece na *proxima* exportacao.
   */
  @Get('auditoria/exportar.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="octaclin-auditoria.csv"')
  async exportarAuditoriaCsv(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Query('acao') acao?: string,
    @Query('recursoTipo') recursoTipo?: string,
    @Query('recursoId') recursoId?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('limite') limite?: string
  ) {
    const csv = await this.servicoOperacoes.exportarAuditoriaCsv(usuario.tenantId, {
      acao,
      recursoTipo,
      recursoId,
      usuarioId,
      inicio,
      fim,
      limite: Number(limite ?? 500)
    });
    await this.registrarExportacao(
      requisicao,
      usuario,
      'operacoes.auditoria.exportar_csv',
      'user_action_log',
      csv,
      {
        filtroAcao: acao ?? null,
        filtroRecursoTipo: recursoTipo ?? null,
        recursoAlvoId: recursoId ?? null,
        usuarioAlvoId: usuarioId ?? null,
        periodoInicio: inicio ?? null,
        periodoFim: fim ?? null,
        limiteSolicitado: Number(limite ?? 500),
        // Varredura = sem periodo e sem alvo. E o formato de quem esta levando
        // o acervo, e nao consultando um caso; sem esta marca, a diferenca so
        // apareceria para quem recompusesse os filtros a mao.
        semFiltro: !acao && !recursoTipo && !recursoId && !usuarioId && !inicio && !fim
      }
    );
    return csv;
  }

  /**
   * Auditoria das exportacoes de console.
   *
   * Grava volume e filtros, nunca o conteudo. O CSV exportado leva a trilha (ou
   * a fila de falhas, ou o dossie LGPD de um titular) linha a linha; copiar
   * isso para `metadados` faria o registro do acesso conter o dado acessado, e
   * a trilha viraria a segunda copia do vazamento que ela deveria denunciar.
   *
   * Volume e filtro sao justamente o que separa a consulta pontual da
   * varredura: `totalLinhas` alto com periodo aberto e o formato da
   * exfiltracao, e e a unica forma de a trilha registrar a diferenca sem
   * guardar uma linha do que foi levado.
   */
  private registrarExportacao(
    requisicao: Request,
    usuario: UsuarioAutenticado,
    acao: string,
    recursoTipo: string,
    csv: string,
    filtros: Record<string, unknown>
  ) {
    return this.registrarAuditoria(requisicao, usuario, acao, recursoTipo, undefined, {
      ...filtros,
      totalLinhas: contarLinhasCsv(csv),
      tamanhoBytes: Buffer.byteLength(csv, 'utf8')
    });
  }

  /**
   * Ponto unico de auditoria do console operacional.
   *
   * Nao ha `try`/`catch` aqui de proposito: `ServicoAuditoria.registrar` ja
   * engole a propria falha e apenas contabiliza, entao uma trilha indisponivel
   * nunca derruba a acao de operacao. Repetir a protecao aqui so esconderia um
   * erro de programacao neste arquivo.
   */
  private registrarAuditoria(
    requisicao: Request,
    usuario: UsuarioAutenticado,
    acao: string,
    recursoTipo: string,
    recursoId?: string,
    metadados?: Record<string, unknown>
  ) {
    return this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao,
      recursoTipo,
      recursoId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados
    });
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
