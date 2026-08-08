import { WebhookAssinaturaOrm } from '../infraestrutura/webhook-assinatura.orm';
import { WebhookEntregaOrm } from '../infraestrutura/webhook-entrega.orm';
import { registrarEventoWebhook } from './registrar-evento-webhook';

describe('registrarEventoWebhook', () => {
  it('faz fan-out por assinatura com payload minimo e deduplicacao', async () => {
    const execute = jest.fn(async () => undefined);
    let valoresCapturados: unknown;
    const values = jest.fn((entrada: unknown) => {
      valoresCapturados = entrada;
      return { orIgnore: () => ({ execute }) };
    });
    const insert = jest.fn(() => ({ values }));
    const gerenciador = {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === WebhookAssinaturaOrm) {
          return { find: jest.fn(async () => [{ id: 'webhook-1' }, { id: 'webhook-2' }]) };
        }
        if (entidade === WebhookEntregaOrm) return { createQueryBuilder: () => ({ insert }) };
        throw new Error('Repositorio inesperado');
      })
    };

    await registrarEventoWebhook(gerenciador as never, 'tenant-1', {
      evento: 'paciente.criado',
      recursoTipo: 'paciente',
      recursoId: 'paciente-1',
      dados: { pacienteId: 'paciente-1', profissionalResponsavelId: 'prof-1' }
    });

    const entregas = valoresCapturados as Array<{ payload: Record<string, unknown>; assinaturaId: string }>;
    expect(entregas).toHaveLength(2);
    expect(entregas.map((item) => item.assinaturaId)).toEqual(['webhook-1', 'webhook-2']);
    expect(JSON.stringify(entregas)).not.toContain('nome');
    expect(JSON.stringify(entregas)).not.toContain('contato');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('nao escreve entrega sem assinatura ativa', async () => {
    const gerenciador = {
      getRepository: jest.fn(() => ({ find: jest.fn(async () => []) }))
    };
    await registrarEventoWebhook(gerenciador as never, 'tenant-1', {
      evento: 'consulta.cancelada',
      recursoTipo: 'agenda_consulta',
      recursoId: 'consulta-1',
      dados: { consultaId: 'consulta-1' }
    });
    expect(gerenciador.getRepository).toHaveBeenCalledTimes(1);
  });
});
