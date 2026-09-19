import { ContratoAcaoAutomacaoInvalido, validarAcoesAutomacao } from './acoes-automacao';

describe('contrato de acoes de automacao', () => {
  it.each(['notificar_profissional', 'enviar_template'])('aceita a acao fechada %s', (tipo) => {
    expect(validarAcoesAutomacao([{ tipo }])).toEqual([{ tipo }]);
  });

  it('aceita criar_tarefa somente com titulo, prioridade e prazo fechados', () => {
    expect(
      validarAcoesAutomacao([
        { tipo: 'criar_tarefa', titulo: 'Revisar acompanhamento', prioridade: 'alta', prazoDias: 2 }
      ])
    ).toEqual([{ tipo: 'criar_tarefa', titulo: 'Revisar acompanhamento', prioridade: 'alta', prazoDias: 2 }]);
  });

  it.each([
    { nome: 'sem parametros', acao: { tipo: 'criar_tarefa' } },
    { nome: 'titulo vazio', acao: { tipo: 'criar_tarefa', titulo: '  ', prioridade: 'media', prazoDias: 1 } },
    { nome: 'titulo longo', acao: { tipo: 'criar_tarefa', titulo: 'x'.repeat(181), prioridade: 'media', prazoDias: 1 } },
    { nome: 'prioridade desconhecida', acao: { tipo: 'criar_tarefa', titulo: 'Retorno', prioridade: 'urgente', prazoDias: 1 } },
    { nome: 'prazo fracionado', acao: { tipo: 'criar_tarefa', titulo: 'Retorno', prioridade: 'media', prazoDias: 1.5 } },
    { nome: 'prazo zero', acao: { tipo: 'criar_tarefa', titulo: 'Retorno', prioridade: 'media', prazoDias: 0 } },
    { nome: 'prazo negativo', acao: { tipo: 'criar_tarefa', titulo: 'Retorno', prioridade: 'media', prazoDias: -1 } },
    { nome: 'prazo excessivo', acao: { tipo: 'criar_tarefa', titulo: 'Retorno', prioridade: 'media', prazoDias: 366 } },
    { nome: 'campo adicional', acao: { tipo: 'criar_tarefa', titulo: 'Retorno', prioridade: 'media', prazoDias: 1, descricao: 'livre' } }
  ])('rejeita criar_tarefa $nome', ({ acao }) => {
    expect(() => validarAcoesAutomacao([acao])).toThrow(ContratoAcaoAutomacaoInvalido);
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
