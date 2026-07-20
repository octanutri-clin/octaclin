import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
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
  @UseGuards(GuardaJwt, GuardaPapeis)
  @Papeis('SuperAdmin', 'Professional', 'Collaborator')
  async criarConvite(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) pacienteId: string,
    @Body() dados: CriarConvitePacienteDto
  ) {
    const convite = await this.servicoConvites.criarConvite(usuario.tenantId, usuario.usuarioId, pacienteId, dados);
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
        email: dados.email,
        expiraEm: convite.expiraEm
      }
    });
    return convite;
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
