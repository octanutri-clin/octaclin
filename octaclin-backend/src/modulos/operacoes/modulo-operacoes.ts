import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ConsentimentoLgpdOrm } from '../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { OutboxEventoOrm } from '../../infraestrutura/outbox/outbox-evento.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoConexaoGoogleCalendar } from '../agenda/aplicacao/servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from '../agenda/aplicacao/servico-google-calendar';
import { AgendaConsultaOrm } from '../agenda/infraestrutura/agenda-consulta.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloComunicacoes } from '../comunicacoes/modulo-comunicacoes';
import { CanalNotificacaoOrm } from '../comunicacoes/infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { SincronizacaoMobileOrm } from '../mobile/infraestrutura/sincronizacao-mobile.orm';
import { ModuloSaude } from '../saude/modulo-saude';
import { TenantConfiguracaoOrm } from '../tenancy/infraestrutura/tenant-configuracao.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoOperacoes } from './aplicacao/servico-operacoes';
import { ControladorOperacoes } from './apresentacao/controlador-operacoes';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutboxEventoOrm,
      SincronizacaoMobileOrm,
      UserActionLogOrm,
      ConsentimentoLgpdOrm,
      TenantConfiguracaoOrm,
      MensagemNotificacaoOrm,
      CanalNotificacaoOrm,
      AgendaConsultaOrm
    ]),
    ModuloAuth,
    ModuloTenancy,
    ModuloComunicacoes,
    ModuloSaude
  ],
  controllers: [ControladorOperacoes],
  providers: [ServicoOperacoes, ServicoGoogleCalendar, ServicoConexaoGoogleCalendar, CriptografiaDadosSensiveis],
  exports: [ServicoOperacoes]
})
export class ModuloOperacoes {}
