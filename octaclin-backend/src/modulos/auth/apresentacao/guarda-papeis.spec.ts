import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GuardaPapeis } from './guarda-papeis';
import { ACAO_AUTORIZACAO_NEGADA, reiniciarJanelaAutorizacaoNegada } from './auditoria-autorizacao';
import { CHAVE_PAPEIS } from './decorators';

const TENANT = 'tenant-1';
const USUARIO = 'usuario-1';
const REQUEST_ID = 'req-1';

/**
 * Valor sintetico montado por concatenacao: escrito inteiro no fonte, ele
 * pareceria credencial real para a varredura de segredos do repositorio.
 */
const TOKEN_SINTETICO = ['Bearer ', 'ey', 'JhbGciOiJIUzI1NiJ9.', 'carga-sintetica', '.assinatura'].join('');

interface OpcoesContexto {
  papel?: string;
  rota?: string;
  usuarioId?: string;
}

function criarContexto(opcoes: OpcoesContexto = {}) {
  class ControladorFicticio {}
  function remover() {}

  const requisicao = {
    headers: { authorization: TOKEN_SINTETICO },
    method: 'DELETE',
    originalUrl: opcoes.rota ?? '/operacoes/logs',
    requestId: REQUEST_ID,
    usuarioAutenticado: opcoes.papel
      ? {
          tenantId: TENANT,
          usuarioId: opcoes.usuarioId ?? USUARIO,
          papel: opcoes.papel,
          emailHash: 'hash',
          permissoes: ['cliente.acessar', 'agenda.consultar']
        }
      : undefined
  };

  return {
    getHandler: () => remover,
    getClass: () => ControladorFicticio,
    switchToHttp: () => ({ getRequest: () => requisicao })
  } as never;
}

function criarReflector(papeisExigidos?: string[]) {
  return {
    getAllAndOverride: jest.fn((chave) => (chave === CHAVE_PAPEIS ? papeisExigidos : undefined))
  } as unknown as Reflector;
}

function criarAuditoria(lanca: 'sincrono' | 'promessa' | false = false) {
  return {
    registrar: jest.fn(() => {
      if (lanca === 'sincrono') throw new Error('trilha indisponivel');
      if (lanca === 'promessa') return Promise.reject(new Error('trilha indisponivel'));
      return Promise.resolve(undefined);
    })
  };
}

describe('GuardaPapeis', () => {
  beforeEach(() => {
    reiniciarJanelaAutorizacaoNegada();
  });

  it('deve permitir rota sem papeis explicitos', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPapeis(criarReflector(undefined), auditoria as never);

    expect(guarda.canActivate(criarContexto({ papel: 'Patient' }))).toBe(true);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('deve permitir usuario com o papel exigido', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);

    expect(guarda.canActivate(criarContexto({ papel: 'SuperAdmin' }))).toBe(true);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('deve negar usuario com papel fora da exigencia', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ papel: 'Patient' }))).toThrow(ForbiddenException);
  });

  it('registra a negativa com o papel exigido, a rota, o handler e o requestId', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ papel: 'Patient' }))).toThrow(ForbiddenException);

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: ACAO_AUTORIZACAO_NEGADA,
        tenantId: TENANT,
        usuarioId: USUARIO,
        recursoTipo: 'autorizacao',
        requestId: REQUEST_ID,
        metadados: expect.objectContaining({
          tipo: 'papel',
          exigido: 'SuperAdmin',
          metodo: 'DELETE',
          rota: '/operacoes/logs',
          alvo: 'ControladorFicticio.remover'
        })
      })
    );
  });

  it('nao vaza o token nem a lista de permissoes do portador na negativa', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ papel: 'Patient' }))).toThrow(ForbiddenException);

    const registrado = JSON.stringify(auditoria.registrar.mock.calls);
    expect(registrado).not.toContain(TOKEN_SINTETICO);
    expect(registrado).not.toContain('assinatura');
    expect(registrado).not.toContain('cliente.acessar');
    expect(registrado).not.toContain('agenda.consultar');
  });

  it('nao registra quando a requisicao chega sem usuario autenticado', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto())).toThrow(ForbiddenException);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('colapsa a rajada da mesma negativa em uma unica escrita por janela', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);

    for (let tentativa = 0; tentativa < 50; tentativa += 1) {
      expect(() => guarda.canActivate(criarContexto({ papel: 'Patient' }))).toThrow(ForbiddenException);
    }

    expect(auditoria.registrar).toHaveBeenCalledTimes(1);
  });

  it('nao engole negativa distinta: outra rota e outro usuario continuam gravando', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ papel: 'Patient' }))).toThrow(ForbiddenException);
    expect(() => guarda.canActivate(criarContexto({ papel: 'Patient', rota: '/operacoes/providers' }))).toThrow(
      ForbiddenException
    );
    expect(() => guarda.canActivate(criarContexto({ papel: 'Patient', usuarioId: 'usuario-2' }))).toThrow(
      ForbiddenException
    );

    expect(auditoria.registrar).toHaveBeenCalledTimes(3);
  });

  it('volta a gravar a mesma negativa depois que a janela expira', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);
    const inicio = Date.parse('2026-09-01T10:00:00.000Z');
    const agora = jest.spyOn(Date, 'now').mockReturnValue(inicio);

    try {
      expect(() => guarda.canActivate(criarContexto({ papel: 'Patient' }))).toThrow(ForbiddenException);
      agora.mockReturnValue(inicio + 59_000);
      expect(() => guarda.canActivate(criarContexto({ papel: 'Patient' }))).toThrow(ForbiddenException);
      expect(auditoria.registrar).toHaveBeenCalledTimes(1);

      agora.mockReturnValue(inicio + 61_000);
      expect(() => guarda.canActivate(criarContexto({ papel: 'Patient' }))).toThrow(ForbiddenException);
      expect(auditoria.registrar).toHaveBeenCalledTimes(2);
    } finally {
      agora.mockRestore();
    }
  });

  it('mantem o 403 quando a trilha lanca de forma sincrona', () => {
    const auditoria = criarAuditoria('sincrono');
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ papel: 'Patient' }))).toThrow(ForbiddenException);
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('mantem o 403 quando a trilha rejeita a promessa', async () => {
    const auditoria = criarAuditoria('promessa');
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ papel: 'Patient' }))).toThrow(ForbiddenException);
    await Promise.resolve();
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('nao devolve true quando a trilha falha: a negativa continua sendo negativa', () => {
    const auditoria = criarAuditoria('sincrono');
    const guarda = new GuardaPapeis(criarReflector(['SuperAdmin']), auditoria as never);

    let resultado: boolean | undefined;
    try {
      resultado = guarda.canActivate(criarContexto({ papel: 'Patient' }));
    } catch (erro) {
      expect(erro).toBeInstanceOf(ForbiddenException);
    }

    expect(resultado).toBeUndefined();
  });
});
