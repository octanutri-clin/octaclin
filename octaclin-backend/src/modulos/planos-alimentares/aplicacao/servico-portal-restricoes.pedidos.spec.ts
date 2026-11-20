import { In } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { inspect } from 'node:util';
import { autorizarPacientePortal } from './autorizacao-paciente-portal';
import { cifrarCampo, decifrarCampo, decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { SolicitacaoRestricaoPacienteOrm } from '../infraestrutura/solicitacao-restricao-paciente.orm';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { ServicoPortalRestricoes } from './servico-portal-restricoes';

jest.mock('./autorizacao-paciente-portal', () => ({ autorizarPacientePortal: jest.fn(async () => 'propria') }));
jest.mock('../infraestrutura/codec-conteudo-restricao', () => ({
  cifrarCampo: jest.fn(() => Buffer.from('cifra-sintetica')),
  decifrarCampo: jest.fn((_c: unknown, campo: string) => campo.endsWith('explicacao_paciente_criptografada') ? 'Explicação sintética' : { itens: [{ item: 'i1', texto: 'Texto sintético' }] }),
  decifrarConteudoRestricao: jest.fn(() => ({ schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alergeno', id: 'alvo-sintetico' },
    observacao: 'CANARIO_OBSERVACAO' }))
}));
jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({ registrarAuditoriaNaTransacao: jest.fn(async () => undefined) }));

/** FOOD06 P2d-3b: dados sintéticos; o comportamento real (RLS, locks, triggers) fica na prova PostgreSQL. */
const tenant = '11111111-1111-4111-8111-111111111111';
const conta = '22222222-2222-4222-8222-222222222222';
const paciente = '33333333-3333-4333-8333-333333333333';
const restricao = '44444444-4444-4444-8444-444444444444';
const pedidoId = '55555555-5555-4555-8555-555555555555';
const chave = '66666666-6666-4666-8666-666666666666';
const outroAutor = '77777777-7777-4777-8777-777777777777';
const ator = { tenantId: tenant, usuarioId: conta, papel: 'Patient', emailHash: '', permissoes: [] } as const;
const itens = [{ item: 'i1', texto: 'Texto sintético' }];

function preparar() {
  const solicitacao = (extra: Record<string, unknown> = {}) => ({ id: pedidoId, tenantId: tenant, pacienteId: paciente, restricaoId: restricao, tipo: 'correcao',
    estado: 'criada', autorUsuarioId: conta, chaveCriacao: chave, conteudoCriptografado: Buffer.from('c'), revisao: 1,
    criadoEm: new Date('2026-11-17T10:00:00.000Z'), justificativaInternaCriptografada: Buffer.from('CANARIO_JUSTIFICATIVA'), ...extra });
  const solicitacoes = { findOne: jest.fn(async (): Promise<unknown> => null), find: jest.fn(async (): Promise<unknown[]> => []),
    update: jest.fn(async () => ({ affected: 1 })), count: jest.fn(async () => 0) };
  const restricoes = { findOne: jest.fn(async (): Promise<unknown> => ({ id: restricao })), find: jest.fn(async (): Promise<unknown[]> => []) };
  const avaliacoes = { findOne: jest.fn(async (): Promise<unknown> => null) };
  const query = jest.fn(async (sql: string, _p?: unknown[]): Promise<unknown[]> => {
    if (sql === 'show transaction_isolation') return [{ transaction_isolation: 'read committed' }];
    if (sql.includes('insert into solicitacoes_restricoes_pacientes')) return [{ criado_em: new Date('2026-11-17T11:00:00.000Z') }];
    return [];
  });
  const g = { query, getRepository: jest.fn((e: unknown) => {
    if (e === SolicitacaoRestricaoPacienteOrm) return solicitacoes; if (e === RestricaoPacienteOrm) return restricoes;
    if (e === AvaliacaoRestricoesPacienteOrm) return avaliacoes; throw new Error('Repositório inesperado');
  }) };
  const executor = { executar: jest.fn(async (_t: string, fn: (x: unknown) => unknown) => fn(g)) };
  return { solicitacao, solicitacoes, restricoes, avaliacoes, query, g, executor, s: new ServicoPortalRestricoes(executor as never, {} as never) };
}
const inseriu = (c: ReturnType<typeof preparar>) => c.query.mock.calls.some(([sql]) => sql.includes('insert into solicitacoes'));
beforeEach(() => jest.clearAllMocks());

