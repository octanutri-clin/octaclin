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

void iniciarAplicacao();
