import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { OutboxEventoOrm } from '../../infraestrutura/outbox/outbox-evento.orm';
import { ProcessadorNotificacoes } from './aplicacao/processador-notificacoes';
import { ProcessadorOutboxComunicacoes } from './aplicacao/processador-outbox-comunicacoes';
import { FILA_NOTIFICACOES, ServicoComunicacoes } from './aplicacao/servico-comunicacoes';
import { ServicoWebhookWhatsapp } from './aplicacao/servico-webhook-whatsapp';
import { ControladorComunicacoes } from './apresentacao/controlador-comunicacoes';
import { ControladorWebhookWhatsApp } from './apresentacao/controlador-webhook-whatsapp';
import { AdaptadorEmailSmtp } from './infraestrutura/adaptadores/adaptador-email-smtp';
import { AdaptadorPushPlaceholder } from './infraestrutura/adaptadores/adaptador-push-placeholder';
import { AdaptadorWhatsAppMeta } from './infraestrutura/adaptadores/adaptador-whatsapp-meta';
import { CanalNotificacaoOrm } from './infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from './infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from './infraestrutura/template-mensagem.orm';
import { deveExecutarProcessadores } from '../../infraestrutura/processamento/papel-processo';

const processadores = deveExecutarProcessadores() ? [ProcessadorNotificacoes, ProcessadorOutboxComunicacoes] : [];

@Module({
  imports: [
    BullModule.registerQueue({ name: FILA_NOTIFICACOES }),
    TypeOrmModule.forFeature([
      CanalNotificacaoOrm,
      TemplateMensagemOrm,
      MensagemNotificacaoOrm,
      OutboxEventoOrm,
      UserActionLogOrm,
      PacienteOrm
    ]),
    ModuloAuth,
    ModuloTenancy
  ],
  controllers: [ControladorComunicacoes, ControladorWebhookWhatsApp],
  providers: [
    ServicoComunicacoes,
    ServicoWebhookWhatsapp,
    ServicoAuditoria,
    CriptografiaDadosSensiveis,
    ...processadores,
    AdaptadorWhatsAppMeta,
    AdaptadorEmailSmtp,
    AdaptadorPushPlaceholder
  ],
  exports: [ServicoComunicacoes]
})
export class ModuloComunicacoes {}
