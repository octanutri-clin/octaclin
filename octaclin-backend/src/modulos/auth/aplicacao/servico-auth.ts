import { createHash, randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { LoginDto, RenovarTokenDto } from './dtos';
import { montarChaveProtecaoAbuso, POLITICA_LOGIN, ServicoProtecaoAbuso } from './servico-protecao-abuso';
import { ServicoSessoes } from './servico-sessoes';
import { contextoAcessoPorPapel } from '../dominio/permissoes';
import {
  TIPO_TOKEN_ACESSO,
  TIPO_TOKEN_RENOVACAO,
  validarClaimsToken,
  type ClaimsToken,
  type TipoToken
} from '../dominio/claims-token';
import type { UsuarioAutenticado } from '../dominio/usuario-autenticado';
import {
  duracaoEmSegundos,
  expiracaoConfigurada,
  opcoesAssinatura,
  opcoesVerificacao
} from '../infraestrutura/configuracao-jwt';
import { RefreshTokenOrm } from '../infraestrutura/refresh-token.orm';
import { SessaoUsuarioOrm } from '../infraestrutura/sessao-usuario.orm';

export interface ParTokens {
  accessToken: string;
  refreshToken: string;
  tipoToken: string;
  expiraEmSegundos: number;
  renovacaoExpiraEmSegundos: number;
  papel: UsuarioOrm['role'];
  permissoes: ReturnType<typeof contextoAcessoPorPapel>['permissoes'];
  escopoDados: ReturnType<typeof contextoAcessoPorPapel>['escopoDados'];
  destinoInicial: ReturnType<typeof contextoAcessoPorPapel>['destinoInicial'];
}

interface DesfechoRotacao {
  reuso: boolean;
  tokens?: ParTokens;
}

@Injectable()
export class ServicoAuth {
  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly jwt: JwtService,
    private readonly senhas: ServicoSenhas,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly protecaoAbuso: ServicoProtecaoAbuso,
    private readonly sessoes: ServicoSessoes
  ) {}

  async login(dados: LoginDto) {
    const chaveProtecao = montarChaveProtecaoAbuso('login', dados.tenantSlug, dados.email);
    await this.protecaoAbuso.verificarDisponibilidade(chaveProtecao, POLITICA_LOGIN);

    const tenant = await this.fonteDados.getRepository(TenantOrm).findOne({
      where: { slug: dados.tenantSlug, status: 'ativo' }
    });

    if (!tenant) {
      await this.protecaoAbuso.registrarFalha(chaveProtecao, POLITICA_LOGIN);
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const emailHash = this.criptografia.gerarHashBusca(dados.email);
    const usuario = await this.executorTenant.executar(tenant.id, (gerenciador) =>
      gerenciador.getRepository(UsuarioOrm).findOne({
        where: { tenantId: tenant.id, emailHash, ativo: true }
      })
    );

    if (!usuario || !this.senhas.verificar(dados.senha, usuario.senhaHash)) {
      await this.protecaoAbuso.registrarFalha(chaveProtecao, POLITICA_LOGIN);
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    await this.protecaoAbuso.registrarSucesso(chaveProtecao);
    return this.emitirSessaoUsuario(usuario);
  }

  /**
   * Cada login abre uma sessao propria. Sessoes anteriores continuam validas:
   * encerra-las e decisao do usuario, pelos endpoints de sessao.
   */
  async emitirSessaoUsuario(usuario: UsuarioOrm): Promise<ParTokens> {
    return this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const sessao = await this.sessoes.criar(gerenciador, {
        tenantId: usuario.tenantId,
        usuarioId: usuario.id,
        expiraEm: this.expiracaoSessao()
      });

      return this.emitirParTokens(gerenciador, usuario, sessao);
    });
  }

  async renovar(dados: RenovarTokenDto): Promise<ParTokens> {
    const claims = await this.verificarToken(dados.refreshToken, TIPO_TOKEN_RENOVACAO);
    const tokenHash = this.hashToken(dados.refreshToken);
    const agora = new Date();

    const desfecho = await this.executorTenant.executar<DesfechoRotacao>(claims.tenantId, async (gerenciador) => {
      const repositorioTokens = gerenciador.getRepository(RefreshTokenOrm);

      // Consumo de uso unico em uma unica escrita condicional. Duas renovacoes
      // concorrentes do mesmo token disputam a mesma linha: a segunda so volta a
      // avaliar a condicao depois do commit da primeira, e ja nao encontra o
      // token nao consumido. Somente uma rotacao produz descendente valido.
      const consumo = await repositorioTokens
        .createQueryBuilder()
        .update(RefreshTokenOrm)
        .set({ consumidoEm: agora })
        .where('tenant_id = :tenantId', { tenantId: claims.tenantId })
        .andWhere('usuario_id = :usuarioId', { usuarioId: claims.sub })
        .andWhere('sessao_id = :sessaoId', { sessaoId: claims.sid })
        .andWhere('token_hash = :tokenHash', { tokenHash })
        .andWhere('consumido_em is null')
        .andWhere('revogado_em is null')
        .andWhere('expira_em > :agora', { agora })
        .execute();

      if ((consumo.affected ?? 0) !== 1) {
        const linha = await repositorioTokens.findOne({
          where: { tenantId: claims.tenantId, usuarioId: claims.sub, tokenHash }
        });

        // Token apenas expirado nao e evidencia de roubo; consumido ou revogado e.
        return { reuso: Boolean(linha && (linha.consumidoEm || linha.revogadoEm)) };
      }

      const repositorioSessoes = gerenciador.getRepository(SessaoUsuarioOrm);
      const sessao = await repositorioSessoes.findOne({
        where: { tenantId: claims.tenantId, usuarioId: claims.sub, id: claims.sid }
      });

      if (!sessao || sessao.revogadoEm || sessao.expiraEm.getTime() <= agora.getTime()) {
        return { reuso: false };
      }

      const usuarioAtual = await gerenciador.getRepository(UsuarioOrm).findOne({
        where: { id: claims.sub, tenantId: claims.tenantId, ativo: true }
      });

      if (!usuarioAtual) return { reuso: false };

      sessao.ultimaAtividadeEm = agora;
      sessao.expiraEm = this.expiracaoSessao(agora);
      await repositorioSessoes.save(sessao);

      return { reuso: false, tokens: await this.emitirParTokens(gerenciador, usuarioAtual, sessao) };
    });

    if (desfecho.reuso) {
      await this.sessoes.revogarPorReuso(claims.tenantId, claims.sub, claims.sid);
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    if (!desfecho.tokens) {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    return desfecho.tokens;
  }

  /** Logout: encerra a sessao inteira, nao apenas o refresh token apresentado. */
  async revogar(refreshToken: string): Promise<void> {
    const claims = await this.verificarToken(refreshToken, TIPO_TOKEN_RENOVACAO);
    await this.sessoes.revogar(claims.tenantId, claims.sub, claims.sid, 'logout');
  }

  listarSessoes(usuario: UsuarioAutenticado) {
    return this.sessoes.listar(usuario.tenantId, usuario.usuarioId, this.exigirSessao(usuario));
  }

  async encerrarSessao(usuario: UsuarioAutenticado, referencia: string): Promise<void> {
    this.exigirSessao(usuario);
    await this.sessoes.encerrarPorReferencia(usuario.tenantId, usuario.usuarioId, referencia);
  }

  async encerrarOutrasSessoes(usuario: UsuarioAutenticado): Promise<{ encerradas: number }> {
    const encerradas = await this.sessoes.encerrarOutras(
      usuario.tenantId,
      usuario.usuarioId,
      this.exigirSessao(usuario)
    );

    return { encerradas };
  }

  obterContextoAcesso(usuario: UsuarioAutenticado) {
    return contextoAcessoPorPapel(usuario.papel);
  }

  private exigirSessao(usuario: UsuarioAutenticado): string {
    if (!usuario.sessaoId) throw new UnauthorizedException('Sessao nao identificada no token.');
    return usuario.sessaoId;
  }

  private expiracaoSessao(referencia = new Date()): Date {
    return new Date(
      referencia.getTime() + duracaoEmSegundos(expiracaoConfigurada(TIPO_TOKEN_RENOVACAO)) * 1000
    );
  }

  private async emitirParTokens(
    gerenciador: EntityManager,
    usuario: UsuarioOrm,
    sessao: SessaoUsuarioOrm
  ): Promise<ParTokens> {
    const contextoAcesso = contextoAcessoPorPapel(usuario.role);

    // O refresh token nao carrega papel, permissoes nem emailHash: ele so precisa
    // apontar para a sessao. Papel e permissoes sao relidos do banco a cada
    // rotacao, entao uma mudanca de papel nao fica congelada dentro do token.
    const accessToken = await this.jwt.signAsync(
      {
        sub: usuario.id,
        tenantId: usuario.tenantId,
        sid: sessao.id,
        tipo: TIPO_TOKEN_ACESSO,
        papel: usuario.role,
        emailHash: usuario.emailHash,
        permissoes: contextoAcesso.permissoes
      },
      opcoesAssinatura(TIPO_TOKEN_ACESSO, randomUUID())
    );

    const refreshToken = await this.jwt.signAsync(
      {
        sub: usuario.id,
        tenantId: usuario.tenantId,
        sid: sessao.id,
        tipo: TIPO_TOKEN_RENOVACAO
      },
      opcoesAssinatura(TIPO_TOKEN_RENOVACAO, randomUUID())
    );

    const repositorioTokens = gerenciador.getRepository(RefreshTokenOrm);
    await repositorioTokens.save(
      repositorioTokens.create({
        tenantId: usuario.tenantId,
        usuarioId: usuario.id,
        tokenHash: this.hashToken(refreshToken),
        familiaToken: sessao.id,
        sessaoId: sessao.id,
        expiraEm: sessao.expiraEm
      })
    );

    return {
      accessToken,
      refreshToken,
      tipoToken: 'Bearer',
      expiraEmSegundos: duracaoEmSegundos(expiracaoConfigurada(TIPO_TOKEN_ACESSO)),
      renovacaoExpiraEmSegundos: duracaoEmSegundos(expiracaoConfigurada(TIPO_TOKEN_RENOVACAO)),
      papel: usuario.role,
      permissoes: contextoAcesso.permissoes,
      escopoDados: contextoAcesso.escopoDados,
      destinoInicial: contextoAcesso.destinoInicial
    };
  }

  private async verificarToken(token: string, tipo: TipoToken): Promise<ClaimsToken> {
    try {
      const payload = await this.jwt.verifyAsync(token, opcoesVerificacao(tipo));
      return validarClaimsToken(payload, tipo);
    } catch {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
