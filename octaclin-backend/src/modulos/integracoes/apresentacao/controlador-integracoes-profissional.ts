import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarChaveApiDto, CriarWebhookDto } from '../aplicacao/dtos';
import { ServicoGestaoIntegracoes } from '../aplicacao/servico-gestao-integracoes';
import { ServicoPermissoesIntegracao } from '../aplicacao/servico-permissoes-integracao';

@Controller('profissional/integracoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional')
@Permissoes('integracoes.acessar')
export class ControladorIntegracoesProfissional {
  constructor(
    private readonly integracoes: ServicoGestaoIntegracoes,
    private readonly permissoes: ServicoPermissoesIntegracao
  ) {}

  @Get('acesso')
  obterAcesso(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.permissoes.obterAcessoAtual(usuario.tenantId, usuario.usuarioId);
  }

  @Get('chaves')
  listarChaves(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.integracoes.listarChaves(usuario.tenantId, { usuarioId: usuario.usuarioId });
  }

  @Post('chaves')
  criarChave(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: CriarChaveApiDto) {
    return this.integracoes.criarChave(usuario.tenantId, usuario.usuarioId, dados, { usuarioId: usuario.usuarioId });
  }

  @Post('chaves/:id/rotacao')
  rotacionarChave(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.integracoes.rotacionarChave(usuario.tenantId, usuario.usuarioId, id, { usuarioId: usuario.usuarioId });
  }

  @Delete('chaves/:id')
  revogarChave(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.integracoes.revogarChave(usuario.tenantId, usuario.usuarioId, id, { usuarioId: usuario.usuarioId });
  }

  @Get('webhooks')
  listarWebhooks(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.integracoes.listarWebhooks(usuario.tenantId, { usuarioId: usuario.usuarioId });
  }

  @Post('webhooks')
  criarWebhook(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: CriarWebhookDto) {
    return this.integracoes.criarWebhook(usuario.tenantId, usuario.usuarioId, dados, { usuarioId: usuario.usuarioId });
  }

  @Post('webhooks/:id/rotacao')
  rotacionarSegredo(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.integracoes.rotacionarSegredoWebhook(usuario.tenantId, usuario.usuarioId, id, { usuarioId: usuario.usuarioId });
  }

  @Delete('webhooks/:id')
  desativarWebhook(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.integracoes.desativarWebhook(usuario.tenantId, usuario.usuarioId, id, { usuarioId: usuario.usuarioId });
  }

  @Get('webhooks/entregas')
  listarEntregas(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.integracoes.listarEntregas(usuario.tenantId, { usuarioId: usuario.usuarioId });
  }

  @Post('webhooks/entregas/:id/reprocessamento')
  reprocessarEntrega(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.integracoes.reprocessarEntrega(usuario.tenantId, usuario.usuarioId, id, { usuarioId: usuario.usuarioId });
  }
}
