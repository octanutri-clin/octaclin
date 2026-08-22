import { validarCriteriosFiltroSalvo } from './filtros-salvos';

describe('validarCriteriosFiltroSalvo', () => {
  it('aceita o conjunto conhecido de criterios', () => {
    const criterios = validarCriteriosFiltroSalvo({
      risco: 'alto',
      status: 'em_acompanhamento',
      profissionalId: '10000000-0000-4000-8000-000000000003',
      semProximaConsulta: true
    });
    expect(criterios.risco).toBe('alto');
    expect(criterios.semProximaConsulta).toBe(true);
  });

  it('aceita objeto vazio', () => {
    expect(validarCriteriosFiltroSalvo({})).toEqual({});
  });

  it('rejeita chave desconhecida em vez de ignorar', () => {
    expect(() => validarCriteriosFiltroSalvo({ busca: 'Maria' }))
      .toThrow('Criterio nao suportado em filtro salvo: busca.');
  });

  it('rejeita texto livre disfarcado de criterio conhecido', () => {
    expect(() => validarCriteriosFiltroSalvo({ risco: 'Maria' }))
      .toThrow('Criterio invalido em filtro salvo: risco.');
  });

  it('rejeita entrada que nao e objeto', () => {
    expect(() => validarCriteriosFiltroSalvo(null)).toThrow('Criterios de filtro salvo invalidos.');
    expect(() => validarCriteriosFiltroSalvo([])).toThrow('Criterios de filtro salvo invalidos.');
  });
});
