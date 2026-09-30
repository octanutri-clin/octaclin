import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ResponderConversaPortalPacienteDto } from '../aplicacao/dtos-conversa-portal-paciente';
import { ServicoConversaPortalPaciente } from '../aplicacao/servico-conversa-portal-paciente';

@Controller('comunicacoes/portal-paciente')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional', 'Collaborator', 'SuperAdmin')
@Permissoes('pacientes.ler', 'comunicacoes.mensagens.ler')
export class ControladorComunicacoesPortalPaciente {
  constructor(
    private readonly servicoConversa: ServicoConversaPortalPaciente,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get()
  listarFila(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('atrasadas') atrasadas?: string,
    @Query('pagina') pagina?: string,
    @Query('status') status?: string
  ) {
    const numeroPagina = pagina === undefined ? 0 : /^\d+$/.test(pagina) ? Number(pagina) : Number.NaN;
    return this.servicoConversa.listarFila(
      usuario.tenantId,
      usuario,
      atrasadas === 'true',
      numeroPagina,
      (status ?? 'aguardando_clinica') as 'aguardando_clinica' | 'aguardando_paciente' | 'encerrada' | 'todas'
    );
  }

  @Get(':conversaId')
  obterConversa(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('conversaId', ParseUUIDPipe) conversaId: string
  ) {
    return this.servicoConversa.obterConversaEquipe(usuario.tenantId, usuario, conversaId);
  }

  @Post(':conversaId/respostas')
  @Permissoes('comunicacoes.mensagens.enviar')
  async responder(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('conversaId', ParseUUIDPipe) conversaId: string,
    @Body() dados: ResponderConversaPortalPacienteDto
  ) {
    const conversa = await this.servicoConversa.responderEquipe(usuario.tenantId, usuario, conversaId, dados.texto);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'comunicacoes.portal_paciente.responder',
      recursoTipo: 'conversa_portal_paciente',
      recursoId: conversa.id,
      ip: requisicao.ip,
      userAgent: requisicao.get('user-agent')?.slice(0, 500),
      metadados: { status: conversa.status }
    });
    return conversa;
  }

  @Post(':conversaId/encerrar')
  @Permissoes('comunicacoes.mensagens.enviar')
  async encerrar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('conversaId', ParseUUIDPipe) conversaId: string
  ) {
    await this.servicoConversa.encerrarConversa(usuario.tenantId, usuario, conversaId);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'comunicacoes.portal_paciente.encerrar',
      recursoTipo: 'conversa_portal_paciente',
      recursoId: conversaId,
      ip: requisicao.ip,
      userAgent: requisicao.get('user-agent')?.slice(0, 500)
    });
    return { encerrada: true };
  }
}
