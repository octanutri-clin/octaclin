import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { InterceptorLogRequisicao } from './infraestrutura/observabilidade/interceptor-log-requisicao';
import { middlewareCorrelacao } from './infraestrutura/observabilidade/middleware-correlacao';
import { ModuloAplicacao } from './modulo-aplicacao';
import { obterSegredoFormularioPublico } from './infraestrutura/seguranca/segredo-formulario-publico';
import { obterPapelProcesso } from './infraestrutura/processamento/papel-processo';
import { redisConfigurado } from './modulos/comunicacoes/aplicacao/configuracao-redis';
import { ServicoTelemetriaOperacional } from './infraestrutura/observabilidade/servico-telemetria-operacional';

function obterOrigensCors(): boolean | string[] {
  const valor = process.env.CORS_ORIGINS;
  if (!valor) return true;

  const origens = valor
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);

  if (!origens.length || origens.includes('*')) return true;
  return origens;
}

function obterPortaHttp(): number {
  return Number(process.env.PORT ?? process.env.PORTA_HTTP ?? 3000);
}

function validarCorsProducao() {
  if (process.env.NODE_ENV !== 'production') return;

  const origens = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);

  if (!origens.length || origens.includes('*')) {
    throw new Error('CORS_ORIGINS deve definir origens explicitas em producao.');
  }

  if (!process.env.JWT_SEGREDO?.trim()) {
    throw new Error('JWT_SEGREDO e obrigatorio em producao.');
  }

  if (!process.env.JWT_REFRESH_SEGREDO?.trim()) {
    throw new Error('JWT_REFRESH_SEGREDO e obrigatorio em producao.');
  }

  if (!process.env.CRIPTOGRAFIA_CHAVE_AES_256?.trim()) {
    throw new Error('CRIPTOGRAFIA_CHAVE_AES_256 e obrigatoria em producao.');
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
  const aplicacao = await NestFactory.create(ModuloAplicacao);
  aplicacao.enableShutdownHooks();
  const servidorHttp = aplicacao.getHttpAdapter().getInstance();
  servidorHttp.set('trust proxy', 1);
  aplicacao.use(middlewareCorrelacao);
  aplicacao.useGlobalInterceptors(new InterceptorLogRequisicao(aplicacao.get(ServicoTelemetriaOperacional)));
  aplicacao.enableCors({
    origin: obterOrigensCors(),
    credentials: true
  });
  aplicacao.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  await aplicacao.listen(obterPortaHttp());
}

validarCorsProducao();
void iniciarAplicacao();
