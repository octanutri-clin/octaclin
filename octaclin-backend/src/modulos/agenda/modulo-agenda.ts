import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloComunicacoes } from '../comunicacoes/modulo-comunicacoes';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../profissionais/infraestrutura/profissional.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ControladorAgenda } from './apresentacao/controlador-agenda';
import { ServicoAgenda } from './aplicacao/servico-agenda';
import { ServicoGoogleCalendar } from './aplicacao/servico-google-calendar';
import { AgendaConsultaOrm } from './infraestrutura/agenda-consulta.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgendaConsultaOrm, PacienteOrm, ProfissionalOrm, UserActionLogOrm]),
    ModuloAuth,
    ModuloTenancy,
    ModuloComunicacoes
  ],
  controllers: [ControladorAgenda],
  providers: [ServicoAgenda, ServicoGoogleCalendar, ServicoAuditoria, CriptografiaDadosSensiveis]
})
export class ModuloAgenda {}
