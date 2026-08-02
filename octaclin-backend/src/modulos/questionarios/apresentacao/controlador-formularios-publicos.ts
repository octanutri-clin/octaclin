import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { ServicoMobile } from '../../mobile/aplicacao/servico-mobile';
import { TipoMidiaMobile } from '../../mobile/dominio/validacao-midia';
import { FinalizarFormularioPacienteDto, SalvarRascunhoFormularioPacienteDto, SolicitarUploadFormularioPacienteDto } from '../aplicacao/dtos';
import { ServicoQuestionarios } from '../aplicacao/servico-questionarios';

@Controller('formularios')
export class ControladorFormulariosPublicos {
  constructor(
    private readonly servicoQuestionarios: ServicoQuestionarios,
    private readonly protecaoAbuso: ServicoProtecaoAbuso,
    private readonly servicoMobile: ServicoMobile,
    private readonly auditoria: ServicoAuditoria
  ) {}

  @Get(':token')
  obterFormulario(@Param('token') token: string) {
    return this.servicoQuestionarios.obterFormularioPaciente(token);
  }

  @Patch(':token/rascunho')
  async salvarRascunho(
    @Param('token') token: string,
    @Body() dados: SalvarRascunhoFormularioPacienteDto,
    @Req() requisicao: Request
  ) {
    await this.limitarEscrita(token, requisicao.ip ?? '');
    return this.servicoQuestionarios.salvarRascunhoFormularioPaciente(token, dados);
  }

  @Post(':token/respostas')
  async finalizarFormulario(
    @Param('token') token: string,
    @Body() dados: FinalizarFormularioPacienteDto,
    @Req() requisicao: Request
  ) {
    await this.limitarEscrita(token, requisicao.ip ?? '');
    return this.servicoQuestionarios.finalizarFormularioPaciente(token, dados);
  }

  @Post(':token/anexos')
  async solicitarUpload(
    @Param('token') token: string,
    @Body() dados: SolicitarUploadFormularioPacienteDto,
    @Req() requisicao: Request
  ) {
    await this.limitarEscrita(token, requisicao.ip ?? '');
    await this.limitarUpload(token, requisicao.ip ?? '');
    const contexto = await this.servicoQuestionarios.obterContextoFormularioPaciente(token);
    const pergunta = contexto.perguntas.find((item) => item.id === dados.perguntaId && item.tipo === 'upload_midia');
    if (!pergunta || !this.mimePermitido(dados.mimeType, pergunta.configuracao.tiposAceitos)) {
      throw new BadRequestException('Arquivo nao permitido para esta pergunta.');
    }
    const tipo = this.tipoMidia(dados.mimeType);
    const upload = await this.servicoMobile.solicitarUploadMidiaFormularioPublico(
      contexto.tenantId,
      {
        pacienteId: contexto.pacienteId,
        tipo,
        categoria: tipo === 'imagem' ? 'foto' : 'exame',
        nomeArquivo: dados.nomeArquivo,
        mimeType: dados.mimeType,
        tamanhoBytes: dados.tamanhoBytes
      },
      { envioid: contexto.envioId, perguntaid: dados.perguntaId }
    );
    await this.auditoria.registrar({
      tenantId: contexto.tenantId,
      acao: 'formulario_publico.anexo.solicitar',
      recursoTipo: 'arquivo_midia',
      recursoId: upload.arquivo.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { envioId: contexto.envioId, perguntaId: dados.perguntaId }
    });
    return upload;
  }

  @Post(':token/anexos/:arquivoId/confirmacao')
  async confirmarUpload(
    @Param('token') token: string,
    @Param('arquivoId', ParseUUIDPipe) arquivoId: string,
    @Body('perguntaId', ParseUUIDPipe) perguntaId: string,
    @Req() requisicao: Request
  ) {
    await this.limitarEscrita(token, requisicao.ip ?? '');
    const contexto = await this.servicoQuestionarios.obterContextoFormularioPaciente(token);
    const arquivo = await this.servicoMobile.confirmarUploadMidiaFormularioPublico(
      contexto.tenantId,
      arquivoId,
      contexto.pacienteId,
      { envioid: contexto.envioId, perguntaid: perguntaId }
    );
    await this.auditoria.registrar({
      tenantId: contexto.tenantId,
      acao: 'formulario_publico.anexo.confirmar',
      recursoTipo: 'arquivo_midia',
      recursoId: arquivoId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { envioId: contexto.envioId, perguntaId }
    });
    return arquivo;
  }

  private limitarEscrita(token: string, ip: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return this.protecaoAbuso.consumirTentativa(`formulario_publico:escrita:${ip || 'ip-desconhecido'}:${tokenHash}`, {
      maxTentativas: 120,
      janelaMs: 15 * 60 * 1000,
      bloqueioMs: 15 * 60 * 1000,
      mensagemBloqueio: 'Muitas atualizacoes deste formulario. Tente novamente em alguns minutos.'
    });
  }

  private limitarUpload(token: string, ip: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return this.protecaoAbuso.consumirTentativa(`formulario_publico:upload:${ip || 'ip-desconhecido'}:${tokenHash}`, {
      maxTentativas: 10,
      janelaMs: 15 * 60 * 1000,
      bloqueioMs: 15 * 60 * 1000,
      mensagemBloqueio: 'Muitos anexos enviados. Tente novamente em alguns minutos.'
    });
  }

  private mimePermitido(mimeType: string, configuracao: unknown): boolean {
    const aceitos = Array.isArray(configuracao) ? configuracao.filter((item): item is string => typeof item === 'string') : ['image/*'];
    return aceitos.some((aceito) => aceito === mimeType || (aceito.endsWith('/*') && mimeType.startsWith(aceito.slice(0, -1))));
  }

  private tipoMidia(mimeType: string): TipoMidiaMobile {
    if (mimeType.startsWith('image/')) return 'imagem';
    if (mimeType === 'application/pdf') return 'documento';
    throw new BadRequestException('Tipo de arquivo nao permitido.');
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
