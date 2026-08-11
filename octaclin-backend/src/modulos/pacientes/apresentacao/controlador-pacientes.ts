import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
import { AtualizarPacienteDto, AtualizarTarefaAcompanhamentoDto, CriarAvaliacaoAntropometricaDto, CriarEvolucaoClinicaDto, CriarPacienteDto, CriarTarefaAcompanhamentoDto, ImportarPacientesDto, ListarLinhaTempoProntuarioDto, ListarPacientesDto } from '../aplicacao/dtos';
import { ServicoImportacaoPacientes } from '../aplicacao/servico-importacao-pacientes';
import { ServicoPacientes } from '../aplicacao/servico-pacientes';

@Controller('pacientes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
@Permissoes('pacientes.ler')
export class ControladorPacientes {
  constructor(
    private readonly servicoPacientes: ServicoPacientes,
    private readonly servicoImportacao: ServicoImportacaoPacientes,
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
    @Query() filtros: ListarPacientesDto
  ) {
    const resultado = await this.servicoPacientes.listar(
      usuario.tenantId,
      usuario,
      filtros.pagina,
      filtros.limite,
      filtros
    );
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.listar_dados_sensiveis',
      recursoTipo: 'paciente',
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { pagina: filtros.pagina, limite: filtros.limite, total: resultado.total }
    });
    return resultado;
  }

  @Get('arquivados')
  @Permissoes('pacientes.listar')
  async listarArquivados(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Query('pagina', new ParseIntPipe({ optional: true })) pagina = 1,
    @Query('limite', new ParseIntPipe({ optional: true })) limite = 25
  ) {
    const resultado = await this.servicoPacientes.listarArquivados(usuario.tenantId, usuario, pagina, limite);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.lixeira.listar',
      recursoTipo: 'paciente',
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { pagina, limite, total: resultado.total }
    });
    return resultado;
  }

  @Get('exportar.csv')
  @Permissoes('pacientes.listar')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="octaclin-pacientes.csv"')
  async exportarCsv(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Query() filtros: ListarPacientesDto
  ) {
    const csv = await this.servicoPacientes.exportarCsv(usuario.tenantId, usuario, filtros);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.exportar_csv',
      recursoTipo: 'paciente',
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      // Exportacao em massa de PHI: a trilha registra o volume levado, nao so
      // que alguem clicou em exportar.
      metadados: { linhas: Math.max(csv.trim().split('\n').length - 1, 0), filtros: { ...filtros } }
    });
    return csv;
  }

  @Post('importar/previa')
  @Permissoes('pacientes.gerenciar')
  previaImportacao(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dados: ImportarPacientesDto) {
    return this.servicoImportacao.previa(usuario.tenantId, usuario, dados);
  }

  @Post('importar')
  @Permissoes('pacientes.gerenciar')
  async importar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: ImportarPacientesDto
  ) {
    const relatorio = await this.servicoImportacao.importar(usuario.tenantId, usuario, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.importar_csv',
      recursoTipo: 'paciente',
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        total: relatorio.total,
        criados: relatorio.criados,
        duplicados: relatorio.duplicados,
        invalidos: relatorio.invalidos,
        bloqueadosPorPlano: relatorio.bloqueadosPorPlano,
        convitesCriados: relatorio.convitesCriados
      }
    });
    return relatorio;
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

  @Get(':id/prontuario/timeline')
  async listarLinhaDoTempoPaginada(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filtros: ListarLinhaTempoProntuarioDto
  ) {
    const pagina = await this.servicoPacientes.listarLinhaDoTempoPaginada(
      usuario.tenantId,
      id,
      usuario,
      filtros
    );
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.prontuario.timeline.listar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { eventos: pagina.itens.length, paginada: true }
    });
    return pagina;
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

  @Get(':id/avaliacoes-antropometricas')
  async listarAvaliacoesAntropometricas(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const serie = await this.servicoPacientes.listarAvaliacoesAntropometricas(usuario.tenantId, id, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.antropometria.listar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { total: serie.avaliacoes.length }
    });
    return serie;
  }

  @Post(':id/avaliacoes-antropometricas')
  @Permissoes('pacientes.gerenciar')
  async registrarAvaliacaoAntropometrica(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: CriarAvaliacaoAntropometricaDto
  ) {
    const avaliacao = await this.servicoPacientes.registrarAvaliacaoAntropometrica(
      usuario.tenantId,
      id,
      usuario.usuarioId,
      dados,
      usuario
    );
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.antropometria.registrar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      // Medida e resultado sao dado clinico: so o metodo entra na auditoria.
      metadados: {
        avaliacaoId: avaliacao.id,
        protocolo: avaliacao.protocolo,
        avaliadaEm: avaliacao.avaliadaEm,
        avisos: avaliacao.resultado.avisos.length
      }
    });
    return avaliacao;
  }

  @Delete(':id/avaliacoes-antropometricas/:avaliacaoId')
  @Permissoes('pacientes.gerenciar')
  async excluirAvaliacaoAntropometrica(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('avaliacaoId', ParseUUIDPipe) avaliacaoId: string
  ) {
    const excluida = await this.servicoPacientes.excluirAvaliacaoAntropometrica(
      usuario.tenantId,
      id,
      avaliacaoId,
      usuario
    );
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.antropometria.excluir',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: { avaliacaoId: excluida.id }
    });
    return excluida;
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

  @Patch(':id/restaurar')
  @Permissoes('pacientes.gerenciar')
  async restaurar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    await this.servicoPacientes.restaurar(usuario.tenantId, id, usuario);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'pacientes.restaurar',
      recursoTipo: 'paciente',
      recursoId: id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao)
    });
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
