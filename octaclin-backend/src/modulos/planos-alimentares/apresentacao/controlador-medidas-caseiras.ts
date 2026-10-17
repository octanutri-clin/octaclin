import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoMedidasCaseiras } from '../aplicacao/servico-medidas-caseiras';
import { AtualizarMedidaCaseiraDto, CriarMedidaCaseiraDto, ListarMedidasCaseirasDto } from '../aplicacao/dtos-medidas-caseiras';
@Controller('planos-alimentares/alimentos/:alimentoId/medidas-caseiras')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional')
export class ControladorMedidasCaseiras {
    constructor(private readonly servico: ServicoMedidasCaseiras) { }
    @Get()
    @Permissoes('planos_alimentares.ler')
    @Header('Cache-Control', 'private, no-store')
    listar(
    @UsuarioAtual()
    usuario: UsuarioAutenticado,
    @Param('alimentoId', ParseUUIDPipe)
    alimentoId: string,
    @Query()
    consulta: ListarMedidasCaseirasDto) {
        return this.servico.listar(usuario.tenantId, alimentoId, usuario, consulta);
    }
    @Post()
    @Permissoes('planos_alimentares.gerenciar')
    @Header('Cache-Control', 'private, no-store')
    criar(
    @UsuarioAtual()
    usuario: UsuarioAutenticado,
    @Param('alimentoId', ParseUUIDPipe)
    alimentoId: string,
    @Body()
    dados: CriarMedidaCaseiraDto) {
        return this.servico.criar(usuario.tenantId, alimentoId, usuario, dados);
    }
    @Patch(':medidaId')
    @Permissoes('planos_alimentares.gerenciar')
    @Header('Cache-Control', 'private, no-store')
    atualizar(
    @UsuarioAtual()
    usuario: UsuarioAutenticado,
    @Param('alimentoId', ParseUUIDPipe)
    alimentoId: string,
    @Param('medidaId', ParseUUIDPipe)
    medidaId: string,
    @Body()
    dados: AtualizarMedidaCaseiraDto) {
        return this.servico.atualizar(usuario.tenantId, alimentoId, medidaId, usuario, dados);
    }
}
@Controller('planos-alimentares/alimentos-personalizados/:alimentoId/medidas-caseiras')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional')
export class ControladorMedidasCaseirasPersonalizadas {
  constructor(private readonly servico: ServicoMedidasCaseiras) {}
  @Get() @Permissoes('planos_alimentares.ler') @Header('Cache-Control', 'private, no-store')
  listar(@UsuarioAtual() u: UsuarioAutenticado, @Param('alimentoId', ParseUUIDPipe) id: string, @Query() q: ListarMedidasCaseirasDto) { return this.servico.listar(u.tenantId, id, u, q, 'custom'); }
  @Post() @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control', 'private, no-store')
  criar(@UsuarioAtual() u: UsuarioAutenticado, @Param('alimentoId', ParseUUIDPipe) id: string, @Body() d: CriarMedidaCaseiraDto) { return this.servico.criar(u.tenantId, id, u, d, 'custom'); }
  @Patch(':medidaId') @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control', 'private, no-store')
  atualizar(@UsuarioAtual() u: UsuarioAutenticado, @Param('alimentoId', ParseUUIDPipe) id: string, @Param('medidaId', ParseUUIDPipe) medidaId: string, @Body() d: AtualizarMedidaCaseiraDto) { return this.servico.atualizar(u.tenantId, id, medidaId, u, d, 'custom'); }
}
