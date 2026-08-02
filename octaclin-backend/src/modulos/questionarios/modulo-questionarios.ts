import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { TenantOrm } from '../tenancy/infraestrutura/tenant.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ModuloMobile } from '../mobile/modulo-mobile';
import { ServicoQuestionarios } from './aplicacao/servico-questionarios';
import { ProcessadorAgendamentosQuestionario } from './aplicacao/processador-agendamentos';
import { ControladorFormulariosPublicos } from './apresentacao/controlador-formularios-publicos';
import { ControladorQuestionarios } from './apresentacao/controlador-questionarios';
import { AgendamentoQuestionarioOrm } from './infraestrutura/agendamento-questionario.orm';
import { CategoriaPerguntaOrm } from './infraestrutura/categoria-pergunta.orm';
import { EnvioQuestionarioOrm } from './infraestrutura/envio-questionario.orm';
import { OpcaoPerguntaOrm } from './infraestrutura/opcao-pergunta.orm';
import { PerguntaOrm } from './infraestrutura/pergunta.orm';
import { QuestionarioOrm } from './infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from './infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from './infraestrutura/resposta-valor.orm';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      TenantOrm,
      PacienteOrm,
      CategoriaPerguntaOrm,
      QuestionarioOrm,
      PerguntaOrm,
      OpcaoPerguntaOrm,
      AgendamentoQuestionarioOrm,
      EnvioQuestionarioOrm,
      RespostaCheckinOrm,
      RespostaValorOrm,
      UserActionLogOrm
    ]),
    ModuloAuth,
    ModuloTenancy,
    ModuloMobile
  ],
  controllers: [ControladorQuestionarios, ControladorFormulariosPublicos],
  providers: [ServicoQuestionarios, ProcessadorAgendamentosQuestionario, ServicoAuditoria],
  exports: [ServicoQuestionarios]
})
export class ModuloQuestionarios {}
