import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { RegistrarConsentimentoEvolucaoFotograficaDto } from '../aplicacao/dtos';
import { ServicoConsentimentosEvolucaoFotografica } from '../aplicacao/servico-consentimentos-evolucao-fotografica';

@Controller('pacientes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorConsentimentosEvolucaoFotografica {
  constructor(private readonly servico: ServicoConsentimentosEvolucaoFotografica, private readonly auditoria: ServicoAuditoria) {}

  @Get(':id/evolucoes-fotograficas/consentimentos')
  @Permissoes('pacientes.ler')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string) {
    const itens = await this.servico.listar(usuario.tenantId, pacienteId, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.evolucao_fotografica.consentimentos_listar', pacienteId, { total: itens.length });
    return itens;
  }

  @Post(':id/evolucoes-fotograficas/consentimentos')
  @Permissoes('pacientes.gerenciar')
  async registrar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string, @Body() dados: RegistrarConsentimentoEvolucaoFotograficaDto) {
    const item = await this.servico.registrar(usuario.tenantId, pacienteId, dados, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.evolucao_fotografica.consentimento_registrar', pacienteId, { consentimentoId: item.id, versao: item.versao, retencaoAte: item.retencaoAte });
    return item;
  }

  @Post(':id/evolucoes-fotograficas/consentimentos/:consentimentoId/revogacao')
  @Permissoes('pacientes.gerenciar')
  async revogar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string, @Param('consentimentoId', ParseUUIDPipe) consentimentoId: string) {
    const item = await this.servico.revogar(usuario.tenantId, pacienteId, consentimentoId, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.evolucao_fotografica.consentimento_revogar', pacienteId, { consentimentoId: item.id });
    return item;
  }

  private async auditar(usuario: UsuarioAutenticado, requisicao: Request, acao: string, pacienteId: string, metadados: Record<string, unknown>) {
    const userAgent = requisicao.headers['user-agent'];
    await this.auditoria.registrar({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao, recursoTipo: 'paciente', recursoId: pacienteId, ip: requisicao.ip, userAgent: Array.isArray(userAgent) ? userAgent.join(', ') : userAgent, metadados });
  }
}
