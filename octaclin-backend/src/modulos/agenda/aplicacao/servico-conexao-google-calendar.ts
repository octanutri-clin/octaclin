import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ProfissionalGoogleConexaoOrm } from '../infraestrutura/profissional-google-conexao.orm';
import { CredenciaisGoogleCalendar } from './servico-google-calendar';

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
  return process.env.CRIPTOGRAFIA_CHAVE_AES_256 ?? 'octaclin-chave-local-desenvolvimento';
}

@Injectable()
export class ServicoConexaoGoogleCalendar {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
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

  validarEDecodificarState(state: string): { tenantId: string; profissionalId: string } {
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
    };
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
        desconectadoEm: undefined
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
    await this.executorTenant.executar(tenantId, async (gerenciador) => {
      const repositorio = gerenciador.getRepository(ProfissionalGoogleConexaoOrm);
      const conexao = await repositorio.findOne({ where: { tenantId, profissionalId } });
      if (!conexao) return;
      conexao.desconectadoEm = new Date();
      conexao.canalWatchId = undefined;
      conexao.canalRecursoId = undefined;
      conexao.canalExpiraEm = undefined;
      await repositorio.save(conexao);
    });
  }

  private assinarState(tenantId: string, profissionalId: string): string {
    const nonce = randomBytes(8).toString('hex');
    const payloadBase64 = Buffer.from(JSON.stringify({ tenantId, profissionalId, nonce })).toString('base64url');
    const assinatura = createHmac('sha256', chaveAssinaturaState()).update(payloadBase64).digest('base64url');
    return Buffer.from(`${payloadBase64}.${assinatura}`).toString('base64url');
  }
}
