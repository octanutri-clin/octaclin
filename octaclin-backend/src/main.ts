import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { InterceptorLogRequisicao } from './infraestrutura/observabilidade/interceptor-log-requisicao';
import { middlewareCorrelacao } from './infraestrutura/observabilidade/middleware-correlacao';
import { ModuloAplicacao } from './modulo-aplicacao';
import { obterSegredoFormularioPublico } from './infraestrutura/seguranca/segredo-formulario-publico';
import { validarSegredosJwt } from './modulos/auth/infraestrutura/configuracao-jwt';
import { obterPapelProcesso } from './infraestrutura/processamento/papel-processo';
import { redisConfigurado } from './modulos/comunicacoes/aplicacao/configuracao-redis';
import { ServicoTelemetriaOperacional } from './infraestrutura/observabilidade/servico-telemetria-operacional';
import { criarPipeValidacaoHttp } from './infraestrutura/http/pipe-validacao-http';

function normalizarOrigemCors(origem: string, producao: boolean): string {
  let url: URL;
  try {
    url = new URL(origem);
  } catch {
    throw new Error('CORS_ORIGINS deve conter apenas origens HTTP(S) validas.');
  }

  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    origem.replace(/\/$/, '') !== url.origin
  ) {
    throw new Error('CORS_ORIGINS deve conter apenas origens HTTP(S), sem caminho, credencial, query ou hash.');
  }
  if (producao && url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('CORS_ORIGINS deve usar HTTPS em producao.');
  }
  return url.origin;
}

function obterOrigensCors(): true | string[] {
  const valor = process.env.CORS_ORIGINS;
  if (!valor) return true;

  const origens = valor
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean)
    .map((origem) => normalizarOrigemCors(origem, process.env.NODE_ENV === 'production'));

  if (!origens.length) return true;
  return [...new Set(origens)];
}

function obterPortaHttp(): number {
  return Number(process.env.PORT ?? process.env.PORTA_HTTP ?? 3000);
}

function validarCorsProducao() {
  if (process.env.NODE_ENV !== 'production') return;

  const origens = obterOrigensCors();
  if (!Array.isArray(origens) || !origens.length) {
    throw new Error('CORS_ORIGINS deve definir origens explicitas em producao.');
  }

  const chaveCriptografia = process.env.CRIPTOGRAFIA_CHAVE_AES_256?.trim();
  if (!chaveCriptografia) {
    throw new Error('CRIPTOGRAFIA_CHAVE_AES_256 e obrigatoria em producao.');
  }
  if (Buffer.byteLength(chaveCriptografia, 'utf8') < 32) {
    throw new Error('CRIPTOGRAFIA_CHAVE_AES_256 precisa ter pelo menos 32 bytes em producao.');
  }

  const chaveCriptografiaAnterior = process.env.CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR?.trim();
  if (chaveCriptografiaAnterior && Buffer.byteLength(chaveCriptografiaAnterior, 'utf8') < 32) {
    throw new Error('CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR precisa ter pelo menos 32 bytes em producao.');
  }
  if (chaveCriptografiaAnterior === chaveCriptografia) {
    throw new Error('CRIPTOGRAFIA_CHAVE_AES_256_ANTERIOR deve ser diferente da chave atual.');
  }

  const chaveIndice = process.env.CRIPTOGRAFIA_CHAVE_INDICE_HMAC?.trim();
  if (chaveIndice && Buffer.byteLength(chaveIndice, 'utf8') < 32) {
    throw new Error('CRIPTOGRAFIA_CHAVE_INDICE_HMAC precisa ter pelo menos 32 bytes em producao.');
  }

  obterSegredoFormularioPublico();

  const configuracaoGoogle = [
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim(),
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim(),
    process.env.GOOGLE_CALENDAR_OAUTH_STATE_SECRET?.trim()
  ];
  if (configuracaoGoogle.some(Boolean) && configuracaoGoogle.some((valor) => !valor)) {
    throw new Error('GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET e GOOGLE_CALENDAR_OAUTH_STATE_SECRET devem ser configurados juntos em producao.');
  }
  if (configuracaoGoogle[2] && Buffer.byteLength(configuracaoGoogle[2], 'utf8') < 32) {
    throw new Error('GOOGLE_CALENDAR_OAUTH_STATE_SECRET precisa ter pelo menos 32 bytes em producao.');
  }

  const configuracaoMeta = [
    process.env.META_WHATSAPP_TOKEN?.trim(),
    process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim(),
    process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim(),
    process.env.META_WHATSAPP_APP_SECRET?.trim()
  ];
  if (configuracaoMeta.some(Boolean) && (!configuracaoMeta[2] || !configuracaoMeta[3])) {
    throw new Error(
      'META_WHATSAPP_WEBHOOK_VERIFY_TOKEN e META_WHATSAPP_APP_SECRET sao obrigatorios quando a integracao Meta esta configurada em producao.'
    );
  }
  if (configuracaoMeta[3] && Buffer.byteLength(configuracaoMeta[3], 'utf8') < 32) {
    throw new Error('META_WHATSAPP_APP_SECRET precisa ter pelo menos 32 bytes em producao.');
  }
}

async function iniciarAplicacao() {
  const papel = obterPapelProcesso();
  if (process.env.NODE_ENV === 'production' && papel !== 'web' && !redisConfigurado()) {
    throw new Error('REDIS_URL ou REDIS_HOST deve ser configurado para executar processadores em producao.');
  }
  if (papel === 'worker') {
    const aplicacao = await NestFactory.createApplicationContext(ModuloAplicacao);
    aplicacao.enableShutdownHooks();
    return;
  }
  const aplicacao = await NestFactory.create<NestExpressApplication>(ModuloAplicacao, { rawBody: true });
  aplicacao.enableShutdownHooks();
  aplicacao.useBodyParser('json', { limit: '100kb' });
  const servidorHttp = aplicacao.getHttpAdapter().getInstance();
  servidorHttp.set('trust proxy', 1);
  aplicacao.use(middlewareCorrelacao);
  aplicacao.useGlobalInterceptors(new InterceptorLogRequisicao(aplicacao.get(ServicoTelemetriaOperacional)));
  aplicacao.enableCors({
    origin: obterOrigensCors(),
    credentials: true
  });
  aplicacao.useGlobalPipes(criarPipeValidacaoHttp());

  await aplicacao.listen(obterPortaHttp());
}

// Fora do bloco de producao de proposito: a regra vale tambem em staging, onde
// `NODE_ENV` sozinho nao distingue o ambiente. Em local e teste, a funcao
// resolve segredos efemeros e nao derruba o processo.
validarCorsProducao();
validarSegredosJwt();
void iniciarAplicacao();
