import { createHash } from 'crypto';
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtivarConvitePacienteDto, CriarConvitePacienteDto } from '../aplicacao/dtos';
import { ServicoConvitesPaciente } from '../aplicacao/servico-convites-paciente';

@Controller()
export class ControladorConvitesPaciente {
  constructor(
    private readonly servicoConvites: ServicoConvitesPaciente,
    private readonly servicoAuditoria: ServicoAuditoria,
    private readonly protecaoAbuso: ServicoProtecaoAbuso
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
  async obterConvite(@Param('token') token: string, @Req() requisicao: Request) {
    await this.limitarPublico('consulta', token, requisicao.ip ?? '', 30);
    return this.servicoConvites.obterConvitePublico(token);
  }

  @Post('pacientes/convites-acesso/ativar')
  async ativarConvite(@Body() dados: AtivarConvitePacienteDto, @Req() requisicao: Request) {
    await this.limitarPublico('ativacao', dados.token, requisicao.ip ?? '', 10);
    return this.servicoConvites.ativarConvite(dados);
  }

  private async limitarPublico(acao: 'consulta' | 'ativacao', token: string, ip: string, maxTentativas: number) {
    const ipNormalizado = ip || 'ip-desconhecido';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const politica = {
      maxTentativas,
      janelaMs: 15 * 60 * 1000,
      bloqueioMs: 30 * 60 * 1000,
      mensagemBloqueio: 'Muitas tentativas com convites. Tente novamente em alguns minutos.'
    };
    await this.protecaoAbuso.consumirTentativa(`convite_paciente:${acao}:${ipNormalizado}`, politica);
    await this.protecaoAbuso.consumirTentativa(
      `convite_paciente:${acao}:${ipNormalizado}:${tokenHash}`,
      politica
    );
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
