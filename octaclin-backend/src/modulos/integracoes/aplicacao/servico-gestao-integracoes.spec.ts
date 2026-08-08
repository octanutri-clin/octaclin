import { ServicoGestaoIntegracoes } from './servico-gestao-integracoes';

describe('ServicoGestaoIntegracoes', () => {
  it('nao permite reprocessar entrega que ja foi confirmada', async () => {
    const repositorio = { findOne: jest.fn(async () => null), save: jest.fn() };
    const executor = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorio })
      )
    };
    const auditoria = { registrar: jest.fn() };
    const servico = new ServicoGestaoIntegracoes(executor as never, {} as never, auditoria as never);

    await expect(servico.reprocessarEntrega('tenant-1', 'usuario-1', 'entrega-confirmada'))
      .rejects.toThrow('Entrega de webhook com falha nao encontrada.');
    expect(repositorio.findOne).toHaveBeenCalledWith({
      where: { id: 'entrega-confirmada', tenantId: 'tenant-1', status: 'falhou' }
    });
    expect(repositorio.save).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('nunca devolve o segredo criptografado ao listar webhooks', async () => {
    const executor = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({
          getRepository: () => ({
            find: jest.fn(async () => [{
              id: 'webhook-1',
              nome: 'Automacao',
              url: 'https://example.com/webhook',
              eventos: ['paciente.criado'],
              ativo: true,
              segredoCriptografado: Buffer.from('nao-pode-sair'),
              criadoEm: new Date(),
              atualizadoEm: new Date()
            }])
          })
        })
      )
    };
    const servico = new ServicoGestaoIntegracoes(executor as never, {} as never, { registrar: jest.fn() } as never);
    const resposta = await servico.listarWebhooks('tenant-1');
    expect(JSON.stringify(resposta)).not.toContain('segredo');
    expect(JSON.stringify(resposta)).not.toContain('nao-pode-sair');
  });
});
