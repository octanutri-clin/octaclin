import { randomBytes, timingSafeEqual } from 'crypto';
import { BadRequestException, Controller, Get, Headers, HttpCode, Logger, Post, Query, Redirect, Req, Res, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Request, Response } from 'express';
import { Papeis, Permissoes, UsuarioAtual } from '../../auth/apresentacao/decorators';
import { GuardaJwt } from '../../auth/apresentacao/guarda-jwt';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { GuardaPermissoes } from '../../auth/apresentacao/guarda-permissoes';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ServicoConexaoGoogleCalendar } from '../aplicacao/servico-conexao-google-calendar';
import { ServicoGoogleCalendar } from '../aplicacao/servico-google-calendar';
import { FILA_SINCRONIZACAO_GOOGLE, ServicoSincronizacaoGoogleCalendar } from '../aplicacao/servico-sincronizacao-google-calendar';
import { extrairTenantIdDoCanalWatchGoogle, gerarIdentificadorCanalWatchGoogle } from '../aplicacao/identificador-canal-watch-google';
import {
  urlAutorizacaoGoogleSegura,
  validarCodigoOAuth
} from '../../../infraestrutura/seguranca/seguranca-integracoes-externas';
import { urlCallbackGoogleAgenda, urlInicioGoogleAgenda, urlRetornoWebGoogleAgenda, urlWebhookGoogleAgenda } from './urls-google-agenda';

const COOKIE_VINCULO_OAUTH_GOOGLE = 'octaclin_google_oauth_binding';
const DURACAO_COOKIE_OAUTH_MS = 10 * 60 * 1000;

