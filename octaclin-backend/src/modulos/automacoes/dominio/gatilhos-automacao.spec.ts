import { ContratoGatilhoAutomacaoInvalido, validarGatilhoAutomacao } from './gatilhos-automacao';

describe('validarGatilhoAutomacao', () => {
  it('aceita paciente.inativo sem campos opcionais', () => {
    expect(validarGatilhoAutomacao({ tipo: 'paciente.inativo' })).toEqual({ tipo: 'paciente.inativo' });
  });

  it('aceita paciente.inativo com os campos especializados do recall', () => {
    expect(
      validarGatilhoAutomacao({
        tipo: 'paciente.inativo',
        diasSemConsulta: 45,
        statusAdesao: ['risco'],
        intervaloMinimoDias: 20,
        limitePorExecucao: 10
      })
    ).toEqual({
      tipo: 'paciente.inativo',
      diasSemConsulta: 45,
      statusAdesao: ['risco'],
      intervaloMinimoDias: 20,
      limitePorExecucao: 10
    });
  });

  it.each(['checkin.atrasado', 'questionario.respondido', 'paciente.risco_alto'])(
    'aceita %s somente com o campo tipo',
    (tipo) => {
      expect(validarGatilhoAutomacao({ tipo })).toEqual({ tipo });
    }
  );

  it('rejeita tipo de gatilho desconhecido', () => {
    expect(() => validarGatilhoAutomacao({ tipo: 'checkin' })).toThrow(ContratoGatilhoAutomacaoInvalido);
  });

  it('rejeita campo fora do contrato em gatilho sem parametros', () => {
    expect(() => validarGatilhoAutomacao({ tipo: 'questionario.respondido', campoExtra: 1 })).toThrow(
      ContratoGatilhoAutomacaoInvalido
    );
  });

  it('rejeita campo fora do contrato em paciente.inativo', () => {
    expect(() => validarGatilhoAutomacao({ tipo: 'paciente.inativo', campoExtra: 1 })).toThrow(
      ContratoGatilhoAutomacaoInvalido
    );
  });

  it('rejeita diasSemConsulta que nao seja numero finito', () => {
    expect(() => validarGatilhoAutomacao({ tipo: 'paciente.inativo', diasSemConsulta: 'muito' })).toThrow(
      ContratoGatilhoAutomacaoInvalido
    );
  });

  it('rejeita statusAdesao que nao seja lista de strings', () => {
    expect(() => validarGatilhoAutomacao({ tipo: 'paciente.inativo', statusAdesao: [1, 2] })).toThrow(
      ContratoGatilhoAutomacaoInvalido
    );
  });

  it('rejeita valor que nao seja objeto', () => {
    expect(() => validarGatilhoAutomacao('checkin.atrasado')).toThrow(ContratoGatilhoAutomacaoInvalido);
    expect(() => validarGatilhoAutomacao(null)).toThrow(ContratoGatilhoAutomacaoInvalido);
    expect(() => validarGatilhoAutomacao(['checkin.atrasado'])).toThrow(ContratoGatilhoAutomacaoInvalido);
  });
});
