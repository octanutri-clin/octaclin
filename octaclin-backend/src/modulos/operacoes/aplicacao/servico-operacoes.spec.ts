import { NotFoundException } from '@nestjs/common';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { SincronizacaoMobileOrm } from '../../mobile/infraestrutura/sincronizacao-mobile.orm';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { ServicoOperacoes } from './servico-operacoes';

function criarServico(
  opcoes: {
    health?: Record<string, unknown>;
  } = {}
) {
  const eventoFalho = {
    id: 'evento-1',
    tenantId: 'tenant-1',
    tipo: 'notificacao.enviar',
    payload: { mensagemId: 'mensagem-1' },
    status: 'falhou',
    tentativas: 3,
    erro: 'Redis indisponivel',
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    processadoEm: new Date()
  };
  const mensagens = [
    {
      id: 'mensagem-email-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      canalId: 'canal-email',
      templateId: 'template-email',
      status: 'falhou',
      payload: { destino: 'ana@example.com', evento: 'agenda.consulta.lembrete' },
      erro: 'SMTP indisponivel',
      criadoEm: new Date('2026-07-22T12:00:00.000Z')
    },
    {
      id: 'mensagem-whatsapp-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      canalId: 'canal-whatsapp',
      templateId: 'template-whatsapp',
      status: 'falhou',
      payload: { destino: '5511992362080', evento: 'agenda.consulta.lembrete' },
      erro: 'Token Meta expirado',
      criadoEm: new Date('2026-07-22T13:00:00.000Z')
    }
  ];
  const canais = [
    { id: 'canal-email', tenantId: 'tenant-1', tipo: 'email', nome: 'Email' },
    { id: 'canal-whatsapp', tenantId: 'tenant-1', tipo: 'whatsapp', nome: 'WhatsApp' }
  ];
  const consultas = [
    {
      id: 'consulta-google-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      profissionalId: 'profissional-1',
      titulo: 'Consulta - Ana Paula',
      inicioEm: new Date('2026-07-23T12:00:00.000Z'),
      fimEm: new Date('2026-07-23T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      status: 'agendada',
      notificacoes: {
        googleCalendar: {
          sincronizado: false,
          motivo: 'falha_google_calendar',
          erro: 'Refresh token revogado'
        }
      },
      payload: { pacienteNome: 'Ana Paula' },
      criadoEm: new Date('2026-07-22T14:00:00.000Z'),
      atualizadoEm: new Date('2026-07-22T14:05:00.000Z')
    }
  ];
  const configuracoes = [
    {
      id: 'plano-1',
      tenantId: 'tenant-1',
      chave: 'plano_saas',
      valor: {
        planoId: 'profissional',
        status: 'trial',
        origem: 'manual_admin',
        renovacaoEm: '2026-08-22T00:00:00.000Z'
      },
      criadoEm: new Date('2026-07-20T10:00:00.000Z')
    },
    {
      id: 'interesse-1',
      tenantId: 'tenant-1',
      chave: 'assinatura_interesse',
      valor: {
        acao: 'upgrade',
        status: 'pendente',
        planoAtualId: 'profissional',
        planoAtual: 'Profissional',
        planoDesejado: 'clinica',
        observacao: 'Mais usuarios administrativos.',
        solicitadoPorUsuarioId: 'cliente-1',
        solicitadoEm: '2026-07-22T10:00:00.000Z'
      },
      criadoEm: new Date('2026-07-22T10:00:00.000Z')
    }
  ];
  const repositorios: Record<string, any> = {
    outbox: {
      count: jest.fn(async ({ where }: { where: { status: string } }) => {
        if ('criadoEm' in where) {
          if (where.status === 'pendente') return 4;
          if (where.status === 'processando') return 0;
          return 4;
        }
        const mapa: Record<string, number> = { pendente: 2, processando: 1, processado: 10, falhou: 3 };
        return mapa[where.status] ?? 0;
      }),
      find: jest.fn(async () => [eventoFalho]),
      findAndCount: jest.fn(async () => [[eventoFalho], 1]),
      findOne: jest.fn(async ({ where }: { where: { id: string; status: string } }) =>
        where.id === 'evento-1' && where.status === 'falhou' ? eventoFalho : null
      ),
      save: jest.fn(async (evento: Record<string, unknown>) => evento)
    },
    mensagens: {
      count: jest.fn(async ({ where }: { where: { criadoEm?: unknown } }) => (where.criadoEm ? 2 : 0)),
      find: jest.fn(async () => mensagens),
      findOne: jest.fn(async ({ where }: { where: { id: string; tenantId: string; status?: string } }) =>
        mensagens.find((mensagem) => mensagem.id === where.id && mensagem.tenantId === where.tenantId && (!where.status || mensagem.status === where.status)) ??
        null
      ),
      save: jest.fn(async (mensagem: Record<string, unknown>) => {
        const existente = mensagens.find((item) => item.id === mensagem.id);
        if (existente) Object.assign(existente, mensagem);
        return mensagem;
      })
    },
    canais: {
      find: jest.fn(async () => canais),
      findOne: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        canais.find((canal) => canal.id === where.id && canal.tenantId === where.tenantId) ?? null
      )
    },
    consultas: {
      find: jest.fn(async () => consultas),
      findOne: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        consultas.find((consulta) => consulta.id === where.id && consulta.tenantId === where.tenantId) ?? null
      ),
      save: jest.fn(async (consulta: Record<string, unknown>) => consulta)
    },
    mobile: {
      count: jest.fn(async ({ where }: { where: { status: string; criadoEm?: unknown } }) => {
        if (where.criadoEm) return 3;
        return where.status === 'sincronizado' ? 8 : 1;
      }),
      find: jest.fn(async () => [{ idLocal: 'local-1', status: 'sincronizado' }])
    },
    auditoria: {
      count: jest.fn(async () => 7),
      find: jest.fn(async () => [{ id: 'log-1', acao: 'pacientes.listar_dados_sensiveis', metadados: {} }]),
      findAndCount: jest.fn(async () => [[{ id: 'log-1', acao: 'pacientes.listar_dados_sensiveis', metadados: {} }], 1])
    },
    consentimentos: {
      count: jest.fn(async () => 1),
      find: jest.fn(async () => [
        {
          id: 'consentimento-1',
          tenantId: 'tenant-1',
          usuarioId: 'usuario-paciente-1',
          tipo: 'solicitacao_lgpd_retificacao',
          versao: '2026-09',
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
          versao: '2026-09',
          aceitoEm: new Date('2026-07-22T11:00:00.000Z'),
          metadados: {
            pacienteId: 'paciente-1',
            protocolo: 'LGPD-123',
            status: 'em_tratamento',
            responsavelId: 'usuario-admin-1',
            detalhes: 'Validando cadastro.'
          }
        }
      ]),
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>) => ({ id: 'tratativa-2', ...dados }))
    },
    configuracoes: {
      itens: configuracoes,
      find: jest.fn(async ({ where }: { where: { tenantId: string; chave?: string } }) =>
        configuracoes.filter((item) => item.tenantId === where.tenantId && (!where.chave || item.chave === where.chave))
      ),
      findOne: jest.fn(async ({ where }: { where: { tenantId: string; chave: string } }) =>
        configuracoes.find((item) => item.tenantId === where.tenantId && item.chave === where.chave) ?? null
      ),
      create: jest.fn((dados: Record<string, unknown>) => dados),
      save: jest.fn(async (dados: Record<string, unknown>): Promise<Record<string, unknown>> => {
        const existente = configuracoes.find((item) => item.id === dados.id);
        if (existente) {
          Object.assign(existente, dados);
          return existente;
        }
        const salvo: Record<string, unknown> = {
          id: `config-${repositorios.configuracoes.itens.length + 1}`,
          criadoEm: new Date('2026-07-22T10:00:00.000Z'),
          ...dados
        };
        configuracoes.push(salvo as never);
        return salvo;
      })
    }
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === OutboxEventoOrm) return repositorios.outbox;
      if (entidade === MensagemNotificacaoOrm) return repositorios.mensagens;
      if (entidade === CanalNotificacaoOrm) return repositorios.canais;
      if (entidade === AgendaConsultaOrm) return repositorios.consultas;
      if (entidade === SincronizacaoMobileOrm) return repositorios.mobile;
      if (entidade === UserActionLogOrm) return repositorios.auditoria;
      if (entidade === ConsentimentoLgpdOrm) return repositorios.consentimentos;
      if (entidade === TenantConfiguracaoOrm) return repositorios.configuracoes;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };

  const comunicacoes = {
    publicarEventoNotificacao: jest.fn(async () => undefined)
  };
  const googleCalendar = {
    criarEvento: jest.fn(async () => ({
      sincronizado: true,
      calendarId: 'primary',
      eventId: 'google-event-1',
      htmlLink: 'https://calendar.google/event'
    })),
    atualizarEvento: jest.fn(async () => ({
      sincronizado: true,
      calendarId: 'primary',
      eventId: 'google-event-1',
      htmlLink: 'https://calendar.google/event'
    })),
    cancelarEvento: jest.fn(async () => ({ sincronizado: true, calendarId: 'primary', eventId: 'google-event-1' }))
  };
  const servicoConexaoGoogle = {
    obterConexaoAtiva: jest.fn(async () => undefined)
  };
  const servicoSaude = {
    verificarDetalhado: jest.fn(async () =>
      opcoes.health ?? {
        status: 'degradado',
        checks: {
          backend: { status: 'ok' },
          banco: { status: 'ok' },
          redis: { status: 'degradado', mensagem: 'Redis nao configurado.' },
          email: { status: 'ok' },
          whatsapp: { status: 'ok' },
          googleCalendar: { status: 'degradado', mensagem: 'Google Calendar incompleto.' }
        }
      }
    )
  };

  return {
    servico: new ServicoOperacoes(
      executorTenant as never,
      comunicacoes as never,
      googleCalendar as never,
      servicoConexaoGoogle as never,
      servicoSaude as never
    ),
    repositorios,
    comunicacoes,
    googleCalendar,
    servicoConexaoGoogle,
    servicoSaude
  };
}

