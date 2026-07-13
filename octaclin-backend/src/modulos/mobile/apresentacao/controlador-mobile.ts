import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  CriarAcompanhanteDto,
  RegistrarDiarioRapidoDto,
  SincronizarLoteMobileDto,
  SolicitarUploadMidiaDto
} from '../aplicacao/dtos';
import { ServicoMobile } from '../aplicacao/servico-mobile';

@Controller('mobile')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('SuperAdmin', 'Professional', 'Collaborator', 'Patient')
export class ControladorMobile {
  constructor(
    private readonly servicoMobile: ServicoMobile,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get('diario-rapido')
  listarDiarioRapido(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoMobile.listarDiarioRapido(usuario.tenantId);
  }

  @Post('diario-rapido')
  async registrarDiarioRapido(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: RegistrarDiarioRapidoDto
  ) {
    const diario = await this.servicoMobile.registrarDiarioRapido(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'mobile.diario_rapido.registrar', 'log_diario_rapido', diario.id, {
      pacienteId: dados.pacienteId,
      tipo: dados.tipo
    });
    return diario;
  }

  @Get('midias/uploads')
  listarArquivosMidia(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoMobile.listarArquivosMidia(usuario.tenantId);
  }

  @Post('midias/uploads')
  async solicitarUploadMidia(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: SolicitarUploadMidiaDto
  ) {
    const upload = await this.servicoMobile.solicitarUploadMidia(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'mobile.midia.upload_solicitar', 'arquivo_midia', upload.arquivo.id, {
      pacienteId: dados.pacienteId,
      tipo: dados.tipo,
      mimeType: dados.mimeType,
      tamanhoBytes: dados.tamanhoBytes
    });
    return upload;
  }

  @Get('acompanhantes')
  listarAcompanhantes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoMobile.listarAcompanhantes(usuario.tenantId);
  }

  @Post('acompanhantes')
  async criarAcompanhante(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarAcompanhanteDto
  ) {
    const acompanhante = await this.servicoMobile.criarAcompanhante(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'mobile.acompanhante.criar', 'acompanhante', acompanhante.id, {
      pacienteId: dados.pacienteId,
      possuiContato: Boolean(dados.contato)
    });
    return acompanhante;
  }

  @Post('sincronizacao/lote')
  async sincronizarLote(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: SincronizarLoteMobileDto
  ) {
    const lote = await this.servicoMobile.sincronizarLote(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'mobile.sincronizacao_lote.executar', 'sincronizacao_mobile', undefined, {
      totalItens: dados.itens.length,
      tipos: Array.from(new Set(dados.itens.map((item) => item.tipo))),
      totalSincronizados: lote.resultados.filter((item) => item.status === 'sincronizado').length
    });
    return lote;
  }

  private registrarAuditoria(
    usuario: UsuarioAutenticado,
    requisicao: Request,
    acao: string,
    recursoTipo: string,
    recursoId?: string,
    metadados?: Record<string, unknown>
  ) {
    return this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao,
      recursoTipo,
      recursoId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados
    });
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
