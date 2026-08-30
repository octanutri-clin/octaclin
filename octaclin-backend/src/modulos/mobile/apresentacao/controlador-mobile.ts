import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
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
import { FeatureFlag, GuardaFeatureFlag } from '../../../infraestrutura/feature-flags/guarda-feature-flag';

@Controller('mobile')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaFeatureFlag)
@Papeis('SuperAdmin', 'Professional', 'Patient')
export class ControladorMobile {
  constructor(
    private readonly servicoMobile: ServicoMobile,
    private readonly servicoAuditoria: ServicoAuditoria,
    private readonly protecaoAbuso: ServicoProtecaoAbuso
  ) {}

  @Get('diario-rapido')
  listarDiarioRapido(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoMobile.listarDiarioRapido(usuario.tenantId, usuario);
  }

  @Post('diario-rapido')
  async registrarDiarioRapido(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: RegistrarDiarioRapidoDto
  ) {
    const diario = await this.servicoMobile.registrarDiarioRapido(usuario.tenantId, dados, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'mobile.diario_rapido.registrar', 'log_diario_rapido', diario.id, {
      pacienteId: dados.pacienteId,
      tipo: dados.tipo
    });
    return diario;
  }

  @Get('midias/uploads')
  listarArquivosMidia(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('pacienteId', new ParseUUIDPipe({ optional: true })) pacienteId?: string
  ) {
    return this.servicoMobile.listarArquivosMidia(usuario.tenantId, usuario, pacienteId);
  }

  @Post('midias/uploads')
  async solicitarUploadMidia(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: SolicitarUploadMidiaDto
  ) {
    await this.protecaoAbuso.consumirTentativa(`mobile:upload:${usuario.tenantId}:${usuario.usuarioId}`, {
      maxTentativas: 30,
      janelaMs: 15 * 60 * 1000,
      bloqueioMs: 15 * 60 * 1000,
      mensagemBloqueio: 'Muitos uploads em pouco tempo. Tente novamente em alguns minutos.'
    });
    const upload = await this.servicoMobile.solicitarUploadMidia(usuario.tenantId, dados, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'mobile.midia.upload_solicitar', 'arquivo_midia', upload.arquivo.id, {
      pacienteId: dados.pacienteId,
      tipo: dados.tipo,
      mimeType: dados.mimeType,
      tamanhoBytes: dados.tamanhoBytes
    });
    return upload;
  }

  @Post('midias/uploads/:arquivoId/confirmacao')
  async confirmarUploadMidia(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('arquivoId', ParseUUIDPipe) arquivoId: string
  ) {
    let arquivo;
    try {
      arquivo = await this.servicoMobile.confirmarUploadMidia(usuario.tenantId, arquivoId, usuario);
    } catch (erro) {
      // Reason code apenas: nunca o conteudo, o resultado do scanner ou o
      // texto interno do erro, que pode conter caminho/estrutura do arquivo.
      await this.registrarAuditoria(usuario, requisicao, 'mobile.midia.upload_rejeitado', 'arquivo_midia', arquivoId);
      throw erro;
    }
    await this.registrarAuditoria(usuario, requisicao, 'mobile.midia.upload_confirmar', 'arquivo_midia', arquivoId, {
      pacienteId: arquivo.pacienteId,
      mimeType: arquivo.mimeType,
      tamanhoBytes: arquivo.tamanhoBytes
    });
    return arquivo;
  }

  @Post('midias/uploads/:arquivoId/acesso')
  async gerarAcessoArquivoMidia(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('arquivoId', ParseUUIDPipe) arquivoId: string
  ) {
    const acesso = await this.servicoMobile.gerarAcessoArquivoMidia(usuario.tenantId, arquivoId, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'mobile.midia.visualizar', 'arquivo_midia', arquivoId);
    return acesso;
  }

  @Delete('midias/uploads/:arquivoId')
  async excluirArquivoMidia(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('arquivoId', ParseUUIDPipe) arquivoId: string
  ) {
    await this.servicoMobile.excluirArquivoMidia(usuario.tenantId, arquivoId, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'mobile.midia.excluir', 'arquivo_midia', arquivoId);
    return { status: 'excluido' };
  }

  @Get('acompanhantes')
  listarAcompanhantes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoMobile.listarAcompanhantes(usuario.tenantId, usuario);
  }

  @Post('acompanhantes')
  async criarAcompanhante(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarAcompanhanteDto
  ) {
    const acompanhante = await this.servicoMobile.criarAcompanhante(usuario.tenantId, dados, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'mobile.acompanhante.criar', 'acompanhante', acompanhante.id, {
      pacienteId: dados.pacienteId,
      possuiContato: Boolean(dados.contato)
    });
    return acompanhante;
  }

  @Post('sincronizacao/lote')
  @FeatureFlag('mobile.sync')
  async sincronizarLote(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: SincronizarLoteMobileDto
  ) {
    const lote = await this.servicoMobile.sincronizarLote(usuario.tenantId, dados, usuario);
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
