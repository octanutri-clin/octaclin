import { createHash, randomUUID } from 'crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager } from 'typeorm';
import { criarJanelaDeduplicacaoTrilha } from '../../../infraestrutura/auditoria/janela-deduplicacao-trilha';
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
 * Teto de escrita de `auth.login.sucesso` (PR 52, fase 2 -- fecha EXC-AUD-002).
 *
 * `ProtecaoAbuso` contem o caso hostil: cinco falhas por (tenantSlug, e-mail)
 * em 15 minutos e a chave morre antes de qualquer consulta. Ele nao contem o
 * caso legitimo. Quem tem credencial **valida** e entra em laco de login --
 * cliente com retry mal configurado, integracao que refaz login a cada
 * requisicao, worker sem cache de token -- passa por `registrarSucesso` a cada
 * volta e grava uma linha por volta em `user_action_logs`, que e append-only e
 * entra em backup. Cada linha e custo permanente, e nenhum contador existente
 * cobria esse caminho.
 *
 * A janela colapsa repeticoes do **mesmo** login -- mesmo tenant, mesmo
 * usuario, mesmo estado de MFA -- para uma escrita por minuto. Login de outro
 * usuario, de outro tenant, ou o primeiro login com MFA verificado de quem
 * vinha sem, nunca e engolido: cada um tem chave propria.
 *
 * O que o servico **nao** consegue colocar na identidade e a origem da
 * requisicao. `emitirSessaoUsuario` recebe `UsuarioOrm`, e nem o controlador
 * nem `SessaoUsuarioOrm` carregam IP ou user agent -- nao ha `AsyncLocalStorage`
 * de requisicao neste backend. Entao "origem nova" aqui e o que o servidor
 * consegue observar: tenant, usuario e MFA. Logins simultaneos do mesmo usuario
 * a partir de dois dispositivos dentro da mesma janela colapsam em uma linha, e
 * isso esta declarado de proposito em vez de ser inferido do codigo. O que
 * sobra do login colapsado e a linha propria em `sessoes_usuario`, e ela e
 * compensacao parcial, nao evidencia equivalente: `sessoes_usuario` aceita
 * UPDATE (`revogadoEm`, `motivoRevogacao`), ficou de fora do gatilho de
 * imutabilidade da migration `1720000001038` -- que cobre so `user_action_logs`
 * -- e nao guarda IP nem user agent. Ela prova que houve outro login; nao prova
 * de qual dispositivo, que e justamente a distincao descartada aqui. O residual
 * suprimido volta como contagem no proximo evento gravado, para que o teto nao
 * compre volume com cegueira.
 *
 * O estado e por processo e em memoria, como no 403: entre replicas cada uma
 * tem a sua, e o teto real e "uma escrita por janela por replica". E otimizacao
 * de volume, nao controle de seguranca -- no pior caso grava de novo, nunca
 * deixa de gravar um login distinto.
 */
const JANELA_LOGIN_SUCESSO_MS = 60_000;

/**
 * Teto de chaves vivas. Diferente do 403, a identidade aqui e inteiramente
 * resolvida pelo servidor (dois UUID e um booleano, ~90 caracteres), entao o
 * cliente nao consegue inflar nem o numero de chaves nem o tamanho delas -- o
 * limite real e a quantidade de usuarios ativos do processo. O teto continua
 * existindo porque um mapa sem teto e um vazamento esperando uma clinica
 * grande, e 2.000 entradas custam menos de 1 MB.
 */
const MAXIMO_CHAVES_LOGIN_MONITORADAS = 2_000;

/** Mesma razao amortizada do 403: liberar 10% de uma vez em vez de uma por insercao. */
const ALVO_APOS_PODA_LOGIN = 1_800;

const janelaLoginSucesso = criarJanelaDeduplicacaoTrilha({
  janelaMs: JANELA_LOGIN_SUCESSO_MS,
  maximoChaves: MAXIMO_CHAVES_LOGIN_MONITORADAS,
  alvoAposPoda: ALVO_APOS_PODA_LOGIN
});

/**
 * Ponto de reinicio do estado de janela, para que um teste nao contamine o
 * seguinte. A janela e de modulo, e nao de instancia, porque `ServicoAuth` e
 * instanciado por modulo Nest -- campo de instancia daria uma janela por
 * instancia e o teto valeria por instancia, que e o mesmo defeito que o
 * contador de falhas de `ServicoAuditoria` ja evita.
 */
