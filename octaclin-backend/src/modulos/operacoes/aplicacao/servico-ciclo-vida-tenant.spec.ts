import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ehViolacaoUnicidadePostgres, resolverTransicaoCicloVidaTenant } from './servico-ciclo-vida-tenant';

describe('resolverTransicaoCicloVidaTenant', () => {
  it.each([
    ['ativo_assistido', 'marcar_primeiro_uso', 'primeiro_uso_validado'],
    ['primeiro_uso_validado', 'iniciar_acompanhamento', 'acompanhamento_48h'],
    ['acompanhamento_48h', 'concluir_acompanhamento', 'ativo'],
    ['ativo', 'suspender', 'suspenso'],
    ['suspenso', 'reativar', 'ativo'],
    ['ativo', 'iniciar_encerramento', 'encerramento_pendente']
  ] as const)('deve aplicar %s -> %s -> %s', (atual, acao, esperado) => {
    expect(resolverTransicaoCicloVidaTenant(atual, { acao })).toBe(esperado);
  });

  it('deve exigir exportacao confirmada antes do encerramento definitivo', () => {
    expect(() => resolverTransicaoCicloVidaTenant('encerramento_pendente', { acao: 'encerrar' })).toThrow(
      BadRequestException
    );
    expect(
      resolverTransicaoCicloVidaTenant('encerramento_pendente', {
        acao: 'encerrar',
        exportacaoConfirmada: true,
        protocoloExportacao: 'EXP-2026-001'
      })
    ).toBe('encerrado');
  });

  it('deve exigir protocolo rastreavel da exportacao', () => {
    expect(() =>
      resolverTransicaoCicloVidaTenant('encerramento_pendente', {
        acao: 'encerrar',
        exportacaoConfirmada: true
      })
    ).toThrow(BadRequestException);
  });

  it('deve rejeitar saltos de etapa e reabertura de tenant encerrado', () => {
    expect(() => resolverTransicaoCicloVidaTenant('ativo_assistido', { acao: 'concluir_acompanhamento' })).toThrow(
      ConflictException
    );
    expect(() => resolverTransicaoCicloVidaTenant('encerrado', { acao: 'reativar' })).toThrow(ConflictException);
  });

  it('deve ser idempotente quando o estado de destino ja foi atingido', () => {
    expect(resolverTransicaoCicloVidaTenant('suspenso', { acao: 'suspender' })).toBe('suspenso');
  });
});

describe('ehViolacaoUnicidadePostgres', () => {
  it('deve reconhecer somente o codigo 23505 do driver Postgres', () => {
    const duplicidade = new QueryFailedError('insert', [], Object.assign(new Error('duplicate'), { code: '23505' }));
    const outroErro = new QueryFailedError('insert', [], Object.assign(new Error('fk'), { code: '23503' }));
    expect(ehViolacaoUnicidadePostgres(duplicidade)).toBe(true);
    expect(ehViolacaoUnicidadePostgres(outroErro)).toBe(false);
    expect(ehViolacaoUnicidadePostgres(new Error('fora do driver'))).toBe(false);
  });
});
