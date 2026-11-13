import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ConcederPermissaoDto, ConfirmarConcessaoDto, ListarConcessoesDto } from '../aplicacao/dtos-concessoes-permissao';
import { ServicoConcessoesPermissao } from '../aplicacao/servico-concessoes-permissao';
import { UsuarioAutenticado } from '../dominio/usuario-autenticado';
import { Papeis, Permissoes, UsuarioAtual } from './decorators';
import { GuardaJwt } from './guarda-jwt';
import { GuardaPapeis } from './guarda-papeis';
import { GuardaPermissoes } from './guarda-permissoes';

@Controller('auth/concessoes-permissao')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional', 'SuperAdmin')
@Permissoes('console.acessar')
export class ControladorConcessoesPermissao {
  constructor(private readonly servico: ServicoConcessoesPermissao) {}
  @Post()
  @Header('Cache-Control', 'private, no-store')
  conceder(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: ConcederPermissaoDto) {
    return this.servico.conceder(usuario, dados);
  }
  @Post(':id/revogar')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  revogar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: ConfirmarConcessaoDto) {
    return this.servico.revogar(usuario, id, dados);
  }
  @Get('usuarios/:usuarioId')
  @Header('Cache-Control', 'private, no-store')
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Query() consulta: ListarConcessoesDto) {
    return this.servico.listar(usuario, usuarioId, consulta.pagina, consulta.limite);
  }
}
