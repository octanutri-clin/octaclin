import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GuardaPermissoes } from './guarda-permissoes';
import { CHAVE_PERMISSOES } from './decorators';

function criarContexto(permissoes?: string[]) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'classe',
    switchToHttp: () => ({
      getRequest: () => ({
        usuarioAutenticado: permissoes
          ? {
              permissoes
            }
          : undefined
      })
    })
  } as never;
}

describe('GuardaPermissoes', () => {
  it('deve permitir rota sem permissoes explicitas', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => undefined)
    } as unknown as Reflector;
    const guarda = new GuardaPermissoes(reflector);

    expect(guarda.canActivate(criarContexto())).toBe(true);
  });

  it('deve permitir usuario com todas as permissoes exigidas', () => {
    const reflector = {
      getAllAndOverride: jest.fn((chave) => (chave === CHAVE_PERMISSOES ? ['cliente.usuarios.ler'] : undefined))
    } as unknown as Reflector;
    const guarda = new GuardaPermissoes(reflector);

    expect(guarda.canActivate(criarContexto(['cliente.acessar', 'cliente.usuarios.ler']))).toBe(true);
  });

  it('deve negar usuario sem a permissao exigida', () => {
    const reflector = {
      getAllAndOverride: jest.fn((chave) => (chave === CHAVE_PERMISSOES ? ['cliente.usuarios.desativar'] : undefined))
    } as unknown as Reflector;
    const guarda = new GuardaPermissoes(reflector);

    expect(() => guarda.canActivate(criarContexto(['cliente.usuarios.ler']))).toThrow(ForbiddenException);
  });
});
