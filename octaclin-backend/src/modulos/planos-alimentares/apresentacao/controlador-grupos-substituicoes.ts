import { Body, Controller, Delete, Header, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoGruposSubstituicoes } from '../aplicacao/servico-grupos-substituicoes';
import { AtualizarGrupoDto, ConsultarGruposDto, CriarGrupoDto, DuplicarGrupoDto, BuscarFontesGrupoDto } from '../aplicacao/dtos-grupos-substituicoes';

@Controller('planos-alimentares/grupos-substituicoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Professional')
export class ControladorGruposSubstituicoes {
  constructor(private readonly servico: ServicoGruposSubstituicoes) {}
  @Post('consulta') @Permissoes('planos_alimentares.ler') @Header('Cache-Control','private, no-store')
  consultar(@UsuarioAtual() u: UsuarioAutenticado,@Body() q: ConsultarGruposDto) { return this.servico.consultar(u.tenantId,u,q); }
  @Get(':id') @Permissoes('planos_alimentares.ler') @Header('Cache-Control','private, no-store')
  obter(@UsuarioAtual() u: UsuarioAutenticado,@Param('id',ParseUUIDPipe) id: string) { return this.servico.obter(u.tenantId,u,id); }
  @Post() @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control','private, no-store')
  criar(@UsuarioAtual() u: UsuarioAutenticado,@Body() d: CriarGrupoDto) { return this.servico.criar(u.tenantId,u,d); }
  @Patch(':id') @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control','private, no-store')
  atualizar(@UsuarioAtual() u: UsuarioAutenticado,@Param('id',ParseUUIDPipe) id: string,@Body() d: AtualizarGrupoDto) { return this.servico.atualizar(u.tenantId,u,id,d); }
  @Post(':id/duplicar') @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control','private, no-store')
  duplicar(@UsuarioAtual() u: UsuarioAutenticado,@Param('id',ParseUUIDPipe) id: string,@Body() d: DuplicarGrupoDto) { return this.servico.duplicar(u.tenantId,u,id,d); }
  @Post(':id/favorito') @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control','private, no-store')
  favoritar(@UsuarioAtual() u: UsuarioAutenticado,@Param('id',ParseUUIDPipe) id: string) { return this.servico.favoritar(u.tenantId,u,id,true); }
  @Delete(':id/favorito') @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control','private, no-store')
  desfavoritar(@UsuarioAtual() u: UsuarioAutenticado,@Param('id',ParseUUIDPipe) id: string) { return this.servico.favoritar(u.tenantId,u,id,false); }
}

@Controller('planos-alimentares/grupos-substituicoes-administracao')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Client','SuperAdmin')
export class ControladorAdministracaoGrupos {
  constructor(private readonly servico: ServicoGruposSubstituicoes) {}
  @Post('alimentos/consulta') @Permissoes('grupos_substituicoes.administrar') @Header('Cache-Control','private, no-store')
  consultarFontes(@UsuarioAtual() u: UsuarioAutenticado,@Body() q: BuscarFontesGrupoDto) { return this.servico.consultarFontesAdministracao(u.tenantId,u,q); }
  @Post('consulta') @Permissoes('grupos_substituicoes.administrar') @Header('Cache-Control','private, no-store')
  consultar(@UsuarioAtual() u: UsuarioAutenticado,@Body() q: ConsultarGruposDto) { return this.servico.consultar(u.tenantId,u,q,true); }
  @Get(':id') @Permissoes('grupos_substituicoes.administrar') @Header('Cache-Control','private, no-store')
  obter(@UsuarioAtual() u: UsuarioAutenticado,@Param('id',ParseUUIDPipe) id: string) { return this.servico.obter(u.tenantId,u,id,true); }
  @Patch(':id') @Permissoes('grupos_substituicoes.administrar') @Header('Cache-Control','private, no-store')
  atualizar(@UsuarioAtual() u: UsuarioAutenticado,@Param('id',ParseUUIDPipe) id: string,@Body() d: AtualizarGrupoDto) { return this.servico.atualizar(u.tenantId,u,id,d,true); }
}
