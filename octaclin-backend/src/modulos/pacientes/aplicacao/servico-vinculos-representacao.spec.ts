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
const profissionalId = '77777777-7777-4777-8777-777777777777';
const MASCARADO = { tipo: 'email_mascarado', email: 'h***@e***.test' };
const profissional: UsuarioAutenticado = { tenantId: tenant, usuarioId: ator, papel: 'Professional', emailHash: '', permissoes: [] };

function preparar() {
  const papeis: Record<string, { role: string; ativo: boolean } | null> = { [representante]: { role: 'Patient', ativo: true } };
  // Conta achada por hash de e-mail (P3-0b). Chave: hash sintético; o mock de criptografia gera `h:<email>`.
  const porHash: Record<string, { id: string; role: string; ativo: boolean; emailCriptografado: Buffer } | undefined> = {};
  const usuario = {
    findOne: jest.fn(async ({ where }: { where: { id?: string; emailHash?: string } }) => {
      if (where.emailHash !== undefined) return porHash[where.emailHash] ?? null;
      const p = papeis[where.id!]; return p ? { id: where.id, ...p } : null; }),
    find: jest.fn(async (): Promise<unknown[]> => [{ id: representante, emailCriptografado: Buffer.from('cifrado:helena.souza@example.test') }])
  };
  const paciente = { findOne: jest.fn(async (): Promise<unknown> => ({ id: pacienteId, usuarioId: contaPaciente, profissionalResponsavelId: profissionalId })),
    find: jest.fn(async (): Promise<unknown[]> => []) };
  const criptografia = {
    descriptografar: jest.fn((b: Buffer) => { const t = b.toString(); if (!t.startsWith('cifrado:')) throw new Error('CANARIO_CRIPTO'); return t.slice(8); }),
    gerarHashBusca: jest.fn((v: string) => `h:${v.trim().toLowerCase()}`)
  };
  const protecao = { consumirTentativa: jest.fn(async () => undefined) };
  const vinculo = { findOne: jest.fn(async (): Promise<unknown> => null), find: jest.fn(async (): Promise<unknown[]> => []), update: jest.fn(async () => ({ affected: 1 })) };
  const auditoria = { insert: jest.fn(async () => undefined), save: jest.fn(async () => undefined), create: jest.fn((x: unknown) => x) };
  const query = jest.fn(async (sql: string, _p?: unknown[]): Promise<unknown[]> => {
    if (sql === 'show transaction_isolation') return [{ transaction_isolation: 'read committed' }];
    if (sql.includes('insert into vinculos_representacao_paciente')) return [{ id: vinculoId, verificado_em: new Date(0) }];
    // Formato REAL do TypeORM/pg para UPDATE ... RETURNING via query(): [linhas, contagem].
    if (sql.includes('update vinculos_representacao_paciente')) return [[{ id: vinculoId }], 1];
    if (sql.includes('as do_paciente')) return [{ do_paciente: 0, do_representante: 0 }];
    return [];
  });
  const g = { query, queryRunner: { isTransactionActive: true }, getRepository: jest.fn((e: unknown) => {
    if (e === UsuarioOrm) return usuario; if (e === PacienteOrm) return paciente; if (e === VinculoRepresentacaoPacienteOrm) return vinculo; return auditoria;
  }) };
  const executor = { executar: jest.fn(async (_t: string, fn: (x: unknown) => unknown) => fn(g)) };
  const autorizar = jest.spyOn(pendencia, 'autorizarPendenciaRestricao').mockResolvedValue('profissional');
  return { papeis, porHash, usuario, paciente, vinculo, query, g, executor, autorizar, criptografia, protecao, auditoria,
    s: new ServicoVinculosRepresentacao(executor as never, criptografia as never, protecao as never) };
}
const inseriu = (c: ReturnType<typeof preparar>) => c.query.mock.calls.some(([sql]) => sql.includes('insert into vinculos'));

afterEach(() => jest.restoreAllMocks());

