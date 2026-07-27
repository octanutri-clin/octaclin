import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { AgendaConsultaOrm } from '../agenda/infraestrutura/agenda-consulta.orm';
import { AgendaSolicitacaoOrm } from '../agenda/infraestrutura/agenda-solicitacao.orm';
import { MensagemNotificacaoOrm } from '../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { AcompanhamentoTarefaOrm } from '../pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../profissionais/infraestrutura/profissional.orm';
import { EnvioQuestionarioOrm } from '../questionarios/infraestrutura/envio-questionario.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoDashboardClinico } from './aplicacao/servico-dashboard-clinico';
import { ControladorDashboardClinico } from './apresentacao/controlador-dashboard-clinico';
import { DashboardAlertaOcultoOrm } from './infraestrutura/dashboard-alerta-oculto.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgendaConsultaOrm,
      AgendaSolicitacaoOrm,
      MensagemNotificacaoOrm,
      AcompanhamentoTarefaOrm,
      PacienteOrm,
      ProfissionalOrm,
      EnvioQuestionarioOrm,
      DashboardAlertaOcultoOrm,
      UserActionLogOrm
    ]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorDashboardClinico],
  providers: [ServicoDashboardClinico, ServicoAuditoria]
})
export class ModuloDashboard {}
