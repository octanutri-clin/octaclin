import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarCatalogoMarcadorExameDto, ListarCatalogoMarcadoresExamesDto } from '../aplicacao/dtos';
import { ServicoCatalogoMarcadoresExames } from '../aplicacao/servico-catalogo-marcadores-exames';

@Controller('exames/marcadores')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorCatalogoMarcadoresExames {
  constructor(private readonly servico: ServicoCatalogoMarcadoresExames) {}

  @Get()
  @Permissoes('pacientes.ler')
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() consulta: ListarCatalogoMarcadoresExamesDto) {
    return this.servico.listar(usuario.tenantId, usuario, consulta);
  }

  @Post()
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('pacientes.gerenciar')
  criar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: CriarCatalogoMarcadorExameDto) {
    return this.servico.criar(usuario.tenantId, usuario, dados);
  }

  @Delete(':itemId')
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('pacientes.gerenciar')
  arquivar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.servico.arquivar(usuario.tenantId, itemId, usuario);
  }
}
