import { NotFoundException } from '@nestjs/common';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { PermissaoIntegracaoProfissionalOrm } from '../infraestrutura/permissao-integracao-profissional.orm';
import { ServicoPermissoesIntegracao } from './servico-permissoes-integracao';

jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({
  registrarAuditoriaNaTransacao: jest.fn()
}));

describe('ServicoPermissoesIntegracao', () => {
  const tenantId = 'tenant-1';
  const gestorId = 'gestor-1';
  const profissionalId = 'profissional-1';

  function criarServico(
    profissionalAtivo: unknown,
    concessoes: Record<string, unknown> = {},
    gestorAtivo: unknown = { id: gestorId, tenantId, role: 'Client', ativo: true }
  ) {
    const repositorioUsuarios = {
      findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const candidato = where.role === 'Client' ? gestorAtivo : profissionalAtivo;
        if (!candidato || typeof candidato !== 'object') return null;
        return Object.entries(where).every(([chave, valor]) => (candidato as Record<string, unknown>)[chave] === valor)
          ? candidato
          : null;
      })
    };
    const repositorioConcessoes = {
      findOne: jest.fn(async ({ where }: { where: { tipo: string } }) => concessoes[where.tipo] ?? null),
      create: jest.fn((entrada: Record<string, unknown>) => ({ id: 'concessao-nova', ...entrada })),
      save: jest.fn(async (entrada: Record<string, unknown>) => entrada),
      find: jest.fn(async () => [])
    };
    const gerenciador = {
      getRepository: (entidade: unknown) =>
        entidade === PermissaoIntegracaoProfissionalOrm ? repositorioConcessoes : repositorioUsuarios
    };
    const executorTenant = {
      executar: jest.fn(async (_tenant: string, operacao: (manager: unknown) => Promise<unknown>) => operacao(gerenciador))
    };
    return {
      servico: new ServicoPermissoesIntegracao(executorTenant as never),
      executorTenant,
      repositorioUsuarios,
      repositorioConcessoes,
      gerenciador
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('grava somente escopos exatos aprovados pelo gestor e audita na transacao', async () => {
    const { servico, repositorioConcessoes, gerenciador } = criarServico({
      id: profissionalId,
      tenantId,
      role: 'Professional',
      ativo: true
    });

    await servico.atualizar(tenantId, gestorId, profissionalId, {
      escoposApi: ['pacientes:ler'],
      eventosWebhook: ['paciente.criado']
    });

    expect(repositorioConcessoes.save).toHaveBeenCalledTimes(2);
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledTimes(2);
    expect((registrarAuditoriaNaTransacao as jest.Mock).mock.calls[0][0]).toBe(gerenciador);
    expect(repositorioConcessoes.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, usuarioId: profissionalId, tipo: 'api', escoposApi: ['pacientes:ler'] })
    );
  });

  it('nao cria duplicata nem evento de auditoria quando a concessao nao mudou', async () => {
    const api: Record<string, unknown> = {
      id: 'grant-api',
      tenantId,
      usuarioId: profissionalId,
      tipo: 'api',
      escoposApi: ['pacientes:ler'],
      eventosWebhook: [],
      revogadaEm: null
    };
    const webhook = {
      id: 'grant-webhook',
      tenantId,
      usuarioId: profissionalId,
      tipo: 'webhook',
      escoposApi: [],
      eventosWebhook: ['paciente.criado'],
      revogadaEm: null
    };
    const { servico, repositorioConcessoes } = criarServico(
      { id: profissionalId, tenantId, role: 'Professional', ativo: true },
      { api, webhook }
    );

    await servico.atualizar(tenantId, gestorId, profissionalId, {
      escoposApi: ['pacientes:ler'],
      eventosWebhook: ['paciente.criado']
    });

    expect(repositorioConcessoes.save).not.toHaveBeenCalled();
    expect(registrarAuditoriaNaTransacao).not.toHaveBeenCalled();
  });

  it('recusa concessao para usuario ausente ou de outro tenant', async () => {
    const { servico, repositorioConcessoes } = criarServico({
      id: profissionalId, tenantId: 'tenant-2', role: 'Professional', ativo: true
    });

    await expect(
      servico.atualizar(tenantId, gestorId, profissionalId, { escoposApi: [], eventosWebhook: [] })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repositorioConcessoes.save).not.toHaveBeenCalled();
    expect(registrarAuditoriaNaTransacao).not.toHaveBeenCalled();
  });

  it('nega concessao quando quem tenta conceder não é gestor Client ativo do tenant', async () => {
    const { servico, repositorioConcessoes } = criarServico(
      { id: profissionalId, tenantId, role: 'Professional', ativo: true },
      {},
      { id: gestorId, tenantId, role: 'Collaborator', ativo: true }
    );

    await expect(servico.atualizar(tenantId, gestorId, profissionalId, {
      escoposApi: ['pacientes:ler'], eventosWebhook: []
    })).rejects.toThrow('Somente o gestor ativo da clínica pode conceder esses acessos.');
    expect(repositorioConcessoes.save).not.toHaveBeenCalled();
  });

  it('registra substituicao e revogacao das capacidades removidas', async () => {
    const api: Record<string, any> = {
      id: 'api-anterior', tenantId, usuarioId: profissionalId, tipo: 'api', escoposApi: ['agenda:ler'],
      eventosWebhook: [], revogadaEm: null
    };
    const { servico, repositorioConcessoes } = criarServico(
      { id: profissionalId, tenantId, role: 'Professional', ativo: true }, { api }
    );

    await servico.atualizar(tenantId, gestorId, profissionalId, {
      escoposApi: ['pacientes:ler'], eventosWebhook: []
    });

    expect(api.revogadaEm).toEqual(expect.any(Date));
    expect(api.revogadaPorUsuarioId).toBe(gestorId);
    expect(repositorioConcessoes.create).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'api', escoposApi: ['pacientes:ler'], concedidaPorUsuarioId: gestorId
    }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledTimes(2);
  });

  it('nega operação profissional sem concessao ativa', async () => {
    const { servico } = criarServico({ id: profissionalId, tenantId, role: 'Professional', ativo: true });
    await expect(servico.exigirAcesso(tenantId, profissionalId, 'api'))
      .rejects.toThrow('O gestor da clínica ainda não concedeu esse acesso.');
  });
});
