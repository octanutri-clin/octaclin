import { copiarDefinicaoPergunta as copiar, planejarInsercaoCopiaPergunta as inserir } from './copia-pergunta';
import { BadRequestException } from '@nestjs/common';
import { TIPOS_PERGUNTA_SUPORTADOS, TipoPergunta } from './tipos-pergunta';
import { normalizarConfiguracaoPergunta } from './configuracao-pergunta';

function origem(tipo: TipoPergunta = 'multipla_escolha') {
  return {
    id: 'original', tenantId: 'tenant-sintetico', questionarioId: 'questionario-sintetico',
    categoriaId: 'categoria-sintetica', tipo, enunciado: 'Pergunta sintética',
    peso: '1.50', obrigatoria: false, ordem: 2,
    configuracao: { secao: 'Rotina', multipla: true, tiposAceitos: ['image/*'] },
    chaveClinica: 'comparacao-original', visivelBiblioteca: true, campoInterno: 'nao copiar',
    opcoes: [
      { id: 'opcao-a', tenantId: 'tenant-sintetico', perguntaId: 'original', rotulo: 'Água', valor: 'agua', imagemUrl: '/sintetico.png', ordem: 1 },
      { id: 'opcao-b', tenantId: 'tenant-sintetico', perguntaId: 'original', rotulo: 'Outra', valor: 'outra', imagemUrl: null, ordem: 2 }
    ]
  };
}

describe('QST-P05: definição independente de pergunta salva', () => {
  it('copia apenas campos reutilizáveis, sem identidades ou chave clínica', () => {
    expect(copiar(origem())).toEqual({
      categoriaId: 'categoria-sintetica', tipo: 'multipla_escolha', enunciado: 'Pergunta sintética',
      peso: '1.50', obrigatoria: false, configuracao: { secao: 'Rotina', multipla: true, tiposAceitos: ['image/*'] },
      visivelBiblioteca: false,
      opcoes: [
        { rotulo: 'Água', valor: 'agua', imagemUrl: '/sintetico.png', ordem: 1 },
        { rotulo: 'Outra', valor: 'outra', imagemUrl: null, ordem: 2 }
      ]
    });
  });

  it.each(TIPOS_PERGUNTA_SUPORTADOS)('preserva tipo e configuração %s', (tipo) => {
    const original = { ...origem(tipo), configuracao: normalizarConfiguracaoPergunta(tipo, { secao: 'Rotina' }), opcoes: tipo === 'multipla_escolha' ? origem().opcoes : [] };
    const antes = structuredClone(original);
    expect(copiar(original)).toMatchObject({ tipo, configuracao: original.configuracao });
    expect(original).toEqual(antes);
  });

  it('não compartilha configuração nem opções mutáveis', () => {
    const original = origem();
    const copia = copiar(original);
    (copia.configuracao.tiposAceitos as string[]).push('application/pdf');
    copia.opcoes[0].rotulo = 'Alterada';
    expect(original.configuracao.tiposAceitos).toEqual(['image/*']);
    expect(original.opcoes[0].rotulo).toBe('Água');
  });

  it('suporta ausência legada de configuração e opções sem inventar conteúdo', () => {
    expect(copiar({ ...origem('texto_longo'), configuracao: undefined, opcoes: undefined }))
      .toMatchObject({ configuracao: {}, opcoes: [], visivelBiblioteca: false });
  });

  it('preserva peso zero, obrigatoriedade falsa e ordem das opções salvas', () => {
    const original = { ...origem(), peso: '0.00' };
    original.opcoes.reverse();
    const copia = copiar(original);
    expect(copia).toMatchObject({ peso: '0.00', obrigatoria: false });
    expect(copia.opcoes.map((opcao: any) => opcao.valor)).toEqual(['outra', 'agua']);
  });
});

describe('QST-P05: plano adjacente sem persistência', () => {
  const perguntas = [{ id: 'a', ordem: 1 }, { id: 'b', ordem: 2 }, { id: 'c', ordem: 3 }];

  it.each([
    ['a', ['a', 'nova', 'b', 'c']],
    ['b', ['a', 'b', 'nova', 'c']],
    ['c', ['a', 'b', 'c', 'nova']]
  ] as const)('insere após %s, inclusive no final', (id, ids) => {
    const antes = structuredClone(perguntas);
    expect(inserir(perguntas, id, 'nova')).toEqual(ids.map((identidade, indice) => ({ id: identidade, ordem: indice + 1 })));
    expect(perguntas).toEqual(antes);
  });

  it.each([
    ['origem inexistente', perguntas, 'ausente', 'nova'],
    ['identidade existente', perguntas, 'a', 'b'],
    ['mesma identidade', perguntas, 'a', 'a'],
    ['origem vazia', [], 'a', 'nova'],
    ['origem repetida', [{ id: 'a', ordem: 1 }, { id: 'a', ordem: 2 }], 'a', 'nova'],
    ['identidade vazia', perguntas, 'a', '']
  ] as const)('rejeita %s sem resultado parcial', (_caso, lista, id, copiaId) => {
    expect(() => inserir([...lista], id, copiaId)).toThrow(BadRequestException);
  });

  it('não usa números de ordem como identidade', () => {
    expect(inserir([{ id: 'x', ordem: 10 }, { id: 'y', ordem: 20 }], 'x', 'nova')).toEqual([
      { id: 'x', ordem: 1 }, { id: 'nova', ordem: 2 }, { id: 'y', ordem: 3 }
    ]);
  });
});
