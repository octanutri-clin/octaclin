import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutorTenant } from '../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../infraestrutura/seguranca/servico-senhas';
import { AdaptadorEmailSmtp } from '../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { TenantOrm } from '../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ServicoRecuperacaoSenha } from './aplicacao/servico-recuperacao-senha';
import { ServicoAuth } from './aplicacao/servico-auth';
import { ControladorAuth } from './apresentacao/controlador-auth';
import { GuardaJwt } from './apresentacao/guarda-jwt';
import { GuardaLimiteLogin } from './apresentacao/guarda-limite-login';
import { GuardaPapeis } from './apresentacao/guarda-papeis';
import { GuardaPermissoes } from './apresentacao/guarda-permissoes';
import { RefreshTokenOrm } from './infraestrutura/refresh-token.orm';
import { TokenRedefinicaoSenhaOrm } from './infraestrutura/token-redefinicao-senha.orm';

@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([RefreshTokenOrm, TokenRedefinicaoSenhaOrm, TenantOrm, UsuarioOrm])],
  controllers: [ControladorAuth],
  providers: [
    ServicoAuth,
    ServicoRecuperacaoSenha,
    ExecutorTenant,
    ServicoSenhas,
    CriptografiaDadosSensiveis,
    AdaptadorEmailSmtp,
    GuardaJwt,
    GuardaPapeis,
    GuardaPermissoes,
    GuardaLimiteLogin
  ],
  exports: [JwtModule, GuardaJwt, GuardaPapeis, GuardaPermissoes, ServicoAuth, ServicoSenhas, CriptografiaDadosSensiveis]
})
export class ModuloAuth {}
