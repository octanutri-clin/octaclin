import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ProcessadorAutomacoes } from './aplicacao/processador-automacoes';
import { FILA_AUTOMACOES, ServicoAutomacoes } from './aplicacao/servico-automacoes';
import { ControladorAutomacoes } from './apresentacao/controlador-automacoes';
import { ExecucaoRegraOrm } from './infraestrutura/execucao-regra.orm';
import { RegraAutomacaoOrm } from './infraestrutura/regra-automacao.orm';

@Module({
  imports: [
    BullModule.registerQueue({ name: FILA_AUTOMACOES }),
    TypeOrmModule.forFeature([RegraAutomacaoOrm, ExecucaoRegraOrm, UserActionLogOrm]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorAutomacoes],
  providers: [ServicoAutomacoes, ProcessadorAutomacoes, ServicoAuditoria],
  exports: [ServicoAutomacoes]
})
export class ModuloAutomacoes {}
