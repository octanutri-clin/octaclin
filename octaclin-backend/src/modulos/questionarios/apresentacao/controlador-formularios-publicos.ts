import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FinalizarFormularioPacienteDto } from '../aplicacao/dtos';
import { ServicoQuestionarios } from '../aplicacao/servico-questionarios';

@Controller('formularios')
export class ControladorFormulariosPublicos {
  constructor(private readonly servicoQuestionarios: ServicoQuestionarios) {}

  @Get(':token')
  obterFormulario(@Param('token') token: string) {
    return this.servicoQuestionarios.obterFormularioPaciente(token);
  }

  @Post(':token/respostas')
  finalizarFormulario(@Param('token') token: string, @Body() dados: FinalizarFormularioPacienteDto) {
    return this.servicoQuestionarios.finalizarFormularioPaciente(token, dados);
  }
}
