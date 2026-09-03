import { createHash, randomUUID } from 'crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import {
  ServicoAuditoria,
  type RegistrarAuditoriaEntrada
} from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoSenhas } from '../../../infraestrutura/seguranca/servico-senhas';
import { TenantOrm } from '../../tenancy/infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ConcluirLoginMfaDto, LoginDto, RenovarTokenDto } from './dtos';
import { montarChaveProtecaoAbuso, POLITICA_LOGIN, ServicoProtecaoAbuso } from './servico-protecao-abuso';
import { ServicoSessoes } from './servico-sessoes';
import { ServicoMfa, type DesafioLoginMfa } from './servico-mfa';
import { contextoAcessoPorPapel } from '../dominio/permissoes';
import {
  TIPO_TOKEN_ACESSO,
  TIPO_TOKEN_RENOVACAO,
  validarClaimsToken,
  type ClaimsToken,
  type TipoToken
} from '../dominio/claims-token';
import type { UsuarioAutenticado } from '../dominio/usuario-autenticado';
import { exigeMfaPorPapel } from '../dominio/politica-mfa';
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
  mfaObrigatorio?: boolean;
}

/**
 * Trilha de autenticacao (PR 52, fase 1b).
 *
 * Antes desta fase o ciclo de vida da credencial era o unico ponto do sistema
 * sem rastro: login, falha de login, logout e rotacao de refresh nao deixavam
 * nada em `user_action_logs`. Isso e o inverso do que a trilha existe para
 * fazer -- ela e a evidencia de *quem* entrou, e sem ela um acesso indevido so
 * aparece depois, pelo dado que a sessao tocou, ja tarde.
 *
 * A restricao que molda o desenho: `user_action_logs` grava sob RLS, via
 * `ExecutorTenant`, e `tenant_id` e NOT NULL. Nao existe linha de trilha sem
 * tenant. Numa falha de login o tenant pode simplesmente nao ser resolvivel --
 * e ai a escolha e entre inventar um tenant (destruiria o isolamento que a RLS
 * garante) e nao gravar. A decisao esta em `registrarFalhaForaDaTrilha`.
 */
@Injectable()
export class ServicoAuth {
  private readonly logger = new Logger(ServicoAuth.name);

  constructor(
    private readonly fonteDados: DataSource,
    private readonly executorTenant: ExecutorTenant,
    private readonly jwt: JwtService,
    private readonly senhas: ServicoSenhas,
    private readonly criptografia: CriptografiaDadosSensiveis,
    private readonly protecaoAbuso: ServicoProtecaoAbuso,
    private readonly sessoes: ServicoSessoes,
    private readonly mfa: ServicoMfa,
    private readonly auditoria: ServicoAuditoria
  ) {}

