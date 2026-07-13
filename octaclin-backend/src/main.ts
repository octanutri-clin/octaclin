import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ModuloAplicacao } from './modulo-aplicacao';

async function iniciarAplicacao() {
  const aplicacao = await NestFactory.create(ModuloAplicacao);
  aplicacao.enableCors({
    origin: true,
    credentials: true
  });
  aplicacao.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const porta = Number(process.env.PORTA_HTTP ?? 3000);
  await aplicacao.listen(porta);
}

void iniciarAplicacao();
