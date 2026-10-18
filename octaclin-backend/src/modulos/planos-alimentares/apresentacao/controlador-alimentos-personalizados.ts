import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoAlimentosPersonalizados } from '../aplicacao/servico-alimentos-personalizados';
import { AtualizarAlimentoPersonalizadoDto, BuscarAlimentosPersonalizadosDto, CriarAlimentoPersonalizadoDto, ListarAlimentosPersonalizadosDto } from '../aplicacao/dtos-alimentos-personalizados';
@Controller('planos-alimentares/alimentos-personalizados')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional')
export class ControladorAlimentosPersonalizados {
  constructor(private readonly servico: ServicoAlimentosPersonalizados) {}
  @Get() @Permissoes('planos_alimentares.ler') @Header('Cache-Control', 'private, no-store')
  listar(@UsuarioAtual() u: UsuarioAutenticado, @Query() q: ListarAlimentosPersonalizadosDto) { return this.servico.listar(u.tenantId, u, q); }
  @Post('busca') @Permissoes('planos_alimentares.ler') @Header('Cache-Control', 'private, no-store')
  buscar(@UsuarioAtual() u: UsuarioAutenticado, @Body() q: BuscarAlimentosPersonalizadosDto) { return this.servico.buscar(u.tenantId, u, q); }
  @Get(':id') @Permissoes('planos_alimentares.ler') @Header('Cache-Control', 'private, no-store')
  obter(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) { return this.servico.obter(u.tenantId, u, id); }
  @Post() @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control', 'private, no-store')
  criar(@UsuarioAtual() u: UsuarioAutenticado, @Body() d: CriarAlimentoPersonalizadoDto) { return this.servico.criar(u.tenantId, u, d); }
  @Patch(':id') @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control', 'private, no-store')
  atualizar(@UsuarioAtual() u: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string, @Body() d: AtualizarAlimentoPersonalizadoDto) { return this.servico.atualizar(u.tenantId, u, id, d); }
}
