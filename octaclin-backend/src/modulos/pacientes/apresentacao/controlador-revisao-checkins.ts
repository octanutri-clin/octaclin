import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoRevisaoCheckins } from '../aplicacao/servico-revisao-checkins';

class ConfirmarRevisaoCheckinDto {
  @IsString()
  @MaxLength(1024)
  comprovanteLeitura: string;
}

@Controller('checkins/revisoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional')
@Permissoes('pacientes.ler')
export class ControladorRevisaoCheckins {
  constructor(
    private readonly servico: ServicoRevisaoCheckins,
    private readonly auditoria: ServicoAuditoria
  ) {}

  @Get('pendentes')
  @Header('Cache-Control', 'private, no-store')
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query('pagina') pagina?: string) {
    return this.servico.listarPendentes(usuario.tenantId, usuario, Number(pagina ?? '1'));
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  obter(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servico.obterDetalhe(usuario.tenantId, id, usuario);
  }

  @Patch(':id')
  @Permissoes('pacientes.gerenciar')
  @Header('Cache-Control', 'private, no-store')
  async revisar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: ConfirmarRevisaoCheckinDto
  ) {
    const revisao = await this.servico.revisar(usuario.tenantId, id, usuario, dados.comprovanteLeitura);
    await this.auditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'checkins.habitos.revisar',
      recursoTipo: 'log_diario_rapido',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: requisicao.headers['user-agent'],
      metadados: { revisadoEm: revisao.revisadoEm }
    });
    return revisao;
  }
}
