import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloComunicacoes } from '../comunicacoes/modulo-comunicacoes';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ProcessadorAutomacoes } from './aplicacao/processador-automacoes';
import { ProcessadorLembretesAgenda } from './aplicacao/processador-lembretes-agenda';
import { ProcessadorRecallInatividade } from './aplicacao/processador-recall-inatividade';
import { FILA_AUTOMACOES, ServicoAutomacoes } from './aplicacao/servico-automacoes';
import { ServicoLembretesAgenda } from './aplicacao/servico-lembretes-agenda';
import { ServicoRecallInatividade } from './aplicacao/servico-recall-inatividade';
import { ControladorAutomacoes } from './apresentacao/controlador-automacoes';
import { AgendaConsultaOrm } from '../agenda/infraestrutura/agenda-consulta.orm';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ExecucaoRegraOrm } from './infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from './infraestrutura/regra-automacao.orm';
import { deveExecutarProcessadores } from '../../infraestrutura/processamento/papel-processo';

const processadores = deveExecutarProcessadores()
  ? [ProcessadorAutomacoes, ProcessadorLembretesAgenda, ProcessadorRecallInatividade]
  : [];

@Module({
  imports: [
    BullModule.registerQueue({ name: FILA_AUTOMACOES }),
    TypeOrmModule.forFeature([RegraAutomacaoOrm, ExecucaoRegraOrm, UserActionLogOrm, AgendaConsultaOrm, PacienteOrm]),
    ModuloAuth,
    ModuloTenancy,
    ModuloComunicacoes
  ],
  controllers: [ControladorAutomacoes],
  providers: [ServicoAutomacoes, ServicoLembretesAgenda, ServicoRecallInatividade, ...processadores, ServicoAuditoria],
  exports: [ServicoAutomacoes, ServicoLembretesAgenda, ServicoRecallInatividade]
})
export class ModuloAutomacoes {}
