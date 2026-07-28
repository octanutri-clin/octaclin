import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoAgenda } from '../../agenda/aplicacao/servico-agenda';
import {
  AtualizarPerfilPacientePortalDto,
  RegistrarCheckinRapidoPortalDto,
  RegistrarConsentimentoLgpdPortalDto,
  RegistrarSolicitacaoLgpdPortalDto
} from '../aplicacao/dtos';
import { ServicoPortalPaciente } from '../aplicacao/servico-portal-paciente';

@Controller('portal')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('Patient')
export class ControladorPortalPaciente {
  constructor(
    private readonly servicoPortal: ServicoPortalPaciente,
    private readonly servicoAgenda: ServicoAgenda,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get('paciente')
  obterResumo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoPortal.obterResumoPortal(usuario.tenantId, usuario.usuarioId);
  }

  @Post('paciente/checkins')
  async registrarCheckinRapido(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: RegistrarCheckinRapidoPortalDto
  ) {
    const checkin = await this.servicoPortal.registrarCheckinRapido(usuario.tenantId, usuario.usuarioId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'portal.paciente.checkin_rapido.registrar',
      recursoTipo: 'log_diario_rapido',
      recursoId: checkin.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        pacienteId: checkin.pacienteId,
        humor: checkin.humor,
        adesaoPlano: checkin.adesaoPlano,
        possuiSintomas: Boolean(dados.sintomas?.trim()),
        possuiObservacoes: Boolean(dados.observacoes?.trim())
      }
    });
    return checkin;
  }

  @Patch('paciente/perfil')
  async atualizarPerfil(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AtualizarPerfilPacientePortalDto
  ) {
    const perfil = await this.servicoPortal.atualizarPerfil(usuario.tenantId, usuario.usuarioId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'portal.paciente.perfil.atualizar',
      recursoTipo: 'paciente',
      recursoId: perfil.paciente.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        campos: Object.keys(dados).filter((campo) => dados[campo as keyof AtualizarPerfilPacientePortalDto] !== undefined)
      }
    });
    return perfil;
  }

  @Post('paciente/lgpd/consentimentos')
  async registrarConsentimentoLgpd(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: RegistrarConsentimentoLgpdPortalDto
  ) {
    const resultado = await this.servicoPortal.registrarConsentimentoLgpd(usuario.tenantId, usuario.usuarioId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'portal.paciente.lgpd.consentimento_registrar',
      recursoTipo: 'paciente',
      recursoId: resultado.paciente.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        versaoLgpd: dados.versaoLgpd,
        preferenciasContato: {
          email: dados.prefereEmail,
          whatsapp: dados.prefereWhatsapp
        }
      }
    });
    return resultado;
  }

  @Get('paciente/lgpd/exportacao')
  async exportarDadosLgpd(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request) {
    const exportacao = await this.servicoPortal.exportarDadosLgpd(usuario.tenantId, usuario.usuarioId);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'portal.paciente.lgpd.exportar_dados',
      recursoTipo: 'paciente',
      recursoId: exportacao.titular.pacienteId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        formato: exportacao.formato,
        categorias: exportacao.escopo.categorias,
        geradoEm: exportacao.geradoEm,
        hashIntegridade: exportacao.integridade.hash
      }
    });
    return exportacao;
  }

  @Post('paciente/lgpd/solicitacoes')
  async registrarSolicitacaoLgpd(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: RegistrarSolicitacaoLgpdPortalDto
  ) {
    const solicitacao = await this.servicoPortal.registrarSolicitacaoLgpd(usuario.tenantId, usuario.usuarioId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'portal.paciente.lgpd.solicitacao_registrar',
      recursoTipo: 'paciente',
      recursoId: solicitacao.pacienteId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        protocolo: solicitacao.protocolo,
        tipo: solicitacao.tipo,
        status: solicitacao.status,
        possuiDetalhes: Boolean(dados.detalhes?.trim())
      }
    });
    return solicitacao;
  }

  @Get('paciente/formularios-respondidos/:respostaId')
  obterFormularioRespondido(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('respostaId', ParseUUIDPipe) respostaId: string
  ) {
    return this.servicoPortal.obterFormularioRespondido(usuario.tenantId, usuario.usuarioId, respostaId);
  }

  @Post('paciente/consultas/:consultaId/desmarcar')
  async desmarcarConsulta(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('consultaId', ParseUUIDPipe) consultaId: string
  ) {
    const consulta = await this.servicoAgenda.desmarcarConsultaPeloPaciente(
      usuario.tenantId,
      consultaId,
      usuario.usuarioId
    );
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'portal.paciente.consulta.desmarcar',
      recursoTipo: 'agenda_consulta',
      recursoId: consulta.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        origem: 'paciente'
      }
    });
    return consulta;
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
