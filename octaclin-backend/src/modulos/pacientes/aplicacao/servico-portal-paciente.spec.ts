import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { EnvioQuestionarioOrm } from '../../questionarios/infraestrutura/envio-questionario.orm';
import { PerguntaOrm } from '../../questionarios/infraestrutura/pergunta.orm';
import { QuestionarioOrm } from '../../questionarios/infraestrutura/questionario.orm';
import { RespostaCheckinOrm } from '../../questionarios/infraestrutura/resposta-checkin.orm';
import { RespostaValorOrm } from '../../questionarios/infraestrutura/resposta-valor.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoPortalPaciente } from './servico-portal-paciente';

function criarRepositorioFake(nome: string, dados: Record<string, any>) {
  const chaveColecao = nome === 'mensagem' ? 'mensagens' : `${nome}s`;
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
    consentimento: criarRepositorioFake('consentimento', dados)
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
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
  };
  const criptografia = {
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8').replace('cripto:', '')),
    criptografar: jest.fn((valor: string) => Buffer.from(`cripto:${valor}`))
  };

  return { servico: new ServicoPortalPaciente(executorTenant as never, criptografia as never), repositorios };
}

describe('ServicoPortalPaciente', () => {
  beforeEach(() => {
    process.env.OCTACLIN_WEB_URL = 'https://app.octaclin.test';
    process.env.FORMULARIO_PUBLICO_SEGREDO = 'segredo-teste-formulario';
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
          status: 'enviado',
          payload: { assunto: 'Consulta agendada', texto: 'Sua consulta foi agendada.' },
          criadoEm: new Date('2026-07-20T14:00:00.000Z'),
          enviadoEm: new Date('2026-07-20T14:01:00.000Z')
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

    expect(portal.paciente).toEqual(
      expect.objectContaining({
        id: 'paciente-1',
        nome: 'Ana Paula',
        statusAdesao: 'aderente',
        scoreRisco: '12.50'
      })
    );
    expect(portal.resumo).toEqual({ consultasProximas: 1, formulariosPendentes: 1, formulariosRespondidos: 1, mensagensRecentes: 1 });
    expect(portal.perfil).toEqual({
      contato: 'ana@example.com',
      email: 'ana@example.com',
      whatsapp: undefined,
      preferenciasContato: { email: true, whatsapp: true },
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
      expect.objectContaining({ id: 'mensagem-1', titulo: 'Consulta agendada', texto: 'Sua consulta foi agendada.' })
    ]);
    expect(portal.lgpd).toEqual({
      versaoAtual: '2026-07',
      ultimoAceiteEm: new Date('2026-07-10T10:00:00.000Z'),
      consentimentos: [
        {
          id: 'consentimento-1',
          tipo: 'primeiro_acesso_paciente',
          versao: '2026-07',
          aceitoEm: new Date('2026-07-10T10:00:00.000Z'),
          metadados: { origem: 'primeiro_acesso' }
        }
      ]
    });
  });

  it('deve rejeitar usuario sem paciente vinculado', async () => {
    const { servico } = criarServico({ pacientes: [], consultas: [], envios: [], questionarios: [], mensagens: [] });

    await expect(servico.obterResumoPortal('tenant-1', 'usuario-sem-paciente')).rejects.toBeInstanceOf(ForbiddenException);
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
      prefereWhatsapp: false
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
        preferenciasContato: { email: true, whatsapp: false }
      })
    );
    expect(repositorios.paciente.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'paciente-1',
        nomeCriptografado: Buffer.from('cripto:Ana Paciente'),
        contatoCriptografado: Buffer.from(
          'cripto:{"email":"ana@example.com","whatsapp":"11999998888","preferencias":{"email":true,"whatsapp":false}}'
        ),
        dataNascimento: '1991-05-20'
      })
    );

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
            'cripto:{"email":"ana@example.com","whatsapp":"5511992362080","preferencias":{"email":true,"whatsapp":true}}'
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
      versaoLgpd: '2026-09',
      prefereEmail: false,
      prefereWhatsapp: true
    });

    expect(repositorios.consentimento.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-paciente-1',
        tipo: 'portal_paciente_lgpd',
        versao: '2026-09',
        aceitoEm: expect.any(Date),
        metadados: {
          pacienteId: 'paciente-1',
          origem: 'portal_paciente',
          preferenciasContato: { email: false, whatsapp: true }
        }
      })
    );
    expect(repositorios.paciente.save).toHaveBeenCalledWith(
      expect.objectContaining({
        contatoCriptografado: Buffer.from(
          'cripto:{"email":"ana@example.com","whatsapp":"5511992362080","preferencias":{"email":false,"whatsapp":true}}'
        )
      })
    );
    expect(resultado.perfil.preferenciasContato).toEqual({ email: false, whatsapp: true });
    expect(resultado.lgpd.consentimentos).toEqual([
      expect.objectContaining({ tipo: 'portal_paciente_lgpd', versao: '2026-09' })
    ]);

    await expect(
      servico.registrarConsentimentoLgpd('tenant-1', 'usuario-paciente-1', { aceiteLgpd: false })
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
      consultas: [],
      envios: [],
      questionarios: [],
      mensagens: [],
      consentimentos: []
    });

    const exportacao = await servico.exportarDadosLgpd('tenant-1', 'usuario-paciente-1');

    expect(exportacao).toEqual(
      expect.objectContaining({
        geradoEm: expect.any(Date),
        titular: {
          pacienteId: 'paciente-1',
          nome: 'Ana Paula',
          email: 'ana@example.com'
        },
        dados: expect.objectContaining({
          paciente: expect.objectContaining({ id: 'paciente-1', nome: 'Ana Paula' })
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
});
