import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AvaliarRegraDto, CriarRegraAutomacaoDto } from '../aplicacao/dtos';
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
      profissionalId: dados.profissionalId,
      ativa: dados.ativa ?? true,
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
    return this.servicoAutomacoes.listarExecucoes(usuario.tenantId);
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
