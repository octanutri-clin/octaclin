import { BadRequestException, ConflictException, ForbiddenException, HttpException, InternalServerErrorException } from '@nestjs/common';

/** Nunca encaminha erro de banco ou seus parâmetros ao filtro/logger padrão. */
export function falharRestricao(erro: unknown, conflitoCriacao = false): never {
  if (erro instanceof HttpException) {
    const status = erro.getStatus();
    if (status === 400) throw new BadRequestException('Solicitação inválida.');
    if (status === 403) throw new ForbiddenException('Operação não autorizada.');
    if (status === 409) throw new ConflictException('Operação indisponível ou concorrente.');
    throw new InternalServerErrorException('Operação indisponível.');
  }
  const falha = erro as { code?: string; constraint?: string; driverError?: { code?: string; constraint?: string } } | null;
  const code = falha?.code ?? falha?.driverError?.code;
  const constraint = falha?.constraint ?? falha?.driverError?.constraint;
  if (conflitoCriacao && code === '23505' && constraint === 'ux_restricoes_pacientes_criacao') {
    throw new ConflictException('Chave já utilizada.');
  }
  if (code === '55P03' || code === '40P01' || code === '40001') throw new ConflictException('Operação concorrente. Tente novamente.');
  throw new InternalServerErrorException('Operação indisponível.');
}
