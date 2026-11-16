import { ForbiddenException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import * as pendencia from '../../planos-alimentares/aplicacao/autorizacao-pendencia-restricao';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { VinculoRepresentacaoPacienteOrm } from '../infraestrutura/vinculo-representacao-paciente.orm';
import { revogarVinculosDoPaciente, revogarVinculosPorAlteracaoAcesso, ServicoVinculosRepresentacao } from './servico-vinculos-representacao';

/** FOOD06 P2d-3a: dados sintéticos; o comportamento real sob PostgreSQL fica na prova RLS. */
const tenant = '11111111-1111-4111-8111-111111111111';
const ator = '22222222-2222-4222-8222-222222222222';
const representante = '33333333-3333-4333-8333-333333333333';
const pacienteId = '44444444-4444-4444-8444-444444444444';
const contaPaciente = '55555555-5555-4555-8555-555555555555';
const vinculoId = '66666666-6666-4666-8666-666666666666';
const profissional: UsuarioAutenticado = { tenantId: tenant, usuarioId: ator, papel: 'Professional', emailHash: '', permissoes: [] };

function preparar() {
  const papeis: Record<string, { role: string; ativo: boolean } | null> = { [representante]: { role: 'Patient', ativo: true } };
  const usuario = { findOne: jest.fn(async ({ where }: { where: { id: string } }) => { const p = papeis[where.id]; return p ? { id: where.id, ...p } : null; }) };
  const paciente = { findOne: jest.fn(async (): Promise<unknown> => ({ id: pacienteId, usuarioId: contaPaciente })) };
  const vinculo = { findOne: jest.fn(async (): Promise<unknown> => null), find: jest.fn(async (): Promise<unknown[]> => []), update: jest.fn(async () => ({ affected: 1 })) };
  const auditoria = { insert: jest.fn(async () => undefined), save: jest.fn(async () => undefined), create: jest.fn((x: unknown) => x) };
  const query = jest.fn(async (sql: string, _p?: unknown[]): Promise<unknown[]> => {
    if (sql === 'show transaction_isolation') return [{ transaction_isolation: 'read committed' }];
    if (sql.includes('insert into vinculos_representacao_paciente')) return [{ id: vinculoId, verificado_em: new Date(0) }];
    if (sql.includes('update vinculos_representacao_paciente')) return [{ id: vinculoId }];
    if (sql.includes('as do_paciente')) return [{ do_paciente: 0, do_representante: 0 }];
    return [];
  });
  const g = { query, queryRunner: { isTransactionActive: true }, getRepository: jest.fn((e: unknown) => {
    if (e === UsuarioOrm) return usuario; if (e === PacienteOrm) return paciente; if (e === VinculoRepresentacaoPacienteOrm) return vinculo; return auditoria;
  }) };
  const executor = { executar: jest.fn(async (_t: string, fn: (x: unknown) => unknown) => fn(g)) };
  const autorizar = jest.spyOn(pendencia, 'autorizarPendenciaRestricao').mockResolvedValue('profissional');
  return { papeis, usuario, paciente, vinculo, query, g, executor, autorizar, s: new ServicoVinculosRepresentacao(executor as never) };
}
const inseriu = (c: ReturnType<typeof preparar>) => c.query.mock.calls.some(([sql]) => sql.includes('insert into vinculos'));

afterEach(() => jest.restoreAllMocks());

describe('ServicoVinculosRepresentacao (P2d-3a)', () => {
  it('equipe autorizada registra; representante travado antes da autorização; auditoria sem conteúdo', async () => {
    const c = preparar();
    await expect(c.s.registrar(profissional, pacienteId, representante.toUpperCase(), 'presencial'))
      .resolves.toEqual({ id: vinculoId, representanteUsuarioId: representante, tipoVerificacao: 'presencial', verificadoEm: new Date(0) });
    expect(c.usuario.findOne.mock.invocationCallOrder[0]).toBeLessThan(c.autorizar.mock.invocationCallOrder[0]);
    expect(c.usuario.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_read' } }));
    expect(c.autorizar).toHaveBeenCalledWith(c.g, expect.objectContaining({ usuarioId: ator, tenantId: tenant }), pacienteId);
    expect(c.query.mock.calls.find(([sql]) => sql.includes('insert into vinculos'))?.[1]).toEqual([tenant, pacienteId, representante, ator, 'presencial']);
  });
  it('colaborador delegado também registra (prova delegada pela autorização da equipe)', async () => {
    const c = preparar(); c.autorizar.mockResolvedValue('colaborador');
    await expect(c.s.registrar({ ...profissional, papel: 'Collaborator' }, pacienteId, representante, 'procuracao')).resolves.toMatchObject({ id: vinculoId });
  });
  it('vínculo vigente repetido devolve o mesmo sem nova linha', async () => {
    const c = preparar(); c.vinculo.findOne.mockResolvedValueOnce({ id: vinculoId, representanteUsuarioId: representante, tipoVerificacao: 'presencial', verificadoEm: new Date(1) });
    await expect(c.s.registrar(profissional, pacienteId, representante, 'presencial')).resolves.toMatchObject({ id: vinculoId, tipoVerificacao: 'presencial' });
    expect(inseriu(c)).toBe(false);
  });
  it('repetição com outro tipo de verificação é conflito explícito, sem reescrever', async () => {
    const c = preparar(); c.vinculo.findOne.mockResolvedValueOnce({ id: vinculoId, representanteUsuarioId: representante, tipoVerificacao: 'outro', verificadoEm: new Date(1) });
    await expect(c.s.registrar(profissional, pacienteId, representante, 'presencial')).rejects.toMatchObject({ status: 409 });
    expect(inseriu(c)).toBe(false);
  });
  it('a linha do paciente é relida com trava explícita e a autorização precisa ser da equipe', async () => {
    const c = preparar();
    await c.s.registrar(profissional, pacienteId, representante, 'presencial');
    expect(c.paciente.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    const d = preparar(); d.autorizar.mockResolvedValue('declaracao_paciente' as never);
    await expect(d.s.registrar(profissional, pacienteId, representante, 'presencial')).rejects.toMatchObject({ status: 403 });
    expect(inseriu(d)).toBe(false);
  });
  it.each([
    ['ator é o próprio representante', (c: ReturnType<typeof preparar>) => c.s.registrar(profissional, pacienteId, ator, 'presencial')],
    ['representante é a conta do próprio paciente', (c: ReturnType<typeof preparar>) => {
      c.papeis[contaPaciente] = { role: 'Patient', ativo: true }; return c.s.registrar(profissional, pacienteId, contaPaciente, 'presencial'); }],
    ['representante inativo', (c: ReturnType<typeof preparar>) => { c.papeis[representante] = { role: 'Patient', ativo: false }; return c.s.registrar(profissional, pacienteId, representante, 'presencial'); }],
    ['representante não é Patient', (c: ReturnType<typeof preparar>) => { c.papeis[representante] = { role: 'Collaborator', ativo: true }; return c.s.registrar(profissional, pacienteId, representante, 'presencial'); }],
    ['representante de outro tenant (invisível sob RLS)', (c: ReturnType<typeof preparar>) => { c.papeis[representante] = null; return c.s.registrar(profissional, pacienteId, representante, 'presencial'); }],
    ['equipe sem carteira ou delegação', (c: ReturnType<typeof preparar>) => { c.autorizar.mockRejectedValue(new ForbiddenException()); return c.s.registrar(profissional, pacienteId, representante, 'presencial'); }],
    ['Patient', (c: ReturnType<typeof preparar>) => c.s.registrar({ ...profissional, papel: 'Patient' }, pacienteId, representante, 'presencial')],
    ['SuperAdmin', (c: ReturnType<typeof preparar>) => c.s.listar({ ...profissional, papel: 'SuperAdmin' }, pacienteId)],
    ['Client', (c: ReturnType<typeof preparar>) => c.s.revogar({ ...profissional, papel: 'Client' }, pacienteId, vinculoId)]
  ])('%s: 403 sem gravar', async (_caso, agir) => {
    const c = preparar();
    await expect(agir(c)).rejects.toMatchObject({ status: 403, message: 'Operação não autorizada.' });
    expect(inseriu(c)).toBe(false);
  });
  it('entrada inválida responde 400 antes do banco', async () => {
    const c = preparar();
    await expect(c.s.registrar(profissional, pacienteId, representante, 'CANARIO_TIPO')).rejects.toMatchObject({ status: 400 });
    await expect(c.s.registrar(profissional, 'x', representante, 'presencial')).rejects.toMatchObject({ status: 400 });
    await expect(c.s.revogar(profissional, pacienteId, 'x')).rejects.toMatchObject({ status: 400 });
    expect(c.executor.executar).not.toHaveBeenCalled();
  });
  it('corrida no índice único vira 409 sem eco', async () => {
    const c = preparar(); c.query.mockImplementation(async (sql: string) => {
      if (sql === 'show transaction_isolation') return [{ transaction_isolation: 'read committed' }];
      throw Object.assign(new Error('duplicate CANARIO_SQL'), { code: '23505' });
    });
    await expect(c.s.registrar(profissional, pacienteId, representante, 'presencial')).rejects.toMatchObject({ status: 409, message: 'Operação indisponível ou concorrente.' });
  });
  it('revogação só alcança vínculo do paciente autorizado; repetida é idempotente', async () => {
    const c = preparar();
    await expect(c.s.revogar(profissional, pacienteId, vinculoId)).rejects.toBeInstanceOf(ForbiddenException);
    c.vinculo.findOne.mockResolvedValueOnce({ id: vinculoId, revogadoEm: null });
    await expect(c.s.revogar(profissional, pacienteId, vinculoId)).resolves.toEqual({ id: vinculoId, revogado: true });
    expect(c.vinculo.findOne).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: vinculoId, tenantId: tenant, pacienteId }, lock: { mode: 'pessimistic_write' } }));
    expect(c.autorizar.mock.invocationCallOrder[0]).toBeLessThan(c.vinculo.findOne.mock.invocationCallOrder[0]);
    c.vinculo.findOne.mockResolvedValueOnce({ id: vinculoId, revogadoEm: new Date() }); c.vinculo.update.mockClear();
    await expect(c.s.revogar(profissional, pacienteId, vinculoId)).resolves.toEqual({ id: vinculoId, revogado: true });
    expect(c.vinculo.update).not.toHaveBeenCalled();
  });
  it.each([[{ do_paciente: 100, do_representante: 0 }], [{ do_paciente: 0, do_representante: 100 }]])(
    'limite de 100 vigentes (por paciente ou por representante) responde 409 sem gravar, sob trava consultiva', async limite => {
      const c = preparar(); const base = c.query.getMockImplementation()!;
      c.query.mockImplementation(async (sql: string, p?: unknown[]) => sql.includes('as do_paciente') ? [limite] : base(sql, p));
      await expect(c.s.registrar(profissional, pacienteId, representante, 'presencial')).rejects.toMatchObject({ status: 409 });
      expect(inseriu(c)).toBe(false);
      expect(c.query.mock.calls.find(([sql]) => sql.includes('pg_advisory_xact_lock'))?.[1]).toEqual([`representante:${tenant}:${representante}`]);
    });
  it('lista só vínculos vigentes do paciente, depois de autorizar', async () => {
    const c = preparar(); c.vinculo.find.mockResolvedValueOnce([{ id: vinculoId, representanteUsuarioId: representante, tipoVerificacao: 'presencial', verificadoEm: new Date(0), revogadoPor: 'CANARIO' }]);
    await expect(c.s.listar(profissional, pacienteId)).resolves.toEqual([{ id: vinculoId, representanteUsuarioId: representante, tipoVerificacao: 'presencial', verificadoEm: new Date(0) }]);
    expect(c.vinculo.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: tenant, pacienteId, revogadoEm: expect.anything() }) }));
  });
  it('cascatas revogam pela conta representante ou pelo paciente', async () => {
    const c = preparar();
    await revogarVinculosPorAlteracaoAcesso(c.g as never, tenant, representante, ator);
    await revogarVinculosDoPaciente(c.g as never, tenant, pacienteId, ator, 'arquivamento');
    const updates = c.query.mock.calls.filter(([sql]) => sql.includes('update vinculos_representacao_paciente'));
    expect(updates[0][0]).toMatch(/v\.representante_usuario_id = \$2/); expect(updates[0][1]).toEqual([tenant, representante, ator]);
    expect(updates[1][0]).toMatch(/v\.paciente_id = \$2/); expect(updates[1][1]).toEqual([tenant, pacienteId, ator]);
  });
});
