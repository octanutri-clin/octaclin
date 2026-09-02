import { ControladorOperacoes } from './controlador-operacoes';
import { CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';

describe('ControladorOperacoes', () => {
  it('deve expor alertas operacionais do tenant autenticado', async () => {
    const servicoOperacoes = {
      listarAlertasOperacionais: jest.fn(async () => ({ status: 'atencao', itens: [] }))
    };
    const controlador = new ControladorOperacoes(servicoOperacoes as never, {} as never, {} as never, {} as never, {} as never, {} as never);

    await expect(
      controlador.listarAlertasOperacionais({
        tenantId: 'tenant-1',
        usuarioId: 'admin-1',
        papel: 'SuperAdmin',
        emailHash: 'hash',
        permissoes: []
      })
    ).resolves.toEqual({ status: 'atencao', itens: [] });
    expect(servicoOperacoes.listarAlertasOperacionais).toHaveBeenCalledWith('tenant-1');
  });

  it('deve exigir leitura para o painel e escrita para reprocessamentos', () => {
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes)).toEqual(['operacoes.auditoria.ler']);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes.prototype.reprocessarOutbox)).toEqual([
      'operacoes.outbox.reprocessar'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes.prototype.reprocessarFalhaComunicacao)).toEqual([
      'operacoes.outbox.reprocessar'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes.prototype.provisionarTenant)).toEqual([
      'operacoes.tenants.gerenciar'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorOperacoes.prototype.atualizarFeatureFlags)).toEqual([
      'operacoes.tenants.gerenciar'
    ]);
  });

  it('deve expor rollout e alterar flags somente pelo tenant alvo informado', async () => {
    const rollout = { obter: jest.fn(async () => ({ status: 'ok' })) };
    const flags = {
      listar: jest.fn(async () => ({ configuracaoValida: true, flags: [] })),
      atualizar: jest.fn(async () => ({ configuracaoValida: true, flags: [] }))
    };
    const auditoria = { registrar: jest.fn(async () => undefined) };
    const controlador = new ControladorOperacoes({} as never, {} as never, auditoria as never, rollout as never, flags as never, {} as never);
    const usuario = {
      tenantId: '00000000-0000-4000-8000-000000000001',
      usuarioId: 'admin-1',
      papel: 'SuperAdmin' as const,
      emailHash: 'hash',
      permissoes: []
    };

    await expect(controlador.obterRollout(usuario)).resolves.toEqual({ status: 'ok' });
    expect(rollout.obter).toHaveBeenCalledWith(usuario.tenantId);

    await controlador.atualizarFeatureFlags(usuario, { ip: '127.0.0.1', headers: {} } as never, {
      tenantId: '00000000-0000-4000-8000-000000000002',
      iaClinica: true,
      mobileSync: false
    });
    expect(flags.atualizar).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000002', {
      'ia.clinica': true,
      'mobile.sync': false
    });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: usuario.tenantId,
        recursoId: '00000000-0000-4000-8000-000000000002',
        acao: 'operacoes.feature_flags.atualizar'
      })
    );
  });

  it('deve reavaliar o menor privilegio dos providers a cada chamada, e nao devolver cache do boot', async () => {
    const menorPrivilegio = {
      avaliar: jest.fn(async () => ({ veredicto: 'conforme' })),
      obterUltimoRelatorio: jest.fn(() => ({ veredicto: 'violado' }))
    };
    const controlador = new ControladorOperacoes(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      menorPrivilegio as never
    );

    await expect(controlador.obterMenorPrivilegioProviders()).resolves.toEqual({ veredicto: 'conforme' });
    expect(menorPrivilegio.avaliar).toHaveBeenCalledTimes(1);
    expect(menorPrivilegio.obterUltimoRelatorio).not.toHaveBeenCalled();
  });
});