describe('ServicoVinculosRepresentacao (P2d-3a)', () => {
  it('equipe autorizada registra; representante travado antes da autorização; auditoria sem conteúdo', async () => {
    const c = preparar();
    await expect(c.s.registrar(profissional, pacienteId, representante.toUpperCase(), 'presencial'))
      .resolves.toEqual({ id: vinculoId, representanteUsuarioId: representante, tipoVerificacao: 'presencial', verificadoEm: new Date(0), identificacao: MASCARADO });
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
  it.each(['listar', 'revogar'] as const)('%s exige que a autorização seja da equipe (nunca de um paciente)', async metodo => {
    const c = preparar(); c.autorizar.mockResolvedValue('declaracao_paciente' as never); c.vinculo.findOne.mockResolvedValue({ id: vinculoId, revogadoEm: null });
    const chamada = metodo === 'listar' ? c.s.listar(profissional, pacienteId) : c.s.revogar(profissional, pacienteId, vinculoId);
    await expect(chamada).rejects.toMatchObject({ status: 403 });
    expect(c.vinculo.find).not.toHaveBeenCalled(); expect(c.vinculo.update).not.toHaveBeenCalled();
  });
  it.each(['listar', 'revogar'] as const)('Patient não usa %s', async metodo => {
    const c = preparar(); const patient = { ...profissional, papel: 'Patient' as const };
    await expect(metodo === 'listar' ? c.s.listar(patient, pacienteId) : c.s.revogar(patient, pacienteId, vinculoId)).rejects.toMatchObject({ status: 403 });
    expect(c.executor.executar).not.toHaveBeenCalled();
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
    await expect(c.s.listar(profissional, pacienteId)).resolves.toEqual([{ id: vinculoId, representanteUsuarioId: representante, tipoVerificacao: 'presencial',
      verificadoEm: new Date(0), identificacao: MASCARADO }]);
    expect(c.vinculo.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: tenant, pacienteId, revogadoEm: expect.anything() }) }));
  });
  it('cascata grava exatamente uma auditoria por vínculo revogado, com o id certo, e falha fechado com formato inesperado', async () => {
    const c = preparar();
    await revogarVinculosPorAlteracaoAcesso(c.g as never, tenant, representante, ator);
    const auditorias = (c.g.getRepository('auditoria' as never) as unknown as { save: jest.Mock; create: jest.Mock }).create.mock.calls.map(([x]) => x);
    expect(auditorias).toEqual([expect.objectContaining({ recursoId: vinculoId, acao: 'representacao.vinculo.revogar_por_alteracao_acesso', metadados: {} })]);
    const d = preparar(); d.query.mockImplementation(async (sql: string) => sql.includes('update vinculos') ? [{ id: vinculoId }] : []);
    await expect(revogarVinculosPorAlteracaoAcesso(d.g as never, tenant, representante, ator)).rejects.toThrow();
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

describe('ServicoVinculosRepresentacao — pessoas (P3-0b)', () => {
  const vigente = { id: vinculoId, representanteUsuarioId: representante, tipoVerificacao: 'presencial', verificadoEm: new Date(0) };
  const conta = (sobre: Record<string, unknown> = {}) => ({ id: representante, role: 'Patient', ativo: true,
    emailCriptografado: Buffer.from('cifrado:helena.souza@example.test'), ...sobre });

  it('identificação: nome da ficha só quando ela é da carteira do paciente atual; senão, e-mail mascarado', async () => {
    const c = preparar(); c.vinculo.find.mockResolvedValue([vigente]);
    c.paciente.find.mockResolvedValueOnce([{ id: 'x', usuarioId: representante, nomeCriptografado: Buffer.from('cifrado:Helena Sintética') }]);
    await expect(c.s.listar(profissional, pacienteId)).resolves.toEqual([{ ...vigente, identificacao: { tipo: 'nome_ficha', nome: 'Helena Sintética' } }]);
    expect(c.paciente.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: tenant,
      profissionalResponsavelId: profissionalId, arquivadoEm: expect.anything() }) }));
    await expect(c.s.listar(profissional, pacienteId)).resolves.toEqual([{ ...vigente, identificacao: MASCARADO }]);
  });
  it('identificação falha fechado (500 genérico) se o e-mail não abre', async () => {
    const c = preparar(); c.vinculo.find.mockResolvedValue([vigente]);
    c.usuario.find.mockResolvedValueOnce([{ id: representante, emailCriptografado: Buffer.from('CANARIO') }]);
    await expect(c.s.listar(profissional, pacienteId)).rejects.toMatchObject({ status: 500, message: 'Operação indisponível.' });
  });

  it('busca: conta Patient ativa elegível volta com identificação; hash do e-mail normalizado; auditoria sem e-mail', async () => {
    const c = preparar(); c.porHash['h:helena.souza@example.test'] = conta();
    await expect(c.s.buscarCandidato(profissional, pacienteId, '  Helena.Souza@Example.TEST ')).resolves
      .toEqual({ candidato: { usuarioId: representante, identificacao: MASCARADO } });
    expect(c.usuario.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: tenant, emailHash: 'h:helena.souza@example.test' } }));
    expect(c.autorizar).toHaveBeenCalledWith(c.g, expect.objectContaining({ usuarioId: ator }), pacienteId);
    expect(c.auditoria.create).toHaveBeenCalledWith(expect.objectContaining({ acao: 'representacao.candidato.buscar', recursoId: pacienteId, metadados: {} }));
    expect(JSON.stringify([c.auditoria.create.mock.calls, c.protecao.consumirTentativa.mock.calls])).not.toMatch(/helena|example/i);
  });
  it('busca consome a cota por usuário antes do banco; 429 passa sem virar outro erro', async () => {
    const c = preparar();
    await c.s.buscarCandidato(profissional, pacienteId, 'x@example.test');
    expect(c.protecao.consumirTentativa).toHaveBeenCalledWith(`representante.candidato:${tenant}:${ator}`, expect.objectContaining({ maxTentativas: 10 }));
    // Revisão R4 (MÉDIA): cota agregada por tenant, para varredura com várias contas da equipe.
    expect(c.protecao.consumirTentativa).toHaveBeenCalledWith(`representante.candidato:${tenant}`, expect.objectContaining({ maxTentativas: 60 }));
    expect(c.protecao.consumirTentativa.mock.invocationCallOrder[1]).toBeLessThan(c.executor.executar.mock.invocationCallOrder[0]);
    expect(c.protecao.consumirTentativa.mock.invocationCallOrder[0]).toBeLessThan(c.executor.executar.mock.invocationCallOrder[0]);
    const { HttpException } = await import('@nestjs/common');
    c.protecao.consumirTentativa.mockRejectedValueOnce(new HttpException('Muitas', 429));
    c.executor.executar.mockClear();
    await expect(c.s.buscarCandidato(profissional, pacienteId, 'x@example.test')).rejects.toMatchObject({ status: 429 });
    expect(c.executor.executar).not.toHaveBeenCalled();
  });
  it.each([
    ['não existe', (_c: ReturnType<typeof preparar>) => undefined],
    ['inativa', (c: ReturnType<typeof preparar>) => { c.porHash['h:alvo@example.test'] = conta({ ativo: false }); }],
    ['não é Patient', (c: ReturnType<typeof preparar>) => { c.porHash['h:alvo@example.test'] = conta({ role: 'Collaborator' }); }],
    ['é a conta do próprio paciente', (c: ReturnType<typeof preparar>) => { c.porHash['h:alvo@example.test'] = conta({ id: contaPaciente }); }],
    ['é o próprio ator', (c: ReturnType<typeof preparar>) => { c.porHash['h:alvo@example.test'] = conta({ id: ator }); }],
  ])('busca: conta que %s tem a MESMA resposta, sem abrir e-mail nem ficha', async (_n, montar) => {
    const c = preparar(); montar(c);
    await expect(c.s.buscarCandidato(profissional, pacienteId, 'alvo@example.test')).resolves.toEqual({ candidato: null });
    expect(c.criptografia.descriptografar).not.toHaveBeenCalled();
    expect(c.paciente.find).not.toHaveBeenCalled();
  });
  it.each(['', 'sem-arroba', 'a@b', `${'a'.repeat(250)}@example.test`, 'a b@example.test', 42, null])(
    'busca: e-mail inválido (%p) responde 400 sem consumir cota nem banco', async email => {
      const c = preparar();
      await expect(c.s.buscarCandidato(profissional, pacienteId, email as never)).rejects.toMatchObject({ status: 400 });
      expect(c.protecao.consumirTentativa).not.toHaveBeenCalled(); expect(c.executor.executar).not.toHaveBeenCalled();
    });
  it('busca exige autorização da equipe; Patient nem consome cota', async () => {
    const c = preparar(); c.autorizar.mockResolvedValue('declaracao_paciente' as never); c.porHash['h:alvo@example.test'] = conta();
    await expect(c.s.buscarCandidato(profissional, pacienteId, 'alvo@example.test')).rejects.toMatchObject({ status: 403 });
    expect(c.usuario.findOne).not.toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ emailHash: expect.anything() }) }));
    const d = preparar();
    await expect(d.s.buscarCandidato({ ...profissional, papel: 'Patient' }, pacienteId, 'alvo@example.test')).rejects.toMatchObject({ status: 403 });
    expect(d.protecao.consumirTentativa).not.toHaveBeenCalled();
  });
});
