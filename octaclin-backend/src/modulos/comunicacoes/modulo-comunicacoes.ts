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

function valorOuIndefinido(valor?: string): string | undefined {
  return valor && valor.length > 0 ? valor : undefined;
}

function criarConexaoRedis() {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const porta = Number(url.port || 6379);

    return {
      host: url.hostname,
      port: porta,
      username: valorOuIndefinido(decodeURIComponent(url.username)),
      password: valorOuIndefinido(decodeURIComponent(url.password)),
      tls: url.protocol === 'rediss:' || process.env.REDIS_TLS === 'true' ? {} : undefined
    };
  }

  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORTA ?? 6379),
    username: valorOuIndefinido(process.env.REDIS_USUARIO),
    password: valorOuIndefinido(process.env.REDIS_SENHA),
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined
  };
}

@Module({
  imports: [
    BullModule.forRoot({
      connection: criarConexaoRedis()
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
