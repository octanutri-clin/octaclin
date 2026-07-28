import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtualizarPacienteDto, AtualizarTarefaAcompanhamentoDto, CriarEvolucaoClinicaDto, CriarPacienteDto, CriarTarefaAcompanhamentoDto } from '../aplicacao/dtos';
import { ServicoPacientes } from '../aplicacao/servico-pacientes';

@Controller('pacientes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
@Permissoes('pacientes.ler')
export class ControladorPacientes {
  constructor(
    private readonly servicoPacientes: ServicoPacientes,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Post()
  @Permissoes('pacientes.gerenciar')
  async criar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarPacienteDto
  ) {
    const paciente = await this.servicoPacientes.criar(usuario.tenantId, dados, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.criar',
      recursoTipo: 'paciente',
      recursoId: paciente.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { profissionalResponsavelId: dados.profissionalResponsavelId }
    });
    return paciente;
  }

  @Get()
  @Permissoes('pacientes.listar')
  async listar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Query('pagina', new ParseIntPipe({ optional: true })) pagina = 1,
    @Query('limite', new ParseIntPipe({ optional: true })) limite = 25
  ) {
    const resultado = await this.servicoPacientes.listar(usuario.tenantId, usuario, pagina, limite);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.listar_dados_sensiveis',
      recursoTipo: 'paciente',
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { pagina, limite, total: resultado.total }
    });
    return resultado;
  }

  @Get(':id')
  async obter(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const paciente = await this.servicoPacientes.obterPorId(usuario.tenantId, id, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.obter_dados_sensiveis',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao)
    });
    return paciente;
  }

  @Get(':id/prontuario')
  async obterProntuario(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const prontuario = await this.servicoPacientes.obterProntuario(usuario.tenantId, id, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.prontuario.ler',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { eventos: prontuario.linhaDoTempo.length }
    });
    return prontuario;
  }

  @Get(':id/evolucoes')
  async listarEvolucoes(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const evolucoes = await this.servicoPacientes.listarEvolucoesClinicas(usuario.tenantId, id, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.evolucoes.listar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { total: evolucoes.length }
    });
    return evolucoes;
  }

  @Post(':id/evolucoes')
  @Permissoes('pacientes.gerenciar')
  async criarEvolucao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: CriarEvolucaoClinicaDto
  ) {
    const evolucao = await this.servicoPacientes.criarEvolucaoClinica(usuario.tenantId, id, usuario.usuarioId, dados, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.evolucoes.criar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { evolucaoId: evolucao.id, tipo: evolucao.tipo, visibilidade: evolucao.visibilidade }
    });
    return evolucao;
  }

  @Get(':id/tarefas-acompanhamento')
  async listarTarefasAcompanhamento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const tarefas = await this.servicoPacientes.listarTarefasAcompanhamento(usuario.tenantId, id, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.tarefas_acompanhamento.listar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { total: tarefas.length }
    });
    return tarefas;
  }

  @Post(':id/tarefas-acompanhamento')
  @Permissoes('pacientes.gerenciar')
  async criarTarefaAcompanhamento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: CriarTarefaAcompanhamentoDto
  ) {
    const tarefa = await this.servicoPacientes.criarTarefaAcompanhamento(usuario.tenantId, id, usuario.usuarioId, dados, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.tarefas_acompanhamento.criar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { tarefaId: tarefa.id, categoria: tarefa.categoria, prioridade: tarefa.prioridade }
    });
    return tarefa;
  }

  @Patch(':id/tarefas-acompanhamento/:tarefaId')
  @Permissoes('pacientes.gerenciar')
  async atualizarTarefaAcompanhamento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tarefaId', ParseUUIDPipe) tarefaId: string,
    @Body() dados: AtualizarTarefaAcompanhamentoDto
  ) {
    return this.atualizarTarefaAcompanhamentoComOrigem(
      usuario,
      requisicao,
      id,
      tarefaId,
      dados,
      'pacientes'
    );
  }

  @Patch('dashboard/:id/tarefas-acompanhamento/:tarefaId')
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('pacientes.gerenciar')
  async atualizarTarefaAcompanhamentoDashboard(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tarefaId', ParseUUIDPipe) tarefaId: string,
    @Body() dados: AtualizarTarefaAcompanhamentoDto
  ) {
    return this.atualizarTarefaAcompanhamentoComOrigem(
      usuario,
      requisicao,
      id,
      tarefaId,
      dados,
      'dashboard_clinico'
    );
  }

  private async atualizarTarefaAcompanhamentoComOrigem(
    usuario: UsuarioAutenticado,
    requisicao: Request,
    id: string,
    tarefaId: string,
    dados: AtualizarTarefaAcompanhamentoDto,
    origem: 'pacientes' | 'dashboard_clinico'
  ) {
    const tarefa = await this.servicoPacientes.atualizarTarefaAcompanhamento(usuario.tenantId, id, tarefaId, dados, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.tarefas_acompanhamento.atualizar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        tarefaId: tarefa.id,
        status: tarefa.status,
        origem
      }
    });
    return tarefa;
  }

  @Patch(':id')
  @Permissoes('pacientes.gerenciar')
  async atualizar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarPacienteDto
  ) {
    const paciente = await this.servicoPacientes.atualizar(usuario.tenantId, id, dados, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.atualizar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { statusAdesao: dados.statusAdesao }
    });
    return paciente;
  }

  @Delete(':id')
  @Permissoes('pacientes.gerenciar')
  async arquivar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.servicoPacientes.arquivar(usuario.tenantId, id, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.arquivar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao)
    });
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
