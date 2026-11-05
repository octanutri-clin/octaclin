import { FiltroRegistrosFactuais } from './filtro-registros-factuais';
import { projetarMetadadosRegistro } from '../aplicacao/projecao-registro-factual';
import { Body,Controller,Header,HttpCode,Param,ParseUUIDPipe,Post,UseGuards,UseFilters } from '@nestjs/common';
import { Papeis,Permissoes,UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoRegistrosAnaliseFactual } from '../aplicacao/servico-registros-analise-factual';
import { RegistrarVersaoFactualDto,ListarRegistrosFactuaisDto,HistoricoRegistrosFactuaisDto,ConsultarRegistroFactualDto,CompararRegistrosFactuaisDto } from '../aplicacao/dtos-registros-factuais';
@Controller('pacientes/:pacienteId/planos-alimentares/analises-factuais')
@UseGuards(GuardaJwt,GuardaPapeis,GuardaPermissoes)
@Papeis('Professional')
@UseFilters(FiltroRegistrosFactuais)
export class ControladorRegistrosFactuais {
 constructor(private readonly servico:ServicoRegistrosAnaliseFactual){}
 @Post() @HttpCode(200) @Permissoes('planos_alimentares.ler','planos_alimentares.gerenciar') @Header('Cache-Control','private, no-store')
 async registrar(@UsuarioAtual() u:UsuarioAutenticado,@Param('pacienteId',ParseUUIDPipe) p:string,@Body() d:RegistrarVersaoFactualDto){
  const r=await this.servico.registrarVersao(u.tenantId,p,u,{registro:d.registro,selecao:d.selecao});return {schemaVersao:1,registro:projetarMetadadosRegistro(r)};
 }
 @Post('listar') @HttpCode(200) @Permissoes('planos_alimentares.ler') @Header('Cache-Control','private, no-store')
 async listar(@UsuarioAtual() u:UsuarioAutenticado,@Param('pacienteId',ParseUUIDPipe) p:string,@Body() d:ListarRegistrosFactuaisDto){
  const r=await this.servico.listar(u.tenantId,p,u,d.pagina,d.limite);return {schemaVersao:1,itens:r.itens.map(projetarMetadadosRegistro),total:r.total,pagina:r.pagina,limite:r.limite};
 }
 @Post('historico') @HttpCode(200) @Permissoes('planos_alimentares.ler') @Header('Cache-Control','private, no-store')
 async historico(@UsuarioAtual() u:UsuarioAutenticado,@Param('pacienteId',ParseUUIDPipe) p:string,@Body() d:HistoricoRegistrosFactuaisDto){return {schemaVersao:1,...await this.servico.historico(u.tenantId,p,u,d.limite,d.cursorId,d.cursorCriadoEm)};}
 @Post('relatorio') @HttpCode(200) @Permissoes('planos_alimentares.ler','planos_alimentares.gerenciar') @Header('Cache-Control','private, no-store')
 prepararRelatorio(@UsuarioAtual() u:UsuarioAutenticado,@Param('pacienteId',ParseUUIDPipe) p:string,@Body() d:ConsultarRegistroFactualDto){return this.servico.prepararRelatorioApi(u.tenantId,p,u,d.registroId);}
 @Post('consultar') @HttpCode(200) @Permissoes('planos_alimentares.ler') @Header('Cache-Control','private, no-store')
 consultar(@UsuarioAtual() u:UsuarioAutenticado,@Param('pacienteId',ParseUUIDPipe) p:string,@Body() d:ConsultarRegistroFactualDto){return this.servico.consultarApi(u.tenantId,p,u,d.registroId);}
 @Post('comparar') @HttpCode(200) @Permissoes('planos_alimentares.ler') @Header('Cache-Control','private, no-store')
 comparar(@UsuarioAtual() u:UsuarioAutenticado,@Param('pacienteId',ParseUUIDPipe) p:string,@Body() d:CompararRegistrosFactuaisDto){return this.servico.compararApi(u.tenantId,p,u,d.antesId,d.depoisId);}
}
