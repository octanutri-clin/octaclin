import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { ServicoQuestionarios } from './servico-questionarios';
import { CategoriaPerguntaOrm } from '../infraestrutura/categoria-pergunta.orm';
import { AgendamentoQuestionarioOrm } from '../infraestrutura/agendamento-questionario.orm';
import { EnvioQuestionarioOrm } from '../infraestrutura/envio-questionario.orm';
import { OpcaoPerguntaOrm } from '../infraestrutura/opcao-pergunta.orm';
import { PerguntaOrm } from '../infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../infraestrutura/resposta-valor.orm';

const usuarioColaborador: UsuarioAutenticado = {
  usuarioId: 'usuario-colaborador-1',
  tenantId: 'tenant-1',
  papel: 'Collaborator',
  emailHash: 'hash-colaborador',
  permissoes: []
};

const usuarioProfissional: UsuarioAutenticado = {
  usuarioId: 'usuario-profissional-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash-profissional',
  permissoes: []
};

function criarRepositorioFake(
  nome:
    | 'questionario'
    | 'pergunta'
    | 'opcao'
    | 'categoria'
    | 'envio'
    | 'respostaCheckin'
    | 'respostaValor'
    | 'agendamento'
    | 'paciente'
    | 'arquivoMidia'
    | 'profissional',
  dados: Record<string, any>
) {
  const itens = dados[`${nome}s`] as Record<string, any>[];

  return {
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    count: jest.fn(async (consulta?: { where?: Record<string, unknown> }) =>
      consulta?.where
        ? itens.filter((item) => Object.entries(consulta.where ?? {}).every(([chave, valor]) => corresponde(item[chave], valor))).length
        : itens.length
    ),
    find: jest.fn(async (consulta?: { where?: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'> }) => {
      const filtrados = consulta?.where
        ? itens.filter((item) => Object.entries(consulta.where ?? {}).every(([chave, valor]) => corresponde(item[chave], valor)))
        : [...itens];
      if (consulta?.order?.ordem) return [...filtrados].sort((a, b) => Number(a.ordem) - Number(b.ordem));
      return filtrados;
    }),
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) =>
      itens.find((item) => Object.entries(consulta.where).every(([chave, valor]) => corresponde(item[chave], valor))) ?? null
    ),
    findAndCount: jest.fn(async (consulta?: { where?: Record<string, unknown>; skip?: number; take?: number }) => {
      const filtrados = consulta?.where
        ? itens.filter((item) => Object.entries(consulta.where ?? {}).every(([chave, valor]) => corresponde(item[chave], valor)))
        : [...itens];
      const inicio = consulta?.skip ?? 0;
      return [filtrados.slice(inicio, inicio + (consulta?.take ?? filtrados.length)), filtrados.length];
    }),
    save: jest.fn(async (entrada: Record<string, any> | Record<string, any>[]) => {
      if (Array.isArray(entrada)) return Promise.all(entrada.map((item) => salvar(item)));
      return salvar(entrada);
    }),
    delete: jest.fn(async (where: Record<string, unknown>) => {
      const removidos = itens.filter((item) => Object.entries(where).every(([chave, valor]) => item[chave] === valor));
      const restantes = itens.filter((item) => !Object.entries(where).every(([chave, valor]) => item[chave] === valor));
      itens.splice(0, itens.length, ...restantes);
      return { affected: removidos.length };
    }),
    update: jest.fn(async (where: Record<string, unknown>, valores: Record<string, unknown>) => {
      const encontrados = itens.filter((item) => Object.entries(where).every(([chave, valor]) => corresponde(item[chave], valor)));
      encontrados.forEach((item) => Object.assign(item, valores));
      return { affected: encontrados.length };
    })
  };

  async function salvar(entrada: Record<string, any>) {
    const salvo = { id: entrada.id ?? `${nome}-${itens.length + 1}`, ...entrada };
    const indice = itens.findIndex((item) => item.id === salvo.id);
    if (indice >= 0) itens[indice] = salvo;
    else itens.push(salvo);
    return salvo;
  }

  function corresponde(valorItem: unknown, valorConsulta: unknown) {
    if (
      valorConsulta &&
      typeof valorConsulta === 'object' &&
      '_type' in valorConsulta &&
      (valorConsulta as { _type?: string })._type === 'isNull'
    ) {
      return valorItem === null || valorItem === undefined;
    }
    if (
      valorConsulta &&
      typeof valorConsulta === 'object' &&
      '_type' in valorConsulta &&
      (valorConsulta as { _type?: string })._type === 'in'
    ) {
      const valores = (valorConsulta as { _value?: unknown[] })._value ?? [];
      return valores.includes(valorItem);
    }
    if (
      valorConsulta &&
      typeof valorConsulta === 'object' &&
      '_type' in valorConsulta &&
      (valorConsulta as { _type?: string })._type === 'ilike'
    ) {
      const trecho = String((valorConsulta as { _value?: unknown })._value ?? '').replaceAll('%', '').toLocaleLowerCase('pt-BR');
      return String(valorItem ?? '').toLocaleLowerCase('pt-BR').includes(trecho);
    }
    if (
      valorConsulta &&
      typeof valorConsulta === 'object' &&
      '_type' in valorConsulta &&
      (valorConsulta as { _type?: string })._type === 'lessThanOrEqual'
    ) {
      return new Date(String(valorItem)).getTime() <= new Date(String((valorConsulta as { _value?: unknown })._value)).getTime();
    }
    return valorItem === valorConsulta;
  }
}

