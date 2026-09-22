import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  AtualizarRascunhoCondutaTerapeuticaDto,
  CriarBibliotecaCondutaDto,
  CriarCondutaTerapeuticaDto,
  ListarBibliotecaCondutasDto
} from '../aplicacao/dtos';
import { ServicoBibliotecaCondutas } from '../aplicacao/servico-biblioteca-condutas';
import { ServicoCondutasTerapeuticas } from '../aplicacao/servico-condutas-terapeuticas';

@Controller('pacientes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional')
export class ControladorCondutasTerapeuticas {
  constructor(private readonly servico: ServicoCondutasTerapeuticas, private readonly auditoria: ServicoAuditoria) {}

  @Get(':id/condutas-terapeuticas')
  @Permissoes('pacientes.ler')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string) {
    const itens = await this.servico.listar(usuario.tenantId, pacienteId, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.condutas_terapeuticas.listar', pacienteId, { total: itens.length });
    return itens;
  }

  @Post(':id/condutas-terapeuticas')
  @Permissoes('pacientes.gerenciar')
  async criar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string, @Body() dados: CriarCondutaTerapeuticaDto) {
    const conduta = await this.servico.criar(usuario.tenantId, pacienteId, usuario, dados);
    await this.auditar(usuario, requisicao, 'pacientes.condutas_terapeuticas.criar', pacienteId, { condutaId: conduta.id, tipo: conduta.tipo });
    return conduta;
  }

  @Put(':id/condutas-terapeuticas/:condutaId/rascunho')
  @Permissoes('pacientes.gerenciar')
  async atualizarRascunho(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string, @Param('condutaId', ParseUUIDPipe) condutaId: string, @Body() dados: AtualizarRascunhoCondutaTerapeuticaDto) {
    const conduta = await this.servico.atualizarRascunho(usuario.tenantId, pacienteId, condutaId, usuario, dados);
    await this.auditar(usuario, requisicao, 'pacientes.condutas_terapeuticas.rascunho_atualizar', pacienteId, { condutaId });
    return conduta;
  }

  @Post(':id/condutas-terapeuticas/:condutaId/publicacao')
  @Permissoes('pacientes.gerenciar')
  async publicar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string, @Param('condutaId', ParseUUIDPipe) condutaId: string) {
    const conduta = await this.servico.publicar(usuario.tenantId, pacienteId, condutaId, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.condutas_terapeuticas.publicar', pacienteId, { condutaId });
    return conduta;
  }

  @Post(':id/condutas-terapeuticas/:condutaId/nova-versao')
  @Permissoes('pacientes.gerenciar')
  async criarNovaVersao(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string, @Param('condutaId', ParseUUIDPipe) condutaId: string) {
    const conduta = await this.servico.criarNovaVersao(usuario.tenantId, pacienteId, condutaId, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.condutas_terapeuticas.nova_versao', pacienteId, { condutaId });
    return conduta;
  }

  @Post(':id/condutas-terapeuticas/:condutaId/arquivamento')
  @Permissoes('pacientes.gerenciar')
  async arquivar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string, @Param('condutaId', ParseUUIDPipe) condutaId: string) {
    const conduta = await this.servico.arquivar(usuario.tenantId, pacienteId, condutaId, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.condutas_terapeuticas.arquivar', pacienteId, { condutaId });
    return conduta;
  }

  private async auditar(usuario: UsuarioAutenticado, requisicao: Request, acao: string, pacienteId: string, metadados: Record<string, unknown>) {
    const userAgent = requisicao.headers['user-agent'];
    await this.auditoria.registrar({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao, recursoTipo: 'paciente', recursoId: pacienteId, ip: requisicao.ip, userAgent: Array.isArray(userAgent) ? userAgent.join(', ') : userAgent, metadados });
  }
}

// Item de biblioteca nao pertence a um paciente (e conhecimento da clinica,
// compartilhado no tenant inteiro), entao a rota vive fora de
// `/pacientes/:id` -- mesmo padrao de `evolucoes/modelos` (Fase 271) e do
// nome literal de `biblioteca-perguntas`, a referencia do PB-23.
@Controller('biblioteca-condutas')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional')
export class ControladorBibliotecaCondutas {
  constructor(private readonly servico: ServicoBibliotecaCondutas) {}

  @Get()
  @Permissoes('pacientes.ler')
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() consulta: ListarBibliotecaCondutasDto) {
    return this.servico.listar(usuario.tenantId, usuario, consulta);
  }

  @Post()
  @Permissoes('pacientes.gerenciar')
  criar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: CriarBibliotecaCondutaDto) {
    return this.servico.criar(usuario.tenantId, usuario, dados);
  }

  @Get(':itemId')
  @Permissoes('pacientes.ler')
  obter(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.servico.obter(usuario.tenantId, itemId, usuario);
  }

  @Delete(':itemId')
  @Permissoes('pacientes.gerenciar')
  arquivar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.servico.arquivar(usuario.tenantId, itemId, usuario);
  }
}
