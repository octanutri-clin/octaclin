import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import {
  ConsultarRecebimentosDto,
  CriarPacoteSessaoDto,
  RegistrarPagamentoConsultaDto
} from '../aplicacao/dtos';
import { ServicoFinanceiroAgenda } from '../aplicacao/servico-financeiro-agenda';

/**
 * Caminho de dinheiro: **toda rota audita**, inclusive leitura. E o que permite
 * responder "quem marcou esta consulta como paga" e "quem consultou o
 * faturamento do mes".
 */
@Controller('agenda')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
export class ControladorFinanceiroAgenda {
  constructor(
    private readonly servicoFinanceiro: ServicoFinanceiroAgenda,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Post('consultas/:consultaId/pagamento')
  @Papeis('SuperAdmin', 'Professional', 'Collaborator')
  @Permissoes('agenda.consultas.criar')
  async registrarPagamento(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('consultaId', ParseUUIDPipe) consultaId: string,
    @Body() dados: RegistrarPagamentoConsultaDto
  ) {
    const consulta = await this.servicoFinanceiro.registrarPagamento(usuario.tenantId, consultaId, dados, usuario);
    await this.registrar(usuario, requisicao, 'agenda.consulta.pagamento', 'agenda_consulta', consultaId, {
      statusPagamento: consulta.statusPagamento,
      valorCentavos: consulta.valorCentavos,
      formaPagamento: consulta.formaPagamento
    });
    return consulta;
  }

  @Get('financeiro/recebimentos')
  @Papeis('SuperAdmin', 'Professional', 'Client')
  @Permissoes('agenda.financeiro.ler')
  async recebimentos(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Query() filtro: ConsultarRecebimentosDto
  ) {
    const resumo = await this.servicoFinanceiro.resumoRecebimentos(usuario.tenantId, filtro, usuario);
    await this.registrar(usuario, requisicao, 'agenda.financeiro.ler', 'agenda_financeiro', usuario.tenantId, {
      inicioEm: filtro.inicioEm,
      fimEm: filtro.fimEm,
      profissionalId: filtro.profissionalId
    });
    return resumo;
  }

  @Get('pacotes')
  @Papeis('SuperAdmin', 'Professional', 'Collaborator')
  @Permissoes('agenda.consultas.ler')
  listarPacotes(@UsuarioAtual() usuario: UsuarioAutenticado, @Query('pacienteId') pacienteId?: string) {
    return this.servicoFinanceiro.listarPacotes(usuario.tenantId, usuario, pacienteId);
  }

  @Post('pacotes')
  @Papeis('SuperAdmin', 'Professional', 'Collaborator')
  @Permissoes('agenda.consultas.criar')
  async criarPacote(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarPacoteSessaoDto
  ) {
    const pacote = await this.servicoFinanceiro.criarPacote(usuario.tenantId, dados, usuario);
    await this.registrar(usuario, requisicao, 'agenda.pacote.criar', 'pacote_sessao', pacote.id, {
      pacienteId: pacote.pacienteId,
      sessoesContratadas: pacote.sessoesContratadas,
      valorTotalCentavos: pacote.valorTotalCentavos,
      statusPagamento: pacote.statusPagamento
    });
    return pacote;
  }

  @Delete('pacotes/:pacoteId')
  @Papeis('SuperAdmin', 'Professional', 'Collaborator')
  @Permissoes('agenda.consultas.criar')
  async cancelarPacote(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('pacoteId', ParseUUIDPipe) pacoteId: string
  ) {
    const pacote = await this.servicoFinanceiro.cancelarPacote(usuario.tenantId, pacoteId, usuario);
    await this.registrar(usuario, requisicao, 'agenda.pacote.cancelar', 'pacote_sessao', pacoteId, {
      sessoesConsumidas: pacote.sessoesConsumidas
    });
    return pacote;
  }

  private async registrar(
    usuario: UsuarioAutenticado,
    requisicao: Request,
    acao: string,
    recursoTipo: string,
    recursoId: string,
    metadados: Record<string, unknown>
  ) {
    const userAgent = requisicao.headers['user-agent'];
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao,
      recursoTipo,
      recursoId,
      ip: requisicao.ip,
      userAgent: Array.isArray(userAgent) ? userAgent.join(', ') : userAgent,
      metadados
    });
  }
}
