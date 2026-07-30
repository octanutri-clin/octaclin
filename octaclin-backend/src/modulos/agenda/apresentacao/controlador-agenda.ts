import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  AprovarSolicitacaoAgendamentoDto,
  CancelarConsultaAgendaDto,
  ConsultarFeedAgendaDto,
  CriarBloqueioManualAgendaDto,
  CriarConsultaAgendaDto,
  RecusarSolicitacaoAgendamentoDto,
  RegistrarDesfechoConsultaAgendaDto,
  RemarcarConsultaAgendaDto
} from '../aplicacao/dtos';
import { ServicoAgendamentoPublico } from '../aplicacao/servico-agendamento-publico';
import { ServicoAgenda } from '../aplicacao/servico-agenda';

@Controller('agenda')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
@Permissoes('agenda.consultas.ler')
export class ControladorAgenda {
  constructor(
    private readonly servicoAgenda: ServicoAgenda,
    private readonly servicoAgendamentoPublico: ServicoAgendamentoPublico,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get('consultas')
  listarConsultas(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoAgenda.listarConsultas(usuario.tenantId, usuario);
  }

  @Get('feed')
  listarFeed(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() dados: ConsultarFeedAgendaDto) {
    return this.servicoAgenda.listarFeed(usuario.tenantId, dados, usuario);
  }

  @Post('bloqueios-manuais')
  @Permissoes('agenda.consultas.criar')
  async criarBloqueioManual(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarBloqueioManualAgendaDto
  ) {
    const bloqueio = await this.servicoAgenda.criarBloqueioManual(usuario.tenantId, dados, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'agenda.bloqueio_manual.criar',
      recursoTipo: 'agenda_bloqueio_manual',
      recursoId: bloqueio.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { profissionalId: bloqueio.profissionalId, tipo: dados.tipo, inicioEm: bloqueio.inicioEm, fimEm: bloqueio.fimEm }
    });
    return bloqueio;
  }

