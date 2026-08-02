import { deveExecutarProcessadores, obterPapelProcesso } from './papel-processo';

describe('papel do processo', () => {
  it('mantem all como padrao para desenvolvimento local', () => {
    expect(obterPapelProcesso(undefined)).toBe('all');
    expect(deveExecutarProcessadores(undefined)).toBe(true);
  });

  it('nao ativa processadores em uma instancia web', () => {
    expect(deveExecutarProcessadores('web')).toBe(false);
    expect(deveExecutarProcessadores('worker')).toBe(true);
  });

  it('rejeita papel invalido para evitar topologia ambigua', () => {
    expect(() => obterPapelProcesso('api')).toThrow('OCTACLIN_PROCESSO deve ser web, worker ou all.');
  });
});
