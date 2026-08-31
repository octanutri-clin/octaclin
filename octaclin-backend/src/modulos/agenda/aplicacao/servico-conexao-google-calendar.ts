import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { CredenciaisGoogleCalendar, ServicoGoogleCalendar } from './servico-google-calendar';
import {
  endpointTokenGoogleSeguro,
  opcoesSegurasFetchExterno,
  validarCodigoOAuth
} from '../../../infraestrutura/seguranca/seguranca-integracoes-externas';

interface RespostaTrocaCodigoGoogle {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function textoEnv(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

function chaveAssinaturaState(): string {
  const segredo = textoEnv(process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET);
  if (!segredo || Buffer.byteLength(segredo, 'utf8') < 32) {
    throw new BadRequestException('GOOGLE_CALENDAR_OAUTH_STATE_SECRET precisa ter pelo menos 32 bytes.');
  }
  return segredo;
}

export const REDIS_OAUTH_STATE_GOOGLE = 'REDIS_OAUTH_STATE_GOOGLE';

export interface ClienteRedisOAuthState {
  set(chave: string, valor: string, modo: 'PX', duracaoMs: number, condicao: 'NX'): Promise<'OK' | null>;
  get(chave: string): Promise<string | null>;
  del(chave: string): Promise<number>;
}

const DURACAO_MAXIMA_STATE_MS = 10 * 60 * 1000;

@Injectable()
export class ServicoConexaoGoogleCalendar {
  private readonly logger = new Logger(ServicoConexaoGoogleCalendar.name);

  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis,
    @Inject(REDIS_OAUTH_STATE_GOOGLE) private readonly redis: ClienteRedisOAuthState,
    private readonly googleCalendar: ServicoGoogleCalendar,
    private readonly fonteDados: DataSource
  ) {}

  gerarTicketInicioOAuth(tenantId: string, profissionalId: string): string {
    return this.assinarPayload({ tipo: 'inicio', tenantId, profissionalId, nonce: randomBytes(16).toString('hex'), exp: Date.now() + DURACAO_MAXIMA_STATE_MS });
  }

  async iniciarAutorizacao(
    ticket: string,
    urlCallback: string
  ): Promise<{ url: string; vinculoBrowser: string }> {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    if (!clientId) throw new BadRequestException('Integracao Google Calendar nao configurada.');

    const inicio = this.validarPayloadAssinado(ticket, 'inicio');
    const ticketConsumido = await this.redis.set(
      `google-oauth-inicio:${inicio.nonce}`,
      '1',
      'PX',
      DURACAO_MAXIMA_STATE_MS,
      'NX'
    );
    if (ticketConsumido !== 'OK') throw new BadRequestException('Ticket OAuth ja utilizado.');

    const vinculoBrowser = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(48).toString('base64url');
    const nonce = randomBytes(16).toString('hex');
    const state = this.assinarPayload({
      tipo: 'state',
      tenantId: inicio.tenantId,
      profissionalId: inicio.profissionalId,
      nonce,
      vinculoHash: this.macVinculo(vinculoBrowser),
      exp: Date.now() + DURACAO_MAXIMA_STATE_MS
    });
    const pkceArmazenado = await this.redis.set(
      `google-oauth-pkce:${nonce}`,
      codeVerifier,
      'PX',
      DURACAO_MAXIMA_STATE_MS,
      'NX'
    );
    if (pkceArmazenado !== 'OK') throw new BadRequestException('Nao foi possivel iniciar OAuth com seguranca.');

    const parametros = new URLSearchParams({
      client_id: clientId,
      redirect_uri: urlCallback,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/calendar',
      state,
      code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
      code_challenge_method: 'S256'
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${parametros.toString()}`, vinculoBrowser };
  }

  async validarEDecodificarState(
    state: string,
    vinculoBrowser: string | undefined
  ): Promise<{ tenantId: string; profissionalId: string; codeVerifier: string }> {
    const payload = this.validarPayloadAssinado(state, 'state');
    if (!vinculoBrowser || !this.compararSeguro(this.macVinculo(vinculoBrowser), payload.vinculoHash ?? '')) {
      throw new BadRequestException('State OAuth nao pertence a este navegador.');
    }

    const chaveConsumido = `google-oauth-state:${payload.nonce}`;
    if (await this.redis.get(chaveConsumido)) throw new BadRequestException('State OAuth ja utilizado.');
    const chavePkce = `google-oauth-pkce:${payload.nonce}`;
    const codeVerifier = await this.redis.get(chavePkce);
    if (!codeVerifier) throw new BadRequestException('State OAuth invalido ou expirado.');

    const consumido = await this.redis.set(chaveConsumido, '1', 'PX', DURACAO_MAXIMA_STATE_MS, 'NX');
    if (consumido !== 'OK') {
      throw new BadRequestException('State OAuth ja utilizado.');
    }
    await this.redis.del(chavePkce);

    return { tenantId: payload.tenantId, profissionalId: payload.profissionalId, codeVerifier };
  }

  async trocarCodigoPorConexao(
    tenantId: string,
    profissionalId: string,
    code: string,
    urlCallback: string,
    codeVerifier: string
  ): Promise<void> {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    const clientSecret = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
    if (!clientId || !clientSecret) throw new BadRequestException('Integracao Google Calendar nao configurada.');

    const tokenUri = endpointTokenGoogleSeguro(textoEnv(process.env.GOOGLE_CALENDAR_TOKEN_URI));
    const resposta = await fetch(tokenUri, {
      ...opcoesSegurasFetchExterno(),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: validarCodigoOAuth(code),
        redirect_uri: urlCallback,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      })
    });
    const corpo = (await resposta.json()) as RespostaTrocaCodigoGoogle;
    if (!resposta.ok || !corpo.refresh_token) {
      throw new BadRequestException(`Falha ao conectar Google Agenda: HTTP ${resposta.status}.`);
    }

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const existente = await repositorio.findOne({ where: { tenantId, profissionalId } });
      const dados = {
        tenantId,
        profissionalId,
        refreshTokenCriptografado: this.criptografia.criptografar(corpo.refresh_token as string),
        calendarId: 'primary',
        escoposConcedidos: corpo.scope,
        conectadoEm: new Date(),
        desconectadoEm: null
      };
      await repositorio.save(existente ? { ...existente, ...dados } : repositorio.create(dados));
    });
  }

  async obterConexaoAtiva(tenantId: string, profissionalId: string): Promise<CredenciaisGoogleCalendar | undefined> {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    const clientSecret = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
    if (!clientId || !clientSecret) return undefined;

    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const conexao = await gerenciador.getRepository(ProfissionalGoogleConexaoOrm).findOne({ where: { tenantId, profissionalId } });
      if (!conexao || conexao.desconectadoEm) return undefined;

      return {
        clientId,
        clientSecret,
        refreshToken: this.criptografia.descriptografar(conexao.refreshTokenCriptografado),
        calendarId: conexao.calendarId
      };
    });
  }

  async desconectar(tenantId: string, profissionalId: string): Promise<void> {
    const conexao = await this.executorTenant.executar(tenantId, (gerenciador) =>
      gerenciador.getRepository(ProfissionalGoogleConexaoOrm).findOne({ where: { tenantId, profissionalId } })
    );
    if (!conexao) return;

    if (conexao.canalWatchId && conexao.canalRecursoId) {
      await this.pararCanalWatchComTolerancia(conexao);
    }

    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const repositorioCanal = gerenciador.getRepository(GoogleCanalWatchOrm);
      const atual = await repositorio.findOne({ where: { tenantId, profissionalId } });
      if (!atual) return;
      if (conexao.canalWatchId) await repositorioCanal.delete({ canalWatchId: conexao.canalWatchId });
      atual.desconectadoEm = new Date();
      atual.canalWatchId = undefined;
      atual.canalRecursoId = undefined;
      atual.canalExpiraEm = undefined;
      await repositorio.save(atual);
    });
  }

  private async pararCanalWatchComTolerancia(conexao: ProfissionalGoogleConexaoOrm): Promise<void> {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    const clientSecret = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
    if (!clientId || !clientSecret || !conexao.canalWatchId || !conexao.canalRecursoId) return;

    try {
      const credenciais: CredenciaisGoogleCalendar = {
        clientId,
        clientSecret,
        refreshToken: this.criptografia.descriptografar(conexao.refreshTokenCriptografado),
        calendarId: conexao.calendarId
      };
      await this.googleCalendar.pararCanalWatch(credenciais, conexao.canalWatchId, conexao.canalRecursoId);
    } catch (erro) {
      this.logger.warn(
        `Falha ao parar canal de watch do Google Calendar (profissional ${conexao.profissionalId}): ${
          erro instanceof Error ? erro.message : 'erro desconhecido'
        }`
      );
    }
  }

  private assinarPayload(payload: Record<string, unknown>): string {
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    // HMAC autentica um payload OAuth; nao deriva nem armazena senha.
    // lgtm[js/insufficient-password-hash]
    const assinatura = createHmac('sha256', chaveAssinaturaState()).update(payloadBase64).digest('base64url');
    return Buffer.from(`${payloadBase64}.${assinatura}`).toString('base64url');
  }

  private validarPayloadAssinado(
    valor: string,
    tipo: 'inicio' | 'state'
  ): { tipo: string; tenantId: string; profissionalId: string; nonce: string; exp: number; vinculoHash?: string } {
    if (typeof valor !== 'string' || valor.length < 20 || valor.length > 4096) {
      throw new BadRequestException('State OAuth invalido.');
    }
    try {
      const partes = Buffer.from(valor, 'base64url').toString('utf8').split('.');
      if (partes.length !== 2) throw new Error('formato');
      const [payloadBase64, assinatura] = partes;
      // HMAC verifica autenticidade do state OAuth; nao processa senha.
      // lgtm[js/insufficient-password-hash]
      const assinaturaEsperada = createHmac('sha256', chaveAssinaturaState()).update(payloadBase64).digest('base64url');
      if (!this.compararSeguro(assinatura, assinaturaEsperada)) throw new Error('assinatura');

      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as Record<string, unknown>;
      if (
        payload.tipo !== tipo ||
        typeof payload.tenantId !== 'string' ||
        !payload.tenantId ||
        typeof payload.profissionalId !== 'string' ||
        !payload.profissionalId ||
        typeof payload.nonce !== 'string' ||
        !/^[a-f0-9]{32}$/.test(payload.nonce) ||
        typeof payload.exp !== 'number'
      ) {
        throw new Error('payload');
      }
      if (tipo === 'state' && (typeof payload.vinculoHash !== 'string' || !/^[a-f0-9]{64}$/.test(payload.vinculoHash))) {
        throw new Error('vinculo');
      }
      if (payload.exp < Date.now()) throw new BadRequestException('State OAuth expirado.');
      if (payload.exp > Date.now() + DURACAO_MAXIMA_STATE_MS + 5_000) throw new Error('prazo');
      return payload as { tipo: string; tenantId: string; profissionalId: string; nonce: string; exp: number; vinculoHash?: string };
    } catch (erro) {
      if (erro instanceof BadRequestException) throw erro;
      throw new BadRequestException('State OAuth invalido.');
    }
  }

  private macVinculo(vinculoBrowser: string): string {
    // O binding aleatorio de 256 bits recebe MAC; nao e credencial humana.
    // lgtm[js/insufficient-password-hash]
    return createHmac('sha256', chaveAssinaturaState()).update(vinculoBrowser).digest('hex');
  }

  private compararSeguro(recebido: string, esperado: string): boolean {
    const bufferRecebido = Buffer.from(recebido);
    const bufferEsperado = Buffer.from(esperado);
    return bufferRecebido.length === bufferEsperado.length && timingSafeEqual(bufferRecebido, bufferEsperado);
  }
}
