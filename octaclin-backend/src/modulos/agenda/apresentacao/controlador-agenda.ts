import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CriarConsultaAgendaDto } from '../aplicacao/dtos';
import { ServicoAgenda } from '../aplicacao/servico-agenda';

@Controller('agenda')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional', 'Collaborator')
@Permissoes('agenda.consultas.ler')
export class ControladorAgenda {
  constructor(
    private readonly servicoAgenda: ServicoAgenda,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get('consultas')
  listarConsultas(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servicoAgenda.listarConsultas(usuario.tenantId);
  }

  @Post('consultas')
  @Permissoes('agenda.consultas.criar')
  async criarConsulta(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Req() requisicao: Request,
    @Body() dados: CriarConsultaAgendaDto
  ) {
    const consulta = await this.servicoAgenda.criarConsulta(usuario.tenantId, dados);
    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'agenda.consulta.criar',
      recursoTipo: 'agenda_consulta',
      recursoId: consulta.id,
      ip: requisicao.ip,
      userAgent: this.obterUserAgent(requisicao),
      metadados: {
        pacienteId: dados.pacienteId,
        profissionalId: dados.profissionalId,
        googleEventId: consulta.googleEventId,
        notificacoes: consulta.notificacoes
      }
    });
    return consulta;
  }

  private obterUserAgent(requisicao: Request): string | undefined {
    const userAgent = requisicao.headers['user-agent'];
    return Array.isArray(userAgent) ? userAgent.join(', ') : userAgent;
  }
}
