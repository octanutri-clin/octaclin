import { ServicoTelemetriaOperacional } from './servico-telemetria-operacional';

describe('ServicoTelemetriaOperacional', () => {
  it('agrega requisicoes e normaliza identificadores sem reter PHI', () => {
    const servico = new ServicoTelemetriaOperacional();

    servico.registrar({
      requestId: 'req-1',
      metodo: 'GET',
      rota: '/pacientes/31109579-f13e-49c0-b7f6-614306d46a0e?email=ana@example.com',
      statusCode: 500,
      duracaoMs: 240,
      erroNome: 'QueryFailedError'
    });
    servico.registrar({
      requestId: 'req-2',
      metodo: 'GET',
      rota: '/pacientes/7f580b5d-3afb-41a5-b1a3-1d8a57429e5c',
      statusCode: 200,
      duracaoMs: 60
    });

    const snapshot = servico.obterSnapshot();
    expect(snapshot.http).toEqual(
      expect.objectContaining({
        total: 2,
        sucesso: 1,
        errosServidor: 1,
        taxaErro5xx: 0.5,
        duracaoMediaMs: 150,
        duracaoP95Ms: 240
      })
    );
    expect(snapshot.http.porRota).toEqual([
      expect.objectContaining({ rota: '/pacientes/:id', total: 2, errosServidor: 1 })
    ]);
    expect(snapshot.tracesRecentes[0]).toEqual(
      expect.objectContaining({ requestId: expect.stringMatching(/^req_[0-9a-f]{12}$/), rota: '/pacientes/:id', resultado: 'sucesso' })
    );
    expect(JSON.stringify(snapshot)).not.toContain('ana@example.com');
    expect(JSON.stringify(snapshot)).not.toContain('31109579-f13e-49c0-b7f6-614306d46a0e');
    expect(JSON.stringify(snapshot)).not.toContain('req-2');
  });

  it('mantem buffers limitados e nao registra mensagens de erro', () => {
    const servico = new ServicoTelemetriaOperacional();

    for (let indice = 0; indice < 650; indice += 1) {
      servico.registrar({
        requestId: `req-${indice}`,
        metodo: 'POST',
        rota: `/formularios/token-secreto-${indice}`,
        statusCode: 400,
        duracaoMs: indice,
        erroNome: 'BadRequestException'
      });
    }

    const snapshot = servico.obterSnapshot();
    expect(snapshot.tracesRecentes).toHaveLength(30);
    expect(snapshot.http.porRota.length).toBeLessThanOrEqual(100);
    expect(snapshot.http.amostrasDuracao).toBe(500);
    expect(JSON.stringify(snapshot)).not.toContain('mensagem');
  });
});
