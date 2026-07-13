import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutorTenant } from '../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../infraestrutura/seguranca/servico-senhas';
import { TenantOrm } from '../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ServicoAuth } from './aplicacao/servico-auth';
import { ControladorAuth } from './apresentacao/controlador-auth';
import { GuardaJwt } from './apresentacao/guarda-jwt';
import { GuardaLimiteLogin } from './apresentacao/guarda-limite-login';
import { GuardaPapeis } from './apresentacao/guarda-papeis';
import { RefreshTokenOrm } from './infraestrutura/refresh-token.orm';

@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([RefreshTokenOrm, TenantOrm, UsuarioOrm])],
  controllers: [ControladorAuth],
  providers: [
    ServicoAuth,
    ExecutorTenant,
    ServicoSenhas,
    CriptografiaDadosSensiveis,
    GuardaJwt,
    GuardaPapeis,
    GuardaLimiteLogin
  ],
  exports: [JwtModule, GuardaJwt, GuardaPapeis, ServicoSenhas, CriptografiaDadosSensiveis]
})
export class ModuloAuth {}