  async login(dados: LoginDto) {
    const chaveProtecao = montarChaveProtecaoAbuso('login', dados.tenantSlug, dados.email);
    await this.protecaoAbuso.verificarDisponibilidade(chaveProtecao, POLITICA_LOGIN);

    const tenant = await this.fonteDados.getRepository(TenantOrm).findOne({
      where: { slug: dados.tenantSlug, status: 'ativo' }
    });

    if (!tenant) {
      await this.protecaoAbuso.registrarFalha(chaveProtecao, POLITICA_LOGIN);
      this.registrarFalhaForaDaTrilha('tenant_inexistente');
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const emailHash = this.criptografia.gerarHashBusca(dados.email);
    const usuario = await this.executorTenant.executar(tenant.id, (gerenciador) =>
      gerenciador.getRepository(UsuarioOrm).findOne({
        where: { tenantId: tenant.id, emailHash, ativo: true }
      })
    );

    if (!usuario || !this.senhas.verificar(dados.senha, usuario.senhaHash)) {
      // A contencao de rajada e a mesma do fluxo de credencial: `registrarFalha`
      // vem antes, e a partir da 5a falha da mesma chave `POLITICA_LOGIN` bloqueia
      // a chave por 15 minutos. A 6a tentativa morre em
      // `verificarDisponibilidade`, no topo deste metodo, antes de qualquer
      // consulta e antes de qualquer escrita de auditoria. O teto por
      // (tenantSlug, email) e portanto o proprio `maxTentativas`, e nao ha
      // contador novo aqui -- duplicar contencao criaria duas fontes de verdade
      // sobre o mesmo limite.
      await this.protecaoAbuso.registrarFalha(chaveProtecao, POLITICA_LOGIN);

      if (usuario) {
        await this.registrarTrilha({
          tenantId: tenant.id,
          usuarioId: usuario.id,
          acao: 'auth.login.falha',
          recursoTipo: 'usuario',
          recursoId: usuario.id,
          metadados: { motivoTecnico: 'credencial_invalida' }
        });
      } else {
        this.registrarFalhaForaDaTrilha('usuario_inexistente', tenant.id);
      }

      throw new UnauthorizedException('Credenciais invalidas.');
    }

    await this.protecaoAbuso.registrarSucesso(chaveProtecao);
    const desafio = await this.mfa.iniciarLogin(usuario);
    if (desafio) return desafio;
    return this.emitirSessaoUsuario(usuario);
  }

  async concluirLoginMfa(dados: ConcluirLoginMfaDto): Promise<ParTokens & { codigosRecuperacao: string[] }> {
    const resultado = await this.mfa.concluirLogin(dados.desafioMfa, dados.codigo.trim().toUpperCase());
    const tokens = await this.emitirSessaoUsuario(resultado.usuario, resultado.mfaVerificadoEm);
    return { ...tokens, codigosRecuperacao: resultado.codigosRecuperacao };
  }

  /**
   * Cada login abre uma sessao propria. Sessoes anteriores continuam validas:
   * encerra-las e decisao do usuario, pelos endpoints de sessao.
   */
  async emitirSessaoUsuario(usuario: UsuarioOrm, mfaVerificadoEm?: Date | null): Promise<ParTokens> {
    if (exigeMfaPorPapel(usuario.role) && !mfaVerificadoEm) {
      throw new UnauthorizedException('Autenticação multifator obrigatória.');
    }
    // A auditoria fica fora do `executar` de proposito: `ServicoAuditoria` abre
    // o proprio escopo de tenant, e chamar de dentro daqui aninharia dois
    // escopos RLS sobre a mesma conexao.
    const emissao = await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const sessao = await this.sessoes.criar(gerenciador, {
        tenantId: usuario.tenantId,
        usuarioId: usuario.id,
        expiraEm: this.expiracaoSessao(),
        mfaVerificadoEm: mfaVerificadoEm ?? null
      });

      return { tokens: await this.emitirParTokens(gerenciador, usuario, sessao), sessaoId: sessao.id };
    });

    await this.registrarTrilha({
      tenantId: usuario.tenantId,
      usuarioId: usuario.id,
      acao: 'auth.login.sucesso',
      recursoTipo: 'sessao_usuario',
      recursoId: emissao.sessaoId,
      metadados: { mfaVerificado: Boolean(mfaVerificadoEm) }
    });

    return emissao.tokens;
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

      if (exigeMfaPorPapel(usuarioAtual.role) && !sessao.mfaVerificadoEm) {
        return { reuso: false, mfaObrigatorio: true };
      }

      sessao.ultimaAtividadeEm = agora;
      sessao.expiraEm = this.expiracaoSessao(agora);
      await repositorioSessoes.save(sessao);

