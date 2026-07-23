import { obterContextoCorrelacao, obterRequestId } from './contexto-requisicao';

describe('contexto-requisicao', () => {
  it('deve preservar request id recebido de forma sanitizada', () => {
    expect(obterRequestId({ 'x-request-id': ' req-123_ABC:/bad value ' })).toBe('req-123_ABC:/badvalue');
  });

  it('deve gerar request id quando nao houver cabecalho de correlacao', () => {
    const requestId = obterRequestId({});

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('deve montar contexto sem query string nem dados pessoais do usuario', () => {
    const contexto = obterContextoCorrelacao({
      headers: { 'x-request-id': 'req-456' },
      method: 'GET',
      originalUrl: '/pacientes?email=ana@example.com',
      usuarioAutenticado: {
        tenantId: 'tenant-1',
        usuarioId: 'usuario-1',
        papel: 'Professional',
        emailHash: 'hash-sensivel',
        permissoes: ['pacientes.ler']
      }
    });

    expect(contexto).toEqual({
      requestId: 'req-456',
      tenantId: 'tenant-1',
      usuarioId: 'usuario-1',
      metodo: 'GET',
      rota: '/pacientes'
    });
    expect(JSON.stringify(contexto)).not.toContain('ana@example.com');
    expect(JSON.stringify(contexto)).not.toContain('hash-sensivel');
  });
});
