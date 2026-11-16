import { ForbiddenException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../infraestrutura/profissional.orm';
import { DelegacaoCarteiraProfissionalOrm } from '../infraestrutura/delegacao-carteira-profissional.orm';
import { autorizarColaboradorDelegado, revogarDelegacoesPorAlteracaoAcesso, ServicoDelegacoesCarteira } from './servico-delegacoes-carteira';

/** FOOD06 P2d-2: dados sintéticos; o comportamento sob PostgreSQL real fica na prova RLS. */
const tenant = '11111111-1111-4111-8111-111111111111';
const titular = '22222222-2222-4222-8222-222222222222';
const colaborador = '33333333-3333-4333-8333-333333333333';
const pacienteId = '44444444-4444-4444-8444-444444444444';
const profissionalId = '55555555-5555-4555-8555-555555555555';
const delegacaoId = '66666666-6666-4666-8666-666666666666';
const ator: UsuarioAutenticado = { tenantId: tenant, usuarioId: titular, papel: 'Professional', emailHash: '', permissoes: [] };

function preparar() {
  const papeis: Record<string, { role: string; ativo: boolean } | null> = { [titular]: { role: 'Professional', ativo: true }, [colaborador]: { role: 'Collaborator', ativo: true } };
  const ordemUsuarios: string[] = [];
  const usuario = { findOne: jest.fn(async ({ where }: { where: { id: string } }) => { ordemUsuarios.push(where.id); const p = papeis[where.id]; return p ? { id: where.id, ...p } : null; }) };
  const profissional = { findOne: jest.fn(async (): Promise<unknown> => ({ id: profissionalId, usuarioId: titular })) };
  const delegacao = { findOne: jest.fn(async (): Promise<unknown> => null), find: jest.fn(async () => []), update: jest.fn(async () => ({ affected: 1 })) };
  const paciente = { findOne: jest.fn(async (): Promise<unknown> => ({ id: pacienteId })) };
  const auditoria = { insert: jest.fn(async () => undefined), save: jest.fn(async () => undefined), create: jest.fn((x: unknown) => x) };
  const query = jest.fn(async (sql: string, _params?: unknown[]): Promise<unknown[]> => {
    if (sql === 'show transaction_isolation') return [{ transaction_isolation: 'read committed' }];
    if (sql.includes('insert into delegacoes_carteira_profissional')) return [{ id: delegacaoId, concedida_em: new Date(0) }];
    if (sql.includes('from pacientes pa join profissionais')) return [{ profissional_id: profissionalId, usuario_id: titular }];
    // Formato REAL do TypeORM/pg para UPDATE ... RETURNING via query(): [linhas, contagem].
    if (sql.includes('update delegacoes_carteira_profissional')) return [[{ id: delegacaoId }], 1];
    if (sql.includes('count(*)::int as total from delegacoes_carteira_profissional')) return [{ total: 0 }];
    return [];
  });
  const g = { query, queryRunner: { isTransactionActive: true }, getRepository: jest.fn((e: unknown) => {
    if (e === UsuarioOrm) return usuario; if (e === ProfissionalOrm) return profissional;
    if (e === DelegacaoCarteiraProfissionalOrm) return delegacao; if (e === PacienteOrm) return paciente; return auditoria;
  }) };
  const executor = { executar: jest.fn(async (_t: string, fn: (x: unknown) => unknown) => fn(g)) };
  return { papeis, ordemUsuarios, usuario, profissional, delegacao, paciente, query, g, executor, s: new ServicoDelegacoesCarteira(executor as never) };
}

describe('ServicoDelegacoesCarteira (P2d-2)', () => {
  it('titular concede ao colaborador ativo; trava usuários por id antes do profissional e audita sem conteúdo', async () => {
    const c = preparar();
    await expect(c.s.conceder(ator, colaborador.toUpperCase())).resolves.toEqual({ id: delegacaoId, colaboradorUsuarioId: colaborador, concedidaEm: new Date(0) });
    expect(c.ordemUsuarios).toEqual([titular, colaborador].sort());
    expect(c.usuario.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_read' } }));
    const insercao = c.query.mock.calls.find(([sql]) => String(sql).includes('insert into delegacoes'));
    expect(insercao?.[1]).toEqual([tenant, profissionalId, colaborador, titular]);
  });
  it('limite de 100 delegações vigentes por titular responde 409 sem gravar, sob trava consultiva do titular', async () => {
    const c = preparar(); const base = c.query.getMockImplementation()!;
    c.query.mockImplementation(async (sql: string, p?: unknown[]) => sql.includes('as total from delegacoes') ? [{ total: 100 }] : base(sql, p));
    await expect(c.s.conceder(ator, colaborador)).rejects.toMatchObject({ status: 409 });
    expect(c.query.mock.calls.some(([sql]) => String(sql).includes('insert into delegacoes'))).toBe(false);
    expect(c.query.mock.calls.find(([sql]) => String(sql).includes('pg_advisory_xact_lock'))?.[1]).toEqual([`delegacoes:${tenant}:${profissionalId}`]);
  });
  it('concessão repetida devolve a vigente sem nova linha', async () => {
    const c = preparar(); c.delegacao.findOne.mockResolvedValueOnce({ id: delegacaoId, colaboradorUsuarioId: colaborador, concedidaEm: new Date(1) });
    await expect(c.s.conceder(ator, colaborador)).resolves.toMatchObject({ id: delegacaoId });
    expect(c.query.mock.calls.some(([sql]) => String(sql).includes('insert into delegacoes'))).toBe(false);
  });
  it.each([
    ['titular delegando a si mesmo', (c: ReturnType<typeof preparar>) => c.s.conceder(ator, titular)],
    ['alvo inativo', (c: ReturnType<typeof preparar>) => { c.papeis[colaborador] = { role: 'Collaborator', ativo: false }; return c.s.conceder(ator, colaborador); }],
    ['alvo Professional', (c: ReturnType<typeof preparar>) => { c.papeis[colaborador] = { role: 'Professional', ativo: true }; return c.s.conceder(ator, colaborador); }],
    ['alvo SuperAdmin', (c: ReturnType<typeof preparar>) => { c.papeis[colaborador] = { role: 'SuperAdmin', ativo: true }; return c.s.conceder(ator, colaborador); }],
    ['alvo de outro tenant (não encontrado sob RLS)', (c: ReturnType<typeof preparar>) => { c.papeis[colaborador] = null; return c.s.conceder(ator, colaborador); }],
    ['titular inativo', (c: ReturnType<typeof preparar>) => { c.papeis[titular] = { role: 'Professional', ativo: false }; return c.s.conceder(ator, colaborador); }],
    ['titular com papel trocado no banco', (c: ReturnType<typeof preparar>) => { c.papeis[titular] = { role: 'Collaborator', ativo: true }; return c.s.conceder(ator, colaborador); }],
    ['perfil profissional arquivado', (c: ReturnType<typeof preparar>) => { c.profissional.findOne.mockResolvedValueOnce(null); return c.s.conceder(ator, colaborador); }],
    ['SuperAdmin', (c: ReturnType<typeof preparar>) => c.s.conceder({ ...ator, papel: 'SuperAdmin' }, colaborador)],
    ['Collaborator', (c: ReturnType<typeof preparar>) => c.s.conceder({ ...ator, papel: 'Collaborator' }, colaborador)],
    ['Client', (c: ReturnType<typeof preparar>) => c.s.listar({ ...ator, papel: 'Client' })]
  ])('%s: 403 sem gravar', async (_caso, agir) => {
    const c = preparar();
    await expect(agir(c)).rejects.toMatchObject({ status: 403, message: 'Operação não autorizada.' });
    expect(c.query.mock.calls.some(([sql]) => String(sql).includes('insert into delegacoes'))).toBe(false);
  });
  it('entrada inválida responde 400 antes do banco', async () => {
    const c = preparar();
    await expect(c.s.conceder(ator, 'nao-uuid')).rejects.toMatchObject({ status: 400 });
    await expect(c.s.revogar(ator, 'nao-uuid')).rejects.toMatchObject({ status: 400 });
    await expect(c.s.listar({ ...ator, tenantId: 'x' })).rejects.toMatchObject({ status: 400 });
    expect(c.executor.executar).not.toHaveBeenCalled();
  });
  it('fora de READ COMMITTED falha fechado (409)', async () => {
    const c = preparar(); c.query.mockResolvedValueOnce([{ transaction_isolation: 'serializable' }]);
    await expect(c.s.listar(ator)).rejects.toMatchObject({ status: 409 });
  });
  it('corrida no índice único vira 409 sem eco do banco', async () => {
    const c = preparar(); c.query.mockImplementation(async (sql: string) => {
      if (sql === 'show transaction_isolation') return [{ transaction_isolation: 'read committed' }];
      throw Object.assign(new Error('duplicate key CANARIO_SQL'), { code: '23505' });
    });
    await expect(c.s.conceder(ator, colaborador)).rejects.toMatchObject({ status: 409, message: 'Operação indisponível ou concorrente.' });
  });
  it('revogação só alcança delegação do próprio titular; repetida é idempotente', async () => {
    const c = preparar();
    await expect(c.s.revogar(ator, delegacaoId)).rejects.toBeInstanceOf(ForbiddenException);
    c.delegacao.findOne.mockResolvedValueOnce({ id: delegacaoId, revogadaEm: null });
    await expect(c.s.revogar(ator, delegacaoId)).resolves.toEqual({ id: delegacaoId, revogada: true });
    expect(c.delegacao.findOne).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: delegacaoId, tenantId: tenant, profissionalId }, lock: { mode: 'pessimistic_write' } }));
    c.delegacao.findOne.mockResolvedValueOnce({ id: delegacaoId, revogadaEm: new Date() }); c.delegacao.update.mockClear();
    await expect(c.s.revogar(ator, delegacaoId)).resolves.toEqual({ id: delegacaoId, revogada: true });
    expect(c.delegacao.update).not.toHaveBeenCalled();
  });
  it('cascata grava exatamente uma auditoria por delegação revogada, com o id certo, e falha fechado com formato inesperado', async () => {
    const c = preparar();
    await revogarDelegacoesPorAlteracaoAcesso(c.g as never, tenant, colaborador, titular);
    const auditorias = (c.g.getRepository('auditoria' as never) as unknown as { create: jest.Mock }).create.mock.calls.map(([x]) => x);
    expect(auditorias).toEqual([expect.objectContaining({ recursoId: delegacaoId, acao: 'carteira.delegacao.revogar_por_alteracao_acesso', metadados: {} })]);
    const d = preparar(); d.query.mockImplementation(async (sql: string) => sql.includes('update delegacoes') ? [{ id: delegacaoId }] : []);
    await expect(revogarDelegacoesPorAlteracaoAcesso(d.g as never, tenant, colaborador, titular)).rejects.toThrow();
  });
  it('cascata revoga como colaborador e como titular, em uma instrução', async () => {
    const c = preparar();
    await revogarDelegacoesPorAlteracaoAcesso(c.g as never, tenant, colaborador, titular);
    const [sql, params] = c.query.mock.calls.find(([s]) => String(s).includes('update delegacoes'))!;
    expect(String(sql)).toMatch(/colaborador_usuario_id = \$2 or d\.profissional_id in/);
    expect(params).toEqual([tenant, colaborador, titular]);
  });
});

