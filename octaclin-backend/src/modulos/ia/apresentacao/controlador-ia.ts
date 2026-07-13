import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AnalisarSentimentoDto, ReconhecerAlimentoDto } from '../aplicacao/dtos';
import { ServicoIa } from '../aplicacao/servico-ia';

@Controller('ia')
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorIa {
  constructor(
    private readonly servicoIa: ServicoIa,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get('sentimento')
  listarAnalisesSentimento(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoIa.listarAnalisesSentimento(usuario.tenantId);
  }

  @Post('sentimento')
  async analisarSentimento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AnalisarSentimentoDto
  ) {
    const analise = await this.servicoIa.analisarSentimento(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'ia.sentimento.analisar', 'analise_sentimento', analise.id, {
      pacienteId: dados.pacienteId,
      respostaCheckinId: dados.respostaCheckinId,
      transcricaoMidiaId: dados.transcricaoMidiaId,
      alertaDisparado: analise.alertaDisparado
    });
    return analise;
  }

  @Get('reconhecimento-alimentar')
  listarReconhecimentosAlimentares(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoIa.listarReconhecimentosAlimentares(usuario.tenantId);
  }

  @Post('reconhecimento-alimentar')
  async reconhecerAlimento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: ReconhecerAlimentoDto
  ) {
    const reconhecimento = await this.servicoIa.reconhecerAlimento(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'ia.reconhecimento_alimentar.criar', 'reconhecimento_alimentar', reconhecimento.id, {
      pacienteId: dados.pacienteId,
      arquivoMidiaId: dados.arquivoMidiaId,
      totalAlimentos: reconhecimento.alimentosDetectados.length
    });
    return reconhecimento;
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
