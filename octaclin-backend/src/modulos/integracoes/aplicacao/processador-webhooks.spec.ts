import { createHmac } from 'crypto';
import { WebhookAssinaturaOrm } from '../infraestrutura/webhook-assinatura.orm';
import { WebhookEntregaOrm } from '../infraestrutura/webhook-entrega.orm';
import { ProcessadorWebhooks } from './processador-webhooks';

describe('ProcessadorWebhooks', () => {
  it('devolve para a fila entregas cujo lease de processamento expirou', async () => {
    const repositorioEntregas = {
      update: jest.fn(async () => ({ affected: 1 })),
      find: jest.fn(async () => [])
    };
    const executor = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorioEntregas })
      )
    };
    const fonteDados = {
      getRepository: jest.fn(() => ({ find: jest.fn(async () => [{ id: 'tenant-1' }]) }))
    };
    const servico = new ProcessadorWebhooks(fonteDados as never, executor as never, {} as never);

    await servico.processarPendentes();

    expect(repositorioEntregas.update).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', status: 'processando' }),
      expect.objectContaining({ status: 'pendente' })
    );
  });

  it('assina timestamp e corpo exato, e conclui entrega 2xx', async () => {
    const entrega = {
      id: 'entrega-1',
      tenantId: 'tenant-1',
      assinaturaId: 'assinatura-1',
      evento: 'paciente.criado',
      recursoTipo: 'paciente',
      recursoId: 'paciente-1',
      payload: { versao: '2026-08-01', evento: 'paciente.criado', dados: { pacienteId: 'paciente-1' } },
      status: 'pendente',
      tentativas: 0,
      proximaTentativaEm: new Date(0),
      criadoEm: new Date(),
      atualizadoEm: new Date()
    } as WebhookEntregaOrm;
    const repositorioEntregas = {
      findOne: jest.fn(async () => entrega),
      update: jest.fn(async () => {
        entrega.status = 'processando';
        entrega.tentativas += 1;
        return { affected: 1 };
      }),
      save: jest.fn(async (valor: WebhookEntregaOrm) => valor)
    };
    const repositorioAssinaturas = {
      findOne: jest.fn(async () => ({
        id: 'assinatura-1',
        tenantId: 'tenant-1',
        ativo: true,
        url: 'https://example.com/webhook',
        segredoCriptografado: Buffer.from('cifrado')
      }))
    };
    const executor = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({
          getRepository: (entidade: unknown) =>
            entidade === WebhookEntregaOrm ? repositorioEntregas : repositorioAssinaturas
        })
      )
    };
    const servico = new ProcessadorWebhooks({} as never, executor as never, {
      descriptografar: jest.fn(() => 'segredo-hmac')
    } as never);
    const enviar = jest.spyOn(servico as never, 'enviar' as never).mockResolvedValue(204 as never);

    await servico.processarUma('tenant-1', 'entrega-1');

    const [url, corpo, cabecalhos] = enviar.mock.calls[0] as unknown as [string, string, Record<string, string>];
    expect(url).toBe('https://example.com/webhook');
    expect(cabecalhos['X-OctaClin-Delivery']).toBe('entrega-1');
    const esperada = createHmac('sha256', 'segredo-hmac')
      .update(`${cabecalhos['X-OctaClin-Timestamp']}.${corpo}`)
      .digest('hex');
    expect(cabecalhos['X-OctaClin-Signature']).toBe(`v1=${esperada}`);
    expect(entrega.status).toBe('entregue');
    expect(repositorioEntregas.save).toHaveBeenCalled();
  });
});