function criarServico(dados: Record<string, any>) {
  const repositorios = {
    categoria: criarRepositorioFake('categoria', dados),
    questionario: criarRepositorioFake('questionario', dados),
    pergunta: criarRepositorioFake('pergunta', dados),
    opcao: criarRepositorioFake('opcao', dados),
    envio: criarRepositorioFake('envio', dados),
    respostaCheckin: criarRepositorioFake('respostaCheckin', dados),
    respostaValor: criarRepositorioFake('respostaValor', dados),
    agendamento: criarRepositorioFake('agendamento', dados),
    paciente: criarRepositorioFake('paciente', dados),
    arquivoMidia: criarRepositorioFake('arquivoMidia', { arquivoMidias: dados.arquivoMidias ?? [] }),
    profissional: criarRepositorioFake('profissional', { profissionals: dados.profissionals ?? [] })
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === CategoriaPerguntaOrm) return repositorios.categoria;
      if (entidade === QuestionarioOrm) return repositorios.questionario;
      if (entidade === PerguntaOrm) return repositorios.pergunta;
      if (entidade === OpcaoPerguntaOrm) return repositorios.opcao;
      if (entidade === EnvioQuestionarioOrm) return repositorios.envio;
      if (entidade === RespostaCheckinOrm) return repositorios.respostaCheckin;
      if (entidade === RespostaValorOrm) return repositorios.respostaValor;
      if (entidade === AgendamentoQuestionarioOrm) return repositorios.agendamento;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      if (entidade === ArquivoMidiaOrm) return repositorios.arquivoMidia;
      if (entidade.name === 'PacienteOrm') return repositorios.paciente;
      // Tenant sem usuario ativo: o formulario respondido nao tem destinatario e
      // o publicador da Fase 210 sai antes de escrever. O fan-out em si esta
      // coberto em registrar-notificacao.spec.ts.
      if (entidade.name === 'UsuarioOrm') return { find: jest.fn(async () => []) };
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
  };

  return { servico: new ServicoQuestionarios(executorTenant as never), dados, repositorios };
}

