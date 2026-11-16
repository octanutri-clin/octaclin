import { InternalServerErrorException } from '@nestjs/common';
import { isUUID } from 'class-validator';

/**
 * `EntityManager.query()` do TypeORM com PostgreSQL devolve, para `UPDATE`/`DELETE ... RETURNING`, o par
 * `[linhas, contagem]` (e só as linhas para `SELECT`/`INSERT`). Iterar o resultado cru trata a contagem como linha.
 * Este helper aceita só esse formato, exige `id` UUID em cada linha e falha fechado em qualquer outro caso.
 */
export function linhasDeUpdateReturning(resultado: unknown): Array<{ id: string }> {
  if (!Array.isArray(resultado) || resultado.length !== 2 || !Array.isArray(resultado[0]) || !Number.isSafeInteger(resultado[1]) ||
    resultado[0].length !== resultado[1]) throw new InternalServerErrorException('Operação indisponível.');
  const linhas = resultado[0] as unknown[];
  for (const linha of linhas) {
    if (!linha || typeof linha !== 'object' || !isUUID((linha as { id?: unknown }).id)) throw new InternalServerErrorException('Operação indisponível.');
  }
  return linhas as Array<{ id: string }>;
}
