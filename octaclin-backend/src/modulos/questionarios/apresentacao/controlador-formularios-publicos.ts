import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request } from 'express';
import { ServicoProtecaoAbuso } from '../../auth/aplicacao/servico-protecao-abuso';
import { FinalizarFormularioPacienteDto, SalvarRascunhoFormularioPacienteDto } from '../aplicacao/dtos';
import { ServicoQuestionarios } from '../aplicacao/servico-questionarios';

@Controller('formularios')
export class ControladorFormulariosPublicos {
  constructor(
    private readonly servicoQuestionarios: ServicoQuestionarios,
    private readonly protecaoAbuso: ServicoProtecaoAbuso
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

  private limitarEscrita(token: string, ip: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return this.protecaoAbuso.consumirTentativa(`formulario_publico:escrita:${ip || 'ip-desconhecido'}:${tokenHash}`, {
      maxTentativas: 120,
      janelaMs: 15 * 60 * 1000,
      bloqueioMs: 15 * 60 * 1000,
      mensagemBloqueio: 'Muitas atualizacoes deste formulario. Tente novamente em alguns minutos.'
    });
  }
}
