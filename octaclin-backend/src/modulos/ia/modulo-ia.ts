import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoIa } from './aplicacao/servico-ia';
import { ControladorIa } from './apresentacao/controlador-ia';
import { AnaliseSentimentoOrm } from './infraestrutura/analise-sentimento.orm';
import { ReconhecimentoAlimentarOrm } from './infraestrutura/reconhecimento-alimentar.orm';

@Module({
  imports: [TypeOrmModule.forFeature([AnaliseSentimentoOrm, ReconhecimentoAlimentarOrm, UserActionLogOrm]), ModuloAuth, ModuloTenancy],
  controllers: [ControladorIa],
  providers: [ServicoIa, ServicoAuditoria],
  exports: [ServicoIa]
})
export class ModuloIa {}
