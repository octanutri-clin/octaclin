import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { TenantConfiguracaoOrm } from '../infraestrutura/tenant-configuracao.orm';
import { TenantOrm } from '../infraestrutura/tenant.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { instalarKitInicialClinica } from './kit-inicial-clinica';
import { ServicoKitInicialClinica } from './servico-kit-inicial-clinica';

jest.mock('./kit-inicial-clinica', () => ({
  ...jest.requireActual('./kit-inicial-clinica'),
  instalarKitInicialClinica: jest.fn(async () => ({
    reutilizado: false,
    versaoMarcador: 2,
    materiaisCriados: 1,
    estruturasHabilitadas: [],
    itensAdicionados: ['material:registro-habitos']
  }))
}));
jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({
  registrarAuditoriaNaTransacao: jest.fn(async () => undefined)
}));

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const OUTRO_TENANT_ID = '10000000-0000-4000-8000-000000000008';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';

function identidade(papel: 'Client' | 'SuperAdmin' = 'Client', tenantId = TENANT_ID): UsuarioAutenticado {
  return {
    usuarioId: USUARIO_ID,
    tenantId,
    papel,
    emailHash: 'hash',
    permissoes: papel === 'Client'
      ? ['cliente.configuracoes.gerenciar']
      : ['operacoes.tenants.gerenciar']
  };
}

function preparar(opcoes: { atorAtivo?: boolean; papelAtor?: string; tenant?: any; marcador?: any; assinatura?: any } = {}) {
  const query = jest.fn(async () => []);
  const usuarioRepo = { findOne: jest.fn(async () => ({ id: USUARIO_ID, tenantId: TENANT_ID, role: opcoes.papelAtor ?? 'Client', ativo: opcoes.atorAtivo ?? true })) };
  const tenantRepo = { findOne: jest.fn(async ({ where }: any) => Object.prototype.hasOwnProperty.call(opcoes, 'tenant')
    ? opcoes.tenant
    : ({ id: where.id, nome: 'Clínica de teste', status: 'ativo', cicloVidaStatus: 'ativo' })) };
  const configuracaoRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where.chave === 'plano_saas') return opcoes.assinatura ?? { valor: { status: 'ativa' } };
      if (where.chave === 'kit_inicial_clinica') return opcoes.marcador ?? null;
      return null;
    })
  };
  const manager = {
    query,
    getRepository: jest.fn((entity: Function) => {
      if (entity === UsuarioOrm) return usuarioRepo;
      if (entity === TenantOrm) return tenantRepo;
      if (entity === TenantConfiguracaoOrm) return configuracaoRepo;
      return {};
    })
  } as unknown as EntityManager;
  const executor = {
    executar: jest.fn(async (_tenant: string, acao: (m: EntityManager) => Promise<unknown>) => acao(manager))
  } as unknown as ExecutorTenant;
  return { servico: new ServicoKitInicialClinica(executor), executor, manager, query, usuarioRepo, tenantRepo };
}

describe('ServicoKitInicialClinica', () => {
  beforeEach(() => jest.clearAllMocks());

  it('impede Client de consultar clínica diferente sem trocar contexto RLS', async () => {
    const { servico, query } = preparar();
    await expect(servico.obter(OUTRO_TENANT_ID, identidade())).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });

  it('permite SuperAdmin ativo consultar outro tenant e mantém autoria do próprio ator', async () => {
    const { servico, query, executor } = preparar({ papelAtor: 'SuperAdmin' });
    const usuario = identidade('SuperAdmin');
    const estado = await servico.obter(OUTRO_TENANT_ID, usuario);
    expect(executor.executar).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    expect(query).toHaveBeenCalledWith("select set_config('app.tenant_id', $1, true)", [OUTRO_TENANT_ID]);
    expect(estado.estado).toBe('nao_instalado');

    await servico.instalar(OUTRO_TENANT_ID, usuario, {
      confirmacao: true,
      versao: 2,
      itens: ['material:registro-habitos']
    });
    expect(instalarKitInicialClinica).toHaveBeenCalledWith(
      expect.anything(), OUTRO_TENANT_ID, USUARIO_ID, ['material:registro-habitos'], 'opt_in_superadmin'
    );
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: OUTRO_TENANT_ID,
      usuarioId: USUARIO_ID,
      acao: 'operacoes.tenant.kit_inicial.instalar'
    }));
  });

  it('recusa ator inativo e não toca no kit', async () => {
    const { servico } = preparar({ atorAtivo: false });
    await expect(servico.obter(TENANT_ID, identidade())).rejects.toBeInstanceOf(ForbiddenException);
    expect(instalarKitInicialClinica).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o alvo administrativo não existe', async () => {
    const { servico } = preparar({ papelAtor: 'SuperAdmin', tenant: null });
    await expect(servico.obter(OUTRO_TENANT_ID, identidade('SuperAdmin'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('audita apenas instalações que acrescentam itens', async () => {
    (instalarKitInicialClinica as jest.Mock).mockResolvedValueOnce({
      reutilizado: true, versaoMarcador: 2, materiaisCriados: 0, estruturasHabilitadas: [], itensAdicionados: []
    });
    const { servico } = preparar();
    await servico.instalar(TENANT_ID, identidade(), {
      confirmacao: true,
      versao: 2,
      itens: ['material:registro-habitos']
    });
    expect(registrarAuditoriaNaTransacao).not.toHaveBeenCalled();
  });
});