describe('portal do paciente: pedidos (P2d-3b)', () => {
  it('cria pedido de correção de restrição visível do mesmo paciente: prova o acesso antes, trava a chave, cifra na revisão 1 e audita sem conteúdo', async () => {
    const c = preparar();
    const r = await c.s.criarPedido(ator as never, paciente, { chaveCriacao: chave, tipo: 'correcao', restricaoId: restricao, itens });
    expect(r).toEqual({ id: expect.any(String), tipo: 'correcao', chaveTexto: 'restricoes.solicitacao.enviada', criadoEm: '2026-11-17T11:00:00.000Z', podeCancelar: true });
    expect(autorizarPacientePortal).toHaveBeenCalledWith(c.g, expect.objectContaining({ usuarioId: conta }), paciente);
    expect(jest.mocked(autorizarPacientePortal).mock.invocationCallOrder[0]).toBeLessThan(c.solicitacoes.findOne.mock.invocationCallOrder[0]);
    expect(c.query.mock.calls.find(([sql]) => sql.includes('pg_advisory_xact_lock'))?.[1]).toEqual([`solicitacao:${tenant}:${conta}:${chave}`]);
    expect(c.restricoes.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: restricao, tenantId: tenant, pacienteId: paciente }) }));
    // PUX-01/05 (R4): o item revisado (rejeitado) chega ao portal, então o filtro que recusa pedido sobre ele é fixado aqui.
    expect(c.restricoes.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      estado: In(['ativa', 'em_reavaliacao']), confirmacao: In(['pendente', 'confirmada']) }) }));
    expect(cifrarCampo).toHaveBeenCalledWith(expect.anything(), 'solicitacoes_restricoes_pacientes.conteudo_criptografado', { itens },
      expect.objectContaining({ tenantId: tenant, pacienteId: paciente, revisao: 1 }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.solicitacao_criar', metadados: {} }));
  });
  it('restrição de outro paciente, inativa ou rejeitada (fora do filtro): 403 sem gravar', async () => {
    const c = preparar(); c.restricoes.findOne.mockResolvedValueOnce(null);
    await expect(c.s.criarPedido(ator as never, paciente, { chaveCriacao: chave, tipo: 'remocao', restricaoId: restricao, itens })).rejects.toMatchObject({ status: 403 });
    expect(inseriu(c)).toBe(false);
  });
  it('repetição idempotente devolve o pedido; mesma chave com outro conteúdo, tipo ou paciente é conflito', async () => {
    const c = preparar(); c.solicitacoes.findOne.mockResolvedValue(c.solicitacao());
    await expect(c.s.criarPedido(ator as never, paciente, { chaveCriacao: chave, tipo: 'correcao', restricaoId: restricao, itens })).resolves.toMatchObject({ id: pedidoId });
    await expect(c.s.criarPedido(ator as never, paciente, { chaveCriacao: chave, tipo: 'remocao', restricaoId: restricao, itens })).rejects.toMatchObject({ status: 409 });
    jest.mocked(decifrarCampo).mockReturnValueOnce({ itens: [{ item: 'i9', texto: 'Outro' }] });
    await expect(c.s.criarPedido(ator as never, paciente, { chaveCriacao: chave, tipo: 'correcao', restricaoId: restricao, itens })).rejects.toMatchObject({ status: 409 });
    expect(inseriu(c)).toBe(false);
  });
  it.each([
    ['tipo inclusão (vira declaração, não pedido)', { chaveCriacao: chave, tipo: 'inclusao', restricaoId: restricao, itens }],
    ['sem restrição', { chaveCriacao: chave, tipo: 'correcao', itens }],
    ['item inválido', { chaveCriacao: chave, tipo: 'correcao', restricaoId: restricao, itens: [{ item: 'i1', texto: '' }] }],
    ['campo extra', { chaveCriacao: chave, tipo: 'correcao', restricaoId: restricao, itens, tenantId: tenant }]
  ])('%s: 400 antes do banco', async (_caso, dados) => {
    const c = preparar();
    await expect(c.s.criarPedido(ator as never, paciente, dados)).rejects.toMatchObject({ status: 400 });
    expect(c.executor.executar).not.toHaveBeenCalled();
  });
  it.each(['Professional', 'Collaborator', 'SuperAdmin', 'Client'] as const)('papel %s não usa o portal', async papel => {
    const c = preparar();
    await expect(c.s.listarPedidos({ ...ator, papel } as never, paciente)).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.executor.executar).not.toHaveBeenCalled();
  });
  it('sem acesso ao paciente: 403 antes de tocar pedidos', async () => {
    const c = preparar(); jest.mocked(autorizarPacientePortal).mockRejectedValueOnce(new ForbiddenException());
    await expect(c.s.listarPedidos(ator as never, paciente)).rejects.toMatchObject({ status: 403 });
    expect(c.solicitacoes.find).not.toHaveBeenCalled();
  });

  it('só o autor cancela, de enviada ou em análise, com trava e CAS; auditoria sem conteúdo', async () => {
    const c = preparar(); c.solicitacoes.findOne.mockResolvedValueOnce(c.solicitacao({ estado: 'em_analise', revisao: 2 }));
    await expect(c.s.cancelarPedido(ator as never, paciente, pedidoId)).resolves.toMatchObject({ id: pedidoId, chaveTexto: 'restricoes.solicitacao.cancelada', podeCancelar: false });
    expect(c.solicitacoes.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: pedidoId, tenantId: tenant, pacienteId: paciente }, lock: { mode: 'pessimistic_write' } }));
    expect(c.solicitacoes.update).toHaveBeenCalledWith(expect.objectContaining({ id: pedidoId, revisao: 2, estado: 'em_analise' }),
      expect.objectContaining({ estado: 'cancelada_pelo_paciente', revisao: 3 }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.solicitacao_cancelar', metadados: {} }));
  });
  it('pedido de outro autor (ex.: outro representante) ou inexistente: 403; decidido: 409; corrida no CAS: 409', async () => {
    const c = preparar();
    c.solicitacoes.findOne.mockResolvedValueOnce(c.solicitacao({ autorUsuarioId: outroAutor }));
    await expect(c.s.cancelarPedido(ator as never, paciente, pedidoId)).rejects.toMatchObject({ status: 403 });
    await expect(c.s.cancelarPedido(ator as never, paciente, pedidoId)).rejects.toMatchObject({ status: 403 });
    c.solicitacoes.findOne.mockResolvedValueOnce(c.solicitacao({ estado: 'atendida' }));
    await expect(c.s.cancelarPedido(ator as never, paciente, pedidoId)).rejects.toMatchObject({ status: 409 });
    c.solicitacoes.findOne.mockResolvedValueOnce(c.solicitacao()); c.solicitacoes.update.mockResolvedValueOnce({ affected: 0 });
    await expect(c.s.cancelarPedido(ator as never, paciente, pedidoId)).rejects.toMatchObject({ status: 409 });
    expect(registrarAuditoriaNaTransacao).not.toHaveBeenCalled();
  });

  it('lista pela projeção do portal: decidido mostra a explicação; nunca justificativa, estado interno ou autor', async () => {
    const c = preparar(); c.solicitacoes.find.mockResolvedValueOnce([
      c.solicitacao({ estado: 'parcial', revisao: 3, decididoEm: new Date('2026-11-17T12:00:00.000Z'), explicacaoPacienteCriptografada: Buffer.from('e') }),
      c.solicitacao({ id: '88888888-8888-4888-8888-888888888888', autorUsuarioId: outroAutor })]);
    const { itens: r, maisAntigos } = await c.s.listarPedidos(ator as never, paciente);
    expect(maisAntigos).toBe(false);
    expect(c.solicitacoes.find).toHaveBeenCalledWith(expect.objectContaining({ take: 101 }));
    expect(r[0]).toEqual({ id: pedidoId, tipo: 'correcao', chaveTexto: 'restricoes.solicitacao.parcial', criadoEm: '2026-11-17T10:00:00.000Z',
      decididoEm: '2026-11-17T12:00:00.000Z', explicacao: 'Explicação sintética', podeCancelar: false });
    expect(r[1]).toMatchObject({ chaveTexto: 'restricoes.solicitacao.enviada', podeCancelar: false });
    expect(decifrarCampo).toHaveBeenCalledWith(expect.anything(), 'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada', expect.anything(),
      expect.objectContaining({ registroId: pedidoId, revisao: 3 }));
    expect(jest.mocked(decifrarCampo).mock.calls.some(([, campo]) => String(campo).includes('justificativa'))).toBe(false);
    expect(inspect(r)).not.toMatch(/CANARIO_|em_analise|parcial"|autor|revisao/);
  });

  it('resumo: só restrições visíveis, sem observação; data da confirmação só com avaliação confirmada', async () => {
    const c = preparar();
    c.restricoes.find.mockResolvedValueOnce([{ id: restricao, origem: 'declaracao_paciente', estado: 'ativa', confirmacao: 'pendente', revisao: 1, conteudoCriptografado: Buffer.from('x') }]);
    c.avaliacoes.findOne.mockResolvedValueOnce({ id: 'a', situacao: 'restricoes_registradas', confirmadoEm: new Date('2026-11-01T00:00:00.000Z') });
    const r = await c.s.resumo(ator as never, paciente);
    expect(r).toEqual({ restricoes: [{ id: restricao, selo: 'restricoes.portal.informada_por_voce', natureza: 'clinica', subtipoClinico: 'alergia_alimentar',
      alvo: { tipo: 'alergeno', id: 'alvo-sintetico' } }], ultimaConfirmacaoEm: '2026-11-01T00:00:00.000Z' });
    expect(c.restricoes.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: tenant, pacienteId: paciente }) }));
    expect(decifrarConteudoRestricao).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ restricaoId: restricao, revisao: 1, finalidade: 'restricao' }));
    expect(inspect(r)).not.toMatch(/CANARIO_/);
    c.restricoes.find.mockResolvedValueOnce([]); c.avaliacoes.findOne.mockResolvedValueOnce({ id: 'a', situacao: 'nao_informado', confirmadoEm: null });
    await expect(c.s.resumo(ator as never, paciente)).resolves.toEqual({ restricoes: [] });
  });
  it('lista sinaliza quando há pedidos além dos 100 mais recentes', async () => {
    const c = preparar(); c.solicitacoes.find.mockResolvedValueOnce(Array.from({ length: 101 }, (_x, i) =>
      c.solicitacao({ id: `${String(i % 10).repeat(8)}-0000-4000-8000-${String(i).padStart(12, '0')}` })));
    const r = await c.s.listarPedidos(ator as never, paciente);
    expect(r.itens).toHaveLength(100); expect(r.maisAntigos).toBe(true);
  });
  it('teto de 50 pedidos abertos por paciente: 409 sem gravar', async () => {
    const c = preparar(); (c.solicitacoes as unknown as { count: jest.Mock }).count = jest.fn(async () => 50);
    await expect(c.s.criarPedido(ator as never, paciente, { chaveCriacao: chave, tipo: 'correcao', restricaoId: restricao, itens })).rejects.toMatchObject({ status: 409 });
    expect(inseriu(c)).toBe(false);
  });
  it('PUX-01/05: resumo inclui rejeitadas há até 30 dias (pela revisão de rejeição e o relógio do banco) com o selo neutro', async () => {
    const c = preparar();
    c.query.mockImplementation(async (sql: string) => sql === 'show transaction_isolation' ? [{ transaction_isolation: 'read committed' }]
      : sql.includes("evento = 'rejeicao'") ? [{ id: restricao, origem: 'declaracao_paciente', estado: 'ativa', confirmacao: 'rejeitada', revisao: 2,
        conteudo_criptografado: Buffer.from('x') }] : []);
    const r = await c.s.resumo(ator as never, paciente);
    expect(r.restricoes.map(x => [x.id, x.selo])).toEqual([[restricao, 'restricoes.portal.revisada']]);
    const [sql, params] = c.query.mock.calls.find(([q]) => String(q).includes("evento = 'rejeicao'"))!;
    expect(sql).toMatch(/r\.confirmacao = 'rejeitada'/);
    expect(sql).toMatch(/clock_timestamp\(\) - interval '30 days'/);
    expect(sql).toMatch(/r\.tenant_id = \$1 and r\.paciente_id = \$2/);
    expect(params).toEqual([tenant, paciente, 201]);
    expect(decifrarConteudoRestricao).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ restricaoId: restricao, revisao: 2, finalidade: 'restricao' }));
  });
  it('teto do resumo conta as rejeitadas recentes junto (falha fechado acima de 200)', async () => {
    const c = preparar(); c.restricoes.find.mockResolvedValueOnce(Array.from({ length: 150 }, () => ({})));
    c.query.mockImplementation(async (sql: string) => sql === 'show transaction_isolation' ? [{ transaction_isolation: 'read committed' }]
      : sql.includes("evento = 'rejeicao'") ? Array.from({ length: 51 }, () => ({})) : []);
    await expect(c.s.resumo(ator as never, paciente)).rejects.toMatchObject({ status: 409 });
  });
  it('resumo acima do limite falha fechado em vez de cortar', async () => {
    const c = preparar(); c.restricoes.find.mockResolvedValueOnce(Array.from({ length: 201 }, () => ({})));
    await expect(c.s.resumo(ator as never, paciente)).rejects.toMatchObject({ status: 409 });
  });
});