describe('ServicoOperacoes', () => {
  it('deve consolidar alertas operacionais por severidade sem expor payload sensivel', async () => {
    const { servico, servicoSaude } = criarServico({
      health: {
        status: 'falha',
        checks: {
          backend: { status: 'ok' },
          banco: { status: 'falha', mensagem: 'database unavailable password=secret' },
          redis: { status: 'degradado', mensagem: 'Redis indisponivel.' },
          email: { status: 'ok' },
          whatsapp: { status: 'degradado', mensagem: 'Token Meta expirado.' },
          googleCalendar: { status: 'ok' }
        }
      }
    });

    await expect(servico.listarAlertasOperacionais('tenant-1')).resolves.toEqual(
      expect.objectContaining({
        status: 'critico',
        resumo: { total: 5, criticos: 2, atencao: 3, informativos: 0 },
        itens: expect.arrayContaining([
          expect.objectContaining({
            id: 'servico.banco.falha',
            origem: 'servico',
            severidade: 'critico',
            titulo: 'Banco indisponivel',
            acaoSugerida: expect.stringContaining('/health/detalhado')
          }),
          expect.objectContaining({
            id: 'fila.outbox.pendente.atrasado',
            origem: 'fila',
            severidade: 'critico',
            metrica: 'outbox_pendente_atrasado',
            valor: 4
          }),
          expect.objectContaining({
            id: 'integracao.whatsapp.degradada',
            origem: 'integracao',
            severidade: 'atencao'
          }),
          expect.objectContaining({
            id: 'integracao.redis.degradada',
            origem: 'integracao',
            severidade: 'atencao'
          }),
          expect.objectContaining({
            id: 'integracao.comunicacoes.falhas',
            origem: 'integracao',
            severidade: 'atencao',
            valor: 4
          })
        ])
      })
    );
    expect(servicoSaude.verificarDetalhado).toHaveBeenCalledTimes(1);
    await expect(servico.listarAlertasOperacionais('tenant-1')).resolves.not.toEqual(
      expect.objectContaining({
        itens: expect.arrayContaining([expect.objectContaining({ mensagem: expect.stringContaining('password=secret') })])
      })
    );
  });

  it('deve retornar status ok quando health e filas estiverem saudaveis', async () => {
    const { servico, repositorios } = criarServico({
      health: {
        status: 'ok',
        checks: {
          backend: { status: 'ok' },
          banco: { status: 'ok' },
          redis: { status: 'ok' },
          email: { status: 'ok' },
          whatsapp: { status: 'ok' },
          googleCalendar: { status: 'ok' }
        }
      }
    });
    repositorios.outbox.count.mockResolvedValue(0);
    repositorios.mensagens.find.mockResolvedValue([]);
    repositorios.outbox.find.mockResolvedValue([]);
    repositorios.consultas.find.mockResolvedValue([]);

    await expect(servico.listarAlertasOperacionais('tenant-1')).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        resumo: { total: 0, criticos: 0, atencao: 0, informativos: 0 },
        itens: []
      })
    );
  });

  it('deve consolidar resumo operacional por tenant', async () => {
    const { servico } = criarServico();

    await expect(servico.obterResumo('tenant-1')).resolves.toEqual({
      outbox: { pendente: 2, processando: 1, processado: 10, falhou: 3 },
      mobile: { sincronizado: 8, erro: 1 }
    });
  });

  it('deve recolocar evento falho de outbox como pendente', async () => {
    const { servico, repositorios } = criarServico();

    const evento = await servico.reprocessarOutbox('tenant-1', 'evento-1');

    expect(evento).toEqual(expect.objectContaining({ status: 'pendente', erro: undefined, processadoEm: undefined }));
    expect(repositorios.outbox.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'evento-1', status: 'pendente' }));
  });

  it('deve rejeitar reprocessamento de evento inexistente', async () => {
    const { servico } = criarServico();

    await expect(servico.reprocessarOutbox('tenant-1', 'evento-x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deve listar auditoria operacional filtrada por tenant', async () => {
    const { servico, repositorios } = criarServico();

    await expect(
      servico.listarAuditoria('tenant-1', {
        acao: 'pacientes.listar_dados_sensiveis',
        recursoTipo: 'paciente',
        usuarioId: 'usuario-1',
        inicio: '2026-01-01T00:00:00.000Z',
        limite: 500
      })
    ).resolves.toEqual([{ id: 'log-1', acao: 'pacientes.listar_dados_sensiveis', metadados: {} }]);

    expect(repositorios.auditoria.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          acao: 'pacientes.listar_dados_sensiveis',
          recursoTipo: 'paciente',
          usuarioId: 'usuario-1'
        }),
        order: { criadoEm: 'DESC' },
        take: 100
      })
    );
  });

  it('deve listar auditoria operacional paginada', async () => {
    const { servico, repositorios } = criarServico();

    await expect(
      servico.listarAuditoriaPaginada('tenant-1', {
        acao: 'pacientes.criar',
        pagina: 2,
        limite: 10
      })
    ).resolves.toEqual({
      itens: [{ id: 'log-1', acao: 'pacientes.listar_dados_sensiveis', metadados: {} }],
      total: 1,
      pagina: 2,
      limite: 10
    });

    expect(repositorios.auditoria.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { criadoEm: 'DESC' },
        take: 10,
        skip: 10
      })
    );
  });

  it('deve exportar falhas de outbox em CSV sem payload bruto', async () => {
    const { servico } = criarServico();

    await expect(servico.exportarFalhasOutboxCsv('tenant-1')).resolves.toContain('criadoEm,tipo,status,tentativas,erro,mensagemId');
  });

  it('deve consolidar central de falhas de comunicacao por origem e canal', async () => {
    const { servico } = criarServico();

    await expect(servico.listarFalhasComunicacao('tenant-1', { pagina: 1, limite: 10 })).resolves.toEqual({
      itens: [
        expect.objectContaining({
          id: 'google_calendar:consulta-google-1',
          origem: 'google_calendar',
          canal: 'google_calendar',
          referenciaId: 'consulta-google-1',
          erro: 'Refresh token revogado'
        }),
        expect.objectContaining({
          id: 'mensagem:mensagem-whatsapp-1',
          origem: 'mensagem',
          canal: 'whatsapp',
          referenciaId: 'mensagem-whatsapp-1',
          erro: 'Token Meta expirado'
        }),
        expect.objectContaining({
          id: 'mensagem:mensagem-email-1',
          origem: 'mensagem',
          canal: 'email',
          referenciaId: 'mensagem-email-1',
          erro: 'SMTP indisponivel'
        }),
        expect.objectContaining({
          id: 'outbox:evento-1',
          origem: 'outbox',
          canal: 'outbox',
          referenciaId: 'evento-1',
          erro: 'Redis indisponivel'
        })
      ],
      total: 4,
      pagina: 1,
      limite: 10,
      resumo: {
        total: 4,
        email: 1,
        whatsapp: 1,
        googleCalendar: 1,
        outbox: 1,
        outras: 0,
        reprocessaveis: 4
      }
    });
  });

  it('deve reprocessar mensagem falha pela central de comunicacao', async () => {
    const { servico, repositorios, comunicacoes } = criarServico();

    await servico.reprocessarFalhaComunicacao('tenant-1', 'mensagem:mensagem-email-1');

    expect(repositorios.mensagens.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mensagem-email-1', status: 'pendente', erro: undefined, enviadoEm: undefined })
    );
    expect(comunicacoes.publicarEventoNotificacao).toHaveBeenCalledWith('tenant-1', 'mensagem-email-1');
  });

  it('deve reprocessar falha de Google Calendar pela central de comunicacao', async () => {
    const { servico, repositorios, googleCalendar, servicoConexaoGoogle } = criarServico();
    const credenciais = { clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'calendario-profissional' };
    servicoConexaoGoogle.obterConexaoAtiva = jest.fn(async () => credenciais) as never;

    await servico.reprocessarFalhaComunicacao('tenant-1', 'google_calendar:consulta-google-1');

    expect(servicoConexaoGoogle.obterConexaoAtiva).toHaveBeenCalledWith('tenant-1', 'profissional-1');
    expect(googleCalendar.criarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        resumo: 'Consulta - Ana Paula',
        inicioEm: new Date('2026-07-23T12:00:00.000Z'),
        fimEm: new Date('2026-07-23T13:00:00.000Z'),
        timezone: 'America/Sao_Paulo',
        credenciais
      })
    );
    expect(repositorios.consultas.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'consulta-google-1',
        googleCalendarId: 'primary',
        googleEventId: 'google-event-1',
        googleEventHtmlLink: 'https://calendar.google/event',
        notificacoes: expect.objectContaining({ googleCalendar: expect.objectContaining({ sincronizado: true }) })
      })
    );
  });

  it('deve listar fila LGPD consolidada por protocolo e status atual', async () => {
    const { servico, repositorios } = criarServico();

    await expect(servico.listarSolicitacoesLgpd('tenant-1', { status: 'em_tratamento' })).resolves.toEqual({
      itens: [
        {
          protocolo: 'LGPD-123',
          pacienteId: 'paciente-1',
          usuarioPacienteId: 'usuario-paciente-1',
          tipo: 'retificacao',
          status: 'em_tratamento',
          detalhes: 'Atualizar telefone cadastrado.',
          abertoEm: new Date('2026-07-22T10:00:00.000Z'),
          atualizadoEm: new Date('2026-07-22T11:00:00.000Z'),
          responsavelId: 'usuario-admin-1',
          ultimaTratativa: 'Validando cadastro.'
        }
      ],
      total: 1,
      pagina: 1,
      limite: 25
    });
    expect(repositorios.consentimentos.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
        order: { aceitoEm: 'DESC' }
      })
    );
  });

  it('deve registrar tratativa LGPD com responsavel operacional', async () => {
    const { servico, repositorios } = criarServico();

    await expect(
      servico.atualizarSolicitacaoLgpd('tenant-1', 'usuario-admin-1', 'LGPD-123', {
        status: 'concluida',
        detalhes: 'Dados corrigidos.'
      })
    ).resolves.toEqual(
      expect.objectContaining({
        protocolo: 'LGPD-123',
        status: 'concluida',
        responsavelId: 'usuario-admin-1'
      })
    );
    expect(repositorios.consentimentos.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-admin-1',
        tipo: 'tratativa_lgpd',
        metadados: expect.objectContaining({
          protocolo: 'LGPD-123',
          status: 'concluida',
          responsavelId: 'usuario-admin-1',
          detalhes: 'Dados corrigidos.'
        })
      })
    );
  });

  it('deve detalhar protocolo LGPD com linha do tempo operacional', async () => {
    const { servico } = criarServico();

    await expect(servico.obterDetalheSolicitacaoLgpd('tenant-1', 'LGPD-123')).resolves.toEqual({
      protocolo: 'LGPD-123',
      pacienteId: 'paciente-1',
      usuarioPacienteId: 'usuario-paciente-1',
      tipo: 'retificacao',
      status: 'em_tratamento',
      detalhes: 'Atualizar telefone cadastrado.',
      abertoEm: new Date('2026-07-22T10:00:00.000Z'),
      atualizadoEm: new Date('2026-07-22T11:00:00.000Z'),
      responsavelId: 'usuario-admin-1',
      ultimaTratativa: 'Validando cadastro.',
      historico: [
        {
          id: 'consentimento-1',
          tipo: 'solicitacao_lgpd_retificacao',
          status: 'recebida',
          detalhes: 'Atualizar telefone cadastrado.',
          responsavelId: undefined,
          criadoEm: new Date('2026-07-22T10:00:00.000Z')
        },
        {
          id: 'tratativa-1',
          tipo: 'tratativa_lgpd',
          status: 'em_tratamento',
          detalhes: 'Validando cadastro.',
          responsavelId: 'usuario-admin-1',
          criadoEm: new Date('2026-07-22T11:00:00.000Z')
        }
      ]
    });
  });

  it('deve exportar protocolo LGPD em CSV sem metadados brutos', async () => {
    const { servico } = criarServico();

    await expect(servico.exportarSolicitacaoLgpdCsv('tenant-1', 'LGPD-123')).resolves.toContain(
      'protocolo,pacienteId,tipo,status,criadoEm,responsavelId,detalhes'
    );
    await expect(servico.exportarSolicitacaoLgpdCsv('tenant-1', 'LGPD-123')).resolves.toContain('LGPD-123,paciente-1,retificacao,recebida');
    await expect(servico.exportarSolicitacaoLgpdCsv('tenant-1', 'LGPD-123')).resolves.not.toContain('usuarioPacienteId');
  });

  it('deve preparar resposta LGPD ao paciente e registrar evento operacional', async () => {
    const { servico, repositorios } = criarServico();

    await expect(servico.prepararRespostaSolicitacaoLgpd('tenant-1', 'usuario-admin-1', 'LGPD-123')).resolves.toEqual(
      expect.objectContaining({
        protocolo: 'LGPD-123',
        pacienteId: 'paciente-1',
        status: 'em_tratamento',
        assuntoEmail: 'Atualizacao da solicitacao LGPD LGPD-123',
        corpoEmail: expect.stringContaining('Seu pedido LGPD LGPD-123 esta em tratamento.'),
        textoWhatsapp: expect.stringContaining('Seu pedido LGPD LGPD-123 esta em tratamento.'),
        canaisSugeridos: ['email', 'whatsapp']
      })
    );
    expect(repositorios.consentimentos.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-admin-1',
        tipo: 'resposta_lgpd_preparada',
        metadados: expect.objectContaining({
          protocolo: 'LGPD-123',
          status: 'em_tratamento',
          responsavelId: 'usuario-admin-1',
          assuntoEmail: 'Atualizacao da solicitacao LGPD LGPD-123'
        })
      })
    );
  });

  it('deve consolidar politicas de retencao com itens vencidos por tipo de dado', async () => {
    const { servico } = criarServico();

    await expect(servico.obterRetencaoDados('tenant-1')).resolves.toEqual(
      expect.objectContaining({
        versao: '2026-10',
        politicas: expect.arrayContaining([
          expect.objectContaining({
            id: 'auditoria_operacional',
            rotulo: 'Auditoria operacional',
            diasRetencao: 3650,
            acao: 'arquivar_exportar'
          }),
          expect.objectContaining({
            id: 'outbox_processado',
            diasRetencao: 180,
            acao: 'excluir'
          }),
          expect.objectContaining({
            id: 'consentimentos_lgpd',
            diasRetencao: 3650,
            acao: 'preservar'
          })
        ]),
        resumo: expect.objectContaining({
          totalVencidos: 17,
          itens: expect.arrayContaining([
            expect.objectContaining({ politicaId: 'auditoria_operacional', vencidos: 7 }),
            expect.objectContaining({ politicaId: 'outbox_processado', vencidos: 4 }),
            expect.objectContaining({ politicaId: 'sincronizacao_mobile', vencidos: 3 }),
            expect.objectContaining({ politicaId: 'mensagens_notificacao', vencidos: 2 }),
            expect.objectContaining({ politicaId: 'consentimentos_lgpd', vencidos: 1 })
          ])
        })
      })
    );
  });

  it('deve programar retencao LGPD com protocolo sem apagar dados no ato', async () => {
    const { servico, repositorios } = criarServico();

    const resultado = await servico.programarRetencaoDados('tenant-1', 'usuario-admin-1');

    expect(resultado).toEqual(
      expect.objectContaining({
        protocolo: expect.stringMatching(/^RET-/),
        status: 'programada',
        totalItensVencidos: 17
      })
    );
    expect(repositorios.consentimentos.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        usuarioId: 'usuario-admin-1',
        tipo: 'retencao_dados_programada',
        versao: '2026-10',
        metadados: expect.objectContaining({
          origem: 'operacoes',
          acao: 'planejamento_retencao',
          totalItensVencidos: 17,
          politicas: expect.arrayContaining(['auditoria_operacional', 'outbox_processado'])
        })
      })
    );
  });

  it('deve listar solicitacoes comerciais de assinatura pendentes', async () => {
    const { servico, repositorios } = criarServico();

    await expect(servico.listarSolicitacoesAssinatura('tenant-1')).resolves.toEqual({
      itens: [
        {
          tenantId: 'tenant-1',
          acao: 'upgrade',
          status: 'pendente',
          planoAtualId: 'profissional',
          planoAtual: 'Profissional',
          planoDesejado: 'clinica',
          observacao: 'Mais usuarios administrativos.',
          solicitadoPorUsuarioId: 'cliente-1',
          solicitadoEm: '2026-07-22T10:00:00.000Z'
        }
      ],
      total: 1,
      pagina: 1,
      limite: 25
    });
    expect(repositorios.configuracoes.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', chave: 'assinatura_interesse' },
      order: { criadoEm: 'DESC' },
      take: 25,
      skip: 0
    });
  });

  it('deve aplicar plano manualmente e concluir solicitacao comercial', async () => {
    const { servico, repositorios } = criarServico();

    await expect(
      servico.aplicarPlanoAssinatura('tenant-1', 'admin-1', {
        planoId: 'clinica',
        status: 'ativa',
        renovacaoEm: '2026-09-22T00:00:00.000Z',
        observacao: 'Aprovado manualmente.'
      })
    ).resolves.toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        planoId: 'clinica',
        plano: 'Clinica',
        status: 'ativa',
        origem: 'operacao_manual',
        renovacaoEm: '2026-09-22T00:00:00.000Z',
        atualizadoPorUsuarioId: 'admin-1'
      })
    );

    expect(repositorios.configuracoes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'plano-1',
        tenantId: 'tenant-1',
        chave: 'plano_saas',
        valor: expect.objectContaining({
          planoId: 'clinica',
          status: 'ativa',
          origem: 'operacao_manual',
          renovacaoEm: '2026-09-22T00:00:00.000Z',
          atualizadoPorUsuarioId: 'admin-1'
        })
      })
    );
    expect(repositorios.configuracoes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'interesse-1',
        tenantId: 'tenant-1',
        chave: 'assinatura_interesse',
        valor: expect.objectContaining({
          status: 'concluida',
          planoAplicadoId: 'clinica',
          resolvidoPorUsuarioId: 'admin-1',
          observacaoResolucao: 'Aprovado manualmente.'
        })
      })
    );
  });
});
