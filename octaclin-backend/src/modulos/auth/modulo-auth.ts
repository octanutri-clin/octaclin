import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { ServicoAuditoria } from '../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../infraestrutura/seguranca/servico-senhas';
import { AdaptadorEmailSmtp } from '../comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp';
import { criarConexaoRedis } from '../comunicacoes/aplicacao/configuracao-redis';
import { TenantOrm } from '../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../usuarios/infraestrutura/usuario.orm';
import { ServicoRecuperacaoSenha } from './aplicacao/servico-recuperacao-senha';
import { ServicoAuth } from './aplicacao/servico-auth';
import { ServicoSessoes } from './aplicacao/servico-sessoes';
import { ServicoMfa } from './aplicacao/servico-mfa';
import { ServicoReautenticacao } from './aplicacao/servico-reautenticacao';
import { ServicoTotp } from './aplicacao/servico-totp';
import { REDIS_PROTECAO_ABUSO, ServicoProtecaoAbuso } from './aplicacao/servico-protecao-abuso';
import { ControladorAuth } from './apresentacao/controlador-auth';
import { GuardaJwt } from './apresentacao/guarda-jwt';
import { GuardaLimiteLogin } from './apresentacao/guarda-limite-login';
import { GuardaPapeis } from './apresentacao/guarda-papeis';
import { GuardaPermissoes } from './apresentacao/guarda-permissoes';
import { GuardaReautenticacao } from './apresentacao/guarda-reautenticacao';
import { RefreshTokenOrm } from './infraestrutura/refresh-token.orm';
import { SessaoUsuarioOrm } from './infraestrutura/sessao-usuario.orm';
import { TokenRedefinicaoSenhaOrm } from './infraestrutura/token-redefinicao-senha.orm';
import { MfaFatorUsuarioOrm } from './infraestrutura/mfa-fator-usuario.orm';
import { MfaCodigoRecuperacaoOrm } from './infraestrutura/mfa-codigo-recuperacao.orm';
import { MfaDesafioOrm } from './infraestrutura/mfa-desafio.orm';

@Module({
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      RefreshTokenOrm,
      SessaoUsuarioOrm,
      TokenRedefinicaoSenhaOrm,
      MfaFatorUsuarioOrm,
      MfaCodigoRecuperacaoOrm,
      MfaDesafioOrm,
      TenantOrm,
      UsuarioOrm
    ])
  ],
  controllers: [ControladorAuth],
  providers: [
    ServicoAuth,
    ServicoSessoes,
    ServicoMfa,
    ServicoReautenticacao,
    ServicoTotp,
    ServicoAuditoria,
    ServicoRecuperacaoSenha,
    { provide: REDIS_PROTECAO_ABUSO, useFactory: () => new Redis(criarConexaoRedis()) },
    ServicoProtecaoAbuso,
    ExecutorTenant,
    ServicoSenhas,
    CriptografiaDadosSensiveis,
    AdaptadorEmailSmtp,
    GuardaJwt,
    GuardaPapeis,
    GuardaPermissoes,
    GuardaLimiteLogin,
    GuardaReautenticacao
  ],
  exports: [
    JwtModule,
    // `GuardaPapeis` e `GuardaPermissoes` passaram a depender de
    // `ServicoAuditoria` (PR 52, fase 1b). Nest registra a guarda referenciada
    // por `@UseGuards` como injetavel do modulo que declara o *controlador*, e
    // resolve as dependencias dela no injetor daquele modulo -- nao neste. Os
    // ~25 modulos que usam as guardas importam `ModuloAuth`, mas nem todos
    // declaram `ServicoAuditoria` (`ModuloNotificacoes`, por exemplo, nao
    // declara). Sem esta exportacao o bootstrap desses modulos quebraria.
    ServicoAuditoria,
    GuardaJwt,
    GuardaPapeis,
    GuardaPermissoes,
    GuardaReautenticacao,
    ServicoAuth,
    ServicoSessoes,
    ServicoProtecaoAbuso,
    ServicoSenhas,
    CriptografiaDadosSensiveis
  ]
})
export class ModuloAuth {}