describe('ServicoQuestionarios', () => {
  beforeEach(() => {
    process.env.FORMULARIO_PUBLICO_SEGREDO = 'segredo-teste-formulario';
  });

  it('deve listar modelos prontos de questionario', () => {
    const { servico } = criarServico({
      categorias: [],
      questionarios: [],
      perguntas: [],
      opcaos: [],
      envios: [],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: []
    });

    const modelos = servico.listarModelosQuestionario();

    expect(modelos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'checkin-adesao-semanal',
          titulo: 'Check-in semanal de adesao',
          totalPerguntas: expect.any(Number)
        })
      ])
    );
  });

  it('deve gerar check-in recorrente apenas para o paciente vinculado ao agendamento', async () => {
    const { servico, dados } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q-1', tenantId: 'tenant-1', titulo: 'Check-in', versao: 1 }],
      perguntas: [],
      opcaos: [],
      agendamentos: [
        {
          id: 'agendamento-1',
          tenantId: 'tenant-1',
          questionarioId: 'q-1',
          pacienteId: 'paciente-alvo',
          ativo: true,
          proximaExecucaoEm: new Date('2026-07-29T08:00:00.000Z')
        }
      ],
      envios: [],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: [
        { id: 'paciente-alvo', tenantId: 'tenant-1', arquivadoEm: undefined },
        { id: 'paciente-nao-selecionado', tenantId: 'tenant-1', arquivadoEm: undefined }
      ]
    });

    const total = await servico.processarAgendamentosVencidos('tenant-1', new Date('2026-07-30T08:00:00.000Z'));

    expect(total).toBe(1);
    expect(dados.envios).toHaveLength(1);
    expect(dados.envios[0]).toEqual(expect.objectContaining({ pacienteId: 'paciente-alvo', agendamentoId: 'agendamento-1' }));
  });

  it('deve persistir o paciente escolhido ao criar um check-in recorrente', async () => {
    const { servico } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q-1', tenantId: 'tenant-1', versao: 1 }],
      perguntas: [],
      opcaos: [],
      agendamentos: [],
      envios: [],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', arquivadoEm: undefined }]
    });

    const agendamento = await servico.criarAgendamento(
      'tenant-1',
      { questionarioId: 'q-1', pacienteId: 'paciente-1', regraCron: '0 8 * * 1' },
      usuarioColaborador
    );

    expect(agendamento).toEqual(expect.objectContaining({ questionarioId: 'q-1', pacienteId: 'paciente-1', ativo: true }));
  });

  it('remove rascunhos de envios expirados durante o processamento recorrente', async () => {
    const agora = new Date('2026-08-01T12:00:00.000Z');
    const { servico, dados } = criarServico({
      categorias: [], questionarios: [], perguntas: [], opcaos: [], agendamentos: [],
      envios: [{
        id: 'envio-expirado', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1',
        status: 'enviado', expiraEm: new Date('2026-08-01T11:00:00.000Z'),
        respostasRascunho: [{ perguntaId: 'p1', valor: true }], rascunhoVersao: 3,
        rascunhoAtualizadoEm: new Date('2026-08-01T10:00:00.000Z')
      }],
      respostaCheckins: [], respostaValors: [], pacientes: []
    });

    await servico.processarAgendamentosVencidos('tenant-1', agora);

    expect(dados.envios[0]).toEqual(expect.objectContaining({ status: 'expirado', rascunhoVersao: 0 }));
    expect(dados.envios[0].respostasRascunho).toBeUndefined();
    expect(dados.envios[0].rascunhoAtualizadoEm).toBeUndefined();
  });

  it('deve listar apenas perguntas visiveis da biblioteca do tenant com busca e categoria', async () => {
    const { servico } = criarServico({
      questionarios: [],
      categorias: [],
      perguntas: [
        {
          id: 'p-adesao',
          tenantId: 'tenant-1',
          questionarioId: 'q-1',
          categoriaId: 'cat-nutricao',
          tipo: 'likert',
          enunciado: 'Como foi sua adesao ao plano?',
          peso: '1',
          obrigatoria: true,
          configuracao: {},
          ordem: 1,
          chaveClinica: 'adesao-plano',
          visivelBiblioteca: true
        },
        {
          id: 'p-oculta',
          tenantId: 'tenant-1',
          questionarioId: 'q-1',
          categoriaId: 'cat-nutricao',
          tipo: 'likert',
          enunciado: 'Pergunta privada',
          peso: '1',
          obrigatoria: true,
          configuracao: {},
          ordem: 2,
          visivelBiblioteca: false
        },
        {
          id: 'p-outro-tenant',
          tenantId: 'tenant-2',
          questionarioId: 'q-2',
          categoriaId: 'cat-nutricao',
          tipo: 'likert',
          enunciado: 'Adesao de outro tenant',
          peso: '1',
          obrigatoria: true,
          configuracao: {},
          ordem: 1,
          visivelBiblioteca: true
        }
      ],
      opcaos: [],
      envios: [],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: []
    });

    await expect(servico.listarBibliotecaPerguntas('tenant-1', { busca: 'adesao', categoriaId: 'cat-nutricao' })).resolves.toEqual([
      expect.objectContaining({ id: 'p-adesao', chaveClinica: 'adesao-plano' })
    ]);
  });

  it('deve incluir na ordem final uma copia independente da pergunta da biblioteca', async () => {
    const { servico, dados } = criarServico({
      questionarios: [{ id: 'q-destino', tenantId: 'tenant-1', versao: 2 }],
      categorias: [],
      perguntas: [
        {
          id: 'p-existente',
          tenantId: 'tenant-1',
          questionarioId: 'q-destino',
          categoriaId: 'cat-1',
          tipo: 'texto_longo',
          enunciado: 'Pergunta existente',
          peso: '1',
          obrigatoria: true,
          configuracao: {},
          ordem: 1,
          visivelBiblioteca: false
        },
        {
          id: 'p-biblioteca',
          tenantId: 'tenant-1',
          questionarioId: 'q-origem',
          categoriaId: 'cat-1',
          tipo: 'multipla_escolha',
          enunciado: 'Quais refeicoes voce realizou?',
          peso: '2',
          obrigatoria: true,
          configuracao: { multipla: true },
          ordem: 1,
          chaveClinica: 'refeicoes-realizadas',
          visivelBiblioteca: true
        }
      ],
      opcaos: [
        { id: 'op-1', tenantId: 'tenant-1', perguntaId: 'p-biblioteca', rotulo: 'Cafe', valor: 'cafe', ordem: 1 },
        { id: 'op-2', tenantId: 'tenant-1', perguntaId: 'p-biblioteca', rotulo: 'Almoco', valor: 'almoco', ordem: 2 }
      ],
      envios: [],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: []
    });

    const incluida = await servico.incluirPerguntaBiblioteca('tenant-1', 'p-biblioteca', 'q-destino', usuarioColaborador);

    expect(incluida).toEqual(
      expect.objectContaining({
        id: expect.not.stringMatching('p-biblioteca'),
        questionarioId: 'q-destino',
        ordem: 2,
        chaveClinica: 'refeicoes-realizadas',
        visivelBiblioteca: false,
        opcoes: [expect.objectContaining({ rotulo: 'Cafe' }), expect.objectContaining({ rotulo: 'Almoco' })]
      })
    );
    expect(dados.questionarios[0].versao).toBe(3);
  });

  it('deve substituir opcoes ao atualizar pergunta de multipla escolha', async () => {
    const { servico, dados } = criarServico({
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', versao: 1 }],
      categorias: [],
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
      opcaos: [{ id: 'opcao-antiga', tenantId: 'tenant-1', perguntaId: 'p1', rotulo: 'Antiga', valor: 'antiga', ordem: 1 }],
      envios: [],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: []
    });

    const resposta = await servico.atualizarPergunta(
      'tenant-1',
      'q1',
      'p1',
      {
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
      } as any,
      usuarioColaborador
    );

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

  it('deve duplicar questionario com perguntas, configuracoes e opcoes', async () => {
    const { servico, dados } = criarServico({
      questionarios: [
        {
          id: 'q1',
          tenantId: 'tenant-1',
          profissionalId: 'prof-1',
          titulo: 'Check-in original',
          descricao: 'Descricao original',
          status: 'publicado',
          versao: 4
        }
      ],
      categorias: [],
      perguntas: [
        {
          id: 'p1',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'texto_longo',
          enunciado: 'Como foi sua semana?',
          peso: '1',
          obrigatoria: true,
          configuracao: { secao: 'Rotina', limiteCaracteres: 500, placeholder: 'Conte aqui' },
          ordem: 1
        },
        {
          id: 'p2',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'multipla_escolha',
          enunciado: 'Quais refeicoes?',
          peso: '2',
          obrigatoria: true,
          configuracao: { secao: 'Alimentacao', multipla: true },
          ordem: 2
        }
      ],
      opcaos: [
        { id: 'o1', tenantId: 'tenant-1', perguntaId: 'p2', rotulo: 'Cafe', valor: 'cafe', ordem: 1 },
        { id: 'o2', tenantId: 'tenant-1', perguntaId: 'p2', rotulo: 'Almoco', valor: 'almoco', ordem: 2 }
      ],
      envios: [],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: []
    });

    const duplicado = await servico.duplicarQuestionario('tenant-1', 'q1', {}, usuarioColaborador);

    expect(duplicado).toEqual(
      expect.objectContaining({
        id: 'questionario-2',
        titulo: 'Check-in original (copia)',
        status: 'rascunho',
        versao: 1
      })
    );
    const perguntasDuplicadas = dados.perguntas.filter((pergunta: Record<string, unknown>) => pergunta.questionarioId === 'questionario-2');
    expect(perguntasDuplicadas).toHaveLength(2);
    expect(perguntasDuplicadas[0]).toEqual(expect.objectContaining({ configuracao: { secao: 'Rotina', limiteCaracteres: 500, placeholder: 'Conte aqui' } }));
    expect(dados.opcaos.filter((opcao: Record<string, unknown>) => opcao.perguntaId === perguntasDuplicadas[1].id)).toHaveLength(2);
  });

  it('deve criar questionario a partir de modelo com categorias, secoes e opcoes', async () => {
    const { servico, dados } = criarServico({
      categorias: [],
      questionarios: [],
      perguntas: [],
      opcaos: [],
      envios: [],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: []
    });

    const criado = await servico.criarQuestionarioAPartirModelo(
      'tenant-1',
      'checkin-adesao-semanal',
      { profissionalId: 'prof-1' } as any,
      usuarioColaborador
    );

    expect(criado).toEqual(
      expect.objectContaining({
        id: 'questionario-1',
        tenantId: 'tenant-1',
        profissionalId: 'prof-1',
        titulo: 'Check-in semanal de adesao',
        status: 'rascunho',
        versao: 1
      })
    );
    expect(dados.categorias.length).toBeGreaterThan(0);
    expect(dados.perguntas.length).toBeGreaterThan(3);
    expect(dados.perguntas[0]).toEqual(
      expect.objectContaining({
        questionarioId: 'questionario-1',
        configuracao: expect.objectContaining({ secao: expect.any(String) }),
        ordem: 1
      })
    );
    expect(dados.opcaos.length).toBeGreaterThan(1);
  });

  it('deve abrir formulario do paciente a partir do token de envio', async () => {
    const { servico } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Check-in', descricao: 'Descricao' }],
      perguntas: [
        {
          id: 'p1',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'sim_nao',
          enunciado: 'Treinou?',
          peso: '1',
          obrigatoria: true,
          configuracao: { secao: 'Rotina', rotuloSim: 'Sim', rotuloNao: 'Nao' },
          ordem: 1
        }
      ],
      opcaos: [],
      envios: [{ id: 'envio-1', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1', status: 'enviado' }],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', ultimoCheckinEm: null }]
    });
    const token = servico.gerarTokenFormularioPaciente('tenant-1', 'envio-1');

    const formulario = await servico.obterFormularioPaciente(token);

    expect(formulario).toEqual(
      expect.objectContaining({
        envioId: 'envio-1',
        titulo: 'Check-in',
        status: 'enviado',
        perguntas: [
          expect.objectContaining({
            id: 'p1',
            enunciado: 'Treinou?',
            configuracao: expect.objectContaining({ secao: 'Rotina' })
          })
        ]
      })
    );
  });

  it('deve abrir o formulario pela estrutura capturada no envio', async () => {
    const { servico } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Titulo alterado', descricao: 'Descricao alterada' }],
      perguntas: [
        {
          id: 'p1',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'sim_nao',
          enunciado: 'Pergunta alterada',
          peso: '1',
          obrigatoria: false,
          configuracao: {},
          ordem: 1
        }
      ],
      opcaos: [],
      envios: [
        {
          id: 'envio-1',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          pacienteId: 'paciente-1',
          status: 'enviado',
          snapshotEstrutura: {
            versaoQuestionario: 1,
            titulo: 'Check-in original',
            descricao: 'Descricao original',
            perguntas: [
              {
                id: 'p1',
                categoriaId: 'cat-1',
                tipo: 'sim_nao',
                enunciado: 'Pergunta original',
                peso: '1',
                obrigatoria: true,
                configuracao: {},
                ordem: 1,
                opcoes: []
              }
            ]
          }
        }
      ],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: []
    });

    const formulario = await servico.obterFormularioPaciente(servico.gerarTokenFormularioPaciente('tenant-1', 'envio-1'));

    expect(formulario).toEqual(
      expect.objectContaining({
        titulo: 'Check-in original',
        descricao: 'Descricao original',
        perguntas: [expect.objectContaining({ id: 'p1', enunciado: 'Pergunta original', obrigatoria: true })]
      })
    );
  });

  it('deve criar envio manual com link publico de formulario', async () => {
    process.env.OCTACLIN_WEB_URL = 'https://app.octaclin.test';
    const { servico, dados } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Check-in', descricao: 'Descricao', versao: 3 }],
      perguntas: [
        {
          id: 'p1',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'multipla_escolha',
          enunciado: 'Como foi sua semana?',
          peso: '1',
          obrigatoria: true,
          configuracao: { multipla: false },
          ordem: 1
        }
      ],
      opcaos: [{ id: 'opcao-1', tenantId: 'tenant-1', perguntaId: 'p1', rotulo: 'Boa', valor: 'boa', ordem: 1 }],
      envios: [],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', ultimoCheckinEm: null }]
    });

    const envio = await servico.criarEnvioQuestionarioManual(
      'tenant-1',
      'q1',
      { pacienteId: 'paciente-1' } as any,
      usuarioColaborador
    );

    expect(envio).toEqual(
      expect.objectContaining({
        id: 'envio-1',
        status: 'enviado',
        linkFormulario: expect.stringMatching(/^https:\/\/app\.octaclin\.test\/formularios\//)
      })
    );
    expect(dados.envios[0]).toEqual(expect.objectContaining({ questionarioId: 'q1', pacienteId: 'paciente-1', enviadoEm: expect.any(Date) }));
    expect(dados.envios[0].snapshotEstrutura).toEqual({
      versaoQuestionario: 3,
      titulo: 'Check-in',
      descricao: 'Descricao',
      perguntas: [
        expect.objectContaining({
          id: 'p1',
          enunciado: 'Como foi sua semana?',
          opcoes: [expect.objectContaining({ id: 'opcao-1', rotulo: 'Boa', valor: 'boa' })]
        })
      ]
    });
  });

  it('deve finalizar formulario salvando respostas e marcando envio como respondido', async () => {
    const { servico, dados } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Check-in', descricao: 'Descricao' }],
      perguntas: [
        {
          id: 'p1',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'sim_nao',
          enunciado: 'Treinou?',
          peso: '1',
          obrigatoria: true,
          configuracao: { secao: 'Rotina', rotuloSim: 'Sim', rotuloNao: 'Nao' },
          ordem: 1
        },
        {
          id: 'p2',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'texto_longo',
          enunciado: 'Observacoes',
          peso: '1',
          obrigatoria: false,
          configuracao: { secao: 'Rotina' },
          ordem: 2
        }
      ],
      opcaos: [],
      envios: [{
        id: 'envio-1', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1', status: 'enviado',
        respostasRascunho: [{ perguntaId: 'p2', valor: 'Rascunho antigo' }], rascunhoVersao: 2,
        rascunhoAtualizadoEm: new Date('2026-07-20T10:00:00.000Z')
      }],
      respostaCheckins: [],
      respostaValors: [],
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', ultimoCheckinEm: null }]
    });
    const token = servico.gerarTokenFormularioPaciente('tenant-1', 'envio-1');

    const resultado = await servico.finalizarFormularioPaciente(token, {
      respostas: [
        { perguntaId: 'p1', valor: true },
        { perguntaId: 'p2', valor: 'Foi uma boa semana.' }
      ]
    });

    expect(resultado).toEqual(expect.objectContaining({ envioId: 'envio-1', status: 'respondido' }));
    expect(dados.respostaCheckins).toHaveLength(1);
    expect(dados.respostaValors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ respostaCheckinId: 'respostaCheckin-1', perguntaId: 'p1', valor: true }),
        expect.objectContaining({ respostaCheckinId: 'respostaCheckin-1', perguntaId: 'p2', valor: 'Foi uma boa semana.' })
      ])
    );
    expect(dados.envios[0].status).toBe('respondido');
    expect(dados.envios[0].respondidoEm).toBeInstanceOf(Date);
    expect(dados.envios[0].respostasRascunho).toBeUndefined();
    expect(dados.envios[0].rascunhoAtualizadoEm).toBeUndefined();
    expect(dados.envios[0].rascunhoVersao).toBe(0);
    expect(dados.pacientes[0].ultimoCheckinEm).toBeInstanceOf(Date);
  });

  it('deve devolver a resposta existente ao repetir a finalizacao do formulario', async () => {
    const respondidoEm = new Date('2026-08-08T12:00:00.000Z');
    const { servico, dados, repositorios } = criarServico({
      categorias: [], questionarios: [], perguntas: [], opcaos: [],
      envios: [{
        id: 'envio-1', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1',
        status: 'respondido', respondidoEm
      }],
      respostaCheckins: [{
        id: 'resposta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1',
        envioQuestionarioId: 'envio-1', finalizadoEm: respondidoEm
      }],
      respostaValors: [], pacientes: [], arquivoMidias: []
    });
    const token = servico.gerarTokenFormularioPaciente('tenant-1', 'envio-1');

    const resultado = await servico.finalizarFormularioPaciente(token, { respostas: [] });

    expect(resultado).toEqual({
      envioId: 'envio-1', respostaCheckinId: 'resposta-1', status: 'respondido', respondidoEm
    });
    expect(dados.respostaCheckins).toHaveLength(1);
    expect(repositorios.envio.findOne).toHaveBeenCalledWith(expect.objectContaining({
      lock: { mode: 'pessimistic_write' }
    }));
  });

  it('aceita apenas anexo confirmado do mesmo paciente, envio e pergunta', async () => {
    const { servico, dados } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Exames' }],
      perguntas: [{
        id: 'p-upload', tenantId: 'tenant-1', questionarioId: 'q1', categoriaId: 'cat-1', tipo: 'upload_midia',
        enunciado: 'Anexe o exame', peso: '1', obrigatoria: true, configuracao: { maxArquivos: 1 }, ordem: 1
      }],
      opcaos: [],
      envios: [{ id: 'envio-1', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1', status: 'enviado' }],
      arquivoMidias: [
        {
          id: 'arquivo-correto', tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'confirmado',
          metadados: { vinculo: { envioid: 'envio-1', perguntaid: 'p-upload' } }
        },
        {
          id: 'arquivo-estranho', tenantId: 'tenant-1', pacienteId: 'paciente-2', status: 'confirmado',
          metadados: { vinculo: { envioid: 'envio-2', perguntaid: 'p-upload' } }
        }
      ],
      respostaCheckins: [], respostaValors: [], pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1' }]
    });
    const token = servico.gerarTokenFormularioPaciente('tenant-1', 'envio-1');

    await expect(servico.finalizarFormularioPaciente(token, {
      respostas: [{ perguntaId: 'p-upload', valor: ['arquivo-estranho'] }]
    })).rejects.toThrow('Anexo nao pertence a este formulario.');
    expect(dados.respostaCheckins).toHaveLength(0);

    await expect(servico.finalizarFormularioPaciente(token, {
      respostas: [{ perguntaId: 'p-upload', valor: ['arquivo-correto'] }]
    })).resolves.toEqual(expect.objectContaining({ status: 'respondido' }));
  });

  it('salva e retoma rascunho publico com versao monotona', async () => {
    const { servico, dados } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Check-in' }],
      perguntas: [{
        id: 'p1', tenantId: 'tenant-1', questionarioId: 'q1', categoriaId: 'cat-1', tipo: 'sim_nao',
        enunciado: 'Treinou?', peso: '1', obrigatoria: true, configuracao: {}, ordem: 1
      }],
      opcaos: [],
      envios: [{ id: 'envio-1', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1', status: 'enviado', rascunhoVersao: 0 }],
      respostaCheckins: [], respostaValors: [], pacientes: []
    });
    const token = servico.gerarTokenFormularioPaciente('tenant-1', 'envio-1');
    const apiRascunho = servico as unknown as {
      salvarRascunhoFormularioPaciente(token: string, dados: { versaoBase: number; respostas: { perguntaId: string; valor: unknown }[] }): Promise<{ rascunhoVersao: number }>;
    };

    await expect(apiRascunho.salvarRascunhoFormularioPaciente(token, {
      versaoBase: 0,
      respostas: [{ perguntaId: 'p1', valor: true }]
    })).resolves.toEqual({ rascunhoVersao: 1, rascunhoAtualizadoEm: expect.any(Date) });

    expect(dados.envios[0]).toEqual(expect.objectContaining({
      respostasRascunho: [{ perguntaId: 'p1', valor: true }],
      rascunhoVersao: 1,
      rascunhoAtualizadoEm: expect.any(Date)
    }));
    await expect(servico.obterFormularioPaciente(token)).resolves.toEqual(expect.objectContaining({
      respostasRascunho: [{ perguntaId: 'p1', valor: true }],
      rascunhoVersao: 1
    }));
  });

  it('rejeita rascunho obsoleto, pergunta duplicada e valor de tipo invalido', async () => {
    const { servico } = criarServico({
      categorias: [], questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Check-in' }],
      perguntas: [{
        id: 'p1', tenantId: 'tenant-1', questionarioId: 'q1', categoriaId: 'cat-1', tipo: 'sim_nao',
        enunciado: 'Treinou?', peso: '1', obrigatoria: true, configuracao: {}, ordem: 1
      }],
      opcaos: [],
      envios: [{ id: 'envio-1', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1', status: 'enviado', rascunhoVersao: 1 }],
      respostaCheckins: [], respostaValors: [], pacientes: []
    });
    const token = servico.gerarTokenFormularioPaciente('tenant-1', 'envio-1');
    const apiRascunho = servico as unknown as {
      salvarRascunhoFormularioPaciente(token: string, dados: { versaoBase: number; respostas: { perguntaId: string; valor: unknown }[] }): Promise<unknown>;
    };

    await expect(apiRascunho.salvarRascunhoFormularioPaciente(token, {
      versaoBase: 0, respostas: [{ perguntaId: 'p1', valor: true }]
    })).rejects.toThrow('Rascunho atualizado em outro dispositivo.');
    await expect(apiRascunho.salvarRascunhoFormularioPaciente(token, {
      versaoBase: 1, respostas: [{ perguntaId: 'p1', valor: true }, { perguntaId: 'p1', valor: false }]
    })).rejects.toThrow('Resposta duplicada');
    await expect(apiRascunho.salvarRascunhoFormularioPaciente(token, {
      versaoBase: 1, respostas: [{ perguntaId: 'p1', valor: 'sim' }]
    })).rejects.toThrow('tipo invalido');
  });

  it('deve listar respostas recebidas por questionario com valores por pergunta', async () => {
    const finalizadoEm = new Date('2026-07-20T12:00:00.000Z');
    const { servico } = criarServico({
      categorias: [],
      questionarios: [
        { id: 'q1', tenantId: 'tenant-1', titulo: 'Check-in semanal' },
        { id: 'q2', tenantId: 'tenant-1', titulo: 'Outro questionario' }
      ],
      perguntas: [
        {
          id: 'p1',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'sim_nao',
          enunciado: 'Treinou?',
          peso: '1',
          obrigatoria: true,
          configuracao: { secao: 'Rotina' },
          ordem: 1
        },
        {
          id: 'p2',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'texto_longo',
          enunciado: 'Observacoes',
          peso: '1',
          obrigatoria: false,
          configuracao: { secao: 'Rotina' },
          ordem: 2
        }
      ],
      opcaos: [],
      envios: [
        { id: 'envio-1', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1', status: 'respondido' },
        { id: 'envio-2', tenantId: 'tenant-1', questionarioId: 'q2', pacienteId: 'paciente-1', status: 'respondido' }
      ],
      respostaCheckins: [
        { id: 'resposta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', envioQuestionarioId: 'envio-1', finalizadoEm },
        { id: 'resposta-2', tenantId: 'tenant-1', pacienteId: 'paciente-1', envioQuestionarioId: 'envio-2', finalizadoEm }
      ],
      respostaValors: [
        { id: 'valor-1', tenantId: 'tenant-1', respostaCheckinId: 'resposta-1', perguntaId: 'p1', valor: true },
        { id: 'valor-2', tenantId: 'tenant-1', respostaCheckinId: 'resposta-1', perguntaId: 'p2', valor: 'Boa semana' },
        { id: 'valor-3', tenantId: 'tenant-1', respostaCheckinId: 'resposta-2', perguntaId: 'p-x', valor: 'Ignorar' }
      ],
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', ultimoCheckinEm: finalizadoEm }]
    });

    const respostas = await servico.listarRespostasQuestionario('tenant-1', 'q1', usuarioColaborador);

    expect(respostas).toEqual([
      expect.objectContaining({
        respostaId: 'resposta-1',
        envioId: 'envio-1',
        pacienteId: 'paciente-1',
        questionarioId: 'q1',
        finalizadoEm,
        totalRespostas: 2,
        respostas: [
          expect.objectContaining({ perguntaId: 'p1', enunciado: 'Treinou?', valor: true }),
          expect.objectContaining({ perguntaId: 'p2', enunciado: 'Observacoes', valor: 'Boa semana' })
        ]
      })
    ]);
  });

  it('deve exportar respostas em CSV com uma coluna por pergunta', async () => {
    const finalizadoEm = new Date('2026-07-20T12:00:00.000Z');
    const { servico } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Check-in semanal' }],
      perguntas: [
        {
          id: 'p1',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'sim_nao',
          enunciado: 'Treinou?',
          peso: '1',
          obrigatoria: true,
          configuracao: {},
          ordem: 1
        },
        {
          id: 'p2',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'texto_longo',
          enunciado: 'Observacoes, gerais',
          peso: '1',
          obrigatoria: false,
          configuracao: {},
          ordem: 2
        }
      ],
      opcaos: [],
      envios: [{ id: 'envio-1', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1', status: 'respondido' }],
      respostaCheckins: [
        { id: 'resposta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', envioQuestionarioId: 'envio-1', finalizadoEm }
      ],
      respostaValors: [
        { id: 'valor-1', tenantId: 'tenant-1', respostaCheckinId: 'resposta-1', perguntaId: 'p1', valor: true },
        { id: 'valor-2', tenantId: 'tenant-1', respostaCheckinId: 'resposta-1', perguntaId: 'p2', valor: '=SUM(A1)' }
      ],
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1', ultimoCheckinEm: finalizadoEm }]
    });

    const csv = await servico.exportarRespostasCsv('tenant-1', 'q1', usuarioColaborador);
    const [cabecalho, linha] = csv.trim().split('\n');

    expect(cabecalho).toBe('respostaId,pacienteId,finalizadoEm,Treinou?,"Observacoes, gerais"');
    expect(linha).toBe(`resposta-1,paciente-1,2026-07-20T12:00:00.000Z,true,"'=SUM(A1)"`);
  });

  it('deve agregar leitura clinica filtrada por paciente', async () => {
    const respostaPaciente1 = new Date('2026-07-20T12:00:00.000Z');
    const respostaPaciente2 = new Date('2026-07-19T12:00:00.000Z');
    const { servico } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Check-in semanal' }],
      perguntas: [
        {
          id: 'p1',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'sim_nao',
          enunciado: 'Treinou?',
          peso: '1',
          obrigatoria: true,
          configuracao: { secao: 'Rotina' },
          ordem: 1
        },
        {
          id: 'p2',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'metrica',
          enunciado: 'Peso corporal',
          peso: '1',
          obrigatoria: false,
          configuracao: { secao: 'Medidas' },
          ordem: 2
        },
        {
          id: 'p3',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          categoriaId: 'cat-1',
          tipo: 'texto_longo',
          enunciado: 'Observacoes',
          peso: '1',
          obrigatoria: false,
          configuracao: { secao: 'Rotina' },
          ordem: 3
        }
      ],
      opcaos: [],
      envios: [
        { id: 'envio-1', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1', status: 'respondido' },
        { id: 'envio-2', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-2', status: 'respondido' }
      ],
      respostaCheckins: [
        { id: 'resposta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', envioQuestionarioId: 'envio-1', finalizadoEm: respostaPaciente1 },
        { id: 'resposta-2', tenantId: 'tenant-1', pacienteId: 'paciente-2', envioQuestionarioId: 'envio-2', finalizadoEm: respostaPaciente2 }
      ],
      respostaValors: [
        { id: 'valor-1', tenantId: 'tenant-1', respostaCheckinId: 'resposta-1', perguntaId: 'p1', valor: true },
        { id: 'valor-2', tenantId: 'tenant-1', respostaCheckinId: 'resposta-1', perguntaId: 'p2', valor: 82.4 },
        { id: 'valor-3', tenantId: 'tenant-1', respostaCheckinId: 'resposta-1', perguntaId: 'p3', valor: 'Dormiu melhor' },
        { id: 'valor-4', tenantId: 'tenant-1', respostaCheckinId: 'resposta-2', perguntaId: 'p1', valor: false },
        { id: 'valor-5', tenantId: 'tenant-1', respostaCheckinId: 'resposta-2', perguntaId: 'p2', valor: 91.2 }
      ],
      pacientes: [
        { id: 'paciente-1', tenantId: 'tenant-1', ultimoCheckinEm: respostaPaciente1 },
        { id: 'paciente-2', tenantId: 'tenant-1', ultimoCheckinEm: respostaPaciente2 }
      ]
    });

    const leitura = await servico.obterLeituraClinicaQuestionario(
      'tenant-1',
      'q1',
      { pacienteId: 'paciente-1' },
      usuarioColaborador
    );

    expect(leitura.resumo).toEqual({
      totalRespostas: 1,
      totalPacientes: 1,
      totalPerguntas: 3,
      mediaRespostasPorEnvio: 3,
      ultimaRespostaEm: respostaPaciente1
    });
    expect(leitura.respostas).toHaveLength(1);
    expect(leitura.pacientes).toEqual([
      expect.objectContaining({ pacienteId: 'paciente-1', totalRespostas: 1, ultimaRespostaEm: respostaPaciente1 })
    ]);
    expect(leitura.perguntas).toEqual([
      expect.objectContaining({ perguntaId: 'p1', totalRespostas: 1, totalSim: 1, totalNao: 0 }),
      expect.objectContaining({ perguntaId: 'p2', totalRespostas: 1, mediaNumerica: 82.4 }),
      expect.objectContaining({ perguntaId: 'p3', totalRespostas: 1, textosRecentes: ['Dormiu melhor'] })
    ]);
  });

  it('deve montar matriz longitudinal apenas para indicadores numericos comparaveis', async () => {
    const anterior = new Date('2026-07-12T12:00:00.000Z');
    const atual = new Date('2026-07-19T12:00:00.000Z');
    const { servico } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Check-in semanal' }],
      perguntas: [],
      opcaos: [],
      envios: [
        {
          id: 'envio-anterior',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          pacienteId: 'paciente-1',
          snapshotEstrutura: {
            perguntas: [
              { id: 'peso', categoriaId: 'medidas', tipo: 'metrica', enunciado: 'Peso', configuracao: { unidade: 'kg' } },
              { id: 'nota', categoriaId: 'medidas', tipo: 'texto_longo', enunciado: 'Observacao', configuracao: {} }
            ]
          }
        },
        {
          id: 'envio-atual',
          tenantId: 'tenant-1',
          questionarioId: 'q1',
          pacienteId: 'paciente-1',
          snapshotEstrutura: {
            perguntas: [
              { id: 'peso', categoriaId: 'medidas', tipo: 'metrica', enunciado: 'Peso', configuracao: { unidade: 'kg' } },
              { id: 'nota', categoriaId: 'medidas', tipo: 'texto_longo', enunciado: 'Observacao', configuracao: {} }
            ]
          }
        }
      ],
      respostaCheckins: [
        { id: 'resposta-anterior', tenantId: 'tenant-1', pacienteId: 'paciente-1', envioQuestionarioId: 'envio-anterior', finalizadoEm: anterior },
        { id: 'resposta-atual', tenantId: 'tenant-1', pacienteId: 'paciente-1', envioQuestionarioId: 'envio-atual', finalizadoEm: atual }
      ],
      respostaValors: [
        { id: 'valor-1', tenantId: 'tenant-1', respostaCheckinId: 'resposta-anterior', perguntaId: 'peso', valor: 81 },
        { id: 'valor-2', tenantId: 'tenant-1', respostaCheckinId: 'resposta-anterior', perguntaId: 'nota', valor: 'Sem observacoes' },
        { id: 'valor-3', tenantId: 'tenant-1', respostaCheckinId: 'resposta-atual', perguntaId: 'peso', valor: 79.5 }
      ],
      pacientes: [{ id: 'paciente-1', tenantId: 'tenant-1' }]
    });

    const matriz = await servico.obterMatrizLongitudinalRespostas(
      'tenant-1',
      { pacienteId: 'paciente-1', categoriaId: 'medidas' },
      usuarioColaborador
    );

    expect(matriz.resumo).toEqual(
      expect.objectContaining({ totalRespostas: 2, totalIndicadores: 1, primeiraRespostaEm: anterior, ultimaRespostaEm: atual })
    );
    expect(matriz.indicadores).toEqual([
      expect.objectContaining({
        pacienteId: 'paciente-1',
        perguntaId: 'peso',
        tipo: 'metrica',
        unidade: 'kg',
        atual: { valor: 79.5, finalizadoEm: atual },
        anterior: { valor: 81, finalizadoEm: anterior },
        delta: -1.5
      })
    ]);
  });

  describe('escopo pacientes_responsaveis para Professional', () => {
    function dadosBase(extra: Record<string, any> = {}) {
      return {
        categorias: [],
        questionarios: [],
        perguntas: [],
        opcaos: [],
        envios: [],
        respostaCheckins: [],
        respostaValors: [],
        pacientes: [],
        profissionals: [{ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }],
        ...extra
      };
    }

    it('deve forcar profissionalId para o proprio profissional ao criar questionario como Professional', async () => {
      const { servico } = criarServico(dadosBase());

      const questionario = await servico.criarQuestionario(
        'tenant-1',
        { profissionalId: 'profissional-outro-2', titulo: 'Novo questionario' } as any,
        usuarioProfissional
      );

      expect(questionario.profissionalId).toBe('profissional-1');
    });

    it('deve listar apenas questionarios do proprio profissional quando o usuario for Professional', async () => {
      const { servico } = criarServico(
        dadosBase({
          questionarios: [
            { id: 'q-meu', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Meu questionario', versao: 1 },
            { id: 'q-outro', tenantId: 'tenant-1', profissionalId: 'profissional-outro-2', titulo: 'De outro profissional', versao: 1 }
          ]
        })
      );

      const resultado = await servico.listarQuestionarios('tenant-1', usuarioProfissional);

      expect(resultado.itens.map((item) => item.id)).toEqual(['q-meu']);
    });

    it('deve buscar titulo e paginar questionarios no servidor', async () => {
      const { servico } = criarServico(
        dadosBase({
          questionarios: [
            { id: 'q-1', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Adesao inicial', versao: 1 },
            { id: 'q-2', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Adesao semanal', versao: 1 },
            { id: 'q-3', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Sono', versao: 1 }
          ]
        })
      );

      const resultado = await servico.listarQuestionarios('tenant-1', usuarioProfissional, 2, 1, 'adesao');

      expect(resultado.total).toBe(2);
      expect(resultado.itens.map((item) => item.id)).toEqual(['q-2']);
    });

    it('deve tratar questionario de outro profissional como nao encontrado ao atualizar', async () => {
      const { servico } = criarServico(
        dadosBase({
          questionarios: [{ id: 'q-outro', tenantId: 'tenant-1', profissionalId: 'profissional-outro-2', titulo: 'De outro', versao: 1 }]
        })
      );

      await expect(
        servico.atualizarQuestionario('tenant-1', 'q-outro', { titulo: 'Tentativa' } as any, usuarioProfissional)
      ).rejects.toThrow('Questionario nao encontrado.');
    });

    it('deve marcar envio respondido como revisado apenas pelo profissional responsavel', async () => {
      const { servico } = criarServico(
        dadosBase({
          envios: [
            {
              id: 'envio-1',
              tenantId: 'tenant-1',
              questionarioId: 'q1',
              pacienteId: 'paciente-1',
              status: 'respondido'
            }
          ],
          pacientes: [
            {
              id: 'paciente-1',
              tenantId: 'tenant-1',
              profissionalResponsavelId: 'profissional-1'
            }
          ]
        })
      );

      const resultado = await servico.marcarEnvioComoRevisado('tenant-1', 'envio-1', usuarioProfissional);

      expect(resultado).toEqual(
        expect.objectContaining({
          revisadoEm: expect.any(Date),
          revisadoPorUsuarioId: usuarioProfissional.usuarioId
        })
      );
    });

    it('deve tratar envio de paciente de outro profissional como nao encontrado ao revisar', async () => {
      const { servico } = criarServico(
        dadosBase({
          envios: [
            {
              id: 'envio-outro',
              tenantId: 'tenant-1',
              questionarioId: 'q1',
              pacienteId: 'paciente-outro',
              status: 'respondido'
            }
          ],
          pacientes: [
            {
              id: 'paciente-outro',
              tenantId: 'tenant-1',
              profissionalResponsavelId: 'profissional-outro-2'
            }
          ]
        })
      );

      await expect(
        servico.marcarEnvioComoRevisado('tenant-1', 'envio-outro', usuarioProfissional)
      ).rejects.toThrow('Envio nao encontrado.');
    });

    it('deve preservar a primeira revisao quando a acao for repetida', async () => {
      const primeiraRevisao = new Date('2026-07-27T14:00:00.000Z');
      const { servico } = criarServico(
        dadosBase({
          envios: [
            {
              id: 'envio-revisado',
              tenantId: 'tenant-1',
              questionarioId: 'q1',
              pacienteId: 'paciente-1',
              status: 'respondido',
              revisadoEm: primeiraRevisao,
              revisadoPorUsuarioId: 'usuario-revisor-original'
            }
          ],
          pacientes: [
            {
              id: 'paciente-1',
              tenantId: 'tenant-1',
              profissionalResponsavelId: 'profissional-1'
            }
          ]
        })
      );

      const resultado = await servico.marcarEnvioComoRevisado('tenant-1', 'envio-revisado', usuarioProfissional);

      expect(resultado.revisadoEm).toBe(primeiraRevisao);
      expect(resultado.revisadoPorUsuarioId).toBe('usuario-revisor-original');
    });

    it('deve limitar a matriz longitudinal aos pacientes do profissional', async () => {
      const { servico } = criarServico(
        dadosBase({
          questionarios: [{ id: 'q-meu', tenantId: 'tenant-1', profissionalId: 'profissional-1', titulo: 'Meu check-in' }],
          perguntas: [
            {
              id: 'peso',
              tenantId: 'tenant-1',
              questionarioId: 'q-meu',
              categoriaId: 'medidas',
              tipo: 'metrica',
              enunciado: 'Peso',
              configuracao: { unidade: 'kg' }
            }
          ],
          envios: [
            { id: 'envio-meu', tenantId: 'tenant-1', questionarioId: 'q-meu', pacienteId: 'paciente-meu' },
            { id: 'envio-outro', tenantId: 'tenant-1', questionarioId: 'q-meu', pacienteId: 'paciente-outro' }
          ],
          respostaCheckins: [
            { id: 'resposta-minha', tenantId: 'tenant-1', pacienteId: 'paciente-meu', envioQuestionarioId: 'envio-meu', finalizadoEm: new Date('2026-07-20T12:00:00.000Z') },
            { id: 'resposta-outra', tenantId: 'tenant-1', pacienteId: 'paciente-outro', envioQuestionarioId: 'envio-outro', finalizadoEm: new Date('2026-07-20T12:00:00.000Z') }
          ],
          respostaValors: [
            { id: 'valor-meu', tenantId: 'tenant-1', respostaCheckinId: 'resposta-minha', perguntaId: 'peso', valor: 80 },
            { id: 'valor-outro', tenantId: 'tenant-1', respostaCheckinId: 'resposta-outra', perguntaId: 'peso', valor: 65 }
          ],
          pacientes: [
            { id: 'paciente-meu', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-1' },
            { id: 'paciente-outro', tenantId: 'tenant-1', profissionalResponsavelId: 'profissional-outro-2' }
          ]
        })
      );

      const matriz = await servico.obterMatrizLongitudinalRespostas('tenant-1', {}, usuarioProfissional);

      expect(matriz.indicadores).toHaveLength(1);
      expect(matriz.indicadores[0]).toEqual(expect.objectContaining({ pacienteId: 'paciente-meu', atual: { valor: 80, finalizadoEm: expect.any(Date) } }));
    });
  });
});
