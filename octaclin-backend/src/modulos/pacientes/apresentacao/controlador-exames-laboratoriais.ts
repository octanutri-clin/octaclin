import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarColetaExameLaboratorialDto } from '../aplicacao/dtos';
import { ServicoExamesLaboratoriais } from '../aplicacao/servico-exames-laboratoriais';

@Controller('pacientes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorExamesLaboratoriais {
  constructor(private readonly servico: ServicoExamesLaboratoriais, private readonly auditoria: ServicoAuditoria) {}

  @Get(':id/exames-laboratoriais')
  @Permissoes('pacientes.ler')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string) {
    const resultado = await this.servico.listar(usuario.tenantId, pacienteId, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.exames_laboratoriais.listar', pacienteId);
    return resultado;
  }

  @Post(':id/exames-laboratoriais')
  @Permissoes('pacientes.gerenciar')
  async criar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string, @Body() dados: CriarColetaExameLaboratorialDto) {
    const resultado = await this.servico.criar(usuario.tenantId, pacienteId, dados, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.exames_laboratoriais.criar', pacienteId);
    return resultado;
  }

  private async auditar(usuario: UsuarioAutenticado, requisicao: Request, acao: string, pacienteId: string) {
    const userAgent = requisicao.headers['user-agent'];
    await this.auditoria.registrar({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao, recursoTipo: 'paciente', recursoId: pacienteId, ip: requisicao.ip, userAgent: Array.isArray(userAgent) ? userAgent.join(', ') : userAgent });
  }
}
