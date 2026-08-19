import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { EnvioMaterialPacienteOrm } from '../../materiais/infraestrutura/envio-material-paciente.orm';
import { MaterialEducativoOrm } from '../../materiais/infraestrutura/material-educativo.orm';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
import { SincronizacaoMobileOrm } from '../../mobile/infraestrutura/sincronizacao-mobile.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { PerguntaOrm } from '../../questionarios/infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../../questionarios/infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../../questionarios/infraestrutura/resposta-valor.orm';
import { PlanoAlimentarItemOrm } from '../../planos-alimentares/infraestrutura/plano-alimentar-item.orm';
import { PlanoAlimentarRefeicaoOrm } from '../../planos-alimentares/infraestrutura/plano-alimentar-refeicao.orm';
import { PlanoAlimentarEscolhaPacienteOrm } from '../../planos-alimentares/infraestrutura/plano-alimentar-escolha-paciente.orm';
import { PlanoAlimentarSubstituicaoOrm } from '../../planos-alimentares/infraestrutura/plano-alimentar-substituicao.orm';
import { PlanoAlimentarVersaoOrm } from '../../planos-alimentares/infraestrutura/plano-alimentar-versao.orm';
import { PlanoAlimentarOrm } from '../../planos-alimentares/infraestrutura/plano-alimentar.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { AcompanhamentoTarefaOrm } from '../infraestrutura/acompanhamento-tarefa.orm';
import { AvaliacaoAntropometricaOrm } from '../infraestrutura/avaliacao-antropometrica.orm';
import { ServicoPortalPaciente } from './servico-portal-paciente';

