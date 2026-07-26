import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { InterceptorLogRequisicao } from './infraestrutura/observabilidade/interceptor-log-requisicao';
import { middlewareCorrelacao } from './infraestrutura/observabilidade/middleware-correlacao';
import { ModuloAplicacao } from './modulo-aplicacao';

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
}

async function iniciarAplicacao() {
  const aplicacao = await NestFactory.create(ModuloAplicacao);
  aplicacao.use(middlewareCorrelacao);
  aplicacao.useGlobalInterceptors(new InterceptorLogRequisicao());
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
