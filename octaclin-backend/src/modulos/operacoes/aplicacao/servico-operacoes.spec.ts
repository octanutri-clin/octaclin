import { Logger, NotFoundException } from '@nestjs/common';
import { ServicoAuditoria, zerarTotalFalhasAuditoriaParaTeste } from '../../../infraestrutura/auditoria/servico-auditoria';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import {
  registrarAutorizacaoNegada,
  reiniciarJanelaAutorizacaoNegada,
  zerarTotalNegativasAutorizacaoParaTeste
} from '../../auth/apresentacao/auditoria-autorizacao';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { CanalNotificacaoOrm } from '../../comunicacoes/infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../../comunicacoes/infraestrutura/mensagem-notificacao.orm';
import { SincronizacaoMobileOrm } from '../../mobile/infraestrutura/sincronizacao-mobile.orm';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { AlertaOperacional, ResultadoAlertasOperacionais, ServicoOperacoes } from './servico-operacoes';

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

const TENANT_DA_NEGATIVA = '11111111-1111-4111-8111-111111111111';
const USUARIO_DA_NEGATIVA = '22222222-2222-4222-8222-222222222222';
const ROTA_DA_NEGATIVA = '/pacientes/:id/prontuario';
const AGORA_NEGATIVA = Date.parse('2026-09-04T10:00:00.000Z');

/** UUID deterministico e distinto por indice, para gerar negativas que a janela nao colapsa. */
function uuidDoIndice(indice: number): string {
  return `00000000-0000-4000-8000-${String(indice).padStart(12, '0')}`;
}

function criarContextoDeNegativa(indice: number) {
  class ControladorProntuario {}
  function abrir() {}

  const requisicao = {
    method: 'GET',
    baseUrl: '',
    headers: {},
    route: { path: ROTA_DA_NEGATIVA },
    params: { id: uuidDoIndice(indice) },
    requestId: 'req-1',
    usuarioAutenticado: {
      tenantId: TENANT_DA_NEGATIVA,
      usuarioId: USUARIO_DA_NEGATIVA,
      papel: 'Collaborator',
      emailHash: 'hash',
      permissoes: []
    }
  };

  return {
    getHandler: () => abrir,
    getClass: () => ControladorProntuario,
    switchToHttp: () => ({ getRequest: () => requisicao })
  } as never;
}

/** Sobe o contador de negativas pelo caminho real das guardas, com alvos distintos. */
function observarNegativas(quantidade: number): void {
  const auditoria = { registrar: jest.fn(async () => undefined) };
  for (let indice = 0; indice < quantidade; indice += 1) {
    registrarAutorizacaoNegada(
      auditoria as never,
      criarContextoDeNegativa(indice),
      { tipo: 'papel', exigido: ['SuperAdmin'] },
      AGORA_NEGATIVA
    );
  }
}

/** Sobe o contador de falhas pelo caminho real: `registrar` engole o erro e conta. */
async function falharGravacaoDaTrilha(quantidade: number, servicoAuditoria?: ServicoAuditoria): Promise<void> {
  const auditoria =
    servicoAuditoria ??
    new ServicoAuditoria({
      executar: async () => {
        throw new Error('banco indisponivel');
      }
    } as never);

  for (let indice = 0; indice < quantidade; indice += 1) {
    await auditoria.registrar({ tenantId: 'tenant-1', acao: 'teste.falha.gravacao' });
  }
}

/** Fixa o uptime do processo para que os limiares de taxa sejam deterministicos. */
function fixarUptime(servico: unknown, segundos: number): void {
  jest.spyOn(servico as { obterUptimeSegundos(): number }, 'obterUptimeSegundos').mockReturnValue(segundos);
}

const ID_ALERTA_FALHA_TRILHA = 'servico.auditoria.falha_gravacao';
const ID_ALERTA_NEGATIVAS = 'servico.autorizacao.negativas_volume';

function alertaPorId(resultado: ResultadoAlertasOperacionais, id: string): AlertaOperacional | undefined {
  return resultado.itens.find((item) => item.id === id);
}