export function reiniciarJanelaLoginSucesso(): void {
  janelaLoginSucesso.reiniciar();
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

    const mfaVerificado = Boolean(mfaVerificadoEm);
    const agora = Date.now();

    // Declarada fora do `try` pela mesma razao de `registrarAutorizacaoNegada`:
    // se algo entre a reserva e o desfecho lancar, o `catch` precisa devolver a
    // chave -- sem isso uma unica excecao silenciaria o login daquele usuario
    // pelos 60 s seguintes e a barreira viraria perda de evidencia.
    let chaveReservada: string | undefined;

    // `registrarTrilha` ja engole a falha da escrita; este `try` e a segunda
    // barreira, e cobre o que ele nao cobre: a contabilidade do teto em volta
    // dela. Hoje nada aqui lanca -- sao operacoes de `Map` com chave string e
    // um getter --, e por isso a barreira nao muda comportamento nenhum. Ela
    // existe porque o dia em que uma dessas pecas passar a lancar (um duble
    // trocado, um `ServicoAuditoria` com contador instrumentado) o efeito seria
    // um login **bem-sucedido** virando 500 por causa da contabilidade da
    // trilha -- exatamente o desfecho que o caminho do 403 ja se recusa a
    // permitir. A trilha nunca decide o desfecho da autenticacao.
    try {
      const chaveJanela = [usuario.tenantId, usuario.id, mfaVerificado ? 'mfa' : 'sem-mfa'].join('|');
      const reserva = janelaLoginSucesso.reservar(chaveJanela, agora);

      if (!reserva.suprimir) {
        chaveReservada = chaveJanela;
        // A janela so pode ser dada por boa quando a escrita de fato aconteceu:
        // confirmar por causa de uma linha que nunca existiu silenciaria o login
        // daquele usuario pelos 60 s seguintes, e o teto viraria perda de
        // evidencia. Como `ServicoAuditoria.registrar` engole a propria falha e
        // volta normalmente, o retorno do envoltorio nao basta -- o delta do
        // contador monotonico de falhas e o unico sinal disponivel. Ele e por
        // processo, entao uma falha concorrente de outro call site pode ser lida
        // como falha desta: o erro cai para o lado seguro, que e gravar de novo.
        const falhasAntes = this.auditoria.obterTotalFalhas();
        const chamadaSemExcecao = await this.registrarTrilha({
          tenantId: usuario.tenantId,
          usuarioId: usuario.id,
          acao: 'auth.login.sucesso',
          recursoTipo: 'sessao_usuario',
          recursoId: emissao.sessaoId,
          metadados: {
            mfaVerificado,
            // Residual da janela anterior. Sai do payload quando e zero, porque
            // campo constante nao carrega informacao (politica de redacao, 4.2) e
            // o formato normal do evento continua sendo o de antes desta fase.
            ...(reserva.suprimidos > 0 ? { loginsSuprimidos: reserva.suprimidos } : {})
          }
        });

        const gravou = chamadaSemExcecao && this.auditoria.obterTotalFalhas() === falhasAntes;
        if (gravou) janelaLoginSucesso.confirmar(chaveJanela, agora);
        else janelaLoginSucesso.liberar(chaveJanela, agora);
        chaveReservada = undefined;
      }
    } catch {
      // Silencio deliberado: ver o bloco acima. O login ja aconteceu -- sessao
      // criada e tokens assinados --, entao propagar aqui negaria acesso
      // legitimo por causa de contabilidade de volume.
      if (chaveReservada !== undefined) janelaLoginSucesso.liberar(chaveReservada, agora);
    }

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
   *
   * Devolve se a escrita aconteceu. O booleano existe para a janela de
   * `auth.login.sucesso`: engolir o erro continua sendo o comportamento certo
   * para o desfecho HTTP, mas quem mantem teto de escrita precisa saber a
   * diferenca entre "gravei" e "engoli", senao passa a suprimir com base numa
   * linha que nao existe. Os demais chamadores ignoram o retorno.
   */
  private async registrarTrilha(entrada: RegistrarAuditoriaEntrada): Promise<boolean> {
    try {
      await this.auditoria.registrar(entrada);
      return true;
    } catch {
      // Silencio deliberado: ver o bloco acima. A contabilidade da falha e do
      // `ServicoAuditoria`, que ja mantem `obterTotalFalhas` para o alarme.
      return false;
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
