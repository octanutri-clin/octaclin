import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { OutboxEventoOrm } from '../../infraestrutura/outbox/outbox-evento.orm';
import { ProcessadorNotificacoes } from './aplicacao/processador-notificacoes';
import { ProcessadorOutboxComunicacoes } from './aplicacao/processador-outbox-comunicacoes';
import { FILA_NOTIFICACOES, ServicoComunicacoes } from './aplicacao/servico-comunicacoes';
import { ControladorComunicacoes } from './apresentacao/controlador-comunicacoes';
import { AdaptadorEmailSendGrid } from './infraestrutura/adaptadores/adaptador-email-sendgrid';
import { AdaptadorPushPlaceholder } from './infraestrutura/adaptadores/adaptador-push-placeholder';
import { AdaptadorWhatsAppMeta } from './infraestrutura/adaptadores/adaptador-whatsapp-meta';
import { CanalNotificacaoOrm } from './infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from './infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from './infraestrutura/template-mensagem.orm';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORTA ?? 6379)
      }
    }),
    BullModule.registerQueue({ name: FILA_NOTIFICACOES }),
    TypeOrmModule.forFeature([CanalNotificacaoOrm, TemplateMensagemOrm, MensagemNotificacaoOrm, OutboxEventoOrm, UserActionLogOrm]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorComunicacoes],
  providers: [
    ServicoComunicacoes,
    ServicoAuditoria,
    ProcessadorNotificacoes,
    ProcessadorOutboxComunicacoes,
    AdaptadorWhatsAppMeta,
    AdaptadorEmailSendGrid,
    AdaptadorPushPlaceholder
  ],
  exports: [ServicoComunicacoes]
})
export class ModuloComunicacoes {}
