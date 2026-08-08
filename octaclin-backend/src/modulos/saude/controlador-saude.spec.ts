import { HttpStatus } from '@nestjs/common';
import { ControladorSaude } from './controlador-saude';

describe('ControladorSaude', () => {
  it.each([
    ['ok', 'ok', HttpStatus.OK],
    ['falha', 'ok', HttpStatus.SERVICE_UNAVAILABLE],
    ['ok', 'falha', HttpStatus.SERVICE_UNAVAILABLE]
  ] as const)('responde readiness por banco=%s e migrations=%s', async (banco, migracoes, statusEsperado) => {
    const health = {
      status: banco === 'ok' && migracoes === 'ok' ? 'ok' : 'falha',
      servico: 'octaclin-backend',
      horario: '2026-08-08T12:00:00.000Z',
      uptimeSegundos: 10,
      checks: {
        backend: { status: 'ok' },
        banco: { status: banco },
        migracoes: { status: migracoes },
        redis: { status: 'degradado' },
        email: { status: 'degradado' },
        whatsapp: { status: 'degradado' },
        googleCalendar: { status: 'degradado' }
      }
    };
    const servico = { verificarDetalhado: jest.fn(async () => health) };
    const respostaHttp = { status: jest.fn() };
    const controlador = new ControladorSaude(servico as never);

    const resposta = await controlador.verificarPronto(respostaHttp as never);

    expect(respostaHttp.status).toHaveBeenCalledWith(statusEsperado);
    expect(resposta).toEqual({
      status: statusEsperado === HttpStatus.OK ? 'ok' : 'falha',
      servico: 'octaclin-backend',
      horario: health.horario,
      checks: {
        banco: health.checks.banco,
        migracoes: health.checks.migracoes
      }
    });
  });
});
