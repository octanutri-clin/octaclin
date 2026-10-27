import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoEquivalenciasPlano } from '../aplicacao/servico-equivalencias-plano';
import { ServicoPreferenciasEquivalencia } from '../aplicacao/servico-preferencias-equivalencia';
import { PreverEquivalenciasDto } from '../aplicacao/dtos-equivalencias';
import { SalvarPreferenciasEquivalenciaDto } from '../aplicacao/dtos-preferencias-equivalencia';
import { projetarPreviaEquivalencias } from '../aplicacao/projecao-previa-equivalencias';
@Controller('pacientes/:pacienteId/planos-alimentares/:planoId/equivalencias')
@UseGuards(GuardaJwt,GuardaPapeis,GuardaPermissoes)
@Papeis('Professional')
export class ControladorEquivalenciasPlano {
 constructor(private readonly servico:ServicoEquivalenciasPlano){}
 @Post('previa') @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control','private, no-store')
 async prever(@UsuarioAtual() u:UsuarioAutenticado,@Param('pacienteId',ParseUUIDPipe) paciente:string,@Param('planoId',ParseUUIDPipe) plano:string,@Body() d:PreverEquivalenciasDto){return projetarPreviaEquivalencias(await this.servico.prever(u.tenantId,paciente,plano,u,d));}
}
@Controller('profissionais/me/preferencias-equivalencia')
@UseGuards(GuardaJwt,GuardaPapeis,GuardaPermissoes)
@Papeis('Professional')
export class ControladorPreferenciasEquivalencia {
 constructor(private readonly servico:ServicoPreferenciasEquivalencia){}
 @Get() @Permissoes('planos_alimentares.ler') @Header('Cache-Control','private, no-store')
 obter(@UsuarioAtual() u:UsuarioAutenticado){return this.servico.obter(u);}
 @Put() @Permissoes('planos_alimentares.gerenciar') @Header('Cache-Control','private, no-store')
 salvar(@UsuarioAtual() u:UsuarioAutenticado,@Body() d:SalvarPreferenciasEquivalenciaDto){return this.servico.salvar(u,{...d});}
}
