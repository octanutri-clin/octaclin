import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { ConsentimentoLgpdOrm } from '../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { OutboxEventoOrm } from '../../infraestrutura/outbox/outbox-evento.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { REDIS_OAUTH_STATE_GOOGLE, ServicoConexaoGoogleCalendar } from '../agenda/aplicacao/servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from '../agenda/aplicacao/servico-google-calendar';
import { AgendaConsultaOrm } from '../agenda/infraestrutura/agenda-consulta.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloComunicacoes } from '../comunicacoes/modulo-comunicacoes';
import { criarConexaoRedis } from '../comunicacoes/aplicacao/configuracao-redis';
import { CanalNotificacaoOrm } from '../comunicacoes/infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { SincronizacaoMobileOrm } from '../mobile/infraestrutura/sincronizacao-mobile.orm';
import { ModuloSaude } from '../saude/modulo-saude';
import { TenantConfiguracaoOrm } from '../tenancy/infraestrutura/tenant-configuracao.orm';
import { TenantOrm } from '../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { RefreshTokenOrm } from '../auth/infraestrutura/refresh-token.orm';
import { TokenRedefinicaoSenhaOrm } from '../auth/infraestrutura/token-redefinicao-senha.orm';
import { AdaptadorEmailSmtp } from '../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoOperacoes } from './aplicacao/servico-operacoes';
import { ServicoCicloVidaTenant } from './aplicacao/servico-ciclo-vida-tenant';
import { ControladorOperacoes } from './apresentacao/controlador-operacoes';
import { ServicoRolloutOperacional } from './aplicacao/servico-rollout-operacional';
import { FILA_NOTIFICACOES } from '../comunicacoes/aplicacao/servico-comunicacoes';
import { FILA_SINCRONIZACAO_GOOGLE } from '../agenda/aplicacao/servico-sincronizacao-google-calendar';
import { FILA_AUTOMACOES } from '../automacoes/aplicacao/servico-automacoes';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: FILA_NOTIFICACOES },
      { name: FILA_SINCRONIZACAO_GOOGLE },
      { name: FILA_AUTOMACOES }
    ),
    TypeOrmModule.forFeature([
      OutboxEventoOrm,
      SincronizacaoMobileOrm,
      UserActionLogOrm,
      ConsentimentoLgpdOrm,
      TenantConfiguracaoOrm,
      MensagemNotificacaoOrm,
      CanalNotificacaoOrm,
      AgendaConsultaOrm,
      TenantOrm,
      UsuarioOrm,
      RefreshTokenOrm,
      TokenRedefinicaoSenhaOrm
    ]),
    ModuloAuth,
    ModuloTenancy,
    ModuloComunicacoes,
    ModuloSaude
  ],
  controllers: [ControladorOperacoes],
  providers: [
    ServicoOperacoes,
    ServicoRolloutOperacional,
    ServicoCicloVidaTenant,
    ServicoAuditoria,
    AdaptadorEmailSmtp,
    ServicoGoogleCalendar,
    ServicoConexaoGoogleCalendar,
    { provide: REDIS_OAUTH_STATE_GOOGLE, useFactory: () => new Redis(criarConexaoRedis()) },
    CriptografiaDadosSensiveis
  ],
  exports: [ServicoOperacoes]
})
export class ModuloOperacoes {}
