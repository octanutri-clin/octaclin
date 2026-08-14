import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtivarConvitePacienteDto, CriarConvitePacienteDto } from '../aplicacao/dtos';
import { ServicoConvitesPaciente } from '../aplicacao/servico-convites-paciente';

@Controller()
export class ControladorConvitesPaciente {
  constructor(
    private readonly servicoConvites: ServicoConvitesPaciente,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Post('pacientes/:id/convites-acesso')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin', 'Professional', 'Collaborator')
  @Permissoes('pacientes.gerenciar')
  async criarConvite(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) pacienteId: string,
    @Body() dados: CriarConvitePacienteDto
  ) {
    const convite = await this.servicoConvites.criarConvite(usuario.tenantId, usuario, pacienteId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.convite_acesso.criar',
      recursoTipo: 'paciente',
      recursoId: pacienteId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        conviteId: convite.id,
        expiraEm: convite.expiraEm
      }
    });
    return convite;
  }

  @Delete('pacientes/:id/convites-acesso/pendente')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin', 'Professional', 'Collaborator')
  @Permissoes('pacientes.gerenciar')
  async revogarConvite(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) pacienteId: string
  ) {
    const resultado = await this.servicoConvites.revogarConvitePendente(usuario.tenantId, pacienteId, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.convite_acesso.revogar',
      recursoTipo: 'paciente',
      recursoId: pacienteId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { conviteId: resultado.conviteId, revogadoEm: resultado.revogadoEm }
    });
    return resultado;
  }

  @Get('pacientes/convites-acesso/:token')
  obterConvite(@Param('token') token: string) {
    return this.servicoConvites.obterConvitePublico(token);
  }

  @Post('pacientes/convites-acesso/ativar')
  ativarConvite(@Body() dados: AtivarConvitePacienteDto) {
    return this.servicoConvites.ativarConvite(dados);
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
