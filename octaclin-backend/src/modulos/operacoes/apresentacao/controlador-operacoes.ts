import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoOperacoes } from '../aplicacao/servico-operacoes';

class AtualizarSolicitacaoLgpdOperacionalDto {
  @IsIn(['em_tratamento', 'concluida', 'indeferida'])
  status: 'em_tratamento' | 'concluida' | 'indeferida';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detalhes?: string;
}

@Controller('operacoes')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('SuperAdmin')
export class ControladorOperacoes {
  constructor(private readonly servicoOperacoes: ServicoOperacoes) {}

  @Get('resumo')
  obterResumo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoOperacoes.obterResumo(usuario.tenantId);
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
  reprocessarOutbox(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id') id: string) {
    return this.servicoOperacoes.reprocessarOutbox(usuario.tenantId, id);
  }

  @Get('mobile/sincronizacoes')
  listarSincronizacoesMobile(@UsuarioAtual() usuario: UsuarioAutenticado, @Query('limite') limite?: string) {
    return this.servicoOperacoes.listarSincronizacoesMobile(usuario.tenantId, Number(limite ?? 50));
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
}
