import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoGestacoesPaciente } from '../aplicacao/servico-gestacoes-paciente';
import { ConsentimentoGestacaoDto, PaginaGestacoesDto, PaginaAvaliacoesGestacaoDto } from '../aplicacao/dtos-gestacoes';

@Controller('portal/paciente/gestacoes')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('Patient')
export class ControladorPortalGestacoes {
  constructor(private readonly servico: ServicoGestacoesPaciente,private readonly auditoria: ServicoAuditoria) {}
  @Get()
  @Header('Cache-Control','private, no-store')
  listar(@UsuarioAtual() u: UsuarioAutenticado,@Query() d: PaginaGestacoesDto) { return this.servico.listarPortal(u.tenantId,u,d); }
  @Get(':gestacaoId')
  @Header('Cache-Control','private, no-store')
  detalhe(@UsuarioAtual() u: UsuarioAutenticado,@Param('gestacaoId',ParseUUIDPipe) id: string,@Query() d: PaginaAvaliacoesGestacaoDto) { return this.servico.detalhePortal(u.tenantId,id,u,d.cursor); }
  @Put(':gestacaoId/consentimento')
  @Header('Cache-Control','private, no-store')
  async consentir(@UsuarioAtual() u: UsuarioAutenticado,@Req() req: Request,@Param('gestacaoId',ParseUUIDPipe) id: string,@Body() d: ConsentimentoGestacaoDto) {
    const resultado = await this.servico.consentir(u.tenantId,id,u,d);
    const ua = req.headers['user-agent'];
    await this.auditoria.registrar({ tenantId: u.tenantId,usuarioId: u.usuarioId,acao: d.aceitar ? 'portal.gestacoes.aceitar' : 'portal.gestacoes.revogar',recursoTipo: 'gestacao',recursoId: id,ip: req.ip,userAgent: Array.isArray(ua) ? ua.join(', ') : ua });
    return resultado;
  }
}
