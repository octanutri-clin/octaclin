import { ProcessadorRenovacaoGoogleCalendar } from './processador-renovacao-google-calendar';

describe('ProcessadorRenovacaoGoogleCalendar', () => {
  it('renova canais que expiram nas proximas 48h e roda reconciliacao para todas as conexoes ativas', async () => {
    const conexaoPertoDeExpirar = {
      tenantId: 'tenant-1',
      profissionalId: 'prof-1',
      canalWatchId: 'canal-antigo',
      canalRecursoId: 'recurso-antigo',
      canalExpiraEm: new Date(Date.now() + 1000 * 60 * 60 * 10)
    };
    const conexaoFolgada = {
      tenantId: 'tenant-2',
      profissionalId: 'prof-2',
      canalWatchId: 'canal-ok',
      canalRecursoId: 'recurso-ok',
      canalExpiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5)
    };

    const fonteDados = {
      getRepository: () => ({
        find: jest.fn(async () => [conexaoPertoDeExpirar, conexaoFolgada]),
        delete: jest.fn(async () => undefined),
        create: jest.fn((dados: any) => dados),
        save: jest.fn(async (dados: any) => dados)
      })
    };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, callback: (gerenciador: any) => any) =>
        callback({ getRepository: () => ({ findOne: jest.fn(async () => null), save: jest.fn(async (dados: any) => dados) }) })
      )
    };
    const servicoConexao = { obterConexaoAtiva: jest.fn(async () => ({ clientId: 'c', clientSecret: 's', refreshToken: 'r', calendarId: 'cal' })) };
    const googleCalendar = {
      pararCanalWatch: jest.fn(async () => undefined),
      criarCanalWatch: jest.fn(async () => ({ recursoId: 'recurso-novo', expiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) }))
    };
    const servicoSincronizacao = { reconciliar: jest.fn(async () => undefined) };

    const processador = new ProcessadorRenovacaoGoogleCalendar(
      fonteDados as any,
      executorTenant as any,
      servicoConexao as any,
      googleCalendar as any,
      servicoSincronizacao as any
    );

    await processador.renovarCanaisEReconciliar();

    expect(googleCalendar.pararCanalWatch).toHaveBeenCalledWith(expect.anything(), 'canal-antigo', 'recurso-antigo');
    expect(googleCalendar.criarCanalWatch).toHaveBeenCalledTimes(1);
    expect(servicoSincronizacao.reconciliar).toHaveBeenCalledWith('tenant-1', 'prof-1');
    expect(servicoSincronizacao.reconciliar).toHaveBeenCalledWith('tenant-2', 'prof-2');
  });
});
