import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GuardaReautenticacao } from './guarda-reautenticacao';
import { CHAVE_REAUTENTICACAO } from './decorators';

const USUARIO = {
  usuarioId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
  sessaoId: '33333333-3333-4333-8333-333333333333',
  papel: 'SuperAdmin' as const,
  emailHash: 'hash',
  permissoes: []
};

function contexto(token?: string) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'classe',
    switchToHttp: () => ({
      getRequest: () => ({
        headers: token ? { 'x-octaclin-reauth': token } : {},
        usuarioAutenticado: USUARIO
      })
    })
  } as never;
}

describe('GuardaReautenticacao', () => {
  const reflector = {
    getAllAndOverride: jest.fn((chave) => chave === CHAVE_REAUTENTICACAO)
  } as unknown as Reflector;

  it('nega rota critica sem prova recente', async () => {
    const verificador = { validarProva: jest.fn() };
    const guarda = new GuardaReautenticacao(reflector, verificador as never);

    await expect(guarda.canActivate(contexto())).rejects.toBeInstanceOf(ForbiddenException);
    expect(verificador.validarProva).not.toHaveBeenCalled();
  });

  it('vincula a prova ao tenant, usuario e sessao autenticados', async () => {
    const verificador = { validarProva: jest.fn(async () => undefined) };
    const guarda = new GuardaReautenticacao(reflector, verificador as never);

    await expect(guarda.canActivate(contexto('prova-sintetica'))).resolves.toBe(true);
    expect(verificador.validarProva).toHaveBeenCalledWith('prova-sintetica', {
      tenantId: USUARIO.tenantId,
      usuarioId: USUARIO.usuarioId,
      sessaoId: USUARIO.sessaoId
    });
  });

  it('nega prova invalida sem expor a causa criptografica', async () => {
    const verificador = { validarProva: jest.fn(async () => { throw new Error('assinatura detalhada'); }) };
    const guarda = new GuardaReautenticacao(reflector, verificador as never);

    await expect(guarda.canActivate(contexto('adulterada'))).rejects.toMatchObject({
      message: 'Confirme sua senha novamente para continuar.'
    });
  });
});
