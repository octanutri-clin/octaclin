import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ConsentimentoLgpdOrm } from '../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { OutboxEventoOrm } from '../../infraestrutura/outbox/outbox-evento.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { SincronizacaoMobileOrm } from '../mobile/infraestrutura/sincronizacao-mobile.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoOperacoes } from './aplicacao/servico-operacoes';
import { ControladorOperacoes } from './apresentacao/controlador-operacoes';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEventoOrm, SincronizacaoMobileOrm, UserActionLogOrm, ConsentimentoLgpdOrm]), ModuloAuth, ModuloTenancy],
  controllers: [ControladorOperacoes],
  providers: [ServicoOperacoes],
  exports: [ServicoOperacoes]
})
export class ModuloOperacoes {}
