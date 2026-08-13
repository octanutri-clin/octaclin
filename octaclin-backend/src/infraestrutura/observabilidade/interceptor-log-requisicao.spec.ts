import { ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { InterceptorLogRequisicao } from './interceptor-log-requisicao';

function criarContexto(statusCode = 200): ExecutionContext {
  const requisicao = {
    requestId: 'req-123',
    method: 'GET',
    originalUrl: '/pacientes?email=ana@example.com',
    usuarioAutenticado: {
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      papel: 'admin',
      emailHash: 'hash-sensivel',
      permissoes: ['pacientes:ler']
    }
  };
  const resposta = { statusCode };

  return {
    switchToHttp: () => ({
      getRequest: () => requisicao,
      getResponse: () => resposta
    })
  } as ExecutionContext;
}

describe('InterceptorLogRequisicao', () => {
  it('deve registrar log estruturado seguro ao concluir requisicao', async () => {
    const loggerLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const interceptor = new InterceptorLogRequisicao();

    await lastValueFrom(
      interceptor.intercept(criarContexto(), {
        handle: () => of({ ok: true })
      })
    );

    expect(loggerLog).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: 'http.request',
        requestId: 'req-123',
        requestRef: expect.stringMatching(/^req_[0-9a-f]{12}$/),
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        metodo: 'GET',
        rota: '/pacientes',
        statusCode: 200
      })
    );
    expect(loggerLog.mock.calls[0][0]).toEqual(expect.objectContaining({ duracaoMs: expect.any(Number) }));
    expect(JSON.stringify(loggerLog.mock.calls[0][0])).not.toContain('ana@example.com');
    expect(JSON.stringify(loggerLog.mock.calls[0][0])).not.toContain('hash-sensivel');

    loggerLog.mockRestore();
  });

  it('deve registrar erro estruturado sem vazar mensagem de negocio', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const interceptor = new InterceptorLogRequisicao();

    await expect(
      lastValueFrom(
        interceptor.intercept(criarContexto(500), {
          handle: () => throwError(() => new Error('email ana@example.com invalido'))
        })
      )
    ).rejects.toThrow('email ana@example.com invalido');

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        evento: 'http.request.erro',
        requestId: 'req-123',
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        metodo: 'GET',
        rota: '/pacientes',
        statusCode: 500,
        erroNome: 'Error'
      })
    );
    expect(JSON.stringify(loggerWarn.mock.calls[0][0])).not.toContain('ana@example.com');

    loggerWarn.mockRestore();
  });
});