describe('ServicoOperacoes', () => {
  beforeEach(() => {
    // Contadores de processo: sem o reset, um caso passaria a depender da ordem
    // de execucao do anterior. Ver `servico-auditoria.ts` e `auditoria-autorizacao.ts`.
    zerarTotalFalhasAuditoriaParaTeste();
    zerarTotalNegativasAutorizacaoParaTeste();
    reiniciarJanelaAutorizacaoNegada();
  });

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

  /**
   * Alertas de observabilidade da trilha (PR 52, fase 3).
   *
   * Os dois contadores lidos aqui sao de processo e monotonicos desde o boot, e
   * a leitura atinge uma replica so -- ver os comentarios em
   * `servico-auditoria.ts` e `auditoria-autorizacao.ts`. Os casos abaixo provam
   * o limiar, a severidade, o escopo do contador e a ausencia de identificador
   * no payload.
   */
  describe('alertas de observabilidade da trilha', () => {
    // `registrar` engole o erro e emite `warn`; aqui a falha e provocada de
    // proposito, entao o log so poluiria a saida da suite.
    let logDeFalha: jest.SpyInstance;

    beforeAll(() => {
      logDeFalha = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    afterAll(() => {
      logDeFalha.mockRestore();
    });

    const healthSaudavel = {
      status: 'ok',
      checks: {
        backend: { status: 'ok' },
        banco: { status: 'ok' },
        redis: { status: 'ok' },
        email: { status: 'ok' },
        whatsapp: { status: 'ok' },
        googleCalendar: { status: 'ok' }
      }
    };

    function criarServicoIsolado() {
      const contexto = criarServico({ health: healthSaudavel });
      contexto.repositorios.outbox.count.mockResolvedValue(0);
      contexto.repositorios.mensagens.find.mockResolvedValue([]);
      contexto.repositorios.outbox.find.mockResolvedValue([]);
      contexto.repositorios.consultas.find.mockResolvedValue([]);
      fixarUptime(contexto.servico, 3_600);
      return contexto;
    }

    it('nao emite alerta algum com os dois contadores zerados', async () => {
      const { servico } = criarServicoIsolado();

      const resultado = await servico.listarAlertasOperacionais('tenant-1');

      expect(resultado.itens).toEqual([]);
      expect(resultado.status).toBe('ok');
    });

    it('emite alerta critico na primeira falha de gravacao da trilha', async () => {
      const { servico } = criarServicoIsolado();
      await falharGravacaoDaTrilha(1);

      const resultado = await servico.listarAlertasOperacionais('tenant-1');

      expect(alertaPorId(resultado, ID_ALERTA_FALHA_TRILHA)).toEqual(
        expect.objectContaining({
          severidade: 'critico',
          origem: 'servico',
          metrica: 'auditoria_falha_gravacao_total',
          valor: 1,
          referencia: expect.stringContaining('total:1')
        })
      );
      expect(resultado.status).toBe('critico');
    });

    it('expoe uptime e taxa no payload para a conta poder ser conferida', async () => {
      const { servico } = criarServicoIsolado();
      await falharGravacaoDaTrilha(2);

      const resultado = await servico.listarAlertasOperacionais('tenant-1');

      expect(alertaPorId(resultado, ID_ALERTA_FALHA_TRILHA)?.referencia).toBe(
        'total:2;uptimeSegundos:3600;porHora:2;limiarCritico:1'
      );
    });

    /**
     * O caso que impede a regressao de "virou campo de instancia": dois
     * `ServicoAuditoria` distintos, como o container Nest cria ao declarar o
     * provider em varios modulos. Se o contador fosse de instancia, o alerta
     * veria 1 -- a fatia de um deles -- e nao os 2 do processo.
     */
    it('conta falhas de instancias distintas do servico de auditoria', async () => {
      const { servico } = criarServicoIsolado();
      const executorQueFalha = {
        executar: async () => {
          throw new Error('banco indisponivel');
        }
      };
      await falharGravacaoDaTrilha(1, new ServicoAuditoria(executorQueFalha as never));
      await falharGravacaoDaTrilha(1, new ServicoAuditoria(executorQueFalha as never));

      const resultado = await servico.listarAlertasOperacionais('tenant-1');

      expect(alertaPorId(resultado, ID_ALERTA_FALHA_TRILHA)?.valor).toBe(2);
    });

    it('duas instancias do servico de operacoes leem o mesmo contador de processo', async () => {
      const primeiro = criarServicoIsolado();
      const segundo = criarServicoIsolado();
      await falharGravacaoDaTrilha(3);

      const resultadoA = await primeiro.servico.listarAlertasOperacionais('tenant-1');
      const resultadoB = await segundo.servico.listarAlertasOperacionais('tenant-1');

      expect(alertaPorId(resultadoA, ID_ALERTA_FALHA_TRILHA)?.valor).toBe(3);
      expect(alertaPorId(resultadoB, ID_ALERTA_FALHA_TRILHA)?.valor).toBe(3);
    });

    it('nao emite alerta de negativa no volume de fundo esperado', async () => {
      const { servico } = criarServicoIsolado();
      observarNegativas(10);

      const resultado = await servico.listarAlertasOperacionais('tenant-1');

      expect(alertaPorId(resultado, ID_ALERTA_NEGATIVAS)).toBeUndefined();
      expect(resultado.status).toBe('ok');
    });

    it('emite atencao quando o total de negativas alcanca o limiar', async () => {
      const { servico } = criarServicoIsolado();
      observarNegativas(50);

      const resultado = await servico.listarAlertasOperacionais('tenant-1');

      expect(alertaPorId(resultado, ID_ALERTA_NEGATIVAS)).toEqual(
        expect.objectContaining({
          severidade: 'atencao',
          origem: 'servico',
          metrica: 'autorizacao_negada_total',
          valor: 50
        })
      );
    });

    it('nao emite alerta de negativa uma unidade abaixo do limiar', async () => {
      const { servico } = criarServicoIsolado();
      observarNegativas(49);

      const resultado = await servico.listarAlertasOperacionais('tenant-1');

      expect(alertaPorId(resultado, ID_ALERTA_NEGATIVAS)).toBeUndefined();
    });

    it('escala para critico na magnitude de enumeracao da politica', async () => {
      const { servico } = criarServicoIsolado();
      observarNegativas(500);

      const resultado = await servico.listarAlertasOperacionais('tenant-1');

      expect(alertaPorId(resultado, ID_ALERTA_NEGATIVAS)).toEqual(
        expect.objectContaining({ severidade: 'critico', valor: 500 })
      );
    });

    // A taxa existe para pegar a rajada antes que o total absoluto a alcance.
    it('emite atencao pela taxa por hora antes do total absoluto', async () => {
      const { servico } = criarServicoIsolado();
      fixarUptime(servico, 900);
      observarNegativas(13);

      const resultado = await servico.listarAlertasOperacionais('tenant-1');

      // 13 negativas em 900 s equivalem a 52/h, acima do limiar de 50/h.
      expect(alertaPorId(resultado, ID_ALERTA_NEGATIVAS)).toEqual(
        expect.objectContaining({ severidade: 'atencao', valor: 13 })
      );
    });

    // Processo recem-iniciado tem taxa instavel: 13 eventos em 10 s dariam
    // 4.680/h e transformariam o boot em alarme.
    it('ignora a taxa antes do uptime minimo', async () => {
      const { servico } = criarServicoIsolado();
      fixarUptime(servico, 10);
      observarNegativas(13);

      const resultado = await servico.listarAlertasOperacionais('tenant-1');

      expect(alertaPorId(resultado, ID_ALERTA_NEGATIVAS)).toBeUndefined();
    });

    /**
     * Teste negativo sobre o payload. A secao 4.2 da politica de redacao e a
     * regua: so volume, contagem, taxa e vocabulario fechado. O endpoint e por
     * tenant, mas estes dois numeros sao do processo -- gravar qualquer
     * identificador aqui seria atribuir a um tenant o que pode ter vindo de
     * outro, alem de expor reconhecimento de infraestrutura.
     */
    it('nao carrega identificador algum nos alertas novos', async () => {
      const { servico } = criarServicoIsolado();
      await falharGravacaoDaTrilha(1);
      observarNegativas(500);

      const resultado = await servico.listarAlertasOperacionais('tenant-1');
      const novos = resultado.itens.filter(
        (item) => item.id === ID_ALERTA_FALHA_TRILHA || item.id === ID_ALERTA_NEGATIVAS
      );
      const serializado = JSON.stringify(novos);

      expect(novos).toHaveLength(2);
      for (const identificador of [
        'tenant-1',
        TENANT_DA_NEGATIVA,
        USUARIO_DA_NEGATIVA,
        ROTA_DA_NEGATIVA,
        'ControladorProntuario',
        'SuperAdmin',
        uuidDoIndice(1)
      ]) {
        expect(serializado).not.toContain(identificador);
      }

      for (const alerta of novos) {
        expect(Object.keys(alerta).sort()).toEqual(
          ['acaoSugerida', 'id', 'mensagem', 'metrica', 'origem', 'referencia', 'severidade', 'titulo', 'valor'].sort()
        );
      }
    });
  });
});
