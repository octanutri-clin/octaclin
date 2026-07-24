import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { ServicoQuestionarios } from './servico-questionarios';
import { CategoriaPerguntaOrm } from '../infraestrutura/categoria-pergunta.orm';
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
    | 'paciente'
    | 'profissional',
  dados: Record<string, any>
) {
  const itens = dados[`${nome}s`] as Record<string, any>[];

  return {
    create: jest.fn((entrada: Record<string, unknown>) => entrada),
    count: jest.fn(async () => itens.length),
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
    findAndCount: jest.fn(async (consulta?: { where?: Record<string, unknown> }) => {
      const filtrados = consulta?.where
        ? itens.filter((item) => Object.entries(consulta.where ?? {}).every(([chave, valor]) => corresponde(item[chave], valor)))
        : [...itens];
      return [filtrados, filtrados.length];
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
    paciente: criarRepositorioFake('paciente', dados),
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
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      if (entidade.name === 'PacienteOrm') return repositorios.paciente;
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

  it('deve criar envio manual com link publico de formulario', async () => {
    process.env.OCTACLIN_WEB_URL = 'https://app.octaclin.test';
    const { servico, dados } = criarServico({
      categorias: [],
      questionarios: [{ id: 'q1', tenantId: 'tenant-1', titulo: 'Check-in', descricao: 'Descricao' }],
      perguntas: [],
      opcaos: [],
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
      envios: [{ id: 'envio-1', tenantId: 'tenant-1', questionarioId: 'q1', pacienteId: 'paciente-1', status: 'enviado' }],
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
    expect(dados.pacientes[0].ultimoCheckinEm).toBeInstanceOf(Date);
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
  });
});
