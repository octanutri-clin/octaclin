import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { FavoritarAlimentoDto } from '../aplicacao/dto-favoritos-alimentos';
import { ServicoFavoritosAlimentos } from '../aplicacao/servico-favoritos-alimentos';

@Controller('planos-alimentares/favoritos')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional')
export class ControladorFavoritosAlimentos {
  constructor(private readonly servico: ServicoFavoritosAlimentos) {}

  @Get() @Permissoes('planos_alimentares.ler') @Header('Cache-Control', 'private, no-store')
  listar(@UsuarioAtual() usuario: UsuarioAutenticado) { return this.servico.listar(usuario.tenantId, usuario); }

  @Post() @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control', 'private, no-store')
  favoritar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dto: FavoritarAlimentoDto) {
    return this.servico.favoritar(usuario.tenantId, usuario, dto.origem, dto.alimentoId);
  }

  @Delete(':origem/:alimentoId') @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control', 'private, no-store')
  desfavoritar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('origem') origem: 'catalogo' | 'custom', @Param('alimentoId', ParseUUIDPipe) alimentoId: string) {
    return this.servico.desfavoritar(usuario.tenantId, usuario, origem, alimentoId);
  }
}
