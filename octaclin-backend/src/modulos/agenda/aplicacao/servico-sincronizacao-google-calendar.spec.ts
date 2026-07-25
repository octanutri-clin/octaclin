import { Logger } from '@nestjs/common';
import { AgendaBloqueioExternoOrm } from '../infraestrutura/agenda-bloqueio-externo.orm';
import { ServicoSincronizacaoGoogleCalendar } from './servico-sincronizacao-google-calendar';

describe('ServicoSincronizacaoGoogleCalendar', () => {
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
      listarEventosAlterados: jest.fn(async () => ({
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
          getRepository: () => ({
            findOne: jest.fn(async () => null),
            create: jest.fn((dados: any) => dados),
            save: jest.fn(async (dados: any) => dados),
            delete: jest.fn(async () => undefined)
          })
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

    await servico.processarNotificacao('canal-1');

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

    await servico.processarNotificacao('canal-1');

    expect(deps.servicoAgenda.cancelarConsultaComoSistema).toHaveBeenCalledWith(
      'tenant-1',
      'consulta-2',
      { motivo: 'Cancelado direto na Google Agenda.' },
      'prof-1'
    );
  });

  it('retorna sem erro quando o canal nao existe mais (ja desconectado)', async () => {
    const deps = construirDependencias();
    (deps.fonteDados.getRepository as any) = () => ({ findOne: jest.fn(async () => null) });
    const servico = new ServicoSincronizacaoGoogleCalendar(
      deps.fonteDados as any,
      deps.executorTenant as any,
      deps.servicoConexao as any,
      deps.googleCalendar as any,
      deps.servicoAgenda as any
    );

    await expect(servico.processarNotificacao('canal-inexistente')).resolves.not.toThrow();
    expect(deps.googleCalendar.listarEventosAlterados).not.toHaveBeenCalled();
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

    await expect(servico.processarNotificacao('canal-1')).resolves.not.toThrow();

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
});
