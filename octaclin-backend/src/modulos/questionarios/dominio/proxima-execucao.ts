import { BadRequestException } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';

export function resolverProximaExecucao(
    regraCron?: string,
    dataFixa?: string,
    timezone = 'America/Sao_Paulo',
    base = new Date()
  ): Date {
    if (dataFixa) return new Date(dataFixa);
    if (!regraCron) throw new BadRequestException('Regra cron ausente.');

    try {
      return CronExpressionParser.parse(regraCron, { currentDate: base, tz: timezone }).next().toDate();
    } catch {
      throw new BadRequestException('Regra cron invalida.');
    }
  }

