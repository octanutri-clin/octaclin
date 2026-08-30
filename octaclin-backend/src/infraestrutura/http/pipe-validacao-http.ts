import { ValidationPipe, type ValidationPipeOptions } from '@nestjs/common';

export const OPCOES_VALIDACAO_HTTP: Readonly<ValidationPipeOptions> = Object.freeze({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true
});

export function criarPipeValidacaoHttp(): ValidationPipe {
  return new ValidationPipe(OPCOES_VALIDACAO_HTTP);
}
