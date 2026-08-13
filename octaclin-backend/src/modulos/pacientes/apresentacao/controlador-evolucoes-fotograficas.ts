import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { SolicitarUploadEvolucaoFotograficaDto } from '../aplicacao/dtos';
import { ServicoEvolucoesFotograficas } from '../aplicacao/servico-evolucoes-fotograficas';

@Controller('pacientes')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
export class ControladorEvolucoesFotograficas {
  constructor(private readonly servico: ServicoEvolucoesFotograficas, private readonly auditoria: ServicoAuditoria) {}

  @Get(':id/evolucoes-fotograficas')
  @Permissoes('pacientes.ler')
  async listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string) {
    const itens = await this.servico.listar(usuario.tenantId, pacienteId, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.evolucao_fotografica.listar', pacienteId, { total: itens.length });
    return itens;
  }

  @Post(':id/evolucoes-fotograficas/uploads')
  @Permissoes('pacientes.gerenciar')
  async solicitarUpload(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string, @Body() dados: SolicitarUploadEvolucaoFotograficaDto) {
    const resultado = await this.servico.solicitarUpload(usuario.tenantId, pacienteId, dados, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.evolucao_fotografica.upload_solicitar', pacienteId, { evolucaoFotograficaId: resultado.evolucaoId, arquivoId: resultado.upload.arquivo.id, mimeType: dados.mimeType, tamanhoBytes: dados.tamanhoBytes });
    return resultado;
  }

  @Delete(':id/evolucoes-fotograficas/:evolucaoId')
  @Permissoes('pacientes.gerenciar')
  async excluir(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Param('id', ParseUUIDPipe) pacienteId: string, @Param('evolucaoId', ParseUUIDPipe) evolucaoId: string) {
    const resultado = await this.servico.excluir(usuario.tenantId, pacienteId, evolucaoId, usuario);
    await this.auditar(usuario, requisicao, 'pacientes.evolucao_fotografica.excluir', pacienteId, { evolucaoFotograficaId: evolucaoId, arquivosRemovidos: resultado.arquivosRemovidos });
    return { status: 'excluida' };
  }

  private async auditar(usuario: UsuarioAutenticado, requisicao: Request, acao: string, pacienteId: string, metadados: Record<string, unknown>) {
    const userAgent = requisicao.headers['user-agent'];
    await this.auditoria.registrar({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, acao, recursoTipo: 'paciente', recursoId: pacienteId, ip: requisicao.ip, userAgent: Array.isArray(userAgent) ? userAgent.join(', ') : userAgent, metadados });
  }
}
