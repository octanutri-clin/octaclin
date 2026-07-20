import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AssociarContatoWhatsappDto, CriarCanalNotificacaoDto, CriarTemplateMensagemDto, DispararMensagemDto } from '../aplicacao/dtos';
import { ProcessadorNotificacoes } from '../aplicacao/processador-notificacoes';
import { ServicoComunicacoes } from '../aplicacao/servico-comunicacoes';

@Controller('comunicacoes')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorComunicacoes {
  constructor(
    private readonly servicoComunicacoes: ServicoComunicacoes,
    private readonly processadorNotificacoes: ProcessadorNotificacoes,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Post('canais')
  async criarCanal(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarCanalNotificacaoDto
  ) {
    const canal = await this.servicoComunicacoes.criarCanal(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'comunicacoes.canal.criar', 'canal_notificacao', canal.id, {
      tipo: dados.tipo,
      ativo: dados.ativo ?? true
    });
    return canal;
  }

  @Get('canais')
  listarCanais(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoComunicacoes.listarCanais(usuario.tenantId);
  }

  @Post('templates')
  async criarTemplate(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarTemplateMensagemDto
  ) {
    const template = await this.servicoComunicacoes.criarTemplate(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'comunicacoes.template.criar', 'template_mensagem', template.id, {
      canal: dados.canal,
      aprovado: dados.aprovado ?? false
    });
    return template;
  }

  @Get('templates')
  listarTemplates(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoComunicacoes.listarTemplates(usuario.tenantId);
  }

  @Get('mensagens')
  listarMensagens(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoComunicacoes.listarMensagens(usuario.tenantId);
  }

  @Post('mensagens')
  async dispararMensagem(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: DispararMensagemDto
  ) {
    const mensagem = await this.servicoComunicacoes.dispararMensagem(usuario.tenantId, dados);
    await this.processadorNotificacoes.processarMensagem(usuario.tenantId, mensagem.id, { propagarErro: false });
    await this.registrarAuditoria(usuario, requisicao, 'comunicacoes.mensagem.disparar', 'mensagem_notificacao', mensagem.id, {
      pacienteId: dados.pacienteId,
      canalId: dados.canalId,
      templateId: dados.templateId,
      status: mensagem.status
    });
    return mensagem;
  }

  @Post('whatsapp/associar-contato')
  async associarContatoWhatsapp(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AssociarContatoWhatsappDto
  ) {
    const resultado = await this.servicoComunicacoes.associarContatoWhatsapp(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'comunicacoes.whatsapp.associar_contato', 'paciente', dados.pacienteId, {
      contato: dados.contato,
      mensagensAtualizadas: resultado.mensagensAtualizadas
    });
    return resultado;
  }

  private registrarAuditoria(
    usuario: UsuarioAutenticado,
    requisicao: Request,
    acao: string,
    recursoTipo: string,
    recursoId?: string,
    metadados?: Record<string, unknown>
  ) {
    return this.servicoAuditoria.registrar({
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
