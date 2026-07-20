import {
  Body,
  Controller,
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
import { Papeis, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  AtualizarQuestionarioDto,
  AtualizarPerguntaDto,
  CriarAgendamentoQuestionarioDto,
  CriarCategoriaPerguntaDto,
  CriarPerguntaDto,
  CriarQuestionarioDto,
  DuplicarQuestionarioDto,
  ReordenarPerguntasDto
} from '../aplicacao/dtos';
import { ServicoQuestionarios } from '../aplicacao/servico-questionarios';

@Controller()
@UseGuards(GuardaJwt, GuardaPapeis)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorQuestionarios {
  constructor(
    private readonly servicoQuestionarios: ServicoQuestionarios,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Post('categorias-pergunta')
  async criarCategoria(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarCategoriaPerguntaDto
  ) {
    const categoria = await this.servicoQuestionarios.criarCategoria(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'questionarios.categoria.criar', 'categoria_pergunta', categoria.id, {
      ordem: dados.ordem
    });
    return categoria;
  }

  @Get('categorias-pergunta')
  listarCategorias(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoQuestionarios.listarCategorias(usuario.tenantId);
  }

  @Post('questionarios')
  async criarQuestionario(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarQuestionarioDto
  ) {
    const questionario = await this.servicoQuestionarios.criarQuestionario(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'questionarios.criar', 'questionario', questionario.id, {
      profissionalId: dados.profissionalId
    });
    return questionario;
  }

  @Get('questionarios')
  listarQuestionarios(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query('pagina', new ParseIntPipe({ optional: true })) pagina = 1,
    @Query('limite', new ParseIntPipe({ optional: true })) limite = 25
  ) {
    return this.servicoQuestionarios.listarQuestionarios(usuario.tenantId, pagina, limite);
  }

  @Patch('questionarios/:id')
  async atualizarQuestionario(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AtualizarQuestionarioDto
  ) {
    const questionario = await this.servicoQuestionarios.atualizarQuestionario(usuario.tenantId, id, dados);
    await this.registrarAuditoria(usuario, requisicao, 'questionarios.atualizar', 'questionario', id, {
      status: dados.status
    });
    return questionario;
  }

  @Post('questionarios/:id/duplicar')
  async duplicarQuestionario(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: DuplicarQuestionarioDto
  ) {
    const duplicado = await this.servicoQuestionarios.duplicarQuestionario(usuario.tenantId, id, dados);
    await this.registrarAuditoria(usuario, requisicao, 'questionarios.duplicar', 'questionario', duplicado.id, {
      origemId: id
    });
    return duplicado;
  }

  @Post('questionarios/:id/perguntas')
  async adicionarPergunta(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: CriarPerguntaDto
  ) {
    const pergunta = await this.servicoQuestionarios.adicionarPergunta(usuario.tenantId, id, dados);
    await this.registrarAuditoria(usuario, requisicao, 'questionarios.pergunta.criar', 'pergunta', pergunta.id, {
      questionarioId: id,
      categoriaId: dados.categoriaId,
      tipo: dados.tipo,
      obrigatoria: dados.obrigatoria
    });
    return pergunta;
  }

  @Get('questionarios/:id/perguntas')
  listarPerguntas(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.servicoQuestionarios.listarPerguntas(usuario.tenantId, id);
  }

  @Patch('questionarios/:id/perguntas/ordem')
  async reordenarPerguntas(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: ReordenarPerguntasDto
  ) {
    const perguntas = await this.servicoQuestionarios.reordenarPerguntas(usuario.tenantId, id, dados);
    await this.registrarAuditoria(usuario, requisicao, 'questionarios.perguntas.reordenar', 'questionario', id, {
      totalPerguntas: dados.perguntas.length
    });
    return perguntas;
  }

  @Patch('questionarios/:id/perguntas/:perguntaId')
  async atualizarPergunta(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('perguntaId', ParseUUIDPipe) perguntaId: string,
    @Body() dados: AtualizarPerguntaDto
  ) {
    const pergunta = await this.servicoQuestionarios.atualizarPergunta(usuario.tenantId, id, perguntaId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'questionarios.pergunta.atualizar', 'pergunta', perguntaId, {
      questionarioId: id,
      categoriaId: dados.categoriaId,
      tipo: dados.tipo,
      obrigatoria: dados.obrigatoria
    });
    return pergunta;
  }

  @Post('agendamentos-questionario')
  async criarAgendamento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarAgendamentoQuestionarioDto
  ) {
    const agendamento = await this.servicoQuestionarios.criarAgendamento(usuario.tenantId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'questionarios.agendamento.criar', 'agendamento_questionario', agendamento.id, {
      questionarioId: dados.questionarioId,
      timezone: dados.timezone
    });
    return agendamento;
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
