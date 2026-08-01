import { obterSegredoFormularioPublico } from './segredo-formulario-publico';

describe('obterSegredoFormularioPublico', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    process.env = { ...ambienteOriginal };
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  it('falha fechado sem segredo dedicado em producao', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FORMULARIO_PUBLICO_SEGREDO;
    expect(() => obterSegredoFormularioPublico()).toThrow('FORMULARIO_PUBLICO_SEGREDO e obrigatorio');
  });

  it('rejeita segredo curto em producao', () => {
    process.env.NODE_ENV = 'production';
    process.env.FORMULARIO_PUBLICO_SEGREDO = 'curto';
    expect(() => obterSegredoFormularioPublico()).toThrow('pelo menos 32 bytes');
  });
});
