import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoPortalRestricoes } from './servico-portal-restricoes';

jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({ registrarAuditoriaNaTransacao: jest.fn(async () => undefined) }));

const tenant = '11111111-1111-4111-8111-111111111111';
const conta = '22222222-2222-4222-8222-222222222222';
const p1 = '33333333-3333-4333-8333-333333333333', p2 = '44444444-4444-4444-8444-444444444444';
const ator = { tenantId: tenant, usuarioId: conta, papel: 'Patient', emailHash: '', permissoes: [] } as const;

function preparar() {
  const usuario = { findOne: jest.fn(async (): Promise<unknown> => ({ id: conta, role: 'Patient', ativo: true })) };
  const query = jest.fn(async (sql: string, _p?: unknown[]): Promise<unknown[]> => sql === 'show transaction_isolation'
    ? [{ transaction_isolation: 'read committed' }]
    : [{ id: p1, via: 'propria', nome: Buffer.from('cifra-1') }, { id: p2, via: 'representante', nome: Buffer.from('cifra-2') }]);
  const g = { query, getRepository: jest.fn((e: unknown) => { if (e === UsuarioOrm) return usuario; throw new Error('Repositório inesperado'); }) };
  const executor = { executar: jest.fn(async (_t: string, fn: (x: unknown) => unknown) => fn(g)) };
  const cripto = { descriptografar: jest.fn((b: Buffer) => `Nome sintético ${b.toString().slice(-1)}`) };
  return { usuario, query, g, executor, s: new ServicoPortalRestricoes(executor as never, cripto as never) };
}
beforeEach(() => jest.clearAllMocks());

describe('seletor de pacientes do portal (P2d-3a)', () => {
  it('lista o próprio e os representados com nome decifrado, filtrando pelo token e só vínculos vigentes', async () => {
    const c = preparar();
    await expect(c.s.listarPacientes(ator as never)).resolves.toEqual([
      { pacienteId: p1, via: 'propria', nome: 'Nome sintético 1' }, { pacienteId: p2, via: 'representante', nome: 'Nome sintético 2' }]);
    const [sql, params] = c.query.mock.calls.find(([s]) => s.includes('from pacientes'))!;
    expect(sql).toMatch(/v\.revogado_em is null/); expect(sql).toMatch(/p\.arquivado_em is null/); expect(sql).toMatch(/limit 100/);
    expect(params).toEqual([tenant, conta]);
    expect(c.usuario.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_read' } }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'portal.restricoes.pacientes_listar', metadados: {} }));
  });
  it.each(['Professional', 'Collaborator', 'SuperAdmin', 'Client'] as const)('papel %s não usa o seletor', async papel => {
    const c = preparar(); await expect(c.s.listarPacientes({ ...ator, papel } as never)).rejects.toMatchObject({ status: 403 });
    expect(c.executor.executar).not.toHaveBeenCalled();
  });
  it('conta inativa ou com papel trocado no banco: 403 sem consultar pacientes', async () => {
    for (const conta2 of [{ id: conta, role: 'Patient', ativo: false }, { id: conta, role: 'Professional', ativo: true }]) {
      const c = preparar(); c.usuario.findOne.mockResolvedValueOnce(conta2);
      await expect(c.s.listarPacientes(ator as never)).rejects.toMatchObject({ status: 403 });
      expect(c.query.mock.calls.some(([s]) => s.includes('from pacientes'))).toBe(false);
    }
  });
  it('linha malformada ou duplicada não sai (falha fechada)', async () => {
    const c = preparar(); c.query.mockImplementation(async (sql: string) => sql === 'show transaction_isolation'
      ? [{ transaction_isolation: 'read committed' }] : [{ id: p1, via: 'propria', nome: Buffer.from('x') }, { id: p1, via: 'representante', nome: Buffer.from('y') }]);
    await expect(c.s.listarPacientes(ator as never)).rejects.toMatchObject({ status: 409 });
    const d = preparar(); d.query.mockImplementation(async (sql: string) => sql === 'show transaction_isolation'
      ? [{ transaction_isolation: 'read committed' }] : [{ id: 'CANARIO', via: 'propria', nome: Buffer.from('x') }]);
    await expect(d.s.listarPacientes(ator as never)).rejects.toMatchObject({ status: 500 });
  });
});
