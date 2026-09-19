import { ContratoAcaoAutomacaoInvalido, validarAcoesAutomacao } from './acoes-automacao';

describe('contrato de acoes de automacao', () => {
  it('aceita a acao fechada notificar_profissional', () => {
    const tipo = 'notificar_profissional';
    expect(validarAcoesAutomacao([{ tipo }])).toEqual([{ tipo }]);
  });

  it('aceita enviar_template somente com canal, template e intervalo fechados', () => {
    expect(
      validarAcoesAutomacao([
        {
          tipo: 'enviar_template',
          canalId: '11111111-1111-4111-8111-111111111111',
          templateId: '22222222-2222-4222-8222-222222222222',
          intervaloMinimoHoras: 24
        }
      ])
    ).toEqual([
      {
        tipo: 'enviar_template',
        canalId: '11111111-1111-4111-8111-111111111111',
        templateId: '22222222-2222-4222-8222-222222222222',
        intervaloMinimoHoras: 24
      }
    ]);
  });

  it('aceita enviar_template sem parametros apenas para o recall especializado', () => {
    expect(validarAcoesAutomacao([{ tipo: 'enviar_template' }], { permitirTemplateEspecializado: true })).toEqual([
      { tipo: 'enviar_template' }
    ]);
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
    { nome: 'sem parametros', acao: { tipo: 'enviar_template' } },
    {
      nome: 'canal invalido',
      acao: {
        tipo: 'enviar_template',
        canalId: 'canal-1',
        templateId: '22222222-2222-4222-8222-222222222222',
        intervaloMinimoHoras: 24
      }
    },
    {
      nome: 'template invalido',
      acao: {
        tipo: 'enviar_template',
        canalId: '11111111-1111-4111-8111-111111111111',
        templateId: 'template-1',
        intervaloMinimoHoras: 24
      }
    },
    {
      nome: 'intervalo fracionado',
      acao: {
        tipo: 'enviar_template',
        canalId: '11111111-1111-4111-8111-111111111111',
        templateId: '22222222-2222-4222-8222-222222222222',
        intervaloMinimoHoras: 1.5
      }
    },
    {
      nome: 'intervalo zero',
      acao: {
        tipo: 'enviar_template',
        canalId: '11111111-1111-4111-8111-111111111111',
        templateId: '22222222-2222-4222-8222-222222222222',
        intervaloMinimoHoras: 0
      }
    },
    {
      nome: 'intervalo excessivo',
      acao: {
        tipo: 'enviar_template',
        canalId: '11111111-1111-4111-8111-111111111111',
        templateId: '22222222-2222-4222-8222-222222222222',
        intervaloMinimoHoras: 721
      }
    },
    {
      nome: 'campo adicional',
      acao: {
        tipo: 'enviar_template',
        canalId: '11111111-1111-4111-8111-111111111111',
        templateId: '22222222-2222-4222-8222-222222222222',
        intervaloMinimoHoras: 24,
        ignorarOptOut: true
      }
    }
  ])('rejeita enviar_template $nome', ({ acao }) => {
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
