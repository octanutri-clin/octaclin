import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { deveExecutarProcessadores } from '../../infraestrutura/processamento/papel-processo';
import { ModuloAgenda } from '../agenda/modulo-agenda';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloPacientes } from '../pacientes/modulo-pacientes';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ProcessadorWebhooks } from './aplicacao/processador-webhooks';
import { ServicoApiPublica } from './aplicacao/servico-api-publica';
import { ServicoGestaoIntegracoes } from './aplicacao/servico-gestao-integracoes';
import { ControladorApiPublica } from './apresentacao/controlador-api-publica';
import { ControladorGestaoIntegracoes } from './apresentacao/controlador-gestao-integracoes';
import { GuardaChaveApi } from './apresentacao/guarda-chave-api';
import { GuardaEscopoApi } from './apresentacao/guarda-escopo-api';
import { ApiChaveOrm } from './infraestrutura/api-chave.orm';
import { WebhookAssinaturaOrm } from './infraestrutura/webhook-assinatura.orm';
import { WebhookEntregaOrm } from './infraestrutura/webhook-entrega.orm';

const processadores = deveExecutarProcessadores() ? [ProcessadorWebhooks] : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiChaveOrm, WebhookAssinaturaOrm, WebhookEntregaOrm]),
    ModuloAuth,
    ModuloTenancy,
    ModuloPacientes,
    ModuloAgenda
  ],
  controllers: [ControladorApiPublica, ControladorGestaoIntegracoes],
  providers: [ServicoApiPublica, ServicoGestaoIntegracoes, GuardaChaveApi, GuardaEscopoApi, ServicoAuditoria, ...processadores]
})
export class ModuloIntegracoes {}
