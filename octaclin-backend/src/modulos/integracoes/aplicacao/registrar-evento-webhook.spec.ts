import { WebhookAssinaturaOrm } from '../infraestrutura/webhook-assinatura.orm';
import { WebhookEntregaOrm } from '../infraestrutura/webhook-entrega.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { PermissaoIntegracaoProfissionalOrm } from '../infraestrutura/permissao-integracao-profissional.orm';
import { registrarEventoWebhook } from './registrar-evento-webhook';

describe('registrarEventoWebhook', () => {
  it('enfileira para a clinica e apenas para o profissional responsavel pelo paciente', async () => {
    let valores: Array<{ assinaturaId: string }> = [];
    const gerenciador = {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === WebhookAssinaturaOrm) return { find: jest.fn(async () => [
          { id: 'clinica' },
          { id: 'profissional-1', profissionalUsuarioId: 'usuario-1' },
          { id: 'profissional-2', profissionalUsuarioId: 'usuario-2' }
        ]) };
        if (entidade === UsuarioOrm) return {
          findOne: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id }))
        };
        if (entidade === PermissaoIntegracaoProfissionalOrm) return {
          findOne: jest.fn(async () => ({ eventosWebhook: ['paciente.criado'] }))
        };
        if (entidade === ProfissionalOrm) return {
          findOne: jest.fn(async ({ where }: { where: { usuarioId: string } }) => ({
            id: where.usuarioId === 'usuario-1' ? 'profissional-1' : 'profissional-2'
          }))
        };
        if (entidade === PacienteOrm) return {
          findOne: jest.fn(async ({ where }: { where: { profissionalResponsavelId: string } }) =>
            where.profissionalResponsavelId === 'profissional-1' ? { id: 'paciente-1' } : null
          )
        };
        if (entidade === WebhookEntregaOrm) return {
          createQueryBuilder: () => ({
            insert: () => ({
              values: (entrada: Array<{ assinaturaId: string }>) => {
                valores = entrada;
                return { orIgnore: () => ({ execute: jest.fn(async () => undefined) }) };
              }
            })
          })
        };
        throw new Error('Repositorio inesperado');
      })
    };

    await registrarEventoWebhook(gerenciador as never, 'tenant-1', {
      evento: 'paciente.criado',
      recursoTipo: 'paciente',
      recursoId: 'paciente-1',
      dados: { pacienteId: 'paciente-1' }
    });

    expect(valores.map(({ assinaturaId }) => assinaturaId)).toEqual(['clinica', 'profissional-1']);
  });

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