describe('autorizarColaboradorDelegado (P2d-2)', () => {
  const chamar = (c: ReturnType<typeof preparar>, u = colaborador) => autorizarColaboradorDelegado(c.g as never, tenant, u, pacienteId);
  it('com delegação vigente do responsável atual trava na ordem usuários → delegação → profissional → paciente', async () => {
    const c = preparar();
    const ordem: string[] = [];
    c.usuario.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => { ordem.push(`usuario:${where.id}`); return { id: where.id, ...c.papeis[where.id]! }; });
    c.delegacao.findOne.mockImplementationOnce(async () => { ordem.push('delegacao'); return { id: delegacaoId }; });
    c.profissional.findOne.mockImplementationOnce(async () => { ordem.push('profissional'); return { id: profissionalId }; });
    c.paciente.findOne.mockImplementationOnce(async () => { ordem.push('paciente'); return { id: pacienteId }; });
    await expect(chamar(c)).resolves.toBeUndefined();
    expect(ordem).toEqual([...[titular, colaborador].sort().map(id => `usuario:${id}`), 'delegacao', 'profissional', 'paciente']);
    expect(c.paciente.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: pacienteId, tenantId: tenant,
      profissionalResponsavelId: profissionalId }), lock: { mode: 'pessimistic_write' } }));
    expect(c.delegacao.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: tenant, profissionalId,
      colaboradorUsuarioId: colaborador, revogadaEm: expect.anything() }), lock: { mode: 'pessimistic_read' } }));
    expect(c.profissional.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_read' } }));
  });
  it.each([
    ['sem delegação', (c: ReturnType<typeof preparar>) => { c.delegacao.findOne.mockResolvedValue(null); }],
    ['colaborador inativo', (c: ReturnType<typeof preparar>) => { c.papeis[colaborador] = { role: 'Collaborator', ativo: false }; }],
    ['titular inativo', (c: ReturnType<typeof preparar>) => { c.papeis[titular] = { role: 'Professional', ativo: false }; }],
    ['colaborador promovido a Professional', (c: ReturnType<typeof preparar>) => { c.papeis[colaborador] = { role: 'Professional', ativo: true }; }],
    ['paciente inexistente ou de outro tenant', (c: ReturnType<typeof preparar>) => { c.query.mockResolvedValueOnce([]); }],
    ['responsável trocado depois da leitura prévia', (c: ReturnType<typeof preparar>) => { c.delegacao.findOne.mockResolvedValueOnce({ id: delegacaoId }); c.paciente.findOne.mockResolvedValueOnce(null); }],
    ['titular arquivado', (c: ReturnType<typeof preparar>) => { c.delegacao.findOne.mockResolvedValueOnce({ id: delegacaoId }); c.profissional.findOne.mockResolvedValueOnce(null); }]
  ])('%s: nega', async (_caso, ajustar) => {
    const c = preparar(); c.delegacao.findOne.mockResolvedValue({ id: delegacaoId }); ajustar(c);
    await expect(chamar(c)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('o próprio titular nunca passa pelo caminho de colaborador', async () => {
    const c = preparar(); c.delegacao.findOne.mockResolvedValueOnce({ id: delegacaoId });
    await expect(chamar(c, titular)).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.usuario.findOne).not.toHaveBeenCalled();
  });
});
