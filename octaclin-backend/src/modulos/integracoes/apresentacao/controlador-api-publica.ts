import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CriarConsultaApiPublicaDto, CriarPacienteApiPublicaDto, ListarApiPublicaDto, ListarConsultasApiPublicaDto } from '../aplicacao/dtos';
import { ServicoApiPublica } from '../aplicacao/servico-api-publica';
import type { ContextoApiPublica } from '../dominio/contratos-integracao';
import { EscoposApiPublica, IntegracaoAtual } from './decorators-api-publica';
import { GuardaChaveApi } from './guarda-chave-api';
import { GuardaEscopoApi } from './guarda-escopo-api';

@Controller('v1')
@UseGuards(GuardaChaveApi, GuardaEscopoApi)
export class ControladorApiPublica {
  constructor(private readonly servico: ServicoApiPublica) {}

  @Get('pacientes')
  @EscoposApiPublica('pacientes:ler')
  listarPacientes(@IntegracaoAtual() contexto: ContextoApiPublica, @Query() filtros: ListarApiPublicaDto) {
    return this.servico.listarPacientes(contexto, filtros);
  }

  @Get('pacientes/:id')
  @EscoposApiPublica('pacientes:ler')
  obterPaciente(@IntegracaoAtual() contexto: ContextoApiPublica, @Param('id', ParseUUIDPipe) id: string) {
    return this.servico.obterPaciente(contexto, id);
  }

  @Post('pacientes')
  @EscoposApiPublica('pacientes:escrever')
  criarPaciente(@IntegracaoAtual() contexto: ContextoApiPublica, @Body() dados: CriarPacienteApiPublicaDto) {
    return this.servico.criarPaciente(contexto, dados);
  }

  @Get('consultas')
  @EscoposApiPublica('agenda:ler')
  listarConsultas(@IntegracaoAtual() contexto: ContextoApiPublica, @Query() filtros: ListarConsultasApiPublicaDto) {
    return this.servico.listarConsultas(contexto, filtros);
  }

  @Post('consultas')
  @EscoposApiPublica('agenda:escrever')
  criarConsulta(@IntegracaoAtual() contexto: ContextoApiPublica, @Body() dados: CriarConsultaApiPublicaDto) {
    return this.servico.criarConsulta(contexto, dados);
  }

  @Delete('consultas/:id')
  @EscoposApiPublica('agenda:escrever')
  cancelarConsulta(@IntegracaoAtual() contexto: ContextoApiPublica, @Param('id', ParseUUIDPipe) id: string) {
    return this.servico.cancelarConsulta(contexto, id);
  }
}
