import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoOperacoes } from '../aplicacao/servico-operacoes';
import { AtualizarCicloVidaTenantDto, ProvisionarTenantDto } from '../aplicacao/dtos-ciclo-vida-tenant';
import { ServicoCicloVidaTenant } from '../aplicacao/servico-ciclo-vida-tenant';

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

@Controller('operacoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin')
@Permissoes('operacoes.auditoria.ler')
export class ControladorOperacoes {
  constructor(
    private readonly servicoOperacoes: ServicoOperacoes,
    private readonly cicloVidaTenant: ServicoCicloVidaTenant,
    private readonly auditoria: ServicoAuditoria
  ) {}

  @Get('resumo')
  obterResumo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoOperacoes.obterResumo(usuario.tenantId);
  }

  @Get('alertas')
  listarAlertasOperacionais(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoOperacoes.listarAlertasOperacionais(usuario.tenantId);
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
  exportarFalhasOutboxCsv(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('tipo') tipo?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('limite') limite?: string
  ) {
    return this.servicoOperacoes.exportarFalhasOutboxCsv(usuario.tenantId, {
      tipo,
      inicio,
      fim,
      limite: Number(limite ?? 500)
    });
  }

  @Post('outbox/:id/reprocessar')
  @Permissoes('operacoes.outbox.reprocessar')
  reprocessarOutbox(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id') id: string) {
    return this.servicoOperacoes.reprocessarOutbox(usuario.tenantId, id);
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
  reprocessarFalhaComunicacao(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id') id: string) {
    return this.servicoOperacoes.reprocessarFalhaComunicacao(usuario.tenantId, id);
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
  aplicarPlanoAssinatura(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dados: AplicarPlanoAssinaturaOperacionalDto
  ) {
    return this.servicoOperacoes.aplicarPlanoAssinatura(usuario.tenantId, usuario.usuarioId, dados);
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
  programarRetencaoDados(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoOperacoes.programarRetencaoDados(usuario.tenantId, usuario.usuarioId);
  }

  @Post('lgpd/solicitacoes/:protocolo/status')
  atualizarSolicitacaoLgpd(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('protocolo') protocolo: string,
    @Body() dados: AtualizarSolicitacaoLgpdOperacionalDto
  ) {
    return this.servicoOperacoes.atualizarSolicitacaoLgpd(usuario.tenantId, usuario.usuarioId, protocolo, dados);
  }

  @Get('lgpd/solicitacoes/:protocolo')
  obterDetalheSolicitacaoLgpd(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('protocolo') protocolo: string) {
    return this.servicoOperacoes.obterDetalheSolicitacaoLgpd(usuario.tenantId, protocolo);
  }

  @Get('lgpd/solicitacoes/:protocolo/exportar.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportarSolicitacaoLgpdCsv(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('protocolo') protocolo: string) {
    return this.servicoOperacoes.exportarSolicitacaoLgpdCsv(usuario.tenantId, protocolo);
  }

  @Post('lgpd/solicitacoes/:protocolo/resposta')
  prepararRespostaSolicitacaoLgpd(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('protocolo') protocolo: string) {
    return this.servicoOperacoes.prepararRespostaSolicitacaoLgpd(usuario.tenantId, usuario.usuarioId, protocolo);
  }

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

  @Get('auditoria/exportar.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="octaclin-auditoria.csv"')
  exportarAuditoriaCsv(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('acao') acao?: string,
    @Query('recursoTipo') recursoTipo?: string,
    @Query('recursoId') recursoId?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
    @Query('limite') limite?: string
  ) {
    return this.servicoOperacoes.exportarAuditoriaCsv(usuario.tenantId, {
      acao,
      recursoTipo,
      recursoId,
      usuarioId,
      inicio,
      fim,
      limite: Number(limite ?? 500)
    });
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
