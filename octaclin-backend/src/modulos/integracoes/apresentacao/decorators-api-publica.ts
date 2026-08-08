import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ContextoApiPublica, EscopoApiPublica } from '../dominio/contratos-integracao';

export const CHAVE_ESCOPOS_API_PUBLICA = 'escoposApiPublica';
export const EscoposApiPublica = (...escopos: EscopoApiPublica[]) => SetMetadata(CHAVE_ESCOPOS_API_PUBLICA, escopos);

export const IntegracaoAtual = createParamDecorator((_: unknown, contexto: ExecutionContext): ContextoApiPublica => {
  const requisicao = contexto.switchToHttp().getRequest<{ integracaoAutenticada: ContextoApiPublica }>();
  return requisicao.integracaoAutenticada;
});
