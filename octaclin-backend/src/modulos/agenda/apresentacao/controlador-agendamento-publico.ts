import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CriarSolicitacaoAgendamentoPublicoDto } from '../aplicacao/dtos';
import { ServicoAgendamentoPublico } from '../aplicacao/servico-agendamento-publico';

@Controller('agendamentos-publicos')
export class ControladorAgendamentoPublico {
  constructor(private readonly servicoAgendamentoPublico: ServicoAgendamentoPublico) {}

  @Get(':token')
  obterAgendaPublica(@Param('token') token: string, @Req() requisicao: Request) {
    return this.servicoAgendamentoPublico.obterAgendaPublica(token, requisicao.ip ?? '');
  }

  @Post(':token/solicitacoes')
  criarSolicitacaoPublica(
    @Param('token') token: string,
    @Body() dados: CriarSolicitacaoAgendamentoPublicoDto,
    @Req() requisicao: Request
  ) {
    return this.servicoAgendamentoPublico.criarSolicitacaoPublica(token, dados, requisicao.ip ?? '');
  }
}
