import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoConquistasPiloto } from '../aplicacao/servico-conquistas-piloto';
import { ServicoCirculosPiloto } from '../aplicacao/servico-circulos-piloto';
import { ServicoPublicacoesPiloto } from '../aplicacao/servico-publicacoes-piloto';
import { ServicoModeracaoPiloto } from '../aplicacao/servico-moderacao-piloto';
import { ComandoPilotoDto, PaginaPilotoDto, ConquistaPilotoDto, CompartilharConquistaDto, ConsentirConquistaDto, CirculoPilotoDto, AceitarCirculoDto, PublicacaoPilotoDto, ComentarioPilotoDto, CurtirPilotoDto, DenunciarPilotoDto, DecidirDenunciaDto } from '../aplicacao/dtos-piloto';

async function auditar<T>(auditoria:ServicoAuditoria,u:UsuarioAutenticado,req:Request,acao:string,operacao:()=>Promise<T>):Promise<T> {
  const resultado=await operacao();
  await auditoria.registrar({tenantId:u.tenantId,usuarioId:u.usuarioId,acao:`gamificacao.piloto.${acao}`,recursoTipo:'gamificacao_piloto',ip:req.ip,metadados:{modelo:317}});
  return resultado;
}

@Controller('gamificacao/piloto')
@UseGuards(GuardaJwt,GuardaPapeis,GuardaPermissoes)
@Papeis('Professional')
@Permissoes('gamificacao.gerenciar','pacientes.gerenciar')
export class ControladorConsolePiloto {
  constructor(private readonly conquistas:ServicoConquistasPiloto,private readonly circulos:ServicoCirculosPiloto,private readonly publicacoes:ServicoPublicacoesPiloto,private readonly moderacao:ServicoModeracaoPiloto,private readonly auditoria:ServicoAuditoria) {}
  @Get('pacientes/:pacienteId/conquistas') @Header('Cache-Control','private, no-store')
  conquistasPaciente(@UsuarioAtual() u:UsuarioAutenticado, @Param('pacienteId',ParseUUIDPipe) pacienteId:string, @Query() p:PaginaPilotoDto) { return this.conquistas.listarProfissional(u,pacienteId,p); }
  @Post('pacientes/:pacienteId/conquistas') @Header('Cache-Control','private, no-store')
  conceder(@UsuarioAtual() u:UsuarioAutenticado, @Param('pacienteId',ParseUUIDPipe) pacienteId:string, @Body() d:ConquistaPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'conceder',()=>this.conquistas.conceder(u,pacienteId,d)); }
  @Patch('pacientes/:pacienteId/conquistas/:conquistaId/compartilhamento') @Header('Cache-Control','private, no-store')
  compartilhar(@UsuarioAtual() u:UsuarioAutenticado, @Param('pacienteId',ParseUUIDPipe) pacienteId:string, @Param('conquistaId',ParseUUIDPipe) conquistaId:string, @Body() d:CompartilharConquistaDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'compartilhar',()=>this.conquistas.compartilhar(u,pacienteId,conquistaId,d)); }
  @Get('circulos') @Header('Cache-Control','private, no-store')
  circulosProprios(@UsuarioAtual() u:UsuarioAutenticado, @Query() p:PaginaPilotoDto) { return this.circulos.listar(u,p); }
  @Post('circulos') @Header('Cache-Control','private, no-store')
  criarCirculo(@UsuarioAtual() u:UsuarioAutenticado, @Body() d:CirculoPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'criarCirculo',()=>this.circulos.criar(u,d)); }
  @Post('circulos/:circuloId/convites/:pacienteId') @Header('Cache-Control','private, no-store')
  convidar(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('pacienteId',ParseUUIDPipe) pacienteId:string, @Body() d:ComandoPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'convidar',()=>this.circulos.convidar(u,circuloId,pacienteId,d)); }

  @Get('circulos/:circuloId/convites/:pacienteId') @Header('Cache-Control','private, no-store')
  convite(@UsuarioAtual() u:UsuarioAutenticado,@Param('circuloId',ParseUUIDPipe) circuloId:string,@Param('pacienteId',ParseUUIDPipe) pacienteId:string) {return this.circulos.obterConvite(u,circuloId,pacienteId);}
  @Post('circulos/:circuloId/convites/:pacienteId/revogacao') @Header('Cache-Control','private, no-store')
  revogar(@UsuarioAtual() u:UsuarioAutenticado,@Param('circuloId',ParseUUIDPipe) circuloId:string,@Param('pacienteId',ParseUUIDPipe) pacienteId:string,@Body() d:ComandoPilotoDto,@Req() req:Request) {return auditar(this.auditoria,u,req,'revogar',()=>this.circulos.revogar(u,circuloId,pacienteId,d));}
  @Post('circulos/:circuloId/encerramento') @Header('Cache-Control','private, no-store')
  encerrar(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Body() d:ComandoPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'encerrar',()=>this.circulos.encerrar(u,circuloId,d)); }
  @Get('circulos/:circuloId/publicacoes') @Header('Cache-Control','private, no-store')
  feed(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Query() p:PaginaPilotoDto) { return this.publicacoes.feed(u,circuloId,p); }
  @Get('circulos/:circuloId/publicacoes/:postId/comentarios') @Header('Cache-Control','private, no-store')
  comentarios(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Query() p:PaginaPilotoDto) { return this.publicacoes.comentarios(u,circuloId,postId,p); }
  @Get('circulos/:circuloId/publicacoes/:postId/curtidas') @Header('Cache-Control','private, no-store')
  curtidas(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Query() p:PaginaPilotoDto) { return this.publicacoes.quemCurtiu(u,circuloId,postId,undefined,p); }
  @Get('circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId/curtidas') @Header('Cache-Control','private, no-store')
  curtidasComentario(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Param('comentarioId',ParseUUIDPipe) comentarioId:string, @Query() p:PaginaPilotoDto) { return this.publicacoes.quemCurtiu(u,circuloId,postId,comentarioId,p); }
  @Post('circulos/:circuloId/publicacoes/:postId/retirada') @Header('Cache-Control','private, no-store')
  retirarPost(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Body() d:ComandoPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'retirarPost',()=>this.publicacoes.retirar(u,circuloId,postId,undefined,d)); }
  @Post('circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId/retirada') @Header('Cache-Control','private, no-store')
  retirarComentario(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Param('comentarioId',ParseUUIDPipe) comentarioId:string, @Body() d:ComandoPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'retirarComentario',()=>this.publicacoes.retirar(u,circuloId,postId,comentarioId,d)); }
  @Get('circulos/:circuloId/denuncias') @Header('Cache-Control','private, no-store')
  denuncias(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Query() p:PaginaPilotoDto) { return this.moderacao.listar(u,circuloId,p); }
  @Post('circulos/:circuloId/denuncias/:denunciaId/decisao') @Header('Cache-Control','private, no-store')
  decidir(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('denunciaId',ParseUUIDPipe) denunciaId:string, @Body() d:DecidirDenunciaDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'decidir',()=>this.moderacao.decidir(u,circuloId,denunciaId,d)); }
}

