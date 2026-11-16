import type { ErrorRequestHandler, RequestHandler } from 'express';

const protegido = (path: string): boolean => /^\/pacientes\/[^/]+\/restricoes(?:\/|$)/i.test(path);

/** Instalado em main.ts antes do parser JSON (FOOD06 P2b). */
export const middlewareRestricoesClinicas: RequestHandler = (req, res, next) => {
  if (protegido(req.path)) res.setHeader('Cache-Control', 'private, no-store');
  next();
};

/** Instalado em main.ts depois do parser, para não refletir conteúdo clínico inválido. */
export const middlewareErroRestricoesClinicas: ErrorRequestHandler = (erro, req, res, next) => {
  if (!protegido(req.path)) return next(erro);
  const original = (erro as { status?: unknown } | null)?.status;
  const status = original === 413 ? 413 : original === 400 ? 400 : 500;
  res.status(status).json({ statusCode: status, message: status === 413 ? 'Solicitação acima do limite.' :
    status === 400 ? 'Solicitação inválida.' : 'Operação indisponível.' });
};
