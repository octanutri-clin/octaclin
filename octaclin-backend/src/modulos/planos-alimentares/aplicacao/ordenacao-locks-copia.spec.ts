import { ordenarEscoposCopia } from './ordenacao-locks-copia';

const origemA = { pacienteId: '10000000-0000-4000-8000-000000000001', planoId: '10000000-0000-4000-8000-000000000011' };
const origemB = { pacienteId: '10000000-0000-4000-8000-000000000002', planoId: '10000000-0000-4000-8000-000000000022' };

describe('ordenação de locks para cópia FOOD05', () => {
  it('produz a mesma ordem global de pacientes e planos para cópias recíprocas', () => {
    const ab = ordenarEscoposCopia(origemA, [{ ...origemB }]);
    const ba = ordenarEscoposCopia(origemB, [{ ...origemA }]);
    expect(ab.pacientes.map(x => x.pacienteId.toLowerCase())).toEqual(ba.pacientes.map(x => x.pacienteId.toLowerCase()));
    expect(ab.pacientes.map(x => x.modo)).toEqual(['pessimistic_write', 'pessimistic_read']);
    expect(ba.pacientes.map(x => x.modo)).toEqual(['pessimistic_read', 'pessimistic_write']);
    expect(ab.planos.map(x => x.planoId.toLowerCase())).toEqual(ba.planos.map(x => x.planoId.toLowerCase()));
    expect(ab.planos.map(x => x.modo)).toEqual(['pessimistic_write', 'pessimistic_read']);
    expect(ba.planos.map(x => x.modo)).toEqual(['pessimistic_read', 'pessimistic_write']);
  });

  it('consolida origem e destino repetidos no mesmo plano com o lock mais forte', () => {
    expect(ordenarEscoposCopia(origemA, [{ ...origemA }, { ...origemA }])).toEqual({
      pacientes: [{ pacienteId: origemA.pacienteId, modo: 'pessimistic_write' }],
      planos: [{ ...origemA, modo: 'pessimistic_write' }]
    });
  });

  it('falha fechado se a mesma identidade de plano vier associada a pacientes diferentes', () => {
    expect(() => ordenarEscoposCopia(origemA, [{ ...origemA, pacienteId: origemB.pacienteId }])).toThrow();
  });
});