@Controller('portal/paciente/gamificacao-piloto')
@UseGuards(GuardaJwt,GuardaPapeis,GuardaPermissoes)
@Papeis('Patient')
export class ControladorPortalPiloto {
  constructor(private readonly conquistas:ServicoConquistasPiloto,private readonly circulos:ServicoCirculosPiloto,private readonly publicacoes:ServicoPublicacoesPiloto,private readonly moderacao:ServicoModeracaoPiloto,private readonly auditoria:ServicoAuditoria) {}

  @Get('privacidade/conquistas') @Header('Cache-Control','private, no-store')
  consentimentos(@UsuarioAtual() u:UsuarioAutenticado,@Query() p:PaginaPilotoDto) {return this.conquistas.listarConsentimentos(u,p);}
  @Get('privacidade/circulos') @Header('Cache-Control','private, no-store')
  participacoes(@UsuarioAtual() u:UsuarioAutenticado,@Query() p:PaginaPilotoDto) {return this.circulos.listarParticipacoes(u,p);}
  @Get('conquistas') @Header('Cache-Control','private, no-store')
  conquistasPaciente(@UsuarioAtual() u:UsuarioAutenticado, @Query() p:PaginaPilotoDto) { return this.conquistas.listarPortal(u,p); }
  @Post('conquistas/:conquistaId/consentimento') @Header('Cache-Control','private, no-store')
  consentir(@UsuarioAtual() u:UsuarioAutenticado, @Param('conquistaId',ParseUUIDPipe) conquistaId:string, @Body() d:ConsentirConquistaDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'consentir',()=>this.conquistas.consentir(u,conquistaId,d)); }
  @Get('circulos') @Header('Cache-Control','private, no-store')
  circulosProprios(@UsuarioAtual() u:UsuarioAutenticado, @Query() p:PaginaPilotoDto) { return this.circulos.listar(u,p); }
  @Post('circulos/:circuloId/aceite') @Header('Cache-Control','private, no-store')
  aceitar(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Body() d:AceitarCirculoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'aceitar',()=>this.circulos.aceitar(u,circuloId,d)); }
  @Post('circulos/:circuloId/saida') @Header('Cache-Control','private, no-store')
  sair(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Body() d:ComandoPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'sair',()=>this.circulos.sair(u,circuloId,d)); }
  @Get('circulos/:circuloId/publicacoes') @Header('Cache-Control','private, no-store')
  feed(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Query() p:PaginaPilotoDto) { return this.publicacoes.feed(u,circuloId,p); }
  @Get('circulos/:circuloId/publicacoes/:postId/comentarios') @Header('Cache-Control','private, no-store')
  comentarios(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Query() p:PaginaPilotoDto) { return this.publicacoes.comentarios(u,circuloId,postId,p); }
  @Get('circulos/:circuloId/publicacoes/:postId/curtidas') @Header('Cache-Control','private, no-store')
  curtidas(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Query() p:PaginaPilotoDto) { return this.publicacoes.quemCurtiu(u,circuloId,postId,undefined,p); }
  @Get('circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId/curtidas') @Header('Cache-Control','private, no-store')
  curtidasComentario(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Param('comentarioId',ParseUUIDPipe) comentarioId:string, @Query() p:PaginaPilotoDto) { return this.publicacoes.quemCurtiu(u,circuloId,postId,comentarioId,p); }
  @Post('circulos/:circuloId/publicacoes/:postId/retirada') @Header('Cache-Control','private, no-store')
  retirarPost(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Body() d:ComandoPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'retirarPost',()=>this.publicacoes.retirar(u,circuloId,postId,undefined,d)); }
  @Post('circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId/retirada') @Header('Cache-Control','private, no-store')
  retirarComentario(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Param('comentarioId',ParseUUIDPipe) comentarioId:string, @Body() d:ComandoPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'retirarComentario',()=>this.publicacoes.retirar(u,circuloId,postId,comentarioId,d)); }
  @Patch('circulos/:circuloId/publicacoes/:postId') @Header('Cache-Control','private, no-store')
  editarPost(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Body() d:PublicacaoPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'editarPost',()=>this.publicacoes.editar(u,circuloId,postId,undefined,d)); }
  @Post('circulos/:circuloId/publicacoes/:postId/curtidas') @Header('Cache-Control','private, no-store')
  curtirPost(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Body() d:CurtirPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'curtirPost',()=>this.publicacoes.curtir(u,circuloId,postId,undefined,d)); }
  @Post('circulos/:circuloId/publicacoes/:postId/denuncias') @Header('Cache-Control','private, no-store')
  denunciarPost(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Body() d:DenunciarPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'denunciarPost',()=>this.moderacao.denunciar(u,circuloId,postId,undefined,d)); }
  @Patch('circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId') @Header('Cache-Control','private, no-store')
  editarComentario(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Param('comentarioId',ParseUUIDPipe) comentarioId:string, @Body() d:ComentarioPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'editarComentario',()=>this.publicacoes.editar(u,circuloId,postId,comentarioId,d)); }
  @Post('circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId/curtidas') @Header('Cache-Control','private, no-store')
  curtirComentario(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Param('comentarioId',ParseUUIDPipe) comentarioId:string, @Body() d:CurtirPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'curtirComentario',()=>this.publicacoes.curtir(u,circuloId,postId,comentarioId,d)); }
  @Post('circulos/:circuloId/publicacoes/:postId/comentarios/:comentarioId/denuncias') @Header('Cache-Control','private, no-store')
  denunciarComentario(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Param('comentarioId',ParseUUIDPipe) comentarioId:string, @Body() d:DenunciarPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'denunciarComentario',()=>this.moderacao.denunciar(u,circuloId,postId,comentarioId,d)); }
  @Post('circulos/:circuloId/publicacoes') @Header('Cache-Control','private, no-store')
  publicar(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Body() d:PublicacaoPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'publicar',()=>this.publicacoes.publicar(u,circuloId,d)); }
  @Post('circulos/:circuloId/publicacoes/:postId/comentarios') @Header('Cache-Control','private, no-store')
  comentar(@UsuarioAtual() u:UsuarioAutenticado, @Param('circuloId',ParseUUIDPipe) circuloId:string, @Param('postId',ParseUUIDPipe) postId:string, @Body() d:ComentarioPilotoDto, @Req() req:Request) { return auditar(this.auditoria,u,req,'comentar',()=>this.publicacoes.comentar(u,circuloId,postId,d)); }
}
