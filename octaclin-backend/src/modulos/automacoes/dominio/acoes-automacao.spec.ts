import { ContratoAcaoAutomacaoInvalido, validarAcoesAutomacao } from './acoes-automacao';

describe('contrato de acoes de automacao', () => {
  it.each(['notificar_profissional', 'enviar_template', 'criar_tarefa'])('aceita a acao fechada %s', (tipo) => {
    expect(validarAcoesAutomacao([{ tipo }])).toEqual([{ tipo }]);
  });

  it.each([
    { nome: 'lista vazia', valor: [] },
    { nome: 'tipo desconhecido', valor: [{ tipo: 'executar_codigo' }] },
    { nome: 'item que nao e objeto', valor: ['notificar_profissional'] },
    { nome: 'campo fora do contrato', valor: [{ tipo: 'notificar_profissional', destinatario: 'usuario-1' }] }
  ])('rejeita $nome', ({ valor }) => {
    expect(() => validarAcoesAutomacao(valor)).toThrow(ContratoAcaoAutomacaoInvalido);
  });
});
