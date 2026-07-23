import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ModuloAuth } from '../auth/modulo-auth';
import { PacienteOrm } from '../pacientes/infraestrutura/paciente.orm';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { ServicoMateriais } from './aplicacao/servico-materiais';
import { ControladorMateriais } from './apresentacao/controlador-materiais';
import { EnvioMaterialPacienteOrm } from './infraestrutura/envio-material-paciente.orm';
import { MaterialEducativoOrm } from './infraestrutura/material-educativo.orm';

@Module({
  imports: [TypeOrmModule.forFeature([MaterialEducativoOrm, EnvioMaterialPacienteOrm, PacienteOrm, UserActionLogOrm]), ModuloAuth, ModuloTenancy],
  controllers: [ControladorMateriais],
  providers: [ServicoMateriais, CriptografiaDadosSensiveis, ServicoAuditoria],
  exports: [ServicoMateriais]
})
export class ModuloMateriais {}
