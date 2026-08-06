import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuloAuth } from '../auth/modulo-auth';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoNotificacoes } from './aplicacao/servico-notificacoes';
import { ControladorNotificacoes } from './apresentacao/controlador-notificacoes';
import { NotificacaoOrm } from './infraestrutura/notificacao.orm';

/**
 * Modulo de leitura apenas. A escrita nao passa por aqui: quem publica e a
 * funcao `registrarNotificacao`, chamada dentro da transacao do evento de
 * origem, justamente para nao acoplar agenda, comunicacoes e questionarios a
 * este modulo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([NotificacaoOrm, PacienteOrm]), ModuloAuth, ModuloTenancy],
  controllers: [ControladorNotificacoes],
  providers: [ServicoNotificacoes]
})
export class ModuloNotificacoes {}
