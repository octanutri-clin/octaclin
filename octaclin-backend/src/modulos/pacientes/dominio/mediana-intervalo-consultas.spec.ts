import { medianaIntervalosConsultaDias } from './mediana-intervalo-consultas';

describe('medianaIntervalosConsultaDias', () => {
  it('reutiliza no máximo três intervalos civis recentes e calcula a mediana', () => {
    const consultas = [
      new Date('2026-09-07T15:00:00Z'),
      new Date('2026-08-17T15:00:00Z'),
      new Date('2026-07-28T15:00:00Z'),
      new Date('2026-07-08T15:00:00Z'),
      new Date('2026-05-01T15:00:00Z')
    ];

    expect(medianaIntervalosConsultaDias(consultas, 'America/Sao_Paulo')).toBe(20);
  });

  it('retorna null com menos de duas consultas ou sem intervalo positivo', () => {
    expect(medianaIntervalosConsultaDias([new Date('2026-09-07T15:00:00Z')])).toBeNull();
    expect(medianaIntervalosConsultaDias([
      new Date('2026-09-07T15:00:00Z'),
      new Date('2026-09-07T18:00:00Z')
    ])).toBeNull();
  });

  it('converte para dia civil no fuso recebido antes de calcular intervalos', () => {
    expect(medianaIntervalosConsultaDias([
      new Date('2026-09-02T04:00:00Z'),
      new Date('2026-09-01T04:00:00Z')
    ], 'America/Sao_Paulo')).toBe(1);
  });
});
