import { ExcecaoRetencaoDto } from '../aplicacao/dtos-piloto';
import { ServicoExcecaoRetencaoPiloto } from '../aplicacao/servico-excecao-retencao-piloto';
import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoConfiguracaoPiloto } from '../aplicacao/servico-configuracao-piloto';
import { PaginaPilotoDto } from '../aplicacao/dtos-piloto';

export class ConfiguracaoPilotoDto {
  @IsBoolean() conquistas: boolean;
  @IsBoolean() comunidade: boolean;
  @IsInt() @Min(0) @Max(2147483646) versaoEsperada: number;


}

@Controller('cliente/configuracoes/gamificacao-piloto')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('Client')
@Permissoes('cliente.configuracoes.gerenciar')
export class ControladorConfiguracaoPiloto {
  constructor(private readonly servico: ServicoConfiguracaoPiloto, private readonly auditoria: ServicoAuditoria, private readonly retencao:ServicoExcecaoRetencaoPiloto) {}
  @Get() @Header('Cache-Control', 'private, no-store')
  obter(@UsuarioAtual() u: UsuarioAutenticado) { return this.servico.obter(u.tenantId, u); }
  @Patch() @Header('Cache-Control', 'private, no-store')
  async atualizar(@UsuarioAtual() u: UsuarioAutenticado, @Body() d: ConfiguracaoPilotoDto, @Req() req: Request) {
    const result = await this.servico.atualizar(u.tenantId, u, d);
    await this.auditoria.registrar({ tenantId: u.tenantId, usuarioId: u.usuarioId, acao: 'gamificacao.piloto.configurar', recursoTipo: 'tenant_configuracao', ip: req.ip, metadados: { conquistasHabilitadas: result.conquistas, comunidadeHabilitada: result.comunidade, versao: result.versao } });
    return result;
  }
  @Get('denuncias-retencao') @Header('Cache-Control','private, no-store')
  listarRetencao(@UsuarioAtual() u:UsuarioAutenticado,@Query() p:PaginaPilotoDto) { return this.retencao.listar(u,p.cursor); }
  @Post('denuncias/:denunciaId/excecao-retencao') @Header('Cache-Control','private, no-store')
  async excecao(@UsuarioAtual() u:UsuarioAutenticado,@Param('denunciaId',ParseUUIDPipe) id:string,@Body() d:ExcecaoRetencaoDto,@Req() req:Request) {
    const result=await this.retencao.registrar(u.tenantId,u,id,d);
    await this.auditoria.registrar({tenantId:u.tenantId,usuarioId:u.usuarioId,acao:'gamificacao.piloto.excecao_retencao',recursoTipo:'retencao_comunidade',ip:req.ip,metadados:{modelo:317,versao:result.versao}});
    return result;
  }
}

@Controller('operacoes/tenants/:tenantId/gamificacao-piloto')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin')
@Permissoes('operacoes.tenants.gerenciar')
export class ControladorOperacoesPiloto {
  constructor(private readonly servico: ServicoConfiguracaoPiloto, private readonly auditoria: ServicoAuditoria) {}
  @Get() @Header('Cache-Control', 'private, no-store')
  obter(@UsuarioAtual() u: UsuarioAutenticado, @Param('tenantId', ParseUUIDPipe) tenantId: string) { return this.servico.obter(tenantId, u); }
  @Patch() @Header('Cache-Control', 'private, no-store')
  async atualizar(@UsuarioAtual() u: UsuarioAutenticado, @Param('tenantId', ParseUUIDPipe) tenantId: string, @Body() d: ConfiguracaoPilotoDto, @Req() req: Request) {
    const result = await this.servico.atualizar(tenantId, u, d);
    await this.auditoria.registrar({ tenantId, usuarioId: u.usuarioId, acao: 'gamificacao.piloto.configurar', recursoTipo: 'tenant_configuracao', ip: req.ip, metadados: { conquistasHabilitadas: result.conquistas, comunidadeHabilitada: result.comunidade, versao: result.versao } });
    return result;
  }
}
