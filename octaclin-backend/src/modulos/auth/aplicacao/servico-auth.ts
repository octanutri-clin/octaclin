import { createHash, randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { LoginDto, RenovarTokenDto } from './dtos';
import { montarChaveProtecaoAbuso, POLITICA_LOGIN, ServicoProtecaoAbuso } from './servico-protecao-abuso';
import { contextoAcessoPorPapel } from '../dominio/permissoes';
import type { PermissaoOctaClin } from '../dominio/permissoes';
import type { PapelUsuario, UsuarioAutenticado } from '../dominio/usuario-autenticado';
import { RefreshTokenOrm } from '../infraestrutura/refresh-token.orm';

interface PayloadToken {
  sub: string;
  tenantId: string;
  papel: PapelUsuario;
  emailHash: string;
  permissoes?: PermissaoOctaClin[];
  familiaToken?: string;
}

@Injectable()
export class ServicoAuth {
  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly jwt: JwtService,
    private readonly senhas: ServicoSenhas,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly protecaoAbuso: ServicoProtecaoAbuso
  ) {}

  async login(dados: LoginDto) {
    const chaveProtecao = montarChaveProtecaoAbuso('login', dados.tenantSlug, dados.email);
    this.protecaoAbuso.verificarDisponibilidade(chaveProtecao, POLITICA_LOGIN);

    const tenant = await this.fonteDados.getRepository(TenantOrm).findOne({
      where: { slug: dados.tenantSlug, status: 'ativo' }
    });

    if (!tenant) {
      this.protecaoAbuso.registrarFalha(chaveProtecao, POLITICA_LOGIN);
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const emailHash = this.criptografia.gerarHashBusca(dados.email);
    const usuario = await this.executorTenant.executar(tenant.id, (gerenciador) =>
      gerenciador.getRepository(UsuarioOrm).findOne({
        where: { tenantId: tenant.id, emailHash, ativo: true }
      })
    );

    if (!usuario || !this.senhas.verificar(dados.senha, usuario.senhaHash)) {
      this.protecaoAbuso.registrarFalha(chaveProtecao, POLITICA_LOGIN);
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    this.protecaoAbuso.registrarSucesso(chaveProtecao);
    return this.emitirParTokens(usuario, randomUUID());
  }

  async renovar(dados: RenovarTokenDto) {
    const payload = await this.verificarRefreshToken(dados.refreshToken);
    const tokenHash = this.hashToken(dados.refreshToken);

    const usuario = await this.executorTenant.executar(payload.tenantId, async (gerenciador) => {
      const repositorioTokens = gerenciador.getRepository(RefreshTokenOrm);
      const tokenAtual = await repositorioTokens.findOne({
        where: {
          tenantId: payload.tenantId,
          usuarioId: payload.sub,
          tokenHash,
          familiaToken: payload.familiaToken
        }
      });

      if (!tokenAtual || tokenAtual.revogadoEm || tokenAtual.expiraEm <= new Date()) {
        throw new UnauthorizedException('Refresh token invalido ou expirado.');
      }

      tokenAtual.revogadoEm = new Date();
      await repositorioTokens.save(tokenAtual);

      const usuarioAtual = await gerenciador.getRepository(UsuarioOrm).findOne({
        where: { id: payload.sub, tenantId: payload.tenantId, ativo: true }
      });

      if (!usuarioAtual) {
        throw new UnauthorizedException('Usuario inativo ou inexistente.');
      }

      return usuarioAtual;
    });

    return this.emitirParTokens(usuario, payload.familiaToken ?? randomUUID());
  }

  async emitirSessaoUsuario(usuario: UsuarioOrm) {
    return this.emitirParTokens(usuario, randomUUID());
  }

  async revogar(refreshToken: string): Promise<void> {
    const payload = await this.verificarRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);

    await this.executorTenant.executar(payload.tenantId, async (gerenciador) => {
      await gerenciador.getRepository(RefreshTokenOrm).update(
        {
          tenantId: payload.tenantId,
          usuarioId: payload.sub,
          tokenHash
        },
        { revogadoEm: new Date() }
      );
    });
  }

  obterContextoAcesso(usuario: UsuarioAutenticado) {
    return contextoAcessoPorPapel(usuario.papel);
  }

  private async emitirParTokens(usuario: UsuarioOrm, familiaToken: string) {
    const contextoAcesso = contextoAcessoPorPapel(usuario.role);
    const payload: PayloadToken = {
      sub: usuario.id,
      tenantId: usuario.tenantId,
      papel: usuario.role,
      emailHash: usuario.emailHash,
      permissoes: contextoAcesso.permissoes,
      familiaToken
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SEGREDO ?? 'dev-access-secret',
      expiresIn: process.env.JWT_EXPIRA_EM ?? '15m'
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SEGREDO ?? process.env.JWT_SEGREDO ?? 'dev-refresh-secret',
      expiresIn: process.env.JWT_REFRESH_EXPIRA_EM ?? '30d'
    });

    await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      await gerenciador.getRepository(RefreshTokenOrm).save(
        gerenciador.getRepository(RefreshTokenOrm).create({
          tenantId: usuario.tenantId,
          usuarioId: usuario.id,
          tokenHash: this.hashToken(refreshToken),
          familiaToken,
          expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        })
      );
    });

    return {
      accessToken,
      refreshToken,
      tipoToken: 'Bearer',
      expiraEmSegundos: 15 * 60,
      papel: usuario.role,
      permissoes: contextoAcesso.permissoes,
      escopoDados: contextoAcesso.escopoDados,
      destinoInicial: contextoAcesso.destinoInicial
    };
  }

  private async verificarRefreshToken(token: string): Promise<PayloadToken> {
    try {
      return await this.jwt.verifyAsync<PayloadToken>(token, {
        secret: process.env.JWT_REFRESH_SEGREDO ?? process.env.JWT_SEGREDO ?? 'dev-refresh-secret'
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
