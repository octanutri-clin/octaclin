import { Logger } from '@nestjs/common';
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { SyncTokenExpiradoError, TokenRevogadoError } from './servico-google-calendar';
import { ServicoSincronizacaoGoogleCalendar } from './servico-sincronizacao-google-calendar';

describe('ServicoSincronizacaoGoogleCalendar', () => {
  const tenantIdCanal = '11111111-1111-4111-8111-111111111111';
  const canalWatchId = `octaclin-gcal:${tenantIdCanal}:22222222-2222-4222-8222-222222222222`;

  function construirDependencias() {
    const canalRegistro = {
      canalWatchId: 'canal-1',
      tenantId: 'tenant-1',
      profissionalId: 'prof-1',
      expiraEm: new Date(Date.now() + 1000 * 60 * 60)
    };

    const fonteDados = {
      getRepository: () => ({
        findOne: jest.fn(async () => canalRegistro)
      })
    };

    const conexaoConexaoAtiva = {
      clientId: 'c',
      clientSecret: 's',
      refreshToken: 'r',
      calendarId: 'cal-1'
    };
    const servicoConexao = {
      obterConexaoAtiva: jest.fn(async () => conexaoConexaoAtiva),
      atualizarSyncToken: jest.fn(async () => undefined)
    };

    const googleCalendar = {
      listarEventosAlterados: jest.fn(async (_credenciais?: unknown, _syncToken?: string) => ({
        eventos: [
          { id: 'evt-consulta', status: 'confirmed', octaclinConsultaId: 'consulta-1', inicioEm: new Date('2026-08-01T10:00:00Z'), fimEm: new Date('2026-08-01T10:50:00Z') },
          { id: 'evt-cancelado', status: 'cancelled', octaclinConsultaId: 'consulta-2' },
          { id: 'evt-externo', status: 'confirmed', inicioEm: new Date('2026-08-02T09:00:00Z'), fimEm: new Date('2026-08-02T09:30:00Z') }
        ],
        proximoSyncToken: 'novo-sync-token'
      }))
    };

    const servicoAgenda = {
      remarcarConsultaComoSistema: jest.fn(async () => undefined),
      cancelarConsultaComoSistema: jest.fn(async () => undefined)
    };

    const executorTenant = {
      executar: jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
        callback({
          getRepository: (entidade: unknown) => {
            if (entidade === GoogleCanalWatchOrm) return { findOne: jest.fn(async () => canalRegistro) };
            return {
            findOne: jest.fn(async () => null),
            create: jest.fn((dados: any) => dados),
            save: jest.fn(async (dados: any) => dados),
            delete: jest.fn(async () => undefined)
            };
          }
        })
      )
    };

    return { fonteDados, servicoConexao, googleCalendar, servicoAgenda, executorTenant, canalRegistro };
  }

  it('aplica evento com octaclinConsultaId via remarcarConsultaComoSistema', async () => {
    const deps = construirDependencias();
    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await servico.processarNotificacao('canal-1', 'tenant-1');

    expect(deps.servicoAgenda.remarcarConsultaComoSistema).toHaveBeenCalledWith(
      'tenant-1',
      'consulta-1',
      { inicioEm: '2026-08-01T10:00:00.000Z', fimEm: '2026-08-01T10:50:00.000Z' },
      'prof-1'
    );
  });

  it('aplica evento cancelado com octaclinConsultaId via cancelarConsultaComoSistema', async () => {
    const deps = construirDependencias();
    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await servico.processarNotificacao('canal-1', 'tenant-1');

    expect(deps.servicoAgenda.cancelarConsultaComoSistema).toHaveBeenCalledWith(
      'tenant-1',
      'consulta-2',
      { motivo: 'Cancelado direto na Google Agenda.' },
      'prof-1'
    );
  });

  it('retorna sem erro quando o canal nao existe mais (ja desconectado)', async () => {
    const deps = construirDependencias();
    deps.executorTenant.executar = jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
      callback({ getRepository: () => ({ findOne: jest.fn(async () => null) }) })
    );
    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await expect(servico.processarNotificacao('canal-inexistente', 'tenant-1')).resolves.not.toThrow();
    expect(deps.googleCalendar.listarEventosAlterados).not.toHaveBeenCalled();
  });

  it('consulta o canal somente no contexto RLS do tenant recebido do webhook', async () => {
    const deps = construirDependencias();
    const canal = { ...deps.canalRegistro, canalWatchId, tenantId: tenantIdCanal };
    const repositorioCanal = { findOne: jest.fn(async () => canal) };
    deps.fonteDados.getRepository = jest.fn(() => {
      throw new Error('nao deve ler google_canais_watch fora de ExecutorTenant');
    });
    deps.executorTenant.executar = jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
      callback({
        getRepository: () => repositorioCanal
      })
    );
    (deps.servicoConexao as any).obterConexaoAtiva = jest.fn(async () => undefined);

    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await servico.processarNotificacao(canalWatchId, tenantIdCanal);

    expect(deps.executorTenant.executar).toHaveBeenCalledWith(tenantIdCanal, expect.any(Function));
    expect(repositorioCanal.findOne).toHaveBeenCalledWith({ where: { canalWatchId, tenantId: tenantIdCanal } });
  });

  it('nao interrompe o lote quando aplicarBloqueioExterno falha para um evento externo, e continua processando os demais eventos', async () => {
    const deps = construirDependencias();

    // Evento de bloqueio externo (falho) vem primeiro no lote, seguido por eventos ligados a consultas,
    // para provar que uma falha no primeiro evento nao impede o processamento dos seguintes.
    deps.googleCalendar.listarEventosAlterados = jest.fn(async () => ({
      eventos: [
        { id: 'evt-externo-falho', status: 'confirmed', inicioEm: new Date('2026-08-02T09:00:00Z'), fimEm: new Date('2026-08-02T09:30:00Z') },
        { id: 'evt-consulta', status: 'confirmed', octaclinConsultaId: 'consulta-1', inicioEm: new Date('2026-08-01T10:00:00Z'), fimEm: new Date('2026-08-01T10:50:00Z') },
        { id: 'evt-cancelado', status: 'cancelled', octaclinConsultaId: 'consulta-2' }
      ],
      proximoSyncToken: 'novo-sync-token'
    }));

    deps.executorTenant.executar = jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
      callback({
        getRepository: (entidade: any) => {
          if (entidade === GoogleCanalWatchOrm) {
            return { findOne: jest.fn(async () => deps.canalRegistro) };
          }
          if (entidade === AgendaBloqueioExternoOrm) {
            return {
              findOne: jest.fn(async () => null),
              create: jest.fn((dados: any) => dados),
              save: jest.fn(async () => {
                throw new Error('Falha simulada de banco ao salvar bloqueio externo');
              }),
              delete: jest.fn(async () => undefined)
            };
          }
          return {
            findOne: jest.fn(async () => null),
            create: jest.fn((dados: any) => dados),
            save: jest.fn(async (dados: any) => dados),
            delete: jest.fn(async () => undefined)
          };
        }
      })
    );

    const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await expect(servico.processarNotificacao('canal-1', 'tenant-1')).resolves.not.toThrow();

    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('evt-externo-falho'));

    expect(deps.servicoAgenda.remarcarConsultaComoSistema).toHaveBeenCalledWith(
      'tenant-1',
      'consulta-1',
      { inicioEm: '2026-08-01T10:00:00.000Z', fimEm: '2026-08-01T10:50:00.000Z' },
      'prof-1'
    );
    expect(deps.servicoAgenda.cancelarConsultaComoSistema).toHaveBeenCalledWith(
      'tenant-1',
      'consulta-2',
      { motivo: 'Cancelado direto na Google Agenda.' },
      'prof-1'
    );

    loggerWarnSpy.mockRestore();
  });

  it('desconecta a integracao quando o Google retorna token revogado (TokenRevogadoError)', async () => {
    const deps = construirDependencias();
    deps.googleCalendar.listarEventosAlterados = jest.fn(async () => {
      throw new TokenRevogadoError();
    });
    const servicoConexaoComDesconectar = { ...deps.servicoConexao, desconectar: jest.fn(async () => undefined) };

    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      servicoConexaoComDesconectar as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await expect(servico.reconciliar('tenant-1', 'prof-1')).resolves.not.toThrow();
    expect(servicoConexaoComDesconectar.desconectar).toHaveBeenCalledWith('tenant-1', 'prof-1');
  });

  it('refaz a sincronizacao do zero quando o sync token expirou (SyncTokenExpiradoError)', async () => {
    const deps = construirDependencias();
    let chamada = 0;
    deps.googleCalendar.listarEventosAlterados = jest.fn(async (_credenciais: unknown, syncToken?: string) => {
      chamada += 1;
      if (chamada === 1) {
        expect(syncToken).toBeUndefined();
        throw new SyncTokenExpiradoError();
      }
      expect(syncToken).toBeUndefined();
      return { eventos: [], proximoSyncToken: 'sync-recem-gerado' };
    });

    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await expect(servico.reconciliar('tenant-1', 'prof-1')).resolves.not.toThrow();
    expect(deps.googleCalendar.listarEventosAlterados).toHaveBeenCalledTimes(2);
  });

  it('nao avanca o syncToken armazenado quando algum evento do lote falhou ao ser aplicado', async () => {
    const deps = construirDependencias();
    deps.servicoAgenda.remarcarConsultaComoSistema = jest.fn(async () => {
      throw new Error('falha simulada ao aplicar evento');
    });

    const chamadasSave: unknown[] = [];
    deps.executorTenant.executar = jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
      callback({
        getRepository: () => ({
          findOne: jest.fn(async () => ({ tenantId: 'tenant-1', profissionalId: 'prof-1', ultimoSyncToken: 'sync-antigo' })),
          create: jest.fn((dados: any) => dados),
          save: jest.fn(async (dados: any) => {
            chamadasSave.push(dados);
            return dados;
          }),
          delete: jest.fn(async () => undefined)
        })
      })
    );

    const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await servico.reconciliar('tenant-1', 'prof-1');

    expect(chamadasSave.some((dados: any) => dados.ultimoSyncToken === 'novo-sync-token')).toBe(false);

    loggerWarnSpy.mockRestore();
  });

  it('remove bloqueios fora da janela depois de uma sincronizacao inicial concluida', async () => {
    const deps = construirDependencias();
    const executarDelete = jest.fn(async () => undefined);
    const queryBuilder = {
      delete: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      execute: executarDelete
    };
    queryBuilder.delete.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);

    deps.googleCalendar.listarEventosAlterados = jest.fn(async () => ({
      eventos: [],
      proximoSyncToken: 'sync-limitado',
      janelaInicial: {
        inicioEm: new Date('2026-07-11T00:00:00.000Z'),
        fimEm: new Date('2027-09-14T00:00:00.000Z')
      }
    }));
    deps.executorTenant.executar = jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
      callback({
        getRepository: () => ({
          findOne: jest.fn(async () => ({
            tenantId: 'tenant-1',
            profissionalId: 'prof-1',
            ultimoSyncToken: undefined,
            falhasConsecutivasSincronizacao: 0
          })),
          save: jest.fn(async (dados: any) => dados),
          createQueryBuilder: jest.fn(() => queryBuilder)
        })
      })
    );

    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );
    await servico.reconciliar('tenant-1', 'prof-1');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(fim_em <= :inicioEm OR inicio_em >= :fimEm)',
      expect.objectContaining({
        inicioEm: new Date('2026-07-11T00:00:00.000Z'),
        fimEm: new Date('2027-09-14T00:00:00.000Z')
      })
    );
    expect(executarDelete).toHaveBeenCalledTimes(1);
  });

  it('avanca o syncToken apos 5 falhas consecutivas ao aplicar eventos, e loga em nivel error (retentativa limitada)', async () => {
    const deps = construirDependencias();
    deps.servicoAgenda.remarcarConsultaComoSistema = jest.fn(async () => {
      throw new Error('falha simulada ao aplicar evento');
    });

    const conexaoFake = {
      tenantId: 'tenant-1',
      profissionalId: 'prof-1',
      ultimoSyncToken: 'sync-antigo',
      falhasConsecutivasSincronizacao: 0
    };
    deps.executorTenant.executar = jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
      callback({
        getRepository: () => ({
          findOne: jest.fn(async () => conexaoFake),
          create: jest.fn((dados: any) => dados),
          save: jest.fn(async (dados: any) => {
            Object.assign(conexaoFake, dados);
            return conexaoFake;
          }),
          delete: jest.fn(async () => undefined)
        })
      })
    );

    const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    for (let chamada = 1; chamada <= 4; chamada += 1) {
      await servico.reconciliar('tenant-1', 'prof-1');
      expect(conexaoFake.ultimoSyncToken).toBe('sync-antigo');
      expect(conexaoFake.falhasConsecutivasSincronizacao).toBe(chamada);
    }
    expect(loggerErrorSpy).not.toHaveBeenCalled();

    await servico.reconciliar('tenant-1', 'prof-1');

    expect(conexaoFake.falhasConsecutivasSincronizacao).toBe(0);
    expect(conexaoFake.ultimoSyncToken).toBe('novo-sync-token');
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('5 falhas consecutivas'));

    loggerWarnSpy.mockRestore();
    loggerErrorSpy.mockRestore();
  });
});
