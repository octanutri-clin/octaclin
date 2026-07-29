import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { CredenciaisGoogleCalendar, ServicoGoogleCalendar } from './servico-google-calendar';

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

  gerarUrlAutorizacao(tenantId: string, profissionalId: string, urlCallback: string): string {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    if (!clientId) throw new BadRequestException('Integracao Google Calendar nao configurada.');

    const state = this.assinarState(tenantId, profissionalId);
    const parametros = new URLSearchParams({
      client_id: clientId,
      redirect_uri: urlCallback,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/calendar',
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${parametros.toString()}`;
  }

  async validarEDecodificarState(state: string): Promise<{ tenantId: string; profissionalId: string }> {
    const partes = Buffer.from(state, 'base64url').toString('utf8').split('.');
    if (partes.length !== 2) throw new BadRequestException('State OAuth invalido.');

    const [payloadBase64, assinatura] = partes;
    const assinaturaEsperada = createHmac('sha256', chaveAssinaturaState()).update(payloadBase64).digest('base64url');
    const bufferAssinatura = Buffer.from(assinatura, 'base64url');
    const bufferEsperada = Buffer.from(assinaturaEsperada, 'base64url');
    if (bufferAssinatura.length !== bufferEsperada.length || !timingSafeEqual(bufferAssinatura, bufferEsperada)) {
      throw new BadRequestException('State OAuth invalido.');
    }

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as {
      tenantId: string;
      profissionalId: string;
      nonce: string;
      exp: number;
    };

    if (!payload.exp || payload.exp < Date.now()) {
      throw new BadRequestException('State OAuth expirado.');
    }

    const consumido = await this.redis.set(`google-oauth-state:${payload.nonce}`, '1', 'PX', DURACAO_MAXIMA_STATE_MS, 'NX');
    if (consumido !== 'OK') {
      throw new BadRequestException('State OAuth ja utilizado.');
    }

    return { tenantId: payload.tenantId, profissionalId: payload.profissionalId };
  }

  async trocarCodigoPorConexao(tenantId: string, profissionalId: string, code: string, urlCallback: string): Promise<void> {
    const clientId = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_ID);
    const clientSecret = textoEnv(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
    if (!clientId || !clientSecret) throw new BadRequestException('Integracao Google Calendar nao configurada.');

    const tokenUri = textoEnv(process.env.GOOGLE_CALENDAR_TOKEN_URI) ?? 'https://oauth2.googleapis.com/token';
    const resposta = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: urlCallback,
        grant_type: 'authorization_code'
      })
    });
    const corpo = (await resposta.json()) as RespostaTrocaCodigoGoogle;
    if (!resposta.ok || !corpo.refresh_token) {
      throw new BadRequestException(`Falha ao conectar Google Agenda: ${corpo.error_description ?? corpo.error ?? 'resposta invalida'}`);
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

  private assinarState(tenantId: string, profissionalId: string): string {
    const nonce = randomBytes(16).toString('hex');
    const exp = Date.now() + DURACAO_MAXIMA_STATE_MS;
    const payloadBase64 = Buffer.from(JSON.stringify({ tenantId, profissionalId, nonce, exp })).toString('base64url');
    const assinatura = createHmac('sha256', chaveAssinaturaState()).update(payloadBase64).digest('base64url');
    return Buffer.from(`${payloadBase64}.${assinatura}`).toString('base64url');
  }
}