function extrairCookie(cabecalho: string | undefined, nome: string): string | undefined {
  if (!cabecalho) return undefined;
  for (const parte of cabecalho.split(';')) {
    const indice = parte.indexOf('=');
    if (indice < 1 || parte.slice(0, indice).trim() !== nome) continue;
    try {
      return decodeURIComponent(parte.slice(indice + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

@Controller('agenda/google')
export class ControladorGoogleAgenda {
  private readonly logger = new Logger(ControladorGoogleAgenda.name);

  constructor(
    private readonly servicoConexao: ServicoConexaoGoogleCalendar,
    private readonly googleCalendar: ServicoGoogleCalendar,
    private readonly executorTenant: ExecutorTenant,
    private readonly servicoSincronizacao: ServicoSincronizacaoGoogleCalendar,
    @InjectQueue(FILA_SINCRONIZACAO_GOOGLE) private readonly filaSincronizacao: Queue
  ) {}

  @Get('conectar')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('Professional')
  @Permissoes('agenda.consultas.ler')
  async conectar(@UsuarioAtual() usuario: UsuarioAutenticado): Promise<{ url: string }> {
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    const ticket = this.servicoConexao.gerarTicketInicioOAuth(usuario.tenantId, profissionalId);
    // A URL usa origem backend validada e retorna JSON; este endpoint nao executa redirect.
    // nosemgrep: typescript.nestjs.security.audit.nestjs-open-redirect.nestjs-open-redirect
    return { url: urlInicioGoogleAgenda(ticket) };
  }

  @Get('iniciar')
  @Redirect()
  async iniciar(
    @Query('ticket') ticket: string,
    @Res({ passthrough: true }) resposta: Response
  ): Promise<{ url: string; statusCode: number }> {
    const inicio = await this.servicoConexao.iniciarAutorizacao(ticket, urlCallbackGoogleAgenda());
    const urlAutorizacao = urlAutorizacaoGoogleSegura(inicio.url);
    resposta.cookie(COOKIE_VINCULO_OAUTH_GOOGLE, inicio.vinculoBrowser, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/agenda/google/callback',
      maxAge: DURACAO_COOKIE_OAUTH_MS
    });
    // O sanitizer acima restringe o redirect a https://accounts.google.com/o/oauth2/v2/auth.
    // nosemgrep: typescript.nestjs.security.audit.nestjs-open-redirect.nestjs-open-redirect
    return { url: urlAutorizacao, statusCode: 302 };
  }

  @Get('callback')
  @Redirect()
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') erroProvider: string | undefined,
    @Req() requisicao: Request,
    @Res({ passthrough: true }) resposta: Response
  ) {
    try {
      if (erroProvider) throw new BadRequestException('Autorizacao Google nao concluida.');
      if (!code || !state) throw new BadRequestException('Callback OAuth incompleto.');
      const codigoValidado = validarCodigoOAuth(code);
      const urlCallback = urlCallbackGoogleAgenda();
      const urlRetorno = urlRetornoWebGoogleAgenda();
      const vinculoBrowser = extrairCookie(requisicao.headers.cookie, COOKIE_VINCULO_OAUTH_GOOGLE);
      const { tenantId, profissionalId, codeVerifier } = await this.servicoConexao.validarEDecodificarState(
        state,
        vinculoBrowser
      );
      await this.servicoConexao.trocarCodigoPorConexao(
        tenantId,
        profissionalId,
        codigoValidado,
        urlCallback,
        codeVerifier
      );
      await this.criarCanalParaProfissional(tenantId, profissionalId);
      await this.servicoSincronizacao.reconciliar(tenantId, profissionalId);

      // urlRetorno deriva de origem HTTPS validada, sem path, credencial, query ou fragmento configuravel.
      // nosemgrep: typescript.nestjs.security.audit.nestjs-open-redirect.nestjs-open-redirect
      return { url: urlRetorno, statusCode: 302 };
    } finally {
      resposta.clearCookie(COOKIE_VINCULO_OAUTH_GOOGLE, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/agenda/google/callback'
      });
    }
  }

  @Get('status')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin', 'Professional')
  @Permissoes('agenda.consultas.ler')
  async status(@UsuarioAtual() usuario: UsuarioAutenticado) {
    if (usuario.papel === 'SuperAdmin') {
      return { conectado: false, podeGerenciar: false, falhasConsecutivas: 0 };
    }
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    const [credenciais, conexao] = await Promise.all([
      this.servicoConexao.obterConexaoAtiva(usuario.tenantId, profissionalId),
      this.executorTenant.executar(usuario.tenantId, (gerenciador) =>
        gerenciador.getRepository(ProfissionalGoogleConexaoOrm).findOne({
          where: { tenantId: usuario.tenantId, profissionalId }
        })
      )
    ]);
    return {
      conectado: Boolean(credenciais),
      podeGerenciar: true,
      falhasConsecutivas: conexao?.falhasConsecutivasSincronizacao ?? 0,
      atualizadoEm: conexao?.atualizadoEm,
      canalExpiraEm: conexao?.canalExpiraEm
    };
  }

  @Get('profissionais/status')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('SuperAdmin')
  @Permissoes('profissionais.ler')
  async statusProfissionais(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const conexoes = await this.executorTenant.executar(usuario.tenantId, (gerenciador) =>
      gerenciador.getRepository(ProfissionalGoogleConexaoOrm).find({ where: { tenantId: usuario.tenantId } })
    );
    return conexoes.map((conexao) => ({ profissionalId: conexao.profissionalId, conectado: !conexao.desconectadoEm }));
  }

  @Post('desconectar')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('Professional')
  @Permissoes('agenda.consultas.ler')
  async desconectar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    await this.servicoConexao.desconectar(usuario.tenantId, profissionalId);
    return { desconectado: true };
  }

  @Post('sincronizar')
  @UseGuards(GuardaJwt, GuardaPapeis, GuardaPermissoes)
  @Papeis('Professional')
  @Permissoes('agenda.consultas.ler')
  async sincronizar(@UsuarioAtual() usuario: UsuarioAutenticado) {
    const profissionalId = await this.resolverProfissionalIdObrigatorio(usuario);
    const credenciais = await this.servicoConexao.obterConexaoAtiva(usuario.tenantId, profissionalId);
    if (!credenciais) return { sincronizado: false, motivo: 'google_nao_conectado' };
    await this.servicoSincronizacao.reconciliar(usuario.tenantId, profissionalId);
    return { sincronizado: true };
  }

  @Post('notificacoes')
  @HttpCode(200)
  async receberNotificacao(
    @Headers('x-goog-channel-id') canalWatchId?: string,
    @Headers('x-goog-channel-token') tokenRecebido?: string,
    @Headers('x-goog-message-number') numeroMensagem?: string,
    @Headers('x-goog-resource-id') recursoId?: string,
    @Headers('x-goog-resource-state') estadoRecurso?: string
  ): Promise<void> {
    if (!canalWatchId || !recursoId || !numeroMensagem || !/^[0-9]{1,40}$/.test(numeroMensagem)) return;
    if (!estadoRecurso || !['sync', 'exists', 'not_exists'].includes(estadoRecurso)) return;
    const tenantId = extrairTenantIdDoCanalWatchGoogle(canalWatchId);
    if (!tenantId) {
      this.logger.warn('Notificacao rejeitada para canal Google legado ou malformado.');
      return;
    }

    const { canal, conexao } = await this.executorTenant.executar(tenantId, async (gerenciador) => ({
      canal: await gerenciador.getRepository(GoogleCanalWatchOrm).findOne({ where: { canalWatchId, tenantId } }),
      conexao: await gerenciador.getRepository(ProfissionalGoogleConexaoOrm).findOne({
        where: { tenantId, canalWatchId }
      })
    }));
    if (!canal) return;
    if (!conexao || conexao.canalRecursoId !== recursoId || conexao.profissionalId !== canal.profissionalId) return;
    if (canal.expiraEm.getTime() <= Date.now() || !conexao.canalExpiraEm || conexao.canalExpiraEm.getTime() <= Date.now()) return;
    if (!canal.token || !tokenRecebido) {
      this.logger.warn(`Notificacao rejeitada para canal ${canalWatchId}: token de canal ausente ou nao verificavel.`);
      return;
    }

    const bufferRecebido = Buffer.from(tokenRecebido);
    const bufferEsperado = Buffer.from(canal.token);
    const tokenValido = bufferRecebido.length === bufferEsperado.length && timingSafeEqual(bufferRecebido, bufferEsperado);
    if (!tokenValido) return;

    await this.filaSincronizacao.add(
      'notificacao',
      { canalWatchId, tenantId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        jobId: `${canalWatchId}-${numeroMensagem}`,
        removeOnComplete: 500,
        removeOnFail: 500
      }
    );
  }

  private async criarCanalParaProfissional(tenantId: string, profissionalId: string): Promise<void> {
    const credenciais = await this.servicoConexao.obterConexaoAtiva(tenantId, profissionalId);
    if (!credenciais) return;

    const canalId = gerarIdentificadorCanalWatchGoogle(tenantId);
    const token = randomBytes(24).toString('hex');
    const { recursoId, expiraEm } = await this.googleCalendar.criarCanalWatch(credenciais, canalId, urlWebhookGoogleAgenda(), token);

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const repositorioCanal = gerenciador.getRepository(GoogleCanalWatchOrm);
      const conexao = await repositorio.findOne({ where: { tenantId, profissionalId } });
      if (!conexao) return;
      conexao.canalWatchId = canalId;
      conexao.canalRecursoId = recursoId;
      conexao.canalExpiraEm = expiraEm;
      await repositorio.save(conexao);
      await repositorioCanal.save(
        repositorioCanal.create({ canalWatchId: canalId, tenantId, profissionalId, expiraEm, token })
      );
    });
  }

  private async resolverProfissionalIdObrigatorio(usuario: UsuarioAutenticado): Promise<string> {
    if (usuario.papel !== 'Professional') {
      throw new Error('Somente profissionais podem conectar a propria Google Agenda nesta fase.');
    }
    const profissionalId = await this.executorTenant.executar(usuario.tenantId, async (gerenciador) => {
      const { resolverProfissionalIdDoUsuario } = await import('../../../infraestrutura/seguranca/escopo-profissional');
      return resolverProfissionalIdDoUsuario(gerenciador, usuario.tenantId, usuario);
    });
    if (!profissionalId) throw new Error('Profissional nao encontrado para o usuario autenticado.');
    return profissionalId;
  }
}