      return { reuso: false, tokens: await this.emitirParTokens(gerenciador, usuarioAtual, sessao) };
    });

    if (desfecho.reuso) {
      await this.sessoes.revogarPorReuso(claims.tenantId, claims.sub, claims.sid);
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    if (desfecho.mfaObrigatorio) {
      await this.sessoes.revogar(claims.tenantId, claims.sub, claims.sid, 'mfa_obrigatorio');
      throw new UnauthorizedException('Autenticação multifator obrigatória.');
    }

    if (!desfecho.tokens) {
      throw new UnauthorizedException('Refresh token invalido ou expirado.');
    }

    await this.registrarTrilha({
      tenantId: claims.tenantId,
      usuarioId: claims.sub,
      acao: 'auth.token.renovado',
      recursoTipo: 'sessao_usuario',
      recursoId: claims.sid,
      metadados: { rotacao: 'refresh_token' }
    });

    return desfecho.tokens;
  }

  /** Logout: encerra a sessao inteira, nao apenas o refresh token apresentado. */
  async revogar(refreshToken: string): Promise<void> {
    const claims = await this.verificarToken(refreshToken, TIPO_TOKEN_RENOVACAO);
    await this.sessoes.revogar(claims.tenantId, claims.sub, claims.sid, 'logout');
    await this.registrarTrilha({
      tenantId: claims.tenantId,
      usuarioId: claims.sub,
      acao: 'auth.sessao.encerrada',
      recursoTipo: 'sessao_usuario',
      recursoId: claims.sid
    });
  }

  listarSessoes(usuario: UsuarioAutenticado, pagina = 1) {
    return this.sessoes.listar(usuario.tenantId, usuario.usuarioId, this.exigirSessao(usuario), pagina);
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

  async encerrarTodasSessoes(usuario: UsuarioAutenticado): Promise<{ encerradas: number }> {
    this.exigirSessao(usuario);
    const encerradas = await this.sessoes.revogarTodas(
      usuario.tenantId,
      usuario.usuarioId,
      'encerrada_pelo_usuario'
    );
    return { encerradas };
  }

  async limparHistoricoSessoes(usuario: UsuarioAutenticado): Promise<{ removidos: number }> {
    this.exigirSessao(usuario);
    const removidos = await this.sessoes.limparHistorico(usuario.tenantId, usuario.usuarioId);
    return { removidos };
  }

  obterContextoAcesso(usuario: UsuarioAutenticado) {
    return contextoAcessoPorPapel(usuario.papel);
  }

  /**
   * Escreve na trilha sem deixar a trilha decidir o desfecho da autenticacao.
   *
   * `ServicoAuditoria.registrar` ja engole a propria falha -- o `catch` dele
   * incrementa o contador e volta normalmente. Este `try` e a segunda barreira,
   * e existe por uma razao especifica deste modulo: aqui a auditoria e chamada
   * a um `throw` de distancia de um 401. Se um dia `registrar` passar a
   * rejeitar (um `Logger` custom que lanca, uma injecao trocada, um duble de
   * teste), a rejeicao subiria no lugar do `UnauthorizedException` e um login
   * recusado viraria 500 -- transformando um controle de seguranca em canal de
   * negacao de servico contra o proprio login legitimo.
   */
  private async registrarTrilha(entrada: RegistrarAuditoriaEntrada): Promise<void> {
    try {
      await this.auditoria.registrar(entrada);
    } catch {
      // Silencio deliberado: ver o bloco acima. A contabilidade da falha e do
      // `ServicoAuditoria`, que ja mantem `obterTotalFalhas` para o alarme.
    }
  }

  /**
   * Falha de login cujo autor a trilha nao consegue representar.
   *
   * `user_action_logs.tenant_id` e NOT NULL e a escrita passa por
   * `ExecutorTenant`, isto e, por RLS. Duas situacoes nao tem tenant utilizavel:
   * o slug nao corresponde a nenhum tenant ativo, e o e-mail nao corresponde a
   * nenhum usuario daquele tenant. Inventar um tenant sintetico ("desconhecido",
   * "sistema") para caber na coluna criaria um balde de linhas fora de qualquer
   * escopo real, legivel por quem tivesse acesso a esse balde -- exatamente o
   * isolamento que o `AGENTS.md` proibe relaxar. Escrever fora do `ExecutorTenant`
   * seria pior: uma escrita sem RLS no caminho anonimo do login.
   *
   * A segunda razao e amplificacao. Estes dois caminhos sao os unicos em que o
   * atacante escolhe livremente o valor que decide a chave: ele varia o e-mail e
   * cada tentativa vira uma chave nova de protecao de abuso, entao o teto de 5
   * falhas nao limita o *total* de escritas, so o total por chave. Manter esses
   * dois casos fora da trilha remove o unico vetor de escrita ilimitada em
   * `user_action_logs` a partir de requisicao nao autenticada.
   *
   * O que sobra e log estruturado: fica no coletor, tem retencao curta, nao e
   * multi-tenant e nao e a evidencia legal. `motivo` e um literal fechado, e o
   * tenant so aparece como UUID opaco quando ja foi resolvido pelo servidor.
   * Nao entra e-mail, senha, slug enviado pelo cliente, token nem hash de
   * nenhum deles -- o par (e-mail, resultado) e por si so um oraculo de
   * enumeracao de contas.
   */
  private registrarFalhaForaDaTrilha(
    motivo: 'tenant_inexistente' | 'usuario_inexistente',
    tenantId?: string
  ): void {
    this.logger.warn({ evento: 'auth.login.falha', motivo, tenantId });
  }

  private exigirSessao(usuario: UsuarioAutenticado): string {
    if (!usuario.sessaoId) throw new UnauthorizedException('Sessão não identificada no token.');
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
        permissoes: contextoAcesso.permissoes,
        mfa: Boolean(sessao.mfaVerificadoEm)
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
