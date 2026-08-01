import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GuardaPapeis } from '../../auth/apresentacao/guarda-papeis';
import { PapelUsuario } from '../../auth/dominio/usuario-autenticado';
import { ControladorMobile } from './controlador-mobile';

function contexto(papel: PapelUsuario): ExecutionContext {
  return {
    getClass: () => ControladorMobile,
    getHandler: () => ControladorMobile.prototype.listarDiarioRapido,
    switchToHttp: () => ({
      getRequest: () => ({ usuarioAutenticado: { papel } })
    })
  } as unknown as ExecutionContext;
}

describe('ControladorMobile', () => {
  const guarda = new GuardaPapeis(new Reflector());

  it('deve bloquear Collaborator', () => {
    expect(() => guarda.canActivate(contexto('Collaborator'))).toThrow(ForbiddenException);
  });

  it.each(['Patient', 'Professional', 'SuperAdmin'] as const)('deve permitir %s', (papel) => {
    expect(guarda.canActivate(contexto(papel))).toBe(true);
  });
});
