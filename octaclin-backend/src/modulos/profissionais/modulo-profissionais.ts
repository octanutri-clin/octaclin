import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../infraestrutura/seguranca/servico-senhas';
import { ModuloAuth } from '../auth/modulo-auth';
import { ModuloTenancy } from '../tenancy/modulo-tenancy';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ServicoProfissionais } from './aplicacao/servico-profissionais';
import { ControladorProfissionais } from './apresentacao/controlador-profissionais';
import { ProfissionalOrm } from './infraestrutura/profissional.orm';

@Module({
  imports: [TypeOrmModule.forFeature([ProfissionalOrm, UsuarioOrm, UserActionLogOrm]), ModuloTenancy, ModuloAuth],
  controllers: [ControladorProfissionais],
  providers: [ServicoProfissionais, CriptografiaDadosSensiveis, ServicoSenhas, ServicoAuditoria],
  exports: [TypeOrmModule, ServicoProfissionais]
})
export class ModuloProfissionais {}
