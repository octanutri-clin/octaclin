import { BadRequestException, Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ServicoRespostasPaginadas } from '../aplicacao/servico-respostas-paginadas';
import { ConsultaPaginaRespostasDto, ExportacaoRespostasPaginadasDto } from '../aplicacao/dto-respostas-paginadas';
import { normalizarConsultaRespostas } from '../aplicacao/consulta-respostas';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { contarLinhasCsv } from '../../../infraestrutura/exportacao/csv';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';

@Controller()
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin','Professional','Collaborator')
@Permissoes('questionarios.ler')
export class ControladorRespostasPaginadas {
  constructor(private readonly respostas: ServicoRespostasPaginadas, private readonly auditoria: ServicoAuditoria) {}

  @Get('questionarios/:id/respostas/pagina')
  @Header('Cache-Control','private, no-store')
  consultar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id',ParseUUIDPipe) id: string, @Query() dados: ConsultaPaginaRespostasDto) {
    return this.respostas.consultar(usuario.tenantId,id,usuario,{...normalizarConsultaRespostas({...dados})});
  }

  @Post('questionarios/:id/respostas/exportacao.csv')
  @HttpCode(200)
  @Header('Content-Type','text/csv; charset=utf-8')
  @Header('Content-Disposition','attachment; filename="octaclin-respostas.csv"')
  @Header('Cache-Control','private, no-store')
  async exportar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id',ParseUUIDPipe) id: string,
    @Body() dados: ExportacaoRespostasPaginadasDto, @Req() requisicao: Request) {
    if ((dados.escopo==='visiveis' && !dados.respostaIds?.length) ||
      (dados.escopo!=='visiveis' && dados.respostaIds !== undefined) ||
      (dados.escopo==='questionario' && dados.filtros !== undefined)) throw new BadRequestException('Alcance da exportação inválido.');
    const {tamanho: _tamanho, ...filtros} = normalizarConsultaRespostas({...dados.filtros});
    const csv = await this.respostas.exportar(usuario.tenantId,id,usuario,filtros,dados.respostaIds);
    await this.auditoria.registrar({tenantId:usuario.tenantId,usuarioId:usuario.usuarioId,
      acao:'questionarios.respostas.exportar_csv',recursoTipo:'questionario',recursoId:id,
      ip:requisicao.ip,userAgent:requisicao.headers['user-agent'],metadados:{tipo:'csv_filtrado',linhas:contarLinhasCsv(csv)}});
    return csv;
  }
}
