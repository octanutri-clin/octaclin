import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarChaveApiDto, CriarWebhookDto } from '../aplicacao/dtos';
import { ServicoGestaoIntegracoes } from '../aplicacao/servico-gestao-integracoes';

@Controller('cliente/integracoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Client')
@Permissoes('cliente.configuracoes.gerenciar')
export class ControladorGestaoIntegracoes {
  constructor(private readonly servico: ServicoGestaoIntegracoes) {}

  @Get('chaves')
  listarChaves(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servico.listarChaves(usuario.tenantId);
  }

  @Post('chaves')
  criarChave(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: CriarChaveApiDto) {
    return this.servico.criarChave(usuario.tenantId, usuario.usuarioId, dados);
  }

  @Post('chaves/:id/rotacao')
  rotacionarChave(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servico.rotacionarChave(usuario.tenantId, usuario.usuarioId, id);
  }

  @Delete('chaves/:id')
  revogarChave(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servico.revogarChave(usuario.tenantId, usuario.usuarioId, id);
  }

  @Get('webhooks')
  listarWebhooks(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servico.listarWebhooks(usuario.tenantId);
  }

  @Post('webhooks')
  criarWebhook(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: CriarWebhookDto) {
    return this.servico.criarWebhook(usuario.tenantId, usuario.usuarioId, dados);
  }

  @Post('webhooks/:id/rotacao')
  rotacionarSegredo(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servico.rotacionarSegredoWebhook(usuario.tenantId, usuario.usuarioId, id);
  }

  @Delete('webhooks/:id')
  desativarWebhook(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servico.desativarWebhook(usuario.tenantId, usuario.usuarioId, id);
  }

  @Get('webhooks/entregas')
  listarEntregas(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servico.listarEntregas(usuario.tenantId);
  }

  @Post('webhooks/entregas/:id/reprocessamento')
  reprocessarEntrega(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servico.reprocessarEntrega(usuario.tenantId, usuario.usuarioId, id);
  }
}
