import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtualizarPerfilPacientePortalDto } from '../aplicacao/dtos';
import { ServicoPortalPaciente } from '../aplicacao/servico-portal-paciente';

@Controller('portal')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('Patient')
export class ControladorPortalPaciente {
  constructor(
    private readonly servicoPortal: ServicoPortalPaciente,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get('paciente')
  obterResumo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoPortal.obterResumoPortal(usuario.tenantId, usuario.usuarioId);
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

  @Get('paciente/formularios-respondidos/:respostaId')
  obterFormularioRespondido(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('respostaId', ParseUUIDPipe) respostaId: string
  ) {
    return this.servicoPortal.obterFormularioRespondido(usuario.tenantId, usuario.usuarioId, respostaId);
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
