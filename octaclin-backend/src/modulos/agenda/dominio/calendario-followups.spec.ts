import { calcularEtapas, gerarCadencia, selecionarSemColisao, validarEtapas } from './calendario-followups';

describe('calendario de follow-ups', () => {
  const consulta = new Date('2026-10-20T15:00:00.000Z');

  it('gera cadencias diaria, semanal, quinzenal e mensal', () => {
    expect(gerarCadencia('diaria', 3, 3).map((item) => item.valor)).toEqual([3, 2, 1]);
    expect(gerarCadencia('semanal', 2, 2).map((item) => item.unidade)).toEqual(['semana', 'semana']);
    expect(gerarCadencia('quinzenal', 2, 2).map((item) => item.unidade)).toEqual(['quinzena', 'quinzena']);
    expect(gerarCadencia('mensal', 2, 2).map((item) => item.unidade)).toEqual(['mes', 'mes']);
  });

  it('calcula dias civis, duracoes e fim de mes no fuso da consulta', () => {
    const itens = calcularEtapas(consulta, 'America/Sao_Paulo', [
      { unidade: 'dia', valor: 7, condicao: 'sempre' },
      { unidade: 'hora', valor: 12, condicao: 'somente_se_nao_confirmada' },
      { unidade: 'minuto', valor: 30, condicao: 'sempre' }
    ]);
    expect(itens.map((item) => item.envioEm.toISOString())).toEqual([
      '2026-10-13T15:00:00.000Z', '2026-10-20T03:00:00.000Z', '2026-10-20T14:30:00.000Z'
    ]);
    const fevereiro = calcularEtapas(new Date('2028-03-31T12:00:00.000Z'), 'UTC', [
      { unidade: 'mes', valor: 1, condicao: 'sempre' }
    ]);
    expect(fevereiro[0].envioEm.toISOString()).toBe('2028-02-29T12:00:00.000Z');
  });

  it('rejeita mais de 30, antecedentes invalidos e instantes duplicados ou proximos', () => {
    expect(() => validarEtapas(Array.from({ length: 31 }, (_, i) => ({ unidade: 'dia' as const, valor: i + 1, condicao: 'sempre' as const })))).toThrow();
    expect(() => validarEtapas([{ unidade: 'hora', valor: 0, condicao: 'sempre' }])).toThrow();
    expect(() => calcularEtapas(consulta, 'UTC', [
      { unidade: 'minuto', valor: 30, condicao: 'sempre' },
      { unidade: 'minuto', valor: 45, condicao: 'sempre' }
    ])).toThrow();
  });

  it('resolve horario inexistente e horario duplicado na troca de horario de verao', () => {
    const etapa = [{ unidade: 'dia' as const, valor: 1, condicao: 'sempre' as const }];
    expect(calcularEtapas(new Date('2026-03-09T06:30:00Z'), 'America/New_York', etapa)[0].envioEm.toISOString()).toBe('2026-03-08T07:00:00.000Z');
    expect(calcularEtapas(new Date('2026-11-02T06:30:00Z'), 'America/New_York', etapa)[0].envioEm.toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });

  it('preserva o horario mais proximo da consulta quando duas etapas colidem no fuso', () => {
    const etapas = [{ envioEm: new Date('2026-03-08T07:00:00Z') }, { envioEm: new Date('2026-03-08T07:10:00Z') }];
    expect(selecionarSemColisao(etapas)).toEqual([etapas[1]]);
  });
});
