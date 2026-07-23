import { middlewareCorrelacao } from './middleware-correlacao';

describe('middlewareCorrelacao', () => {
  it('deve anexar request id na requisicao e resposta', () => {
    const requisicao = {
      headers: { 'x-correlation-id': 'corr-789' },
      method: 'POST',
      originalUrl: '/agenda'
    };
    const resposta = {
      setHeader: jest.fn()
    };
    const proximo = jest.fn();

    middlewareCorrelacao(requisicao, resposta, proximo);

    expect(requisicao).toMatchObject({
      requestId: 'corr-789',
      correlacao: expect.objectContaining({
        requestId: 'corr-789',
        metodo: 'POST',
        rota: '/agenda'
      })
    });
    expect(resposta.setHeader).toHaveBeenCalledWith('x-request-id', 'corr-789');
    expect(proximo).toHaveBeenCalledTimes(1);
  });
});
