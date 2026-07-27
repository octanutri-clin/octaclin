import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { FiltrosDashboardClinicoDto } from '../aplicacao/dtos-dashboard-clinico';
import { ServicoDashboardClinico } from '../aplicacao/servico-dashboard-clinico';

@Controller('dashboard')
@UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
@Papeis('SuperAdmin', 'Professional')
@Permissoes('dashboard.ler')
export class ControladorDashboardClinico {
  constructor(
    private readonly servicoDashboard: ServicoDashboardClinico,
    private readonly servicoAuditoria: ServicoAuditoria
  ) {}

  @Get('clinico')
  async obter(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Query() filtros: FiltrosDashboardClinicoDto
  ) {
    const resumo = await this.servicoDashboard.obterResumo(usuario.tenantId, filtros, usuario);

    if (usuario.papel === 'SuperAdmin' && filtros.profissionalId) {
      await this.servicoAuditoria.registrar({
        tenantId: usuario.tenantId,
        usuarioId: usuario.usuarioId,
        acao: 'dashboard.clinico.consultar_contexto_terceiro',
        recursoTipo: 'profissional',
        recursoId: filtros.profissionalId,
        metadados: { periodo: filtros.periodo ?? 'hoje' }
      });
    }

    return resumo;
  }

  @Post('clinico/alertas/:alertaId/ocultar')
  async ocultarAlerta(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('alertaId') alertaId: string
  ) {
    const ocultacao = await this.servicoDashboard.ocultarAlerta(
      usuario.tenantId,
      alertaId,
      usuario
    );

    await this.servicoAuditoria.registrar({
      tenantId: usuario.tenantId,
      usuarioId: usuario.usuarioId,
      acao: 'dashboard.clinico.alerta.ocultar',
      recursoTipo: 'dashboard_alerta',
      metadados: {
        alertaId: ocultacao.alertaId,
        ocultoAteEm: ocultacao.ocultoAteEm
      }
    });

    return ocultacao;
  }
}
