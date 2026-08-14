import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  AtualizarContatoCadastroPacienteDto,
  AtualizarFiscalCadastroPacienteDto,
  AtualizarIdentificacaoCadastroPacienteDto,
  AtualizarOperacaoCadastroPacienteDto
} from '../aplicacao/dtos';
import { ServicoPerfilCadastroPaciente } from '../aplicacao/servico-perfil-cadastro-paciente';

@Controller('pacientes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorPerfilCadastroPaciente {
  constructor(
    private readonly servicoPerfil: ServicoPerfilCadastroPaciente,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get(':id/perfil-cadastro')
  @Permissoes('pacientes.ler')
  async obter(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) id: string) {
    const perfil = await this.servicoPerfil.obter(usuario.tenantId, id, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.perfil_cadastro.ler', id);
    return perfil;
  }

  @Get(':id/perfil-cadastro/qualidade-acesso')
  @Permissoes('pacientes.ler')
  async obterQualidadeEAcesso(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) id: string) {
    const resposta = await this.servicoPerfil.obterQualidadeEAcesso(usuario.tenantId, id, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.perfil_cadastro.qualidade_acesso.ler', id);
    return resposta;
  }

  @Patch(':id/perfil-cadastro/identificacao')
  @Permissoes('pacientes.gerenciar')
  async atualizarIdentificacao(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dados: AtualizarIdentificacaoCadastroPacienteDto) {
    const resposta = await this.servicoPerfil.atualizarIdentificacao(usuario.tenantId, id, dados, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.perfil_cadastro.identificacao.atualizar', id);
    return resposta;
  }

  @Patch(':id/perfil-cadastro/contato')
  @Permissoes('pacientes.gerenciar')
  async atualizarContato(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dados: AtualizarContatoCadastroPacienteDto) {
    const resposta = await this.servicoPerfil.atualizarContato(usuario.tenantId, id, dados, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.perfil_cadastro.contato.atualizar', id);
    return resposta;
  }

  @Patch(':id/perfil-cadastro/operacao')
  @Permissoes('pacientes.gerenciar')
  async atualizarOperacao(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dados: AtualizarOperacaoCadastroPacienteDto) {
    const resposta = await this.servicoPerfil.atualizarOperacao(usuario.tenantId, id, dados, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.perfil_cadastro.operacao.atualizar', id);
    return resposta;
  }

  @Get(':id/perfil-cadastro/fiscal')
  @Permissoes('pacientes.ler', 'agenda.financeiro.ler')
  async obterFiscal(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) id: string) {
    const fiscal = await this.servicoPerfil.obterFiscal(usuario.tenantId, id, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.perfil_cadastro.fiscal.ler', id);
    return fiscal;
  }

  @Patch(':id/perfil-cadastro/fiscal')
  @Permissoes('pacientes.gerenciar', 'agenda.financeiro.ler')
  async atualizarFiscal(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) id: string, @Body() dados: AtualizarFiscalCadastroPacienteDto) {
    const resposta = await this.servicoPerfil.atualizarFiscal(usuario.tenantId, id, dados, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.perfil_cadastro.fiscal.atualizar', id);
    return resposta;
  }

  private async auditar(usuario: UsuarioAutenticado, requisicao: Request, acao: string, pacienteId: string): Promise<void> {
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao,
      recursoTipo: 'paciente',
      recursoId: pacienteId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao)
    });
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
