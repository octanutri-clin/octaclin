import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { GuardaChaveApi } from './guarda-chave-api';

describe('GuardaChaveApi', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const chaveId = '22222222-2222-4222-8222-222222222222';
  const segredo = 'segredo-muito-forte-com-mais-de-trinta-e-dois-bytes';

  function montar(chave: Record<string, unknown> | null) {
    const repositorio = {
      findOne: jest.fn(async () => chave),
      update: jest.fn(async () => ({ affected: 1 }))
    };
    const executor = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorio })
      )
    };
    const protecao = { consumirTentativa: jest.fn(async () => undefined) };
    const requisicao: Record<string, unknown> = {
      headers: { authorization: `Bearer octa_live.${tenantId}.${chaveId}.${segredo}` }
    };
    const contexto = {
      switchToHttp: () => ({ getRequest: () => requisicao })
    } as unknown as ExecutionContext;
    return { guarda: new GuardaChaveApi(executor as never, protecao as never), executor, protecao, repositorio, requisicao, contexto };
  }

  it('estabelece tenant e escopos somente depois de comparar o hash', async () => {
    const cenario = montar({
      id: chaveId,
      tenantId,
      segredoHash: createHash('sha256').update(segredo).digest('hex'),
      escopos: ['pacientes:ler'],
      criadoPorUsuarioId: '33333333-3333-4333-8333-333333333333'
    });
    await expect(cenario.guarda.canActivate(cenario.contexto)).resolves.toBe(true);
    expect(cenario.executor.executar).toHaveBeenCalledWith(tenantId, expect.any(Function));
    expect(cenario.protecao.consumirTentativa).toHaveBeenCalledWith(
      `api-publica:${tenantId}:${chaveId}`,
      expect.objectContaining({ maxTentativas: 120 })
    );
    expect(cenario.protecao.consumirTentativa).toHaveBeenCalledWith(
      'api-publica-auth:ip-desconhecido',
      expect.objectContaining({ maxTentativas: 300 })
    );
    expect(cenario.requisicao.integracaoAutenticada).toEqual(expect.objectContaining({ tenantId, chaveId }));
  });

  it('nega imediatamente chave revogada, ausente ou com segredo incorreto', async () => {
    const ausente = montar(null);
    await expect(ausente.guarda.canActivate(ausente.contexto)).rejects.toBeInstanceOf(UnauthorizedException);

    const incorreta = montar({
      id: chaveId,
      tenantId,
      segredoHash: createHash('sha256').update('outro-segredo').digest('hex'),
      escopos: ['pacientes:ler']
    });
    await expect(incorreta.guarda.canActivate(incorreta.contexto)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(incorreta.protecao.consumirTentativa).toHaveBeenCalledTimes(1);
    expect(incorreta.protecao.consumirTentativa).toHaveBeenCalledWith(
      'api-publica-auth:ip-desconhecido',
      expect.objectContaining({ maxTentativas: 300 })
    );
  });
});
