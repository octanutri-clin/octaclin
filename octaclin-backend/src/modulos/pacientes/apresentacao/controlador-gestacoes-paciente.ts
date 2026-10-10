import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoGestacoesPaciente } from '../aplicacao/servico-gestacoes-paciente';
import { CriarGestacaoDto, ConfirmarGestacaoDto, NovaReferenciaGestacaoDto, CompartilharGestacaoDto, PaginaGestacoesDto, PaginaAvaliacoesGestacaoDto } from '../aplicacao/dtos-gestacoes';

@Controller('pacientes/:id/gestacoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin','Professional','Collaborator')
export class ControladorGestacoesPaciente {
  constructor(private readonly servico: ServicoGestacoesPaciente,private readonly auditoria: ServicoAuditoria) {}
  @Get('')
  @Header('Cache-Control','private, no-store')
  @Permissoes('pacientes.ler')
  async listar(@UsuarioAtual() u: UsuarioAutenticado,@Req() req: Request,@Param('id',ParseUUIDPipe) pacienteId: string,@Query() d: PaginaGestacoesDto) {
    const resultado = await this.servico.listar(u.tenantId,pacienteId,u,d);
    await this.auditar(u,req,'pacientes.gestacoes.listar',pacienteId);
    return resultado;
  }
  @Post('')
  @Header('Cache-Control','private, no-store')
  @Permissoes('pacientes.gerenciar')
  async criar(@UsuarioAtual() u: UsuarioAutenticado,@Req() req: Request,@Param('id',ParseUUIDPipe) pacienteId: string,@Body() d: CriarGestacaoDto) {
    const resultado = await this.servico.criar(u.tenantId,pacienteId,u,d);
    await this.auditar(u,req,'pacientes.gestacoes.criar',pacienteId);
    return resultado;
  }
  @Get(':gestacaoId')
  @Header('Cache-Control','private, no-store')
  @Permissoes('pacientes.ler')
  async detalhe(@UsuarioAtual() u: UsuarioAutenticado,@Req() req: Request,@Param('id',ParseUUIDPipe) pacienteId: string,@Param('gestacaoId',ParseUUIDPipe) gestacaoId: string,@Query() d: PaginaAvaliacoesGestacaoDto) {
    const resultado = await this.servico.detalhe(u.tenantId,pacienteId,gestacaoId,u,d.cursor);
    await this.auditar(u,req,'pacientes.gestacoes.detalhe',pacienteId);
    return resultado;
  }
  @Post(':gestacaoId/referencias')
  @Header('Cache-Control','private, no-store')
  @Permissoes('pacientes.gerenciar')
  async referencia(@UsuarioAtual() u: UsuarioAutenticado,@Req() req: Request,@Param('id',ParseUUIDPipe) pacienteId: string,@Param('gestacaoId',ParseUUIDPipe) gestacaoId: string,@Body() d: NovaReferenciaGestacaoDto) {
    const resultado = await this.servico.mudar(u.tenantId,pacienteId,gestacaoId,u,d,'referencia');
    await this.auditar(u,req,'pacientes.gestacoes.referencia',pacienteId);
    return resultado;
  }
  @Post(':gestacaoId/encerrar')
  @Header('Cache-Control','private, no-store')
  @Permissoes('pacientes.gerenciar')
  async encerrar(@UsuarioAtual() u: UsuarioAutenticado,@Req() req: Request,@Param('id',ParseUUIDPipe) pacienteId: string,@Param('gestacaoId',ParseUUIDPipe) gestacaoId: string,@Body() d: ConfirmarGestacaoDto) {
    const resultado = await this.servico.mudar(u.tenantId,pacienteId,gestacaoId,u,d,'encerrar');
    await this.auditar(u,req,'pacientes.gestacoes.encerrar',pacienteId);
    return resultado;
  }
  @Post(':gestacaoId/reabrir')
  @Header('Cache-Control','private, no-store')
  @Permissoes('pacientes.gerenciar')
  async reabrir(@UsuarioAtual() u: UsuarioAutenticado,@Req() req: Request,@Param('id',ParseUUIDPipe) pacienteId: string,@Param('gestacaoId',ParseUUIDPipe) gestacaoId: string,@Body() d: ConfirmarGestacaoDto) {
    const resultado = await this.servico.mudar(u.tenantId,pacienteId,gestacaoId,u,d,'reabrir');
    await this.auditar(u,req,'pacientes.gestacoes.reabrir',pacienteId);
    return resultado;
  }
  @Put(':gestacaoId/compartilhamento')
  @Header('Cache-Control','private, no-store')
  @Permissoes('pacientes.gerenciar')
  async compartilhar(@UsuarioAtual() u: UsuarioAutenticado,@Req() req: Request,@Param('id',ParseUUIDPipe) pacienteId: string,@Param('gestacaoId',ParseUUIDPipe) gestacaoId: string,@Body() d: CompartilharGestacaoDto) {
    const resultado = await this.servico.mudar(u.tenantId,pacienteId,gestacaoId,u,d,'compartilhar');
    await this.auditar(u,req,'pacientes.gestacoes.compartilhar',pacienteId);
    return resultado;
  }
  private async auditar(u: UsuarioAutenticado,req: Request,acao: string,id: string) {
    const ua = req.headers['user-agent'];
    await this.auditoria.registrar({ tenantId: u.tenantId,usuarioId: u.usuarioId,acao,recursoTipo: 'paciente',recursoId: id,ip: req.ip,userAgent: Array.isArray(ua) ? ua.join(', ') : ua });
  }
}
