import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CancelarDocumentoClinicoDto, EmitirDocumentoClinicoDto } from '../aplicacao/dtos';
import { ServicoDocumentosClinicos } from '../aplicacao/servico-documentos-clinicos';

/**
 * Documento clinico e dado saindo do sistema para a mao de terceiro. Toda rota
 * daqui deixa registro na auditoria — inclusive a leitura, que e o que permite
 * responder "quem abriu a declaracao deste paciente".
 */
@Controller('pacientes/:pacienteId/documentos')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
@Permissoes('pacientes.ler')
export class ControladorDocumentosClinicos {
  constructor(
    private readonly servicoDocumentos: ServicoDocumentosClinicos,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get()
  async listar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string
  ) {
    const documentos = await this.servicoDocumentos.listar(usuario.tenantId, pacienteId, usuario);
    await this.registrar(usuario, requisicao, 'pacientes.documentos.listar', pacienteId, {
      total: documentos.length
    });
    return documentos;
  }

  @Get(':documentoId')
  async obter(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string
  ) {
    const documento = await this.servicoDocumentos.obter(usuario.tenantId, pacienteId, documentoId, usuario);
    await this.registrar(usuario, requisicao, 'pacientes.documentos.abrir', pacienteId, {
      documentoId,
      tipo: documento.tipo
    });
    return documento;
  }

  @Post()
  @Permissoes('pacientes.gerenciar')
  async emitir(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: EmitirDocumentoClinicoDto
  ) {
    const documento = await this.servicoDocumentos.emitir(usuario.tenantId, pacienteId, usuario, dados);
    await this.registrar(usuario, requisicao, 'pacientes.documentos.emitir', pacienteId, {
      documentoId: documento.id,
      tipo: documento.tipo,
      consultaId: documento.consultaId,
      variaveisVazias: documento.variaveisVazias
    });
    return documento;
  }

  @Post(':documentoId/cancelamento')
  @Permissoes('pacientes.gerenciar')
  async cancelar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string,
    @Body() dados: CancelarDocumentoClinicoDto
  ) {
    const documento = await this.servicoDocumentos.cancelar(
      usuario.tenantId,
      pacienteId,
      documentoId,
      usuario,
      dados
    );
    await this.registrar(usuario, requisicao, 'pacientes.documentos.cancelar', pacienteId, {
      documentoId,
      tipo: documento.tipo
    });
    return documento;
  }

  @Post(':documentoId/envio')
  @Permissoes('pacientes.gerenciar')
  async enviar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Param('documentoId', ParseUUIDPipe) documentoId: string
  ) {
    const resultado = await this.servicoDocumentos.enviarPorEmail(
      usuario.tenantId,
      pacienteId,
      documentoId,
      usuario
    );
    await this.registrar(usuario, requisicao, 'pacientes.documentos.enviar', pacienteId, {
      documentoId,
      status: resultado.status,
      motivo: resultado.motivo
    });
    return resultado;
  }

  private registrar(
    usuario: UsuarioAutenticado,
    requisicao: Request,
    acao: string,
    pacienteId: string,
    metadados: Record<string, unknown>
  ) {
    return this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao,
      recursoTipo: 'paciente',
      recursoId: pacienteId,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados
    });
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const valor = requisicao.headers['user-agent'];
    return Array.isArray(valor) ? valor[0] : valor;
  }
}
