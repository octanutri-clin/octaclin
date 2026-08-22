import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarFiltroSalvoDto, ListarFiltrosSalvosDto } from '../aplicacao/dtos-filtros-salvos';
import { ServicoFiltrosSalvosPacientes } from '../aplicacao/servico-filtros-salvos-pacientes';

@Controller('pacientes/filtros-salvos')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorFiltrosSalvosPacientes {
  constructor(
    private readonly servico: ServicoFiltrosSalvosPacientes,
    private readonly auditoria: ServicoAuditoria
  ) {}

  @Get()
  @Permissoes('pacientes.listar')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() consulta: ListarFiltrosSalvosDto) {
    return this.servico.listar(usuario.tenantId, usuario, consulta);
  }

  @Post()
  @Permissoes('pacientes.listar')
  async criar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarFiltroSalvoDto
  ) {
    const filtro = await this.servico.criar(usuario.tenantId, usuario, dados);
    await this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.filtro_salvo.criar',
      recursoTipo: 'filtro_salvo_paciente',
      recursoId: filtro.id,
      ip: requisicao.ip,
      userAgent: requisicao.get('user-agent'),
      metadados: { origem: filtro.origem }
    });
    return filtro;
  }

  @Delete(':filtroId')
  @Permissoes('pacientes.listar')
  async arquivar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('filtroId', ParseUUIDPipe) filtroId: string
  ) {
    await this.servico.arquivar(usuario.tenantId, filtroId, usuario);
    await this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.filtro_salvo.arquivar',
      recursoTipo: 'filtro_salvo_paciente',
      recursoId: filtroId,
      ip: requisicao.ip,
      userAgent: requisicao.get('user-agent')
    });
    return { arquivado: true };
  }
}
