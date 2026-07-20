import { ServicoQuestionarios } from './servico-questionarios';
import { OpcaoPerguntaOrm } from '../infraestrutura/opcao-pergunta.orm';
import { PerguntaOrm } from '../infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../infraestrutura/questionario.orm';

function criarRepositorioFake(nome: 'questionario' | 'pergunta' | 'opcao', dados: Record<string, any>) {
  const itens = dados[`${nome}s`] as Record<string, any>[];

  return {
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    count: jest.fn(async () => itens.length),
    find: jest.fn(async (consulta?: { where?: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'> }) => {
      const filtrados = consulta?.where
        ? itens.filter((item) => Object.entries(consulta.where ?? {}).every(([chave, valor]) => item[chave] === valor))
        : [...itens];
      if (consulta?.order?.ordem) return [...filtrados].sort((a, b) => Number(a.ordem) - Number(b.ordem));
      return filtrados;
    }),
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) =>
      itens.find((item) => Object.entries(consulta.where).every(([chave, valor]) => item[chave] === valor)) ?? null
    ),
    save: jest.fn(async (entrada: Record<string, any> | Record<string, any>[]) => {
      if (Array.isArray(entrada)) return Promise.all(entrada.map((item) => salvar(item)));
      return salvar(entrada);
    }),
    delete: jest.fn(async (where: Record<string, unknown>) => {
      const removidos = itens.filter((item) => Object.entries(where).every(([chave, valor]) => item[chave] === valor));
      const restantes = itens.filter((item) => !Object.entries(where).every(([chave, valor]) => item[chave] === valor));
      itens.splice(0, itens.length, ...restantes);
      return { affected: removidos.length };
    })
  };

  async function salvar(entrada: Record<string, any>) {
    const salvo = { id: entrada.id ?? `${nome}-${itens.length + 1}`, ...entrada };
    const indice = itens.findIndex((item) => item.id === salvo.id);
    if (indice >= 0) itens[indice] = salvo;
    else itens.push(salvo);
    return salvo;
  }
}

function criarServico(dados: Record<string, any>) {
  const repositorios = {
    questionario: criarRepositorioFake('questionario', dados),
    pergunta: criarRepositorioFake('pergunta', dados),
    opcao: criarRepositorioFake('opcao', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === QuestionarioOrm) return repositorios.questionario;
      if (entidade === PerguntaOrm) return repositorios.pergunta;
      if (entidade === OpcaoPerguntaOrm) return repositorios.opcao;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
  };

  return { servico: new ServicoQuestionarios(executorTenant as never), dados, repositorios };
}

describe('ServicoQuestionarios', () => {
  it('deve substituir opcoes ao atualizar pergunta de multipla escolha', async () => {
    const { servico, dados } = criarServico({
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', versao: 1 }],
      perguntas: [
        {
          id: 'p1',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'likert',
          enunciado: 'Pergunta antiga',
          peso: '1',
          obrigatoria: true,
          configuracao: {},
          ordem: 1
        }
      ],
      opcaos: [{ id: 'opcao-antiga', tenantId: 'tenant-1', perguntaId: 'p1', rotulo: 'Antiga', valor: 'antiga', ordem: 1 }]
    });

    const resposta = await servico.atualizarPergunta('tenant-1', 'q1', 'p1', {
      categoriaId: 'cat-1',
      tipo: 'multipla_escolha',
      enunciado: 'Quais refeicoes voce fez hoje?',
      peso: 2,
      obrigatoria: true,
      configuracao: { multipla: true },
      opcoes: [
        { rotulo: 'Cafe da manha', valor: 'cafe' },
        { rotulo: 'Almoco', valor: 'almoco' }
      ]
    } as any);

    expect(resposta).toEqual(
      expect.objectContaining({
        tipo: 'multipla_escolha',
        configuracao: { multipla: true },
        opcoes: [
          expect.objectContaining({ rotulo: 'Cafe da manha', valor: 'cafe', ordem: 1 }),
          expect.objectContaining({ rotulo: 'Almoco', valor: 'almoco', ordem: 2 })
        ]
      })
    );
    expect(dados.opcaos).toHaveLength(2);
    expect(dados.opcaos.some((opcao: Record<string, unknown>) => opcao.id === 'opcao-antiga')).toBe(false);
  });
});
