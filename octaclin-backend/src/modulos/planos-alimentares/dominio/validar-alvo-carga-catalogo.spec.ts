import { validarAlvoCargaCatalogo } from './validar-alvo-carga-catalogo';

describe('validarAlvoCargaCatalogo', () => {
  const alvo = {
    bancoAtual: 'octaclin_catalogo_stage',
    roleAtual: 'octaclin_owner',
    bancoEsperado: 'octaclin_catalogo_stage',
    roleEsperada: 'octaclin_owner'
  };

  it('aceita apenas quando banco e role correspondem exatamente', () => {
    expect(() => validarAlvoCargaCatalogo(alvo)).not.toThrow();
  });

  it('recusa banco divergente', () => {
    expect(() => validarAlvoCargaCatalogo({ ...alvo, bancoAtual: 'octaclin_production' })).toThrow(/banco\/role/);
  });

  it('recusa role divergente', () => {
    expect(() => validarAlvoCargaCatalogo({ ...alvo, roleAtual: 'octaclin_runtime' })).toThrow(/banco\/role/);
  });

  it('exige banco e role esperados', () => {
    expect(() => validarAlvoCargaCatalogo({ ...alvo, roleEsperada: ' ' })).toThrow(/obrigatórios/);
  });
});
