import { ControladorGoogleAgenda } from './controlador-google-agenda';
import { GoogleCanalWatchOrm } from '../infraestrutura/google-canal-watch.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';

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
    const repositorioProfissional = {
      findOne: jest.fn(async () => ({ id: '33333333-3333-4333-8333-333333333333' }))
    };
    const executorTenant = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => unknown) =>
        operacao({
          getRepository: jest.fn((entidade: unknown) =>
            entidade === ProfissionalOrm ? repositorioProfissional : repositorioCanal
          )
        })
      )
    };
    const filaSincronizacao = { add: jest.fn(async () => undefined) };
    const servicoSincronizacao = { reconciliar: jest.fn(async () => undefined) };
    const servicoConexao = { obterConexaoAtiva: jest.fn(async () => ({ refreshToken: 'segredo' })) };
    const fonteDados = {
      getRepository: jest.fn(() => {
        throw new Error('google_canais_watch deve ser lida no contexto RLS do tenant');
      })
    };
    const controlador = new ControladorGoogleAgenda(
      servicoConexao as never,
      {} as never,
      executorTenant as never,
      servicoSincronizacao as never,
      filaSincronizacao as never
    );

    return {
      controlador,
      executorTenant,
      filaSincronizacao,
      repositorioCanal,
      repositorioProfissional,
      fonteDados,
      servicoConexao,
      servicoSincronizacao
    };
  }

  it('resolve o tenant pelo identificador do canal e valida o token dentro do contexto RLS antes de enfileirar', async () => {
    const deps = construirControlador();

    await deps.controlador.receberNotificacao(CANAL_WATCH_ID, 'token-do-canal', '9');

    expect(deps.executorTenant.executar).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    expect(deps.repositorioCanal.findOne).toHaveBeenCalledWith({ where: { canalWatchId: CANAL_WATCH_ID, tenantId: TENANT_ID } });
    expect(deps.filaSincronizacao.add).toHaveBeenCalledWith(
      'notificacao',
      { canalWatchId: CANAL_WATCH_ID, tenantId: TENANT_ID },
      expect.objectContaining({ jobId: `${CANAL_WATCH_ID}-9` })
    );
    expect(deps.fonteDados.getRepository).not.toHaveBeenCalledWith(GoogleCanalWatchOrm);
  });

  it('ignora um identificador legado ou malformado antes de tentar uma leitura global', async () => {
    const deps = construirControlador();

    await deps.controlador.receberNotificacao('canal-legado', 'token-do-canal');

    expect(deps.executorTenant.executar).not.toHaveBeenCalled();
    expect(deps.filaSincronizacao.add).not.toHaveBeenCalled();
  });

  it('representa Google individual como indisponivel para SuperAdmin sem resolver perfil profissional', async () => {
    const deps = construirControlador();

    await expect(
      deps.controlador.status({
        usuarioId: '44444444-4444-4444-8444-444444444444',
        tenantId: TENANT_ID,
        papel: 'SuperAdmin',
        emailHash: 'hash-superadmin',
        permissoes: ['agenda.consultas.ler']
      })
    ).resolves.toEqual({ conectado: false, podeGerenciar: false, falhasConsecutivas: 0 });

    expect(deps.executorTenant.executar).not.toHaveBeenCalled();
  });

  it('permite que o profissional conectado force uma reconciliacao de recuperacao', async () => {
    const deps = construirControlador();

    await expect(
      deps.controlador.sincronizar({
        usuarioId: '55555555-5555-4555-8555-555555555555',
        tenantId: TENANT_ID,
        papel: 'Professional',
        emailHash: 'hash-profissional',
        permissoes: ['agenda.consultas.ler']
      })
    ).resolves.toEqual({ sincronizado: true });

    expect(deps.servicoConexao.obterConexaoAtiva).toHaveBeenCalledWith(
      TENANT_ID,
      '33333333-3333-4333-8333-333333333333'
    );
    expect(deps.servicoSincronizacao.reconciliar).toHaveBeenCalledWith(
      TENANT_ID,
      '33333333-3333-4333-8333-333333333333'
    );
  });
});
