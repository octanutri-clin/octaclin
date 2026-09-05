import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GuardaPermissoes } from './guarda-permissoes';
import { ACAO_AUTORIZACAO_NEGADA, reiniciarJanelaAutorizacaoNegada } from './auditoria-autorizacao';
import { CHAVE_PERMISSOES } from './decorators';

const TENANT = 'tenant-1';
const USUARIO = 'usuario-1';
const REQUEST_ID = 'req-1';

/**
 * Valor sintetico montado por concatenacao: escrito inteiro no fonte, ele
 * pareceria credencial real para a varredura de segredos do repositorio.
 */
const TOKEN_SINTETICO = ['Bearer ', 'ey', 'JhbGciOiJIUzI1NiJ9.', 'carga-sintetica', '.assinatura'].join('');

interface OpcoesContexto {
  permissoes?: string[];
  semUsuario?: boolean;
  rota?: string;
}

function criarContexto(opcoes: OpcoesContexto = {}) {
  class ControladorFicticio {}
  function listar() {}

  const requisicao = {
    headers: { authorization: TOKEN_SINTETICO },
    method: 'GET',
    originalUrl: `${opcoes.rota ?? '/pacientes'}?busca=ana`,
    requestId: REQUEST_ID,
    usuarioAutenticado: opcoes.semUsuario
      ? undefined
      : {
          tenantId: TENANT,
          usuarioId: USUARIO,
          papel: 'Collaborator',
          emailHash: 'hash',
          permissoes: opcoes.permissoes ?? []
        }
  };

  return {
    getHandler: () => listar,
    getClass: () => ControladorFicticio,
    switchToHttp: () => ({ getRequest: () => requisicao })
  } as never;
}

function criarReflector(permissoesExigidas?: string[]) {
  return {
    getAllAndOverride: jest.fn((chave) => (chave === CHAVE_PERMISSOES ? permissoesExigidas : undefined))
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

describe('GuardaPermissoes', () => {
  beforeEach(() => {
    reiniciarJanelaAutorizacaoNegada();
  });

  it('deve permitir rota sem permissoes explicitas', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPermissoes(criarReflector(undefined), auditoria as never);

    expect(guarda.canActivate(criarContexto())).toBe(true);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('deve permitir usuario com todas as permissoes exigidas', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPermissoes(criarReflector(['cliente.usuarios.ler']), auditoria as never);

    expect(guarda.canActivate(criarContexto({ permissoes: ['cliente.acessar', 'cliente.usuarios.ler'] }))).toBe(true);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('deve negar usuario sem a permissao exigida', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPermissoes(criarReflector(['cliente.usuarios.desativar']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ permissoes: ['cliente.usuarios.ler'] }))).toThrow(
      ForbiddenException
    );
  });

  it('registra a negativa com a permissao exigida, a rota, o handler e o requestId', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPermissoes(criarReflector(['cliente.usuarios.desativar']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ permissoes: ['cliente.usuarios.ler'] }))).toThrow(
      ForbiddenException
    );

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: ACAO_AUTORIZACAO_NEGADA,
        tenantId: TENANT,
        usuarioId: USUARIO,
        recursoTipo: 'autorizacao',
        requestId: REQUEST_ID,
        metadados: expect.objectContaining({
          tipo: 'permissao',
          exigido: 'cliente.usuarios.desativar',
          metodo: 'GET',
          rota: '/pacientes',
          alvo: 'ControladorFicticio.listar'
        })
      })
    );
  });

  it('nao vaza o token nem a lista de permissoes do portador na negativa', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPermissoes(criarReflector(['cliente.usuarios.desativar']), auditoria as never);
    const permissoesDoPortador = ['cliente.acessar', 'cliente.usuarios.ler', 'agenda.consultar'];

    expect(() => guarda.canActivate(criarContexto({ permissoes: permissoesDoPortador }))).toThrow(
      ForbiddenException
    );

    const registrado = JSON.stringify(auditoria.registrar.mock.calls);
    expect(registrado).not.toContain(TOKEN_SINTETICO);
    expect(registrado).not.toContain('assinatura');
    for (const permissao of permissoesDoPortador) {
      expect(registrado).not.toContain(permissao);
    }
  });

  it('registra apenas a permissao que faltou, nao a exigencia inteira ja satisfeita', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPermissoes(
      criarReflector(['cliente.acessar', 'cliente.usuarios.desativar']),
      auditoria as never
    );

    expect(() => guarda.canActivate(criarContexto({ permissoes: ['cliente.acessar'] }))).toThrow(ForbiddenException);

    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        metadados: expect.objectContaining({ exigido: 'cliente.usuarios.desativar' })
      })
    );
  });

  it('nao tenta escrever na trilha quando nao ha usuario autenticado no contexto', () => {
    const auditoria = criarAuditoria();
    const guarda = new GuardaPermissoes(criarReflector(['cliente.usuarios.ler']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ semUsuario: true }))).toThrow(ForbiddenException);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('mantem o 403 quando a trilha lanca de forma sincrona', () => {
    const auditoria = criarAuditoria('sincrono');
    const guarda = new GuardaPermissoes(criarReflector(['cliente.usuarios.desativar']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ permissoes: [] }))).toThrow(ForbiddenException);
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('mantem o 403 quando a trilha rejeita a promessa', async () => {
    const auditoria = criarAuditoria('promessa');
    const guarda = new GuardaPermissoes(criarReflector(['cliente.usuarios.desativar']), auditoria as never);

    expect(() => guarda.canActivate(criarContexto({ permissoes: [] }))).toThrow(ForbiddenException);
    // Deixa o microtask da rejeicao drenar: se ela nao fosse tratada, o teste
    // terminaria com `unhandledRejection`.
    await Promise.resolve();
    expect(auditoria.registrar).toHaveBeenCalled();
  });
});
