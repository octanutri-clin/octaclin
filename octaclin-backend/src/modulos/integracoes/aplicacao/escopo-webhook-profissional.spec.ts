import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { PermissaoIntegracaoProfissionalOrm } from '../infraestrutura/permissao-integracao-profissional.orm';
import { WebhookAssinaturaOrm } from '../infraestrutura/webhook-assinatura.orm';
import { podeEntregarWebhook } from './escopo-webhook-profissional';

describe('escopo de webhook profissional', () => {
  const assinatura = { profissionalUsuarioId: 'usuario-profissional' } as WebhookAssinaturaOrm;

  function cenario(opcoes: { carteira?: boolean; concessao?: boolean; ativo?: boolean } = {}) {
    const pacientes = { findOne: jest.fn(async () => opcoes.carteira === false ? null : { id: 'paciente-1' }) };
    const gerenciador = {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === UsuarioOrm) return { findOne: jest.fn(async () => opcoes.ativo === false ? null : { id: 'usuario-profissional' }) };
        if (entidade === PermissaoIntegracaoProfissionalOrm) return {
          findOne: jest.fn(async () => opcoes.concessao === false ? null : { eventosWebhook: ['paciente.criado'] })
        };
        if (entidade === ProfissionalOrm) return { findOne: jest.fn(async () => ({ id: 'profissional-1' })) };
        if (entidade === PacienteOrm) return pacientes;
        throw new Error('Repositorio inesperado');
      })
    };
    return { gerenciador, pacientes };
  }

  it('permite somente evento concedido de paciente sob responsabilidade atual', async () => {
    const { gerenciador, pacientes } = cenario();
    await expect(podeEntregarWebhook(
      gerenciador as never, 'tenant-1', assinatura, 'paciente.criado', { pacienteId: 'paciente-1' }
    )).resolves.toBe(true);
    expect(pacientes.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: 'tenant-1', id: 'paciente-1', profissionalResponsavelId: 'profissional-1'
      })
    }));
  });

  it('bloqueia paciente fora da carteira, concessao retirada e payload sem paciente', async () => {
    const fora = cenario({ carteira: false });
    await expect(podeEntregarWebhook(
      fora.gerenciador as never, 'tenant-1', assinatura, 'paciente.criado', { pacienteId: 'paciente-2' }
    )).resolves.toBe(false);

    const revogada = cenario({ concessao: false });
    await expect(podeEntregarWebhook(
      revogada.gerenciador as never, 'tenant-1', assinatura, 'paciente.criado', { pacienteId: 'paciente-1' }
    )).resolves.toBe(false);
    expect(revogada.pacientes.findOne).not.toHaveBeenCalled();

    await expect(podeEntregarWebhook(
      revogada.gerenciador as never, 'tenant-1', assinatura, 'paciente.criado', {}
    )).resolves.toBe(false);
  });
});