  @Delete('bloqueios-manuais/:bloqueioId')
  @Permissoes('agenda.consultas.criar')
  async removerBloqueioManual(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('bloqueioId', ParseUUIDPipe) bloqueioId: string
  ) {
    const resultado = await this.servicoAgenda.removerBloqueioManual(usuario.tenantId, bloqueioId, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'agenda.bloqueio_manual.remover',
      recursoTipo: 'agenda_bloqueio_manual',
      recursoId: bloqueioId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {}
    });
    return resultado;
  }

  @Get('agendamento-publico')
  listarLinksPublicos(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('profissionalId') profissionalId?: string
  ) {
    return this.servicoAgendamentoPublico.listarLinksPublicos(usuario.tenantId, usuario, profissionalId);
  }

  @Post('agendamento-publico/rotacionar')
  @Permissoes('agenda.consultas.criar')
  async rotacionarLinkPublico(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Query('profissionalId') profissionalId?: string
  ) {
    const link = await this.servicoAgendamentoPublico.rotacionarLinkPublico(usuario.tenantId, usuario, profissionalId);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'agenda.link_publico.rotacionar',
      recursoTipo: 'agenda_link_publico',
      recursoId: link.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        profissionalId: link.profissionalId,
        duracaoMinutos: link.duracaoMinutos
      }
    });
    return link;
  }

  @Get('solicitacoes')
  listarSolicitacoes(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('profissionalId') profissionalId?: string
  ) {
    return this.servicoAgendamentoPublico.listarSolicitacoes(usuario.tenantId, usuario, profissionalId);
  }

  @Post('solicitacoes/:solicitacaoId/aprovar')
  @Permissoes('agenda.consultas.criar')
  async aprovarSolicitacao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('solicitacaoId', ParseUUIDPipe) solicitacaoId: string,
    @Body() dados: AprovarSolicitacaoAgendamentoDto
  ) {
    const solicitacao = await this.servicoAgendamentoPublico.aprovarSolicitacao(
      usuario.tenantId,
      solicitacaoId,
      dados,
      usuario
    );
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'agenda.solicitacao.aprovar',
      recursoTipo: 'agenda_solicitacao',
      recursoId: solicitacao.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        profissionalId: solicitacao.profissionalId,
        pacienteId: solicitacao.pacienteId,
        consultaId: solicitacao.consultaId,
        inicioEm: solicitacao.inicioEm,
        fimEm: solicitacao.fimEm
      }
    });
    return solicitacao;
  }

  @Post('solicitacoes/:solicitacaoId/recusar')
  @Permissoes('agenda.consultas.criar')
  async recusarSolicitacao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('solicitacaoId', ParseUUIDPipe) solicitacaoId: string,
    @Body() dados: RecusarSolicitacaoAgendamentoDto
  ) {
    const solicitacao = await this.servicoAgendamentoPublico.recusarSolicitacao(
      usuario.tenantId,
      solicitacaoId,
      dados ?? {},
      usuario
    );
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'agenda.solicitacao.recusar',
      recursoTipo: 'agenda_solicitacao',
      recursoId: solicitacao.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        profissionalId: solicitacao.profissionalId,
        inicioEm: solicitacao.inicioEm,
        fimEm: solicitacao.fimEm,
        possuiMotivo: Boolean(dados?.motivo)
      }
    });
    return solicitacao;
  }

  @Post('consultas')
  @Permissoes('agenda.consultas.criar')
  async criarConsulta(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarConsultaAgendaDto
  ) {
    const consulta = await this.servicoAgenda.criarConsulta(usuario.tenantId, dados, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'agenda.consulta.criar',
      recursoTipo: 'agenda_consulta',
      recursoId: consulta.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        pacienteId: dados.pacienteId,
        profissionalId: dados.profissionalId,
        googleEventId: consulta.googleEventId,
        notificacoes: consulta.notificacoes
      }
    });
    return consulta;
  }

  @Patch('consultas/:consultaId')
  @Permissoes('agenda.consultas.criar')
  async remarcarConsulta(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('consultaId', ParseUUIDPipe) consultaId: string,
    @Body() dados: RemarcarConsultaAgendaDto
  ) {
    const consulta = await this.servicoAgenda.remarcarConsulta(usuario.tenantId, consultaId, dados, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'agenda.consulta.remarcar',
      recursoTipo: 'agenda_consulta',
      recursoId: consulta.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        inicioEm: consulta.inicioEm,
        fimEm: consulta.fimEm,
        googleEventId: consulta.googleEventId
      }
    });
    return consulta;
  }

  @Post('consultas/:consultaId/desfecho')
  @Permissoes('agenda.consultas.criar')
  async registrarDesfecho(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('consultaId', ParseUUIDPipe) consultaId: string,
    @Body() dados: RegistrarDesfechoConsultaAgendaDto
  ) {
    return this.registrarDesfechoComOrigem(usuario, requisicao, consultaId, dados, 'agenda');
  }

  @Post('dashboard/consultas/:consultaId/desfecho')
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('agenda.consultas.criar')
  async registrarDesfechoDashboard(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('consultaId', ParseUUIDPipe) consultaId: string,
    @Body() dados: RegistrarDesfechoConsultaAgendaDto
  ) {
    return this.registrarDesfechoComOrigem(
      usuario,
      requisicao,
      consultaId,
      dados,
      'dashboard_clinico'
    );
  }

  private async registrarDesfechoComOrigem(
    usuario: UsuarioAutenticado,
    requisicao: Request,
    consultaId: string,
    dados: RegistrarDesfechoConsultaAgendaDto,
    origem: 'agenda' | 'dashboard_clinico'
  ) {
    const consulta = await this.servicoAgenda.registrarDesfecho(usuario.tenantId, consultaId, dados, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'agenda.consulta.desfecho',
      recursoTipo: 'agenda_consulta',
      recursoId: consultaId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        status: dados.status,
        origem
      }
    });
    return consulta;
  }

  @Delete('consultas/:consultaId')
  @Permissoes('agenda.consultas.criar')
  async cancelarConsulta(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('consultaId', ParseUUIDPipe) consultaId: string,
    @Body() dados: CancelarConsultaAgendaDto
  ) {
    const consulta = await this.servicoAgenda.cancelarConsulta(usuario.tenantId, consultaId, dados ?? {}, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'agenda.consulta.cancelar',
      recursoTipo: 'agenda_consulta',
      recursoId: consulta.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        motivo: dados?.motivo,
        googleEventId: consulta.googleEventId
      }
    });
    return consulta;
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
