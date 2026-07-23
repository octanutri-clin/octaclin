import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarMaterialEducativoDto, EnviarMaterialPacienteDto } from '../aplicacao/dtos';
import { ServicoMateriais } from '../aplicacao/servico-materiais';

@Controller('materiais')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
@Permissoes('materiais.ler')
export class ControladorMateriais {
  constructor(
    private readonly servicoMateriais: ServicoMateriais,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get()
  listar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoMateriais.listarMateriais(usuario.tenantId);
  }

  @Post()
  @Permissoes('materiais.gerenciar')
  async criar(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: Request, @Body() dados: CriarMaterialEducativoDto) {
    const material = await this.servicoMateriais.criarMaterial(usuario.tenantId, usuario.usuarioId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'materiais.criar', 'material_educativo', material.id, {
      tipo: material.tipo,
      categoria: material.categoria
    });
    return material;
  }

  @Get('pacientes/:pacienteId')
  @Permissoes('materiais.ler', 'pacientes.ler')
  async listarPaciente(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('pacienteId', ParseUUIDPipe) pacienteId: string) {
    return this.servicoMateriais.listarMateriaisPaciente(usuario.tenantId, pacienteId);
  }

  @Post('pacientes/:pacienteId')
  @Permissoes('materiais.gerenciar', 'pacientes.gerenciar')
  async enviarPaciente(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Param('pacienteId', ParseUUIDPipe) pacienteId: string,
    @Body() dados: EnviarMaterialPacienteDto
  ) {
    const envio = await this.servicoMateriais.enviarMaterialParaPaciente(usuario.tenantId, pacienteId, usuario.usuarioId, dados);
    await this.registrarAuditoria(usuario, requisicao, 'materiais.enviar_paciente', 'paciente', pacienteId, {
      materialId: envio.materialId,
      envioId: envio.id,
      tipo: envio.tipo
    });
    return envio;
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
