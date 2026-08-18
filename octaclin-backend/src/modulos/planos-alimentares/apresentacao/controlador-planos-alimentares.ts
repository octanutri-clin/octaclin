import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  AtualizarRascunhoPlanoAlimentarDto,
  BuscarAlimentosDto,
  CriarModeloPlanoAlimentarDto,
  CriarPlanoAlimentarDto,
  ListarModelosPlanoAlimentarDto,
  ListarPlanosAlimentaresDto
} from '../aplicacao/dtos';
import { ServicoModelosPlanoAlimentar } from '../aplicacao/servico-modelos-plano-alimentar';
import { ServicoPlanosAlimentares } from '../aplicacao/servico-planos-alimentares';

@Controller('pacientes/:pacienteId/planos-alimentares')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional')
export class ControladorPlanosAlimentares {
  constructor(private readonly servico: ServicoPlanosAlimentares) {}

  @Get()
  @Permissoes('planos_alimentares.ler')
  listar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Query() consulta: ListarPlanosAlimentaresDto
  ) {
    return this.servico.listar(usuario.tenantId, pacienteId, usuario, consulta);
  }

  @Post()
  @Permissoes('planos_alimentares.gerenciar')
  criar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: CriarPlanoAlimentarDto
  ) {
    return this.servico.criar(usuario.tenantId, pacienteId, usuario, dados);
  }

  @Get(':planoId')
  @Permissoes('planos_alimentares.ler')
  obter(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('planoId', ParseUUIDPipe) planoId: string
  ) {
    return this.servico.obter(usuario.tenantId, pacienteId, planoId, usuario);
  }

  @Get(':planoId/versoes/:numero')
  @Permissoes('planos_alimentares.ler')
  obterVersao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('planoId', ParseUUIDPipe) planoId: string,
    @Param('numero', ParseIntPipe) numero: number
  ) {
    return this.servico.obterVersao(usuario.tenantId, pacienteId, planoId, numero, usuario);
  }

  @Get(':planoId/rascunho')
  @Permissoes('planos_alimentares.ler')
  obterRascunho(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('planoId', ParseUUIDPipe) planoId: string
  ) {
    return this.servico.obterRascunho(usuario.tenantId, pacienteId, planoId, usuario);
  }

  @Put(':planoId/rascunho')
  @Permissoes('planos_alimentares.gerenciar')
  atualizarRascunho(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('planoId', ParseUUIDPipe) planoId: string,
    @Body() dados: AtualizarRascunhoPlanoAlimentarDto
  ) {
    return this.servico.atualizarRascunho(usuario.tenantId, pacienteId, planoId, usuario, dados);
  }

  @Post(':planoId/revisao')
  @Permissoes('planos_alimentares.gerenciar')
  revisar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('planoId', ParseUUIDPipe) planoId: string
  ) {
    return this.servico.revisar(usuario.tenantId, pacienteId, planoId, usuario);
  }

  @Post(':planoId/publicacao')
  @Permissoes('planos_alimentares.gerenciar')
  publicar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('planoId', ParseUUIDPipe) planoId: string
  ) {
    return this.servico.publicar(usuario.tenantId, pacienteId, planoId, usuario);
  }

  @Post(':planoId/nova-versao')
  @Permissoes('planos_alimentares.gerenciar')
  criarNovaVersao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('planoId', ParseUUIDPipe) planoId: string
  ) {
    return this.servico.criarNovaVersao(usuario.tenantId, pacienteId, planoId, usuario);
  }

  @Post(':planoId/arquivamento')
  @Permissoes('planos_alimentares.gerenciar')
  arquivar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('planoId', ParseUUIDPipe) planoId: string
  ) {
    return this.servico.arquivar(usuario.tenantId, pacienteId, planoId, usuario);
  }
}

@Controller('planos-alimentares')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional')
export class ControladorCatalogoAlimentos {
  constructor(private readonly servico: ServicoPlanosAlimentares) {}

  @Get('alimentos')
  @Permissoes('planos_alimentares.ler')
  buscar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query() consulta: BuscarAlimentosDto
  ) {
    return this.servico.buscarAlimentos(usuario.tenantId, usuario, consulta);
  }
}

@Controller('planos-alimentares/modelos')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional')
export class ControladorModelosPlanoAlimentar {
  constructor(private readonly servico: ServicoModelosPlanoAlimentar) {}

  @Get()
  @Permissoes('planos_alimentares.ler')
  listar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query() consulta: ListarModelosPlanoAlimentarDto
  ) {
    return this.servico.listar(usuario.tenantId, usuario, consulta);
  }

  @Post()
  @Permissoes('planos_alimentares.gerenciar')
  criar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dados: CriarModeloPlanoAlimentarDto
  ) {
    return this.servico.criar(usuario.tenantId, usuario, dados);
  }

  @Get(':modeloId')
  @Permissoes('planos_alimentares.ler')
  obter(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('modeloId', ParseUUIDPipe) modeloId: string
  ) {
    return this.servico.obter(usuario.tenantId, modeloId, usuario);
  }

  @Delete(':modeloId')
  @Permissoes('planos_alimentares.gerenciar')
  arquivar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('modeloId', ParseUUIDPipe) modeloId: string
  ) {
    return this.servico.arquivar(usuario.tenantId, modeloId, usuario);
  }
}
