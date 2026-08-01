import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AlterarAtivacaoRegraDto, AvaliarRegraDto, CriarRegraAutomacaoDto } from '../aplicacao/dtos';
import { ServicoAutomacoes } from '../aplicacao/servico-automacoes';

@Controller('automacoes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
@Permissoes('automacoes.gerenciar')
export class ControladorAutomacoes {
  constructor(
    private readonly servicoAutomacoes: ServicoAutomacoes,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Post('regras')
  async criarRegra(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarRegraAutomacaoDto
  ) {
    const regra = await this.servicoAutomacoes.criarRegra(usuario.tenantId, dados, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'automacoes.regra.criar', 'regra_automacao', regra.id, {
      profissionalId: regra.profissionalId,
      ativa: regra.ativa,
      totalCondicoes: dados.condicoes.length,
      totalAcoes: dados.acoes.length
    });
    return regra;
  }

  @Get('regras')
  listarRegras(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoAutomacoes.listarRegras(usuario.tenantId, usuario);
  }

  @Get('avaliacoes')
  listarExecucoes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoAutomacoes.listarExecucoes(usuario.tenantId, usuario);
  }

  @Post('avaliacoes')
  async solicitarAvaliacao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AvaliarRegraDto
  ) {
    const execucao = await this.servicoAutomacoes.solicitarAvaliacao(usuario.tenantId, dados, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'automacoes.avaliacao.solicitar', 'execucao_regra', execucao.id, {
      regraId: dados.regraId,
      pacienteId: dados.pacienteId,
      status: execucao.status
    });
    return execucao;
  }

  @Post('simulacoes')
  async simularRegra(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: AvaliarRegraDto
  ) {
    const execucao = await this.servicoAutomacoes.simularRegra(usuario.tenantId, dados, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'automacoes.regra.simular', 'execucao_regra', execucao.id, {
      regraId: dados.regraId,
      pacienteId: dados.pacienteId,
      executar: execucao.resultado.executar
    });
    return execucao;
  }

  @Patch('regras/:id/ativacao')
  async alterarAtivacao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dados: AlterarAtivacaoRegraDto
  ) {
    const regra = await this.servicoAutomacoes.alterarAtivacao(usuario.tenantId, id, dados.ativa, usuario);
    await this.registrarAuditoria(usuario, requisicao, 'automacoes.regra.ativacao_alterar', 'regra_automacao', regra.id, {
      ativa: regra.ativa
    });
    return regra;
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
