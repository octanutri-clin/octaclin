import { idadePediatrica, somarMesesCivis } from './idade-pediatrica';

describe('idade pediátrica civil reproduzível', () => {
  it.each(['2025-02-29', '2024-02-30', '2024-13-01', '2024-1-01', '0000-01-01'])('rejeita data impossível %s', (nascimento) => {
    expect(() => idadePediatrica(nascimento, '2026-01-01')).toThrow('data_civil_invalida');
  });
  it('não usa timezone nem arredonda meses estatísticos', () => {
    expect(idadePediatrica('2024-02-29', '2026-03-01')).toEqual({ dias: 731, mesesEstatisticos: 731 / 30.4375, anosCompletos: 2 });
    expect(idadePediatrica('2024-02-29', '2026-02-28').dias).toBe(730);
    expect(idadePediatrica('2024-02-29', '2025-02-28').anosCompletos).toBe(0);
  });
  it('mantém regra civil explícita para 29/02 e mês curto', () => {
    expect(somarMesesCivis('2024-02-29', 12)).toBe('2025-02-28');
    expect(somarMesesCivis('2024-01-31', 1)).toBe('2024-02-29');
  });
  it('rejeita idade negativa e intervalos não inteiros', () => {
    expect(() => idadePediatrica('2026-01-02', '2026-01-01')).toThrow('avaliacao_anterior_ao_nascimento');
    expect(() => somarMesesCivis('2024-01-01', 1.5)).toThrow();
  });
});
