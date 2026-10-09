import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuloAuth } from '../auth/modulo-auth';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoNotificacoes } from './aplicacao/servico-notificacoes';
import { ServicoPreferenciasNotificacoes } from './aplicacao/servico-preferencias-notificacoes';
import { ProcessadorEmailResumos } from './aplicacao/processador-email-resumos';
import { ControladorNotificacoes } from './apresentacao/controlador-notificacoes';
import { NotificacaoOrm } from './infraestrutura/notificacao.orm';
import { PreferenciaNotificacaoUsuarioOrm } from './infraestrutura/preferencia-notificacao-usuario.orm';
import { ResumoNotificacaoUsuarioOrm } from './infraestrutura/resumo-notificacao-usuario.orm';
import { AdaptadorEmailSmtp } from '../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { deveExecutarProcessadores } from '../../infraestrutura/processamento/papel-processo';

const processadores = deveExecutarProcessadores() ? [ProcessadorEmailResumos] : [];

/**
 * Modulo de leitura apenas. A escrita nao passa por aqui: quem publica e a
 * funcao `registrarNotificacao`, chamada dentro da transacao do evento de
 * origem, justamente para nao acoplar agenda, comunicacoes e questionarios a
 * este modulo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([
    NotificacaoOrm,
    PacienteOrm,
    PreferenciaNotificacaoUsuarioOrm,
    ResumoNotificacaoUsuarioOrm
  ]), ModuloAuth, ModuloTenancy],
  controllers: [ControladorNotificacoes],
  providers: [ServicoNotificacoes, ServicoPreferenciasNotificacoes, AdaptadorEmailSmtp, ...processadores]
})
export class ModuloNotificacoes {}