function criarRepositorioFake(nome: string, dados: Record<string, any>) {
  const chaveColecao = nome === 'mensagem' ? 'mensagens' : nome === 'material' ? 'materiais' : `${nome}s`;
  const itens: Record<string, any>[] = dados[chaveColecao] ?? [];

  function corresponde(valorItem: unknown, valorConsulta: unknown) {
    if (
      valorConsulta &&
      typeof valorConsulta === 'object' &&
      '_type' in valorConsulta &&
      (valorConsulta as { _type?: string })._type === 'in'
    ) {
      return ((valorConsulta as { _value?: unknown[] })._value ?? []).includes(valorItem);
    }
    if (
      valorConsulta &&
      typeof valorConsulta === 'object' &&
      '_type' in valorConsulta &&
      (valorConsulta as { _type?: string })._type === 'isNull'
    ) {
      return valorItem === null || valorItem === undefined;
    }
    return valorItem === valorConsulta;
  }

  return {
    create: jest.fn((entrada: Record<string, any>) => entrada),
    findOne: jest.fn(async (consulta: { where: Record<string, unknown> }) =>
      itens.find((item) => Object.entries(consulta.where).every(([chave, valor]) => corresponde(item[chave], valor))) ?? null
    ),
    find: jest.fn(async (consulta?: { where?: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'>; take?: number }) => {
      let resultado = consulta?.where
        ? itens.filter((item) => Object.entries(consulta.where ?? {}).every(([chave, valor]) => corresponde(item[chave], valor)))
        : [...itens];
      const [campoOrdenacao, direcao] = Object.entries(consulta?.order ?? {})[0] ?? [];
      if (campoOrdenacao) {
        resultado = resultado.sort((a, b) => {
          const valorA = a[campoOrdenacao] instanceof Date ? a[campoOrdenacao].getTime() : a[campoOrdenacao];
          const valorB = b[campoOrdenacao] instanceof Date ? b[campoOrdenacao].getTime() : b[campoOrdenacao];
          return direcao === 'DESC' ? valorB - valorA : valorA - valorB;
        });
      }
      return consulta?.take ? resultado.slice(0, consulta.take) : resultado;
    }),
    save: jest.fn(async (entidade: Record<string, any>) => {
      if (!entidade.id) entidade.id = `${nome}-${itens.length + 1}`;
      const existente = itens.find((item) => item.id === entidade.id);
      if (existente) Object.assign(existente, entidade);
      else itens.push(entidade);
      return entidade;
    })
  };
}

function criarServico(dados: Record<string, any>) {
  const repositorios = {
    paciente: criarRepositorioFake('paciente', dados),
    consulta: criarRepositorioFake('consulta', dados),
    envio: criarRepositorioFake('envio', dados),
    pergunta: criarRepositorioFake('pergunta', dados),
    questionario: criarRepositorioFake('questionario', dados),
    respostaCheckin: criarRepositorioFake('respostaCheckin', dados),
    respostaValor: criarRepositorioFake('respostaValor', dados),
    mensagem: criarRepositorioFake('mensagem', dados),
    consentimento: criarRepositorioFake('consentimento', dados),
    tarefa: criarRepositorioFake('tarefa', dados),
    material: criarRepositorioFake('material', dados),
    envioMaterial: criarRepositorioFake('envioMaterial', dados),
    diario: criarRepositorioFake('diario', dados),
    sincronizacao: criarRepositorioFake('sincronizacao', dados),
    planoAlimentar: criarRepositorioFake('planoAlimentar', dados),
    planoAlimentarVersao: criarRepositorioFake('planoAlimentarVersao', dados),
    planoAlimentarRefeicao: criarRepositorioFake('planoAlimentarRefeicao', dados),
    planoAlimentarItem: criarRepositorioFake('planoAlimentarItem', dados),
    planoAlimentarSubstituicao: criarRepositorioFake('planoAlimentarSubstituicao', dados),
    planoAlimentarEscolha: criarRepositorioFake('planoAlimentarEscolha', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === AgendaConsultaOrm) return repositorios.consulta;
      if (entidade === EnvioQuestionarioOrm) return repositorios.envio;
      if (entidade === PerguntaOrm) return repositorios.pergunta;
      if (entidade === QuestionarioOrm) return repositorios.questionario;
      if (entidade === RespostaCheckinOrm) return repositorios.respostaCheckin;
      if (entidade === RespostaValorOrm) return repositorios.respostaValor;
      if (entidade === MensagemNotificacaoOrm) return repositorios.mensagem;
      if (entidade === ConsentimentoLgpdOrm) return repositorios.consentimento;
      if (entidade === AcompanhamentoTarefaOrm) return repositorios.tarefa;
      if (entidade === MaterialEducativoOrm) return repositorios.material;
      if (entidade === EnvioMaterialPacienteOrm) return repositorios.envioMaterial;
      if (entidade === LogDiarioRapidoOrm) return repositorios.diario;
      if (entidade === SincronizacaoMobileOrm) return repositorios.sincronizacao;
      if (entidade === PlanoAlimentarOrm) return repositorios.planoAlimentar;
      if (entidade === PlanoAlimentarVersaoOrm) return repositorios.planoAlimentarVersao;
      if (entidade === PlanoAlimentarRefeicaoOrm) return repositorios.planoAlimentarRefeicao;
      if (entidade === PlanoAlimentarItemOrm) return repositorios.planoAlimentarItem;
      if (entidade === PlanoAlimentarSubstituicaoOrm) return repositorios.planoAlimentarSubstituicao;
      if (entidade === PlanoAlimentarEscolhaPacienteOrm) return repositorios.planoAlimentarEscolha;
      if (entidade === AvaliacaoAntropometricaOrm) return { find: jest.fn(async () => []) };
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
  };
  const criptografia = {
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8').replace('cripto:', '')),
    criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`)),
    gerarHashesBuscaPii: jest.fn(() => ['hash-busca'])
  };

  return { servico: new ServicoPortalPaciente(executorTenant as never, criptografia as never), repositorios };
}

describe('ServicoPortalPaciente', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00.000Z'));
    process.env.OCTACLIN_WEB_URL = 'https://app.octaclin.test';
    process.env.FORMULARIO_PUBLICO_SEGREDO = 'segredo-teste-formulario';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deve expor a publicacao mais recente mesmo quando existe um plano em rascunho mais novo', async () => {
    const publicadoEm = new Date('2026-08-08T12:00:00.000Z');
    const { servico } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula'),
          profissionalResponsavelId: 'profissional-1',
          statusAdesao: 'aderente'
        }
      ],
      planoAlimentars: [
        {
          id: 'plano-rascunho-novo',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tituloCriptografado: Buffer.from('cripto:Rascunho mais novo'),
          versaoPublicadaAtualId: null,
          criadoEm: new Date('2026-08-07T12:00:00.000Z')
        },
        {
          id: 'plano-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tituloCriptografado: Buffer.from('cripto:Plano alimentar de agosto'),
          versaoPublicadaAtualId: 'versao-publicada-1',
          criadoEm: new Date('2026-08-01T12:00:00.000Z')
        }
      ],
      planoAlimentarVersaos: [
        {
          id: 'versao-publicada-1',
          tenantId: 'tenant-1',
          planoId: 'plano-1',
          numero: 2,
          publicadaEm: publicadoEm,
          objetivosCriptografados: Buffer.from('cripto:Melhorar a regularidade das refeicoes.'),
          observacoesCriptografadas: Buffer.from('cripto:Prefira alimentos in natura.'),
          calculoSnapshotCriptografado: Buffer.from(
            'cripto:{"metaEnergeticaKcal":2000,"metasMacronutrientes":{"carboidratosG":250,"proteinasG":100,"gordurasG":66.7},"formula":"mifflin","fatorAtividade":1.5,"metabolismoRepousoKcal":1300,"sexo":"feminino","idadeAnos":36,"alertasInternos":["revisar"]}'
          ),
          totaisSnapshotCriptografado: Buffer.from(
            'cripto:{"energiaKcal":1988,"proteinasG":98,"carboidratosG":247,"gordurasG":67}'
          ),
          avaliacaoAntropometricaId: 'avaliacao-1',
          formulaCodigo: 'mifflin_st_jeor_1990',
          revisadaPorUsuarioId: 'usuario-profissional-1',
          hashConteudo: 'hash-interno'
        }
      ],
      planoAlimentarRefeicaos: [
        {
          id: 'refeicao-1',
          tenantId: 'tenant-1',
          versaoId: 'versao-publicada-1',
          ordem: 1,
          nomeCriptografado: Buffer.from('cripto:Cafe da manha'),
          horarioLocal: '08:00:00',
          orientacoesCriptografadas: Buffer.from('cripto:Consumir com calma.')
        }
      ],
      planoAlimentarItems: [
        {
          id: 'item-1',
          tenantId: 'tenant-1',
          refeicaoId: 'refeicao-1',
          ordem: 1,
          descricaoCriptografada: Buffer.from('cripto:Mamao'),
          quantidade: '1.000',
          unidade: 'fatia',
          porcaoGramas: '100.000',
          composicaoSnapshotCriptografada: Buffer.from(
            'cripto:{"origem":"catalogo","fonte":{"nome":"TACO","codigoExterno":"segredo"},"nutrientesPor100g":{"energiaKcal":45},"nutrientesPorcao":{"energiaKcal":45,"proteinasG":0.8,"carboidratosG":11.6,"gordurasG":0.1}}'
          )
        }
      ],
      planoAlimentarSubstituicaos: [
        {
          id: 'substituicao-1',
          tenantId: 'tenant-1',
          itemId: 'item-1',
          ordem: 1,
          descricaoCriptografada: Buffer.from('cripto:Melao'),
          quantidade: '1.000',
          unidade: 'fatia',
          porcaoGramas: '100.000',
          composicaoSnapshotCriptografada: Buffer.from(
            'cripto:{"origem":"manual","nutrientesPorcao":{"energiaKcal":29,"proteinasG":0.7,"carboidratosG":7.5,"gordurasG":0}}'
          ),
          liberadaParaPaciente: true,
          preferida: false
        }
      ]
    });

    const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');

    expect(portal.planoAlimentar).toEqual({
      id: 'plano-1',
      titulo: 'Plano alimentar de agosto',
      numeroVersao: 2,
      publicadoEm,
      objetivo: 'Melhorar a regularidade das refeicoes.',
      orientacoes: 'Prefira alimentos in natura.',
      metaEnergeticaKcal: 2000,
      macros: { carboidratosG: 250, proteinasG: 100, gordurasG: 66.7 },
      refeicoes: [
        {
          id: 'refeicao-1',
          nome: 'Cafe da manha',
          horarioLocal: '08:00:00',
          orientacoes: 'Consumir com calma.',
          itens: [
            {
              id: 'item-1',
              descricao: 'Mamao',
              quantidade: 1,
              unidade: 'fatia',
              porcaoGramas: 100,
              nutrientes: { energiaKcal: 45, proteinasG: 0.8, carboidratosG: 11.6, gordurasG: 0.1 },
              substituicoes: [
                {
                  id: 'substituicao-1',
                  descricao: 'Melao',
                  quantidade: 1,
                  unidade: 'fatia',
                  porcaoGramas: 100,
                  nutrientes: { energiaKcal: 29, proteinasG: 0.7, carboidratosG: 7.5, gordurasG: 0 },
                  preferida: false
                }
              ]
            }
          ]
        }
      ]
    });
    const payload = JSON.stringify(portal.planoAlimentar);
    for (const campoInterno of [
      'formula',
      'fatorAtividade',
      'metabolismoRepousoKcal',
      'sexo',
      'idadeAnos',
      'alertasInternos',
      'avaliacaoAntropometricaId',
      'revisadaPorUsuarioId',
      'hashConteudo',
      'fonte',
      'codigoExterno'
    ]) {
      expect(payload).not.toContain(campoInterno);
    }
  });

  it('escolhe publicadaEm mais recente entre planos ativos, independentemente de criadoEm', async () => {
    const { servico } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula')
        }
      ],
      planoAlimentars: [
        {
          id: 'plano-criado-depois',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tituloCriptografado: Buffer.from('cripto:Publicacao antiga'),
          versaoPublicadaAtualId: 'versao-antiga',
          criadoEm: new Date('2026-08-07T12:00:00.000Z')
        },
        {
          id: 'plano-criado-antes',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tituloCriptografado: Buffer.from('cripto:Publicacao mais recente'),
          versaoPublicadaAtualId: 'versao-recente',
          criadoEm: new Date('2026-08-01T12:00:00.000Z')
        }
      ],
      planoAlimentarVersaos: [
        {
          id: 'versao-antiga',
          tenantId: 'tenant-1',
          planoId: 'plano-criado-depois',
          numero: 1,
          publicadaEm: new Date('2026-08-05T12:00:00.000Z')
        },
        {
          id: 'versao-recente',
          tenantId: 'tenant-1',
          planoId: 'plano-criado-antes',
          numero: 3,
          publicadaEm: new Date('2026-08-08T12:00:00.000Z')
        }
      ]
    });

    const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');

    expect(portal.planoAlimentar).toEqual(
      expect.objectContaining({
        id: 'plano-criado-antes',
        titulo: 'Publicacao mais recente',
        numeroVersao: 3
      })
    );
  });

  it('nunca deve expor rascunho quando o plano nao possui publicacao atual', async () => {
    const { servico } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula')
        }
      ],
      planoAlimentars: [
        {
          id: 'plano-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tituloCriptografado: Buffer.from('cripto:Rascunho sigiloso'),
          versaoPublicadaAtualId: 'rascunho-1',
          criadoEm: new Date('2026-08-01T12:00:00.000Z')
        }
      ],
      planoAlimentarVersaos: [
        {
          id: 'rascunho-1',
          tenantId: 'tenant-1',
          planoId: 'plano-1',
          numero: 1,
          objetivosCriptografados: Buffer.from('cripto:Nao publicar')
        }
      ]
    });

    const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');

    expect(portal).not.toHaveProperty('planoAlimentar');
    expect(JSON.stringify(portal)).not.toContain('Rascunho sigiloso');
    expect(JSON.stringify(portal)).not.toContain('Nao publicar');
  });

  it('nao deve seguir ponteiro de versao pertencente a outro plano ou tenant', async () => {
    const { servico } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula')
        }
      ],
      planoAlimentars: [
        {
          id: 'plano-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tituloCriptografado: Buffer.from('cripto:Plano da Ana'),
          versaoPublicadaAtualId: 'versao-alheia',
          criadoEm: new Date('2026-08-01T12:00:00.000Z')
        }
      ],
      planoAlimentarVersaos: [
        {
          id: 'versao-alheia',
          tenantId: 'tenant-2',
          planoId: 'plano-outro-paciente',
          numero: 9,
          publicadaEm: new Date('2026-08-08T12:00:00.000Z'),
          objetivosCriptografados: Buffer.from('cripto:Dado de outro paciente')
        }
      ]
    });

    const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');

    expect(portal).not.toHaveProperty('planoAlimentar');
    expect(JSON.stringify(portal)).not.toContain('Dado de outro paciente');
  });

  it('deve montar portal autenticado somente com dados do paciente logado', async () => {
    const inicioConsulta = new Date('2026-08-10T13:00:00.000Z');
    const { servico } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula'),
          contatoCriptografado: Buffer.from('cripto:ana@example.com'),
          dataNascimento: '1990-04-15',
          profissionalResponsavelId: 'profissional-1',
          statusAdesao: 'aderente',
          scoreRisco: '12.50',
          ultimoCheckinEm: new Date('2026-07-20T12:00:00.000Z')
        },
        {
          id: 'paciente-2',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-2',
          nomeCriptografado: Buffer.from('cripto:Outro Paciente')
        }
      ],
      consultas: [
        {
          id: 'consulta-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          titulo: 'Consulta nutricional',
          inicioEm: inicioConsulta,
          fimEm: new Date('2026-08-10T13:50:00.000Z'),
          status: 'agendada',
          local: 'Online',
          googleEventHtmlLink: 'https://calendar.google.com/event'
        },
        {
          id: 'consulta-2',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          titulo: 'Consulta de outro paciente',
          inicioEm: inicioConsulta,
          fimEm: new Date('2026-08-10T13:50:00.000Z'),
          status: 'agendada'
        }
      ],
      envios: [
        {
          id: 'envio-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          questionarioId: 'questionario-1',
          status: 'enviado',
          expiraEm: new Date('2026-08-12T12:00:00.000Z')
        },
        {
          id: 'envio-2',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          questionarioId: 'questionario-2',
          status: 'respondido',
          respondidoEm: new Date('2026-07-19T12:05:00.000Z')
        },
        {
          id: 'envio-3',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          questionarioId: 'questionario-1',
          status: 'enviado'
        }
      ],
      questionarios: [
        { id: 'questionario-1', tenantId: 'tenant-1', titulo: 'Check-in semanal' },
        { id: 'questionario-2', tenantId: 'tenant-1', titulo: 'Respondido' }
      ],
      respostaCheckins: [
        {
          id: 'resposta-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          envioQuestionarioId: 'envio-2',
          scoreFinal: '87.40',
          finalizadoEm: new Date('2026-07-19T12:05:00.000Z')
        }
      ],
      mensagens: [
        {
          id: 'mensagem-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          canalId: 'canal-email-1',
          status: 'enviado',
          payload: { assunto: 'Consulta agendada', texto: 'Sua consulta foi agendada.', canal: 'email', evento: 'agenda.consulta.agendada' },
          criadoEm: new Date('2026-07-20T14:00:00.000Z'),
          enviadoEm: new Date('2026-07-20T14:01:00.000Z')
        },
        {
          id: 'mensagem-pendente-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          canalId: 'canal-whatsapp-1',
          status: 'pendente',
          payload: {
            assunto: 'Lembrete de consulta',
            texto: 'Sua consulta sera amanha.',
            canal: 'whatsapp',
            evento: 'agenda.consulta.lembrete',
            agendadoPara: '2026-08-09T13:00:00.000Z'
          },
          criadoEm: new Date('2026-07-21T14:00:00.000Z')
        },
        {
          id: 'mensagem-2',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          status: 'enviado',
          payload: { texto: 'Nao deve aparecer' },
          criadoEm: new Date('2026-07-20T15:00:00.000Z')
        }
      ],
      tarefas: [
        {
          id: 'tarefa-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          profissionalId: 'profissional-1',
          titulo: 'Registrar agua diariamente',
          descricaoCriptografada: Buffer.from('cripto:Meta de 2 litros por dia.'),
          categoria: 'meta',
          prioridade: 'alta',
          status: 'pendente',
          vencimentoEm: new Date('2026-08-05T12:00:00.000Z'),
          criadoEm: new Date('2026-07-22T12:00:00.000Z'),
          atualizadoEm: new Date('2026-07-22T12:00:00.000Z')
        },
        {
          id: 'tarefa-outro',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          profissionalId: 'profissional-1',
          titulo: 'Nao deve aparecer',
          categoria: 'tarefa',
          prioridade: 'media',
          status: 'pendente',
          criadoEm: new Date('2026-07-22T12:00:00.000Z'),
          atualizadoEm: new Date('2026-07-22T12:00:00.000Z')
        }
      ],
      materiais: [
        {
          id: 'material-1',
          tenantId: 'tenant-1',
          criadoPorUsuarioId: 'usuario-profissional-1',
          titulo: 'Guia de hidratacao',
          tipo: 'link',
          categoria: 'Habitos',
          resumo: 'Orientacoes para hidratar melhor.',
          url: 'https://materiais.octaclin.test/hidratacao',
          ativo: true,
          criadoEm: new Date('2026-07-21T12:00:00.000Z'),
          atualizadoEm: new Date('2026-07-21T12:00:00.000Z')
        }
      ],
      envioMaterials: [
        {
          id: 'envio-material-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          materialId: 'material-1',
          enviadoPorUsuarioId: 'usuario-profissional-1',
          observacaoCriptografada: Buffer.from('cripto:Ler antes da proxima consulta.'),
          status: 'enviado',
          enviadoEm: new Date('2026-07-22T13:00:00.000Z'),
          criadoEm: new Date('2026-07-22T13:00:00.000Z'),
          atualizadoEm: new Date('2026-07-22T13:00:00.000Z')
        },
        {
          id: 'envio-material-outro',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          materialId: 'material-1',
          enviadoPorUsuarioId: 'usuario-profissional-1',
          status: 'enviado',
          criadoEm: new Date('2026-07-22T13:00:00.000Z'),
          atualizadoEm: new Date('2026-07-22T13:00:00.000Z')
        }
      ],
      diarios: [
        {
          id: 'diario-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          tipo: 'humor',
          valor: {
            humor: 'bem',
            adesaoPlano: 80,
            sintomas: 'Sono leve',
            observacoes: 'Consegui seguir o plano no almoco.',
            origem: 'portal_paciente'
          },
          registradoEm: new Date('2026-07-23T10:00:00.000Z')
        },
        {
          id: 'diario-outro',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          tipo: 'humor',
          valor: { humor: 'mal', origem: 'portal_paciente' },
          registradoEm: new Date('2026-07-23T11:00:00.000Z')
        }
      ],
      consentimentos: [
        {
          id: 'consentimento-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          tipo: 'primeiro_acesso_paciente',
          versao: '2026-07',
          aceitoEm: new Date('2026-07-10T10:00:00.000Z'),
          metadados: { origem: 'primeiro_acesso' }
        },
        {
          id: 'consentimento-outro',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-2',
          tipo: 'primeiro_acesso_paciente',
          versao: '2026-07',
          aceitoEm: new Date('2026-07-11T10:00:00.000Z'),
          metadados: { origem: 'outro' }
        }
      ]
    });

    const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');
    const portalComPlano = portal as typeof portal & {
      tarefasAcompanhamento: unknown[];
      materiaisDisponiveis: unknown[];
      diariosRecentes: unknown[];
      notificacoesPaciente: unknown[];
    };

    expect(portal.paciente).toEqual(
      expect.objectContaining({
        id: 'paciente-1',
        nome: 'Ana Paula',
        statusAdesao: 'aderente'
      })
    );
    // Regra da Fase 161: score de risco e triagem interna e nao volta para o
    // paciente. Este payload devolvia `scoreRisco: '12.50'` ate a Fase 207.
    expect(portal.paciente).not.toHaveProperty('scoreRisco');
    expect(JSON.stringify(portal)).not.toContain('scoreRisco');
    expect(portal.resumo).toEqual({
      consultasProximas: 1,
      formulariosPendentes: 1,
      formulariosRespondidos: 1,
      mensagensRecentes: 2,
      tarefasPendentes: 1,
      materiaisDisponiveis: 1,
      checkinsRecentes: 1,
      notificacoesPendentes: 1,
      notificacoesHistorico: 2
    });
    expect(portal.perfil).toEqual({
      contato: 'ana@example.com',
      email: 'ana@example.com',
      whatsapp: undefined,
      preferenciasContato: {
        email: true,
        whatsapp: true,
        canalPreferido: 'qualquer',
        horarioPermitido: { inicio: '08:00', fim: '20:00', timezone: 'America/Sao_Paulo' }
      },
      dataNascimento: '1990-04-15',
      profissionalResponsavelId: 'profissional-1',
      ultimoCheckinEm: new Date('2026-07-20T12:00:00.000Z')
    });
    expect(portal.consultasProximas).toEqual([
      expect.objectContaining({ id: 'consulta-1', titulo: 'Consulta nutricional', local: 'Online' })
    ]);
    expect(portal.formulariosPendentes).toEqual([
      expect.objectContaining({
        envioId: 'envio-1',
        questionarioId: 'questionario-1',
        titulo: 'Check-in semanal',
        status: 'enviado',
        linkFormulario: expect.stringContaining('/formularios/')
      })
    ]);
    expect(portal.formulariosRespondidos).toEqual([
      expect.objectContaining({
        respostaId: 'resposta-1',
        envioId: 'envio-2',
        questionarioId: 'questionario-2',
        titulo: 'Respondido',
        scoreFinal: '87.40',
        finalizadoEm: new Date('2026-07-19T12:05:00.000Z')
      })
    ]);
    expect(portal.mensagensRecentes).toEqual([
      expect.objectContaining({ id: 'mensagem-pendente-1', titulo: 'Lembrete de consulta', texto: 'Sua consulta sera amanha.' }),
      expect.objectContaining({ id: 'mensagem-1', titulo: 'Consulta agendada', texto: 'Sua consulta foi agendada.' })
    ]);
    expect(portalComPlano.notificacoesPaciente).toEqual([
      expect.objectContaining({
        id: 'mensagem-pendente-1',
        canal: 'whatsapp',
        titulo: 'Lembrete de consulta',
        texto: 'Sua consulta sera amanha.',
        status: 'pendente',
        evento: 'agenda.consulta.lembrete',
        criadoEm: new Date('2026-07-21T14:00:00.000Z'),
        agendadoPara: new Date('2026-08-09T13:00:00.000Z')
      }),
      expect.objectContaining({
        id: 'mensagem-1',
        canal: 'email',
        titulo: 'Consulta agendada',
        texto: 'Sua consulta foi agendada.',
        status: 'enviado',
        evento: 'agenda.consulta.agendada',
        criadoEm: new Date('2026-07-20T14:00:00.000Z'),
        enviadoEm: new Date('2026-07-20T14:01:00.000Z')
      })
    ]);
    expect(portalComPlano.tarefasAcompanhamento).toEqual([
      expect.objectContaining({
        id: 'tarefa-1',
        titulo: 'Registrar agua diariamente',
        descricao: 'Meta de 2 litros por dia.',
        categoria: 'meta',
        prioridade: 'alta',
        status: 'pendente',
        vencimentoEm: new Date('2026-08-05T12:00:00.000Z')
      })
    ]);
    expect(portalComPlano.materiaisDisponiveis).toEqual([
      expect.objectContaining({
        id: 'envio-material-1',
        materialId: 'material-1',
        titulo: 'Guia de hidratacao',
        tipo: 'link',
        categoria: 'Habitos',
        resumo: 'Orientacoes para hidratar melhor.',
        url: 'https://materiais.octaclin.test/hidratacao',
        observacao: 'Ler antes da proxima consulta.',
        status: 'enviado'
      })
    ]);
    expect(portalComPlano.diariosRecentes).toEqual([
      expect.objectContaining({
        id: 'diario-1',
        tipo: 'humor',
        humor: 'bem',
        adesaoPlano: 80,
        sintomas: 'Sono leve',
        observacoes: 'Consegui seguir o plano no almoco.',
        registradoEm: new Date('2026-07-23T10:00:00.000Z')
      })
    ]);
    expect(portal.lgpd).toEqual({
      versaoAtual: '2026-07',
      ultimoAceiteEm: new Date('2026-07-10T10:00:00.000Z'),
      documentosLegais: [
        expect.objectContaining({
          tipo: 'termos_uso',
          titulo: 'Termos de uso',
          versao: '2026-07',
          perfil: 'paciente',
          obrigatorio: true,
          aceito: false
        }),
        expect.objectContaining({
          tipo: 'politica_privacidade',
          titulo: 'Politica de privacidade',
          versao: '2026-07',
          perfil: 'paciente',
          obrigatorio: true,
          aceito: false
        }),
        expect.objectContaining({
          tipo: 'consentimento_lgpd',
          titulo: 'Consentimento LGPD',
          versao: '2026-07',
          perfil: 'paciente',
          obrigatorio: true,
          aceito: false
        })
      ],
      consentimentos: [
        {
          id: 'consentimento-1',
          tipo: 'primeiro_acesso_paciente',
          versao: '2026-07',
          aceitoEm: new Date('2026-07-10T10:00:00.000Z'),
          metadados: { origem: 'primeiro_acesso' }
        }
      ],
      solicitacoes: []
    });
  });

  it('deve rejeitar usuario sem paciente vinculado', async () => {
    const { servico } = criarServico({ pacientes: [], consultas: [], envios: [], questionarios: [], mensagens: [] });

    await expect(servico.obterResumoPortal('tenant-1', 'usuario-sem-paciente')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deve registrar check-in rapido no paciente vinculado ao usuario logado', async () => {
    const { servico, repositorios } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula'),
          profissionalResponsavelId: 'profissional-1',
          statusAdesao: 'aderente',
          scoreRisco: '12.50'
        }
      ],
      consultas: [],
      envios: [],
      questionarios: [],
      mensagens: [],
      diarios: [],
      sincronizacaos: []
    });

    const checkin = await (servico as any).registrarCheckinRapido('tenant-1', 'usuario-paciente-1', {
      humor: 'bem',
      adesaoPlano: 80,
      sintomas: 'Sono leve',
      observacoes: 'Consegui seguir o plano no almoco.'
    });

    expect(checkin).toEqual(
      expect.objectContaining({
        pacienteId: 'paciente-1',
        tipo: 'humor',
        humor: 'bem',
        adesaoPlano: 80,
        sintomas: 'Sono leve',
        observacoes: 'Consegui seguir o plano no almoco.',
        registradoEm: expect.any(Date)
      })
    );
    expect(repositorios.diario.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        pacienteId: 'paciente-1',
        tipo: 'humor',
        valor: {
          humor: 'bem',
          adesaoPlano: 80,
          sintomas: 'Sono leve',
          observacoes: 'Consegui seguir o plano no almoco.',
          origem: 'portal_paciente'
        },
        registradoEm: expect.any(Date)
      })
    );
    expect(repositorios.paciente.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'paciente-1',
        ultimoCheckinEm: expect.any(Date)
      })
    );
  });

  it('deve reaproveitar check-in quando a mesma operacao offline for reenviada', async () => {
    const dados = {
      pacientes: [{
        id: 'paciente-1', tenantId: 'tenant-1', usuarioId: 'usuario-paciente-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paula'), arquivadoEm: null
      }],
      consultas: [], envios: [], questionarios: [], mensagens: [],
      diarios: [], sincronizacaos: []
    };
    const { servico, repositorios } = criarServico(dados);
    const entrada = { idLocal: 'pwa-checkin-1', humor: 'bem' as const, adesaoPlano: 80 };

    const primeiro = await servico.registrarCheckinRapido('tenant-1', 'usuario-paciente-1', entrada);
    const repetido = await servico.registrarCheckinRapido('tenant-1', 'usuario-paciente-1', entrada);

    expect(repetido.id).toBe(primeiro.id);
    expect(dados.diarios).toHaveLength(1);
    expect(dados.sincronizacaos).toHaveLength(1);
    expect(repositorios.paciente.findOne).toHaveBeenCalledWith(expect.objectContaining({
      lock: { mode: 'pessimistic_write' }
    }));
  });

  it('deve rejeitar fila offline vinculada a outro paciente', async () => {
    const dados = {
      pacientes: [{
        id: '11111111-1111-4111-8111-111111111111', tenantId: 'tenant-1',
        usuarioId: 'usuario-paciente-1', nomeCriptografado: Buffer.from('cripto:Ana'), arquivadoEm: null
      }],
      consultas: [], envios: [], questionarios: [], mensagens: [], diarios: [], sincronizacaos: []
    };
    const { servico } = criarServico(dados);

    await expect(servico.registrarCheckinRapido('tenant-1', 'usuario-paciente-1', {
      idLocal: 'pwa-checkin-outra-conta',
      pacienteIdEsperado: '22222222-2222-4222-8222-222222222222',
      humor: 'bem',
      adesaoPlano: 80
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(dados.diarios).toHaveLength(0);
  });

  it('deve mostrar protocolos LGPD do paciente com status operacional consolidado', async () => {
    const { servico } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula'),
          profissionalResponsavelId: 'profissional-1',
          statusAdesao: 'aderente'
        }
      ],
      consultas: [],
      envios: [],
      questionarios: [],
      mensagens: [],
      consentimentos: [
        {
          id: 'solicitacao-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          tipo: 'solicitacao_lgpd_retificacao',
          versao: '2026-07',
          aceitoEm: new Date('2026-07-22T10:00:00.000Z'),
          metadados: {
            pacienteId: 'paciente-1',
            protocolo: 'LGPD-123',
            status: 'recebida',
            detalhes: 'Atualizar telefone cadastrado.'
          }
        },
        {
          id: 'tratativa-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-admin-1',
          tipo: 'tratativa_lgpd',
          versao: '2026-07',
          aceitoEm: new Date('2026-07-22T11:00:00.000Z'),
          metadados: {
            pacienteId: 'paciente-1',
            protocolo: 'LGPD-123',
            status: 'em_tratamento',
            responsavelId: 'usuario-admin-1',
            detalhes: 'Validando cadastro.'
          }
        },
        {
          id: 'resposta-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-admin-1',
          tipo: 'resposta_lgpd_preparada',
          versao: '2026-07',
          aceitoEm: new Date('2026-07-22T12:00:00.000Z'),
          metadados: {
            pacienteId: 'paciente-1',
            protocolo: 'LGPD-123',
            status: 'em_tratamento',
            assuntoEmail: 'Atualizacao da solicitacao LGPD LGPD-123'
          }
        },
        {
          id: 'solicitacao-outro',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-2',
          tipo: 'solicitacao_lgpd_exclusao',
          versao: '2026-07',
          aceitoEm: new Date('2026-07-22T13:00:00.000Z'),
          metadados: {
            pacienteId: 'paciente-2',
            protocolo: 'LGPD-OUTRO',
            status: 'recebida',
            detalhes: 'Nao deve aparecer.'
          }
        }
      ]
    });

    const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');

    expect(portal.lgpd.solicitacoes).toEqual([
      {
        protocolo: 'LGPD-123',
        pacienteId: 'paciente-1',
        tipo: 'retificacao',
        status: 'em_tratamento',
        detalhes: 'Atualizar telefone cadastrado.',
        abertoEm: new Date('2026-07-22T10:00:00.000Z'),
        atualizadoEm: new Date('2026-07-22T12:00:00.000Z'),
        ultimaTratativa: 'Validando cadastro.',
        ultimaResposta: 'Atualizacao da solicitacao LGPD LGPD-123'
      }
    ]);
    expect(JSON.stringify(portal.lgpd.solicitacoes)).not.toContain('LGPD-OUTRO');
  });

  it('deve detalhar formulario respondido do paciente logado com perguntas e respostas', async () => {
    const finalizadoEm = new Date('2026-07-19T12:05:00.000Z');
    const { servico } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula'),
          profissionalResponsavelId: 'profissional-1',
          statusAdesao: 'aderente',
          scoreRisco: '12.50'
        },
        {
          id: 'paciente-2',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-2',
          nomeCriptografado: Buffer.from('cripto:Outro Paciente')
        }
      ],
      envios: [
        {
          id: 'envio-respondido-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          questionarioId: 'questionario-1',
          status: 'respondido',
          respondidoEm: finalizadoEm
        },
        {
          id: 'envio-outro',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          questionarioId: 'questionario-1',
          status: 'respondido',
          respondidoEm: finalizadoEm
        }
      ],
      questionarios: [{ id: 'questionario-1', tenantId: 'tenant-1', titulo: 'Check-in semanal', descricao: 'Acompanhamento' }],
      perguntas: [
        {
          id: 'pergunta-1',
          tenantId: 'tenant-1',
          questionarioId: 'questionario-1',
          tipo: 'sim_nao',
          enunciado: 'Treinou?',
          obrigatoria: true,
          ordem: 1
        },
        {
          id: 'pergunta-2',
          tenantId: 'tenant-1',
          questionarioId: 'questionario-1',
          tipo: 'texto_longo',
          enunciado: 'Observacoes',
          obrigatoria: false,
          ordem: 2
        }
      ],
      respostaCheckins: [
        {
          id: 'resposta-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          envioQuestionarioId: 'envio-respondido-1',
          scoreFinal: '87.40',
          finalizadoEm
        },
        {
          id: 'resposta-outro',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          envioQuestionarioId: 'envio-outro',
          finalizadoEm
        }
      ],
      respostaValors: [
        { id: 'valor-1', tenantId: 'tenant-1', respostaCheckinId: 'resposta-1', perguntaId: 'pergunta-1', valor: true },
        { id: 'valor-2', tenantId: 'tenant-1', respostaCheckinId: 'resposta-1', perguntaId: 'pergunta-2', valor: 'Dormiu melhor' },
        { id: 'valor-outro', tenantId: 'tenant-1', respostaCheckinId: 'resposta-outro', perguntaId: 'pergunta-1', valor: false }
      ],
      consultas: [],
      mensagens: []
    });

    const detalhe = await servico.obterFormularioRespondido('tenant-1', 'usuario-paciente-1', 'resposta-1');

    expect(detalhe).toEqual(
      expect.objectContaining({
        respostaId: 'resposta-1',
        envioId: 'envio-respondido-1',
        questionarioId: 'questionario-1',
        titulo: 'Check-in semanal',
        descricao: 'Acompanhamento',
        scoreFinal: '87.40',
        finalizadoEm
      })
    );
    expect(detalhe.respostas).toEqual([
      expect.objectContaining({ perguntaId: 'pergunta-1', enunciado: 'Treinou?', tipo: 'sim_nao', valor: true, ordem: 1 }),
      expect.objectContaining({ perguntaId: 'pergunta-2', enunciado: 'Observacoes', tipo: 'texto_longo', valor: 'Dormiu melhor', ordem: 2 })
    ]);
    await expect(servico.obterFormularioRespondido('tenant-1', 'usuario-paciente-1', 'resposta-outro')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deve atualizar perfil do paciente logado com preferencias de contato', async () => {
    const { servico, repositorios } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula'),
          contatoCriptografado: Buffer.from('cripto:ana-antigo@example.com'),
          dataNascimento: '1990-04-15',
          profissionalResponsavelId: 'profissional-1',
          statusAdesao: 'aderente',
          scoreRisco: '12.50'
        },
        {
          id: 'paciente-2',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-2',
          nomeCriptografado: Buffer.from('cripto:Outro Paciente')
        }
      ],
      consultas: [],
      envios: [],
      questionarios: [],
      mensagens: []
    });

    const perfil = await servico.atualizarPerfil('tenant-1', 'usuario-paciente-1', {
      nome: ' Ana Paciente ',
      email: ' ANA@EXAMPLE.COM ',
      whatsapp: ' (11) 99999-8888 ',
      dataNascimento: '1991-05-20',
      prefereEmail: true,
      prefereWhatsapp: false,
      canalPreferido: 'whatsapp',
      horarioInicio: '09:00',
      horarioFim: '18:30',
      timezoneComunicacao: 'America/Sao_Paulo'
    });

    expect(perfil.paciente).toEqual(
      expect.objectContaining({
        id: 'paciente-1',
        nome: 'Ana Paciente'
      })
    );
    expect(perfil.perfil).toEqual(
      expect.objectContaining({
        contato: 'ana@example.com',
        email: 'ana@example.com',
        whatsapp: '11999998888',
        dataNascimento: '1991-05-20',
        preferenciasContato: {
          email: true,
          whatsapp: false,
          canalPreferido: 'whatsapp',
          horarioPermitido: { inicio: '09:00', fim: '18:30', timezone: 'America/Sao_Paulo' }
        }
      })
    );
    expect(repositorios.paciente.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'paciente-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paciente'),
        dataNascimento: '1991-05-20'
      })
    );
    const contatoSalvo = JSON.parse(
      repositorios.paciente.save.mock.calls[0][0].contatoCriptografado.toString('utf8').replace('cripto:', '')
    );
    expect(contatoSalvo).toEqual({
      email: 'ana@example.com',
      whatsapp: '11999998888',
      preferencias: {
        email: true,
        whatsapp: false,
        canalPreferido: 'whatsapp',
        horarioPermitido: { inicio: '09:00', fim: '18:30', timezone: 'America/Sao_Paulo' }
      }
    });

    await expect(servico.atualizarPerfil('tenant-1', 'usuario-paciente-1', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.atualizarPerfil('tenant-1', 'usuario-paciente-2', { email: 'outro@example.com' })).resolves.toEqual(
      expect.objectContaining({ paciente: expect.objectContaining({ id: 'paciente-2' }) })
    );
  });

  it('deve registrar aceite LGPD do paciente logado e atualizar preferencias de comunicacao', async () => {
    const { servico, repositorios } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula'),
          contatoCriptografado: Buffer.from(
            'cripto:{"email":"ana@example.com","whatsapp":"5511992362080","preferencias":{"email":true,"whatsapp":true,"canalPreferido":"whatsapp","horarioPermitido":{"inicio":"09:00","fim":"18:00","timezone":"America/Sao_Paulo"}}}'
          ),
          profissionalResponsavelId: 'profissional-1',
          statusAdesao: 'aderente',
          scoreRisco: '12.50'
        }
      ],
      consultas: [],
      envios: [],
      questionarios: [],
      mensagens: [],
      consentimentos: []
    });

    const resultado = await servico.registrarConsentimentoLgpd('tenant-1', 'usuario-paciente-1', {
      aceiteLgpd: true,
      aceiteTermosUso: true,
      aceitePoliticaPrivacidade: true,
      versaoLgpd: '2026-09',
      versaoTermosUso: '2026-09',
      versaoPoliticaPrivacidade: '2026-09',
      prefereEmail: false,
      prefereWhatsapp: true
    });

    expect(repositorios.consentimento.save).toHaveBeenCalledTimes(3);
    expect(repositorios.consentimento.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-paciente-1',
        tipo: 'termos_uso',
        versao: '2026-09',
        aceitoEm: expect.any(Date),
        metadados: expect.objectContaining({
          pacienteId: 'paciente-1',
          origem: 'portal_paciente',
          perfil: 'paciente',
          documentoLegal: 'termos_uso'
        })
      })
    );
    expect(repositorios.consentimento.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-paciente-1',
        tipo: 'politica_privacidade',
        versao: '2026-09',
        aceitoEm: expect.any(Date),
        metadados: expect.objectContaining({
          pacienteId: 'paciente-1',
          origem: 'portal_paciente',
          perfil: 'paciente',
          documentoLegal: 'politica_privacidade'
        })
      })
    );
    expect(repositorios.consentimento.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-paciente-1',
        tipo: 'consentimento_lgpd',
        versao: '2026-09',
        aceitoEm: expect.any(Date),
        metadados: expect.objectContaining({
          pacienteId: 'paciente-1',
          origem: 'portal_paciente',
          perfil: 'paciente',
          documentoLegal: 'consentimento_lgpd',
          preferenciasContato: {
            email: false,
            whatsapp: true,
            canalPreferido: 'whatsapp',
            horarioPermitido: { inicio: '09:00', fim: '18:00', timezone: 'America/Sao_Paulo' }
          }
        })
      })
    );
    expect(repositorios.paciente.save).toHaveBeenCalledWith(
      expect.objectContaining({
        contatoCriptografado: Buffer.from(
          'cripto:{"email":"ana@example.com","whatsapp":"5511992362080","preferencias":{"email":false,"whatsapp":true,"canalPreferido":"whatsapp","horarioPermitido":{"inicio":"09:00","fim":"18:00","timezone":"America/Sao_Paulo"}}}'
        )
      })
    );
    expect(resultado.perfil.preferenciasContato).toEqual({
      email: false,
      whatsapp: true,
      canalPreferido: 'whatsapp',
      horarioPermitido: { inicio: '09:00', fim: '18:00', timezone: 'America/Sao_Paulo' }
    });
    expect(resultado.lgpd.consentimentos).toEqual([
      expect.objectContaining({ tipo: 'termos_uso', versao: '2026-09' }),
      expect.objectContaining({ tipo: 'politica_privacidade', versao: '2026-09' }),
      expect.objectContaining({ tipo: 'consentimento_lgpd', versao: '2026-09' })
    ]);

    await expect(
      servico.registrarConsentimentoLgpd('tenant-1', 'usuario-paciente-1', {
        aceiteLgpd: true,
        aceiteTermosUso: false,
        aceitePoliticaPrivacidade: true
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve exportar dados LGPD do paciente logado sem dados de outro paciente', async () => {
    const { servico } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula'),
          contatoCriptografado: Buffer.from('cripto:ana@example.com'),
          profissionalResponsavelId: 'profissional-1',
          statusAdesao: 'aderente',
          scoreRisco: '12.50'
        },
        {
          id: 'paciente-2',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-2',
          nomeCriptografado: Buffer.from('cripto:Outro Paciente')
        }
      ],
      consultas: [
        {
          id: 'consulta-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          titulo: 'Consulta nutricional',
          inicioEm: new Date('2026-08-10T13:00:00.000Z'),
          fimEm: new Date('2026-08-10T13:50:00.000Z'),
          status: 'agendada',
          local: 'Online'
        },
        {
          id: 'consulta-outro',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          titulo: 'Consulta de outro paciente',
          inicioEm: new Date('2026-08-10T13:00:00.000Z'),
          fimEm: new Date('2026-08-10T13:50:00.000Z'),
          status: 'agendada'
        }
      ],
      envios: [
        {
          id: 'envio-respondido-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          questionarioId: 'questionario-1',
          status: 'respondido',
          respondidoEm: new Date('2026-07-19T12:00:00.000Z')
        },
        {
          id: 'envio-outro',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          questionarioId: 'questionario-outro',
          status: 'respondido',
          respondidoEm: new Date('2026-07-19T12:00:00.000Z')
        }
      ],
      questionarios: [
        {
          id: 'questionario-1',
          tenantId: 'tenant-1',
          titulo: 'Recordatorio alimentar',
          descricao: 'Resumo alimentar'
        },
        {
          id: 'questionario-outro',
          tenantId: 'tenant-1',
          titulo: 'Formulario de outro paciente'
        }
      ],
      respostaCheckins: [
        {
          id: 'resposta-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          envioQuestionarioId: 'envio-respondido-1',
          scoreFinal: '87.40',
          finalizadoEm: new Date('2026-07-19T12:05:00.000Z')
        },
        {
          id: 'resposta-outro',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-2',
          envioQuestionarioId: 'envio-outro',
          scoreFinal: '10.00',
          finalizadoEm: new Date('2026-07-19T12:05:00.000Z')
        }
      ],
      perguntas: [
        {
          id: 'pergunta-1',
          tenantId: 'tenant-1',
          questionarioId: 'questionario-1',
          enunciado: 'Como foi sua adesao?',
          tipo: 'texto_longo',
          obrigatoria: true,
          ordem: 1
        },
        {
          id: 'pergunta-outro',
          tenantId: 'tenant-1',
          questionarioId: 'questionario-outro',
          enunciado: 'Pergunta de outro paciente',
          tipo: 'texto_longo',
          obrigatoria: true,
          ordem: 1
        }
      ],
      respostaValors: [
        {
          id: 'valor-1',
          tenantId: 'tenant-1',
          respostaCheckinId: 'resposta-1',
          perguntaId: 'pergunta-1',
          valor: 'Mantive boa adesao durante a semana.',
          scorePonderado: '87.40'
        },
        {
          id: 'valor-outro',
          tenantId: 'tenant-1',
          respostaCheckinId: 'resposta-outro',
          perguntaId: 'pergunta-outro',
          valor: 'Dado de outro paciente'
        }
      ],
      mensagens: [
        {
          id: 'mensagem-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          status: 'enviado',
          payload: { canal: 'email', assunto: 'Consulta agendada', texto: 'Sua consulta foi agendada.' },
          criadoEm: new Date('2026-07-22T12:00:00.000Z')
        }
      ],
      consentimentos: [
        {
          id: 'consentimento-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          tipo: 'consentimento_lgpd',
          versao: '2026-09',
          aceitoEm: new Date('2026-07-10T10:00:00.000Z'),
          metadados: { pacienteId: 'paciente-1', origem: 'primeiro_acesso' }
        }
      ],
      tarefas: [
        {
          id: 'tarefa-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          titulo: 'Enviar medidas',
          categoria: 'checkin',
          prioridade: 'media',
          status: 'pendente',
          criadoEm: new Date('2026-07-20T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-20T10:00:00.000Z')
        }
      ],
      materiais: [
        {
          id: 'material-1',
          tenantId: 'tenant-1',
          titulo: 'Guia de hidratacao',
          tipo: 'pdf',
          ativo: true
        }
      ],
      envioMaterials: [
        {
          id: 'envio-material-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          materialId: 'material-1',
          status: 'enviado',
          enviadoEm: new Date('2026-07-22T13:00:00.000Z'),
          criadoEm: new Date('2026-07-22T13:00:00.000Z'),
          atualizadoEm: new Date('2026-07-22T13:00:00.000Z')
        }
      ],
      diarios: [
        {
          id: 'diario-1',
          tenantId: 'tenant-1',
          pacienteId: 'paciente-1',
          valor: { humor: 'bem', adesaoPlano: 80, sintomas: 'Sono leve' },
          registradoEm: new Date('2026-07-23T10:00:00.000Z')
        }
      ]
    });

    const exportacao = await servico.exportarDadosLgpd('tenant-1', 'usuario-paciente-1');

    expect(exportacao).toEqual(
      expect.objectContaining({
        geradoEm: expect.any(Date),
        formato: 'octaclin.lgpd.exportacao_paciente.v1',
        titular: expect.objectContaining({
          pacienteId: 'paciente-1',
          nome: 'Ana Paula',
          email: 'ana@example.com'
        }),
        escopo: expect.objectContaining({
          categorias: ['perfil', 'consultas', 'formularios', 'comunicacoes', 'acompanhamento', 'lgpd']
        }),
        pacote: expect.objectContaining({
          perfil: expect.objectContaining({
            paciente: expect.objectContaining({ id: 'paciente-1', nome: 'Ana Paula' })
          }),
          consultas: expect.arrayContaining([expect.objectContaining({ id: 'consulta-1', titulo: 'Consulta nutricional' })]),
          formularios: expect.objectContaining({
            respondidos: [
              expect.objectContaining({
                respostaId: 'resposta-1',
                titulo: 'Recordatorio alimentar',
                respostas: [
                  expect.objectContaining({
                    perguntaId: 'pergunta-1',
                    valor: 'Mantive boa adesao durante a semana.'
                  })
                ]
              })
            ]
          }),
          comunicacoes: expect.objectContaining({
            notificacoes: expect.arrayContaining([expect.objectContaining({ id: 'mensagem-1', titulo: 'Consulta agendada' })])
          }),
          acompanhamento: expect.objectContaining({
            tarefas: expect.arrayContaining([expect.objectContaining({ id: 'tarefa-1', titulo: 'Enviar medidas' })]),
            materiais: expect.arrayContaining([expect.objectContaining({ id: 'envio-material-1', titulo: 'Guia de hidratacao' })]),
            diarios: expect.arrayContaining([expect.objectContaining({ id: 'diario-1', humor: 'bem' })])
          }),
          lgpd: expect.objectContaining({
            consentimentos: expect.arrayContaining([expect.objectContaining({ id: 'consentimento-1', tipo: 'consentimento_lgpd' })])
          })
        }),
        integridade: expect.objectContaining({
          algoritmo: 'sha256',
          hash: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      })
    );
    expect(JSON.stringify(exportacao)).not.toContain('Outro Paciente');
  });

  it('deve registrar solicitacao LGPD com protocolo no historico do paciente', async () => {
    const { servico, repositorios } = criarServico({
      pacientes: [
        {
          id: 'paciente-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          nomeCriptografado: Buffer.from('cripto:Ana Paula'),
          profissionalResponsavelId: 'profissional-1',
          statusAdesao: 'aderente',
          scoreRisco: '12.50'
        }
      ],
      consultas: [],
      envios: [],
      questionarios: [],
      mensagens: [],
      consentimentos: []
    });

    const solicitacao = await servico.registrarSolicitacaoLgpd('tenant-1', 'usuario-paciente-1', {
      tipo: 'retificacao',
      detalhes: 'Atualizar telefone cadastrado.'
    });

    expect(solicitacao).toEqual(
      expect.objectContaining({
        pacienteId: 'paciente-1',
        tipo: 'retificacao',
        status: 'recebida',
        protocolo: expect.stringMatching(/^LGPD-/),
        criadoEm: expect.any(Date)
      })
    );
    expect(repositorios.consentimento.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-paciente-1',
        tipo: 'solicitacao_lgpd_retificacao',
        metadados: expect.objectContaining({
          pacienteId: 'paciente-1',
          protocolo: solicitacao.protocolo,
          status: 'recebida',
          detalhes: 'Atualizar telefone cadastrado.'
        })
      })
    );
  });

  describe('trocas liberadas ao paciente', () => {
    const PUBLICADO_EM = new Date('2026-08-08T12:00:00.000Z');

    function cenario(
      substituicoes: Record<string, any>[],
      extraItem: Record<string, any> = {},
      escolhas: Record<string, any>[] = []
    ) {
      return criarServico({
        pacientes: [
          {
            id: 'paciente-1',
            tenantId: 'tenant-1',
            usuarioId: 'usuario-paciente-1',
            nomeCriptografado: Buffer.from('cripto:Ana Paula'),
            profissionalResponsavelId: 'profissional-1',
            statusAdesao: 'aderente'
          }
        ],
        planoAlimentars: [
          {
            id: 'plano-1',
            tenantId: 'tenant-1',
            pacienteId: 'paciente-1',
            tituloCriptografado: Buffer.from('cripto:Plano'),
            versaoPublicadaAtualId: 'versao-1',
            criadoEm: new Date('2026-08-01T12:00:00.000Z')
          }
        ],
        planoAlimentarVersaos: [
          {
            id: 'versao-1',
            tenantId: 'tenant-1',
            planoId: 'plano-1',
            numero: 1,
            publicadaEm: PUBLICADO_EM,
            calculoSnapshotCriptografado: Buffer.from('cripto:{}'),
            totaisSnapshotCriptografado: Buffer.from('cripto:{}')
          }
        ],
        planoAlimentarRefeicaos: [
          {
            id: 'refeicao-1',
            tenantId: 'tenant-1',
            versaoId: 'versao-1',
            ordem: 1,
            nomeCriptografado: Buffer.from('cripto:Cafe')
          }
        ],
        planoAlimentarItems: [
          {
            id: 'item-1',
            tenantId: 'tenant-1',
            refeicaoId: 'refeicao-1',
            ordem: 1,
            descricaoCriptografada: Buffer.from('cripto:Mamao'),
            quantidade: '1.000',
            unidade: 'fatia',
            porcaoGramas: '100.000',
            composicaoSnapshotCriptografada: Buffer.from('cripto:{"nutrientesPorcao":{"energiaKcal":45}}'),
            ...extraItem
          }
        ],
        planoAlimentarSubstituicaos: substituicoes,
        planoAlimentarEscolhas: escolhas
      });
    }

    function alternativa(id: string, ordem: number, extra: Record<string, any>) {
      return {
        id,
        tenantId: 'tenant-1',
        itemId: 'item-1',
        ordem,
        descricaoCriptografada: Buffer.from('cripto:' + id),
        quantidade: '1.000',
        unidade: 'fatia',
        porcaoGramas: '100.000',
        composicaoSnapshotCriptografada: Buffer.from('cripto:{"nutrientesPorcao":{"energiaKcal":29}}'),
        ...extra
      };
    }

    it('esconde do paciente a alternativa que o profissional nao liberou', async () => {
      const { servico } = cenario([
        alternativa('liberada', 1, { liberadaParaPaciente: true, preferida: false }),
        alternativa('interna', 2, { liberadaParaPaciente: false, preferida: false })
      ]);

      const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');

      expect(portal.planoAlimentar!.refeicoes[0].itens[0].substituicoes.map((troca) => troca.id)).toEqual([
        'liberada'
      ]);
    });

    it('coloca as preferidas na frente sem perder a ordem dentro do grupo', async () => {
      const { servico } = cenario([
        alternativa('comum-a', 1, { liberadaParaPaciente: true, preferida: false }),
        alternativa('preferida-b', 2, { liberadaParaPaciente: true, preferida: true }),
        alternativa('comum-c', 3, { liberadaParaPaciente: true, preferida: false }),
        alternativa('preferida-d', 4, { liberadaParaPaciente: true, preferida: true })
      ]);

      const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');

      expect(portal.planoAlimentar!.refeicoes[0].itens[0].substituicoes.map((troca) => troca.id)).toEqual([
        'preferida-b',
        'preferida-d',
        'comum-a',
        'comum-c'
      ]);
    });

    it('entrega o limite de exibicao definido pelo profissional', async () => {
      const { servico } = cenario(
        [alternativa('liberada', 1, { liberadaParaPaciente: true, preferida: false })],
        { substituicoesVisiveisInicialmente: 1 }
      );

      const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');

      expect(portal.planoAlimentar!.refeicoes[0].itens[0].substituicoesVisiveisInicialmente).toBe(1);
    });

    it('devolve a escolha vigente, que e a ultima da trilha e nao a unica', async () => {
      const { servico } = cenario(
        [
          alternativa('troca-a', 1, { liberadaParaPaciente: true, preferida: false }),
          alternativa('troca-b', 2, { liberadaParaPaciente: true, preferida: false })
        ],
        {},
        [
          {
            id: 'escolha-1',
            tenantId: 'tenant-1',
            versaoId: 'versao-1',
            itemId: 'item-1',
            substituicaoId: 'troca-a',
            escolhidoPorUsuarioId: 'usuario-paciente-1',
            criadoEm: new Date('2026-08-09T10:00:00.000Z')
          },
          {
            id: 'escolha-2',
            tenantId: 'tenant-1',
            versaoId: 'versao-1',
            itemId: 'item-1',
            substituicaoId: 'troca-b',
            escolhidoPorUsuarioId: 'usuario-paciente-1',
            criadoEm: new Date('2026-08-10T10:00:00.000Z')
          }
        ]
      );

      const portal = await servico.obterResumoPortal('tenant-1', 'usuario-paciente-1');

      expect(portal.planoAlimentar!.refeicoes[0].itens[0].escolhaAtualSubstituicaoId).toBe('troca-b');
    });

    it('registra a escolha como evento novo, sem tocar na versao publicada', async () => {
      const { servico, repositorios } = cenario([
        alternativa('troca-a', 1, { liberadaParaPaciente: true, preferida: false })
      ]);

      const escolha = await servico.registrarEscolhaSubstituicao('tenant-1', 'usuario-paciente-1', 'item-1', {
        substituicaoId: 'troca-a'
      });

      expect(escolha).toEqual(
        expect.objectContaining({ itemId: 'item-1', substituicaoId: 'troca-a', versaoId: 'versao-1' })
      );
      expect(repositorios.planoAlimentarVersao.save).not.toHaveBeenCalled();
      expect(repositorios.planoAlimentarSubstituicao.save).not.toHaveBeenCalled();
    });

    it('aceita o retorno ao alimento principal como decisao registrada', async () => {
      const { servico } = cenario([alternativa('troca-a', 1, { liberadaParaPaciente: true, preferida: false })]);

      const escolha = await servico.registrarEscolhaSubstituicao('tenant-1', 'usuario-paciente-1', 'item-1', {});

      expect(escolha.substituicaoId).toBeUndefined();
    });

    it('recusa escolher alternativa que o profissional nao liberou', async () => {
      const { servico } = cenario([alternativa('interna', 1, { liberadaParaPaciente: false, preferida: false })]);

      await expect(
        servico.registrarEscolhaSubstituicao('tenant-1', 'usuario-paciente-1', 'item-1', { substituicaoId: 'interna' })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('recusa alternativa que pertence a outro item', async () => {
      const { servico } = cenario([
        alternativa('troca-a', 1, { liberadaParaPaciente: true, preferida: false }),
        { ...alternativa('troca-alheia', 1, { liberadaParaPaciente: true, preferida: false }), itemId: 'item-9' }
      ]);

      await expect(
        servico.registrarEscolhaSubstituicao('tenant-1', 'usuario-paciente-1', 'item-1', {
          substituicaoId: 'troca-alheia'
        })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('recusa registrar troca em versao que nao e a publicada atual', async () => {
      const { servico, repositorios } = cenario([
        alternativa('troca-a', 1, { liberadaParaPaciente: true, preferida: false })
      ]);
      // Versao antiga: a publicacao atual do plano ja e outra.
      const plano = (await repositorios.planoAlimentar.findOne({ where: { id: 'plano-1' } })) as Record<string, unknown>;
      plano.versaoPublicadaAtualId = 'versao-2';

      await expect(
        servico.registrarEscolhaSubstituicao('tenant-1', 'usuario-paciente-1', 'item-1', {})
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa item que nao pertence ao plano publicado do paciente', async () => {
      const { servico } = cenario([alternativa('troca-a', 1, { liberadaParaPaciente: true, preferida: false })]);

      await expect(
        servico.registrarEscolhaSubstituicao('tenant-1', 'usuario-paciente-1', 'item-fantasma', {})
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
