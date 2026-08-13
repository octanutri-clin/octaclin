import { ServicoFeatureFlags } from './servico-feature-flags';

describe('ServicoFeatureFlags', () => {
  const ambienteOriginal = process.env.OCTACLIN_FEATURE_FLAGS;

  afterEach(() => {
    if (ambienteOriginal === undefined) delete process.env.OCTACLIN_FEATURE_FLAGS;
    else process.env.OCTACLIN_FEATURE_FLAGS = ambienteOriginal;
  });

  function criarServico(valorTenant: Record<string, unknown> | null = null) {
    const repositorio = {
      findOne: jest.fn(async () =>
        valorTenant
          ? { id: 'config-1', tenantId: 'tenant-1', chave: 'feature_flags', valor: valorTenant, criadoEm: new Date() }
          : null
      ),
      create: jest.fn((valor) => valor),
      save: jest.fn(async (valor) => valor)
    };
    const executor = {
      executar: jest.fn(async (_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorio })
      )
    };
    return { servico: new ServicoFeatureFlags(executor as never), repositorio };
  }

  it('resolve defaults fail-closed, ambiente e override do tenant nessa ordem', async () => {
    process.env.OCTACLIN_FEATURE_FLAGS = JSON.stringify({ 'ia.clinica': true, 'mobile.sync': false });
    const { servico } = criarServico({ 'ia.clinica': false, 'mobile.sync': true });

    await expect(servico.listar('tenant-1')).resolves.toEqual({
      configuracaoValida: true,
      flags: [
        { chave: 'ia.clinica', habilitada: false, origem: 'tenant' },
        { chave: 'mobile.sync', habilitada: true, origem: 'tenant' }
      ]
    });
  });

  it('falha fechado quando a configuracao de ambiente e invalida', async () => {
    process.env.OCTACLIN_FEATURE_FLAGS = '{invalido';
    const { servico } = criarServico();

    await expect(servico.listar('tenant-1')).resolves.toEqual({
      configuracaoValida: false,
      flags: [
        { chave: 'ia.clinica', habilitada: false, origem: 'padrao' },
        { chave: 'mobile.sync', habilitada: false, origem: 'padrao' }
      ]
    });
  });

  it('persiste apenas flags conhecidas e booleanas', async () => {
    const { servico, repositorio } = criarServico({ 'ia.clinica': true });

    await servico.atualizar('tenant-1', { 'ia.clinica': false, 'mobile.sync': true });

    expect(repositorio.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'config-1',
        tenantId: 'tenant-1',
        chave: 'feature_flags',
        valor: { 'ia.clinica': false, 'mobile.sync': true }
      })
    );
  });

  it('preserva o override existente quando a atualizacao e parcial', async () => {
    const { servico, repositorio } = criarServico({ 'ia.clinica': true, 'mobile.sync': true });

    await servico.atualizar('tenant-1', { 'ia.clinica': false });

    expect(repositorio.save).toHaveBeenCalledWith(
      expect.objectContaining({
        valor: { 'ia.clinica': false, 'mobile.sync': true }
      })
    );
  });
});
