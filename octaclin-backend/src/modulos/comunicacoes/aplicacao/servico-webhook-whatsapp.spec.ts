import { ServicoWebhookWhatsapp } from './servico-webhook-whatsapp';

describe('ServicoWebhookWhatsapp', () => {
  function criarServico(mensagem?: Record<string, unknown>) {
    const entidadeMensagem: { status: string; payload: Record<string, unknown>; erro?: string } | null = mensagem
      ? {
          status: 'enviado',
          payload: mensagem
        }
      : null;

    const repositorioMensagens = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn(() => ({
          getOne: jest.fn(async () => entidadeMensagem)
        }))
      })),
      save: jest.fn(async (registro) => registro)
    };

    const fonteDados = {
      getRepository: jest.fn(() => ({
        find: jest.fn(async () => [{ id: 'tenant-1' }])
      }))
    };

    const executorTenant = {
      executar: jest.fn(async (_tenantId, operacao) =>
        operacao({
          getRepository: jest.fn(() => repositorioMensagens)
        })
      )
    };

    return {
      servico: new ServicoWebhookWhatsapp(fonteDados as never, executorTenant as never),
      entidadeMensagem,
      repositorioMensagens,
      executorTenant
    };
  }

  it('deve anexar o ultimo status Meta na mensagem correspondente', async () => {
    const { servico, entidadeMensagem, repositorioMensagens } = criarServico({
      resultadoEnvio: { idExterno: 'wamid-1' }
    });

    await expect(
      servico.registrarStatus([{ id: 'wamid-1', status: 'delivered', timestamp: '1780000000', recipient_id: '5511999999999' }])
    ).resolves.toEqual({ atualizados: 1, ignorados: 0 });

    expect(entidadeMensagem?.payload).toMatchObject({
      resultadoEnvio: { idExterno: 'wamid-1' },
      ultimoStatusMeta: {
        status: 'delivered',
        timestamp: '1780000000',
        recipientId: '5511999999999'
      }
    });
    expect(repositorioMensagens.save).toHaveBeenCalledWith(entidadeMensagem);
  });

  it('deve marcar mensagem como falhou quando a Meta reportar failed', async () => {
    const { servico, entidadeMensagem } = criarServico({
      resultadoEnvio: { idExterno: 'wamid-1' }
    });

    await servico.registrarStatus([
      {
        id: 'wamid-1',
        status: 'failed',
        errors: [{ title: 'Telefone indisponivel' }]
      }
    ]);

    expect(entidadeMensagem?.status).toBe('falhou');
    expect(entidadeMensagem?.erro).toBe('Telefone indisponivel');
  });

  it('deve ignorar status sem mensagem correspondente', async () => {
    const { servico, repositorioMensagens } = criarServico();

    await expect(servico.registrarStatus([{ id: 'wamid-inexistente', status: 'read' }])).resolves.toEqual({
      atualizados: 0,
      ignorados: 1
    });
    expect(repositorioMensagens.save).not.toHaveBeenCalled();
  });
});
