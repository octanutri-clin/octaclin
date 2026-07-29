import { ControladorGoogleAgenda } from './controlador-google-agenda';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const CANAL_WATCH_ID = `octaclin-gcal:${TENANT_ID}:22222222-2222-4222-8222-222222222222`;

describe('ControladorGoogleAgenda', () => {
  function construirControlador() {
    const repositorioCanal = {
      findOne: jest.fn(async () => ({
        canalWatchId: CANAL_WATCH_ID,
        tenantId: TENANT_ID,
        profissionalId: '33333333-3333-4333-8333-333333333333',
        token: 'token-do-canal'
      }))
    };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => unknown) =>
        operacao({ getRepository: jest.fn(() => repositorioCanal) })
      )
    };
    const filaSincronizacao = { add: jest.fn(async () => undefined) };
    const fonteDados = {
      getRepository: jest.fn(() => {
        throw new Error('google_canais_watch deve ser lida no contexto RLS do tenant');
      })
    };
    const controlador = new ControladorGoogleAgenda(
      {} as never,
      {} as never,
      executorTenant as never,
      filaSincronizacao as never
    );

    return { controlador, executorTenant, filaSincronizacao, repositorioCanal, fonteDados };
  }

  it('resolve o tenant pelo identificador do canal e valida o token dentro do contexto RLS antes de enfileirar', async () => {
    const deps = construirControlador();

    await deps.controlador.receberNotificacao(CANAL_WATCH_ID, 'token-do-canal', '9');

    expect(deps.executorTenant.executar).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    expect(deps.repositorioCanal.findOne).toHaveBeenCalledWith({ where: { canalWatchId: CANAL_WATCH_ID, tenantId: TENANT_ID } });
    expect(deps.filaSincronizacao.add).toHaveBeenCalledWith(
      'notificacao',
      { canalWatchId: CANAL_WATCH_ID, tenantId: TENANT_ID },
      expect.objectContaining({ jobId: `${CANAL_WATCH_ID}:9` })
    );
    expect(deps.fonteDados.getRepository).not.toHaveBeenCalledWith(GoogleCanalWatchOrm);
  });

  it('ignora um identificador legado ou malformado antes de tentar uma leitura global', async () => {
    const deps = construirControlador();

    await deps.controlador.receberNotificacao('canal-legado', 'token-do-canal');

    expect(deps.executorTenant.executar).not.toHaveBeenCalled();
    expect(deps.filaSincronizacao.add).not.toHaveBeenCalled();
  });
});
