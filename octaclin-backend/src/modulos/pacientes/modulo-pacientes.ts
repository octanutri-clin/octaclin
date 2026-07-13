import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoPacientes } from './aplicacao/servico-pacientes';
import { ControladorPacientes } from './apresentacao/controlador-pacientes';
import { PacienteOrm } from './infraestrutura/paciente.orm';

@Module({
  imports: [TypeOrmModule.forFeature([PacienteOrm, UserActionLogOrm]), ModuloTenancy, ModuloAuth],
  controllers: [ControladorPacientes],
  providers: [ServicoPacientes, CriptografiaDadosSensiveis, ServicoAuditoria],
  exports: [ServicoPacientes]
})
export class ModuloPacientes {}
