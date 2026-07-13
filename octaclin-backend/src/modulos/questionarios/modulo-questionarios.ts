import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { TenantOrm } from '../tenancy/infraestrutura/tenant.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoQuestionarios } from './aplicacao/servico-questionarios';
import { ProcessadorAgendamentosQuestionario } from './aplicacao/processador-agendamentos';
import { ControladorQuestionarios } from './apresentacao/controlador-questionarios';
import { AgendamentoQuestionarioOrm } from './infraestrutura/agendamento-questionario.orm';
import { CategoriaPerguntaOrm } from './infraestrutura/categoria-pergunta.orm';
import { EnvioQuestionarioOrm } from './infraestrutura/envio-questionario.orm';
import { OpcaoPerguntaOrm } from './infraestrutura/opcao-pergunta.orm';
import { PerguntaOrm } from './infraestrutura/pergunta.orm';
import { QuestionarioOrm } from './infraestrutura/questionario.orm';

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
      UserActionLogOrm
    ]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorQuestionarios],
  providers: [ServicoQuestionarios, ProcessadorAgendamentosQuestionario, ServicoAuditoria],
  exports: [ServicoQuestionarios]
})
export class ModuloQuestionarios {}
