import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { ConsentimentoLgpdOrm } from '../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../infraestrutura/seguranca/servico-senhas';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ServicoConvitesPaciente } from './aplicacao/servico-convites-paciente';
import { ServicoPacientes } from './aplicacao/servico-pacientes';
import { ControladorConvitesPaciente } from './apresentacao/controlador-convites-paciente';
import { ControladorPacientes } from './apresentacao/controlador-pacientes';
import { ConvitePacienteOrm } from './infraestrutura/convite-paciente.orm';
import { PacienteOrm } from './infraestrutura/paciente.orm';

@Module({
  imports: [
    TypeOrmModule.forFeature([PacienteOrm, ConvitePacienteOrm, UsuarioOrm, ConsentimentoLgpdOrm, UserActionLogOrm]),
    ModuloTenancy,
    ModuloAuth
  ],
  controllers: [ControladorPacientes, ControladorConvitesPaciente],
  providers: [ServicoPacientes, ServicoConvitesPaciente, CriptografiaDadosSensiveis, ServicoSenhas, ServicoAuditoria],
  exports: [ServicoPacientes, ServicoConvitesPaciente]
})
export class ModuloPacientes {}
