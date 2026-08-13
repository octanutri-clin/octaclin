import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHAVE_FEATURE_FLAG, GuardaFeatureFlag } from './guarda-feature-flag';

describe('GuardaFeatureFlag', () => {
  function criarContexto(tenantId = 'tenant-1') {
    class Controlador {}
    const handler = () => undefined;
    Reflect.defineMetadata(CHAVE_FEATURE_FLAG, 'ia.clinica', Controlador);
    return {
      getHandler: () => handler,
      getClass: () => Controlador,
      switchToHttp: () => ({ getRequest: () => ({ usuarioAutenticado: { tenantId } }) })
    } as unknown as ExecutionContext;
  }

  it('libera somente quando a flag do tenant esta habilitada', async () => {
    const flags = { habilitada: jest.fn(async () => true) };
    const guarda = new GuardaFeatureFlag(new Reflector(), flags as never);

    await expect(guarda.canActivate(criarContexto())).resolves.toBe(true);
    expect(flags.habilitada).toHaveBeenCalledWith('tenant-1', 'ia.clinica');
  });

  it('falha fechado sem habilitacao ou tenant autenticado', async () => {
    const flags = { habilitada: jest.fn(async () => false) };
    const guarda = new GuardaFeatureFlag(new Reflector(), flags as never);

    await expect(guarda.canActivate(criarContexto())).rejects.toBeInstanceOf(ForbiddenException);
  });
});
