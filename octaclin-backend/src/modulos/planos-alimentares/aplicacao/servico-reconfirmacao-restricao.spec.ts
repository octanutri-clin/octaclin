import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ServicoReconfirmacaoRestricao } from './servico-reconfirmacao-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../infraestrutura/revisao-avaliacao-restricoes.orm';
import { ReconfirmacaoRestricoesOrm } from '../infraestrutura/reconfirmacao-restricoes.orm';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';
import { cifrarCampo, decifrarCampo, decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';

jest.mock('./autorizacao-restricao-clinica', () => ({ autorizarRestricaoClinica: jest.fn(async () => undefined) }));
jest.mock('../infraestrutura/codec-conteudo-restricao', () => ({ cifrarCampo: jest.fn(() => Buffer.from('sintetico')), decifrarCampo: jest.fn(), decifrarConteudoRestricao: jest.fn() }));
jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({ registrarAuditoriaNaTransacao: jest.fn(async () => undefined) }));
const usuario = { tenantId: '11111111-1111-4111-8111-111111111111', usuarioId: '22222222-2222-4222-8222-222222222222', papel: 'Professional', emailHash: '', permissoes: [] } as const;
const paciente = '33333333-3333-4333-8333-333333333333';
const avaliacaoId = '44444444-4444-4444-8444-444444444444';
const chaveIdempotencia = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dados = { avaliacaoId, revisaoAvaliacao: 2, chaveIdempotencia, meio: 'teleconsulta', atestacao: true };
const restricao = { id: '66666666-6666-4666-8666-666666666666', revisao: 1, estado: 'em_reavaliacao', confirmacao: 'confirmada', conteudoCriptografado: Buffer.from('sintetico') };
function preparar() {
  const avaliacoes = { findOne: jest.fn(async (): Promise<unknown> => ({ id: avaliacaoId, revisao: 2, situacao: 'nao_informado' })),
    insert: jest.fn(async () => undefined), update: jest.fn(async (_where: unknown, _changes: unknown) => ({ affected: 1 })) };
  const revisoes = { findOne: jest.fn(async (): Promise<unknown> => {
    const avaliacao = await avaliacoes.findOne.mock.results.at(-1)?.value as { situacao?: string; venceEm?: Date | null } | undefined;
    return { numero: 2, situacao: avaliacao?.situacao, venceEm: avaliacao?.venceEm ?? null };
  }), insert: jest.fn(async () => undefined) };
  const reconfirmacoes = { findOne: jest.fn(async (): Promise<unknown> => null), insert: jest.fn(async () => undefined) };
  const restricoes = { find: jest.fn(async (): Promise<unknown[]> => []), findOne: jest.fn(async (): Promise<unknown> => restricao) };
  const revisoesRestricao = { findOne: jest.fn(async (): Promise<unknown> => ({ numero: 1, evento: 'criacao', conteudoCriptografado: Buffer.from('sintetico') })) };
  const g = { query: jest.fn(async (sql: string, _params?: unknown[]): Promise<Array<Record<string, unknown>>> =>
    sql === 'show transaction_isolation' ? [{ transaction_isolation: 'read committed' }] : sql.includes('is not distinct from') ? [{ consistente: true }] : []), getRepository: jest.fn((entidade: unknown) => {
    if (entidade === AvaliacaoRestricoesPacienteOrm) return avaliacoes;
    if (entidade === RevisaoAvaliacaoRestricoesOrm) return revisoes;
    if (entidade === ReconfirmacaoRestricoesOrm) return reconfirmacoes;
    if (entidade === RestricaoPacienteOrm) return restricoes;
    if (entidade === RevisaoRestricaoPacienteOrm) return revisoesRestricao;
    throw new Error('Repositório inesperado');
  }) };
  const executor = { executar: jest.fn(async (_tenant: string, fn: (g: unknown) => unknown) => fn(g)) };
  const servico = new ServicoReconfirmacaoRestricao(executor as never, {} as never, {} as never);
  return { avaliacoes, revisoes, reconfirmacoes, restricoes, revisoesRestricao, g, executar: (entrada: unknown = dados) => servico.registrarPendencia(usuario as never, paciente, entrada),
    executarAlteracao: (entrada: unknown = dados) => servico.registrarAlteracaoInformada(usuario as never, paciente, entrada),
    executarSemAlteracao: (entrada: unknown = dados) => servico.registrarSemAlteracao(usuario as never, paciente, entrada),
    executarAusencia: (entrada: unknown = { ...dados, confirmacaoExplicitaAusencia: true }) => servico.registrarAusenciaDeclarada(usuario as never, paciente, entrada),
    executarIndividual: (entrada: unknown = { ...dados, restricaoId: restricao.id, revisaoRestricao: 1 }) => servico.registrarSemAlteracaoIndividual(usuario as never, paciente, entrada),
    executarPendenciaIndividual: (entrada: unknown = { ...dados, restricaoId: restricao.id, revisaoRestricao: 1 }) => servico.registrarPendenciaIndividual(usuario as never, paciente, entrada),
    executarAlteracaoIndividual: (entrada: unknown = { ...dados, restricaoId: restricao.id, revisaoRestricao: 1 }) => servico.registrarAlteracaoInformadaIndividual(usuario as never, paciente, entrada),
    iniciarAvaliacao: () => servico.garantirAvaliacaoInicial(usuario as never, paciente) };
}
beforeEach(() => jest.clearAllMocks());
it('cria avaliação inicial não informada com histórico e auditoria, sem presumir ausência', async () => {
  const c = preparar(); c.avaliacoes.findOne.mockResolvedValueOnce(null);
  const resposta = await c.iniciarAvaliacao() as { id: string; revisao: number; situacao: string };
  expect(resposta).toEqual({ id: expect.any(String), revisao: 1, situacao: 'nao_informado' });
  expect(c.avaliacoes.insert).toHaveBeenCalledWith(expect.objectContaining({ id: resposta.id, tenantId: usuario.tenantId,
    pacienteId: paciente, situacao: 'nao_informado', revisao: 1, confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null }));
  expect(c.revisoes.insert).toHaveBeenCalledWith(expect.objectContaining({ avaliacaoId: resposta.id, numero: 1, situacao: 'nao_informado' }));
  expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.avaliacao_iniciada', metadados: {} }));
});
it('reusa avaliação existente coerente, sem gravações adicionais', async () => {
  const c = preparar();
  await expect(c.iniciarAvaliacao()).resolves.toEqual({ id: avaliacaoId, revisao: 2, situacao: 'nao_informado' });
  expect(c.avaliacoes.insert).not.toHaveBeenCalled(); expect(c.revisoes.insert).not.toHaveBeenCalled();
  expect(registrarAuditoriaNaTransacao).not.toHaveBeenCalled();
});
it('não cria avaliação sem autorização ou com histórico existente inconsistente', async () => {
  jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
  const c = preparar(); await expect(c.iniciarAvaliacao()).rejects.toBeInstanceOf(ForbiddenException);
  c.revisoes.findOne.mockResolvedValueOnce(null);
  await expect(c.iniciarAvaliacao()).rejects.toBeInstanceOf(ConflictException);
  expect(c.avaliacoes.insert).not.toHaveBeenCalled(); expect(c.revisoes.insert).not.toHaveBeenCalled();
});
it('não inicializa avaliação em isolamento que preserva snapshot', async () => {
  const c = preparar(); c.g.query.mockResolvedValueOnce([{ transaction_isolation: 'repeatable read' }]);
  await expect(c.iniciarAvaliacao()).rejects.toBeInstanceOf(ConflictException);
  expect(autorizarRestricaoClinica).not.toHaveBeenCalled(); expect(c.avaliacoes.insert).not.toHaveBeenCalled();
});
it('registra atestação cifrada vinculada à revisão, sem declarar ausência ou atualizar avaliação', async () => {
  const c = preparar();
  const resultado = await c.executar();
  expect(autorizarRestricaoClinica).toHaveBeenCalled();
  expect(cifrarCampo).toHaveBeenCalledWith(expect.anything(), 'reconfirmacoes_restricoes.resultado_criptografado', { resultado: 'pendencia_mantida' }, expect.objectContaining({ tenantId: usuario.tenantId, pacienteId: paciente, revisao: 1 }));
  expect(c.reconfirmacoes.insert).toHaveBeenCalledWith(expect.objectContaining({ tenantId: usuario.tenantId, pacienteId: paciente, avaliacaoId, revisaoAvaliacao: 2, venceEm: null, chaveIdempotencia }));
  expect(c.avaliacoes.update).not.toHaveBeenCalled();
  expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ metadados: {} }));
  expect(resultado).toEqual(expect.objectContaining({ id: expect.any(String), resultado: 'pendencia_mantida' }));
});
it('nega ator não autorizado antes de ler ou escrever a avaliação', async () => {
  jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
  const c = preparar(); await expect(c.executar()).rejects.toBeInstanceOf(ForbiddenException);
  expect(c.avaliacoes.findOne).not.toHaveBeenCalled(); expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('não registra avaliação alterada ou sem histórico correspondente', async () => {
  const c = preparar(); c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 3 });
  await expect(c.executar()).rejects.toBeInstanceOf(ConflictException);
  c.revisoes.findOne.mockResolvedValueOnce(null);
  await expect(c.executar()).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('recusa histórico com situação ou validade divergente do estado atual', async () => {
  const c = preparar();
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas', venceEm: new Date('2026-12-01T00:00:00.000Z') });
  c.revisoes.findOne.mockResolvedValueOnce({ numero: 2, situacao: 'nao_informado', venceEm: null });
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas', venceEm: new Date('2026-12-01T00:00:00.000Z') });
  c.revisoes.findOne.mockResolvedValueOnce({ numero: 2, situacao: 'sem_restricoes_confirmadas', venceEm: new Date('2026-12-02T00:00:00.000Z') });
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
  expect(c.avaliacoes.update).not.toHaveBeenCalled(); expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('recusa divergência de precisão identificada pelo banco mesmo quando as datas JavaScript coincidem', async () => {
  const c = preparar();
  const data = new Date('2026-12-01T00:00:00.000Z');
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas', venceEm: data });
  c.revisoes.findOne.mockResolvedValueOnce({ numero: 2, situacao: 'sem_restricoes_confirmadas', venceEm: data });
  c.g.query.mockResolvedValueOnce([{ transaction_isolation: 'read committed' }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ consistente: false }]);
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
  expect(c.avaliacoes.update).not.toHaveBeenCalled(); expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('exige atestação explícita e não aceita chaves extras', async () => {
  const c = preparar();
  await expect(c.executar({ ...dados, atestacao: false })).rejects.toBeInstanceOf(BadRequestException);
  await expect(c.executar({ ...dados, extra: true })).rejects.toBeInstanceOf(BadRequestException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('repetição igual é idempotente e chave com outro resultado é recusada', async () => {
  const c = preparar();
  const existente = { id: '55555555-5555-4555-8555-555555555555', pacienteId: paciente, avaliacaoId, revisaoAvaliacao: 2, meio: dados.meio, resultadoCriptografado: Buffer.from('sintetico') };
  c.reconfirmacoes.findOne.mockResolvedValueOnce(existente).mockResolvedValueOnce(existente);
  jest.mocked(decifrarCampo).mockReturnValueOnce({ resultado: 'pendencia_mantida' }).mockReturnValueOnce({ resultado: 'alteracao_informada' });
  await expect(c.executar()).resolves.toEqual({ id: existente.id, resultado: 'pendencia_mantida' });
  await expect(c.executar()).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('normaliza a chave antes do bloqueio e da persistência', async () => {
  const c = preparar(); await c.executar({ ...dados, chaveIdempotencia: chaveIdempotencia.toUpperCase() });
  expect(c.g.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [expect.stringContaining(chaveIdempotencia)]);
  expect(c.reconfirmacoes.insert).toHaveBeenCalledWith(expect.objectContaining({ chaveIdempotencia }));
});
it('falha de cifra não retorna detalhes internos nem grava auditoria', async () => {
  jest.mocked(cifrarCampo).mockImplementationOnce(() => { throw new Error('CANARIO_FALHA_CIFRA'); });
  const c = preparar(); const erro = await c.executar().catch(e => e);
  expect(erro).toMatchObject({ status: 500, message: 'Operação indisponível.' });
  expect(JSON.stringify(erro)).not.toContain('CANARIO_FALHA_CIFRA');
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled(); expect(registrarAuditoriaNaTransacao).not.toHaveBeenCalled();
});
it('registra alteração informada sem renovar avaliação e sem convertê-la em pendência mantida', async () => {
  const c = preparar();
  const resultado = await c.executarAlteracao();
  expect(cifrarCampo).toHaveBeenCalledWith(expect.anything(), 'reconfirmacoes_restricoes.resultado_criptografado', { resultado: 'alteracao_informada' }, expect.anything());
  expect(c.avaliacoes.update).not.toHaveBeenCalled();
  expect(c.reconfirmacoes.insert).toHaveBeenCalledWith(expect.objectContaining({ venceEm: null, revisaoAvaliacao: 2 }));
  expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.reconfirmacao_alteracao', metadados: {} }));
  expect(resultado).toEqual(expect.objectContaining({ id: expect.any(String), resultado: 'alteracao_informada' }));
});
it('repete alteração informada sem nova gravação após revalidar autorização', async () => {
  const c = preparar();
  const id = '55555555-5555-4555-8555-555555555555';
  c.reconfirmacoes.findOne.mockResolvedValueOnce({ id, pacienteId: paciente, avaliacaoId, revisaoAvaliacao: 2,
    meio: dados.meio, resultadoCriptografado: Buffer.from('sintetico') });
  jest.mocked(decifrarCampo).mockReturnValueOnce({ resultado: 'alteracao_informada' });
  await expect(c.executarAlteracao()).resolves.toEqual({ id, resultado: 'alteracao_informada' });
  expect(autorizarRestricaoClinica).toHaveBeenCalled();
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
  expect(c.avaliacoes.update).not.toHaveBeenCalled();
  expect(c.revisoes.insert).not.toHaveBeenCalled();
});
it('não reutiliza chave de pendência mantida para alteração informada', async () => {
  const c = preparar();
  c.reconfirmacoes.findOne.mockResolvedValueOnce({ id: '55555555-5555-4555-8555-555555555555', pacienteId: paciente, avaliacaoId,
    revisaoAvaliacao: 2, meio: dados.meio, resultadoCriptografado: Buffer.from('sintetico') });
  jest.mocked(decifrarCampo).mockReturnValueOnce({ resultado: 'pendencia_mantida' });
  await expect(c.executarAlteracao()).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('nega alteração informada quando falta autorização clínica', async () => {
  jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
  const c = preparar();
  await expect(c.executarAlteracao()).rejects.toBeInstanceOf(ForbiddenException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
  expect(cifrarCampo).not.toHaveBeenCalled();
});
it.each([['pendência mantida', 'sem_restricoes_confirmadas'], ['alteração informada', 'sem_restricoes_confirmadas'],
  ['alteração informada', 'restricoes_registradas'], ['pendência mantida', 'restricoes_registradas']])
('%s invalida avaliação anterior %s na mesma transação', async (tipo, situacao) => {
  const c = preparar();
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao });
  await (tipo === 'pendência mantida' ? c.executar() : c.executarAlteracao());
  expect(c.avaliacoes.update).toHaveBeenCalledWith(expect.objectContaining({ id: avaliacaoId, tenantId: usuario.tenantId, pacienteId: paciente, revisao: 2 }),
    expect.objectContaining({ situacao: 'nao_informado', revisao: 3, confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null }));
  expect(c.revisoes.insert).toHaveBeenCalledWith(expect.objectContaining({ avaliacaoId, numero: 3, situacao: 'nao_informado' }));
  expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.avaliacao_invalidada', metadados: {} }));
});
it('recusa quando a atualização concorrente da avaliação falha', async () => {
  const c = preparar(); c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas' });
  c.avaliacoes.update.mockResolvedValueOnce({ affected: 0 });
  await expect(c.executarAlteracao()).rejects.toBeInstanceOf(ConflictException);
  expect(c.revisoes.insert).not.toHaveBeenCalled(); expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('reconfirma avaliação de ausência consistente por 180 dias com histórico e sem alterar restrições', async () => {
  const c = preparar();
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas' });
  const antes = Date.now();
  const resposta = await c.executarSemAlteracao();
  expect(c.avaliacoes.update).toHaveBeenCalledWith(expect.objectContaining({ tenantId: usuario.tenantId, pacienteId: paciente, id: avaliacaoId, revisao: 2 }),
    expect.objectContaining({ situacao: 'sem_restricoes_confirmadas', revisao: 3, confirmadoPorUsuarioId: usuario.usuarioId,
      confirmadoEm: expect.any(Date), venceEm: expect.any(Date) }));
  const alteracao = c.avaliacoes.update.mock.calls[0][1] as { confirmadoEm: Date; venceEm: Date };
  expect(alteracao.confirmadoEm.getTime()).toBeGreaterThanOrEqual(antes);
  expect(alteracao.venceEm.getTime() - alteracao.confirmadoEm.getTime()).toBe(180 * 86_400_000);
  expect(c.revisoes.insert).toHaveBeenCalledWith(expect.objectContaining({ avaliacaoId, numero: 3, situacao: 'sem_restricoes_confirmadas' }));
  expect(cifrarCampo).toHaveBeenCalledWith(expect.anything(), 'reconfirmacoes_restricoes.resultado_criptografado', { resultado: 'sem_alteracao' }, expect.anything());
  expect(resposta).toEqual(expect.objectContaining({ resultado: 'sem_alteracao' }));
});
it('não renova avaliação não informada ou com restrições pendentes', async () => {
  const c = preparar();
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas' });
  c.restricoes.find.mockResolvedValueOnce([{ ...restricao, confirmacao: 'pendente' }]);
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ natureza: 'clinica' } as never);
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
  expect(c.avaliacoes.update).not.toHaveBeenCalled(); expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('não renova ausência contraditória com restrição confirmada nem avaliação registrada sem confirmação ativa', async () => {
  const c = preparar();
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas' });
  c.restricoes.find.mockResolvedValueOnce([restricao]);
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ natureza: 'clinica' } as never);
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'restricoes_registradas' });
  c.restricoes.find.mockResolvedValueOnce([]);
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
  expect(c.avaliacoes.update).not.toHaveBeenCalled();
});
it('renova avaliação com restrição confirmada em reavaliação sem alterá-la', async () => {
  const c = preparar();
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'restricoes_registradas' });
  c.restricoes.find.mockResolvedValueOnce([restricao]);
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ natureza: 'clinica' } as never);
  await c.executarSemAlteracao();
  expect(c.restricoes.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: usuario.tenantId, pacienteId: paciente }) }));
  expect(c.avaliacoes.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ situacao: 'restricoes_registradas', revisao: 3 }));
});
it('preferência em reavaliação não impede ausência e não satisfaz avaliação com restrições', async () => {
  const c = preparar();
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas' });
  c.restricoes.find.mockResolvedValueOnce([restricao]);
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ natureza: 'preferencia' } as never);
  await expect(c.executarSemAlteracao()).resolves.toEqual(expect.objectContaining({ resultado: 'sem_alteracao' }));
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'restricoes_registradas' });
  c.restricoes.find.mockResolvedValueOnce([restricao]);
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ natureza: 'preferencia' } as never);
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
});
it('conteúdo ilegível falha fechado e não renova avaliação', async () => {
  const c = preparar();
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas' });
  c.restricoes.find.mockResolvedValueOnce([restricao]);
  jest.mocked(decifrarConteudoRestricao).mockImplementationOnce(() => { throw new Error('CANARIO_CIFRA'); });
  const erro = await c.executarSemAlteracao().catch(e => e);
  expect(erro).toMatchObject({ status: 500, message: 'Operação indisponível.' });
  expect(JSON.stringify(erro)).not.toContain('CANARIO_CIFRA');
  expect(c.avaliacoes.update).not.toHaveBeenCalled();
});
it.each(['repeatable read', 'serializable'])('recusa isolamento %s antes de consultar autorização ou restrições', async isolamento => {
  const c = preparar();
  c.g.query.mockResolvedValueOnce([{ transaction_isolation: isolamento }]);
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
  expect(autorizarRestricaoClinica).not.toHaveBeenCalled();
  expect(c.restricoes.find).not.toHaveBeenCalled(); expect(c.avaliacoes.update).not.toHaveBeenCalled();
});
it('examina a página seguinte antes de renovar, sem tratar cem preferências como ausência de pendência', async () => {
  const c = preparar();
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas' });
  c.restricoes.find.mockResolvedValueOnce(Array.from({ length: 100 }, () => restricao))
    .mockResolvedValueOnce([{ ...restricao, confirmacao: 'pendente' }]);
  for (let i = 0; i < 100; i++) jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ natureza: 'preferencia' } as never);
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ natureza: 'clinica' } as never);
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
  expect(c.restricoes.find).toHaveBeenNthCalledWith(2, expect.objectContaining({ skip: 100, take: 100 }));
  expect(c.avaliacoes.update).not.toHaveBeenCalled();
});
it('replay da reconfirmação sem alteração não renova novamente', async () => {
  const c = preparar();
  const id = '55555555-5555-4555-8555-555555555555';
  c.reconfirmacoes.findOne.mockResolvedValueOnce({ id, pacienteId: paciente, avaliacaoId, revisaoAvaliacao: 2, meio: dados.meio,
    venceEm: new Date('2027-01-01T00:00:00.000Z'), resultadoCriptografado: Buffer.from('sintetico') });
  jest.mocked(decifrarCampo).mockReturnValueOnce({ resultado: 'sem_alteracao' });
  await expect(c.executarSemAlteracao()).resolves.toEqual({ id, resultado: 'sem_alteracao' });
  expect(autorizarRestricaoClinica).toHaveBeenCalled();
  expect(c.avaliacoes.update).not.toHaveBeenCalled(); expect(c.revisoes.insert).not.toHaveBeenCalled();
});
it('não lê restrições para renovar sem autorização clínica', async () => {
  jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
  const c = preparar();
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ForbiddenException);
  expect(c.avaliacoes.findOne).not.toHaveBeenCalled(); expect(c.restricoes.find).not.toHaveBeenCalled();
});
it('não cria reconfirmação se a revisão da avaliação mudar no CAS', async () => {
  const c = preparar();
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao: 'sem_restricoes_confirmadas' });
  c.avaliacoes.update.mockResolvedValueOnce({ affected: 0 });
  await expect(c.executarSemAlteracao()).rejects.toBeInstanceOf(ConflictException);
  expect(c.revisoes.insert).not.toHaveBeenCalled(); expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('registra ausência explícita a partir de avaliação não informada, com prazo e histórico', async () => {
  const c = preparar();
  const resultado = await c.executarAusencia();
  expect(resultado).toEqual(expect.objectContaining({ id: expect.any(String), resultado: 'sem_restricoes_declaradas' }));
  expect(c.avaliacoes.update).toHaveBeenCalledWith(expect.objectContaining({ id: avaliacaoId, revisao: 2 }),
    expect.objectContaining({ situacao: 'sem_restricoes_confirmadas', revisao: 3, confirmadoPorUsuarioId: usuario.usuarioId,
      confirmadoEm: expect.any(Date), venceEm: expect.any(Date) }));
  expect(c.revisoes.insert).toHaveBeenCalledWith(expect.objectContaining({ numero: 3, situacao: 'sem_restricoes_confirmadas' }));
  expect(cifrarCampo).toHaveBeenCalledWith(expect.anything(), 'reconfirmacoes_restricoes.resultado_criptografado', { resultado: 'sem_restricoes_declaradas' }, expect.anything());
});
it('ausência exige confirmação explícita e é recusada diante de restrição vigente ou pendente', async () => {
  const c = preparar();
  await expect(c.executarAusencia(dados)).rejects.toBeInstanceOf(BadRequestException);
  for (const confirmacao of ['pendente', 'confirmada']) {
    c.restricoes.find.mockResolvedValueOnce([{ ...restricao, confirmacao }]);
    jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ natureza: 'clinica' } as never);
    await expect(c.executarAusencia()).rejects.toBeInstanceOf(ConflictException);
  }
  expect(c.avaliacoes.update).not.toHaveBeenCalled(); expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('não usa confirmação de ausência em resultados diferentes nem reaproveita a chave para outro resultado', async () => {
  const c = preparar();
  await expect(c.executar({ ...dados, confirmacaoExplicitaAusencia: true })).rejects.toBeInstanceOf(BadRequestException);
  c.reconfirmacoes.findOne.mockResolvedValueOnce({ id: '55555555-5555-4555-8555-555555555555', pacienteId: paciente, avaliacaoId,
    revisaoAvaliacao: 2, meio: dados.meio, venceEm: new Date('2027-01-01T00:00:00.000Z'), resultadoCriptografado: Buffer.from('sintetico') });
  jest.mocked(decifrarCampo).mockReturnValueOnce({ resultado: 'sem_alteracao' });
  await expect(c.executarAusencia()).rejects.toBeInstanceOf(ConflictException);
});
it('registra reconfirmação individual vigente sem renovar avaliação nem alterar restrição', async () => {
  const c = preparar();
  const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'sintetico' } };
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce(conteudo as never).mockReturnValueOnce(conteudo as never);
  const resposta = await c.executarIndividual();
  expect(resposta).toEqual({ id: expect.any(String), resultado: 'sem_alteracao', escopo: 'restricao_individual', revisaoAvaliacao: 2, revisaoRestricao: 1 });
  expect(c.reconfirmacoes.insert).toHaveBeenCalledWith(expect.objectContaining({ restricaoId: restricao.id, revisaoRestricao: 1,
    avaliacaoId, revisaoAvaliacao: 2, venceEm: null }));
  expect(c.avaliacoes.update).not.toHaveBeenCalled(); expect(c.revisoes.insert).not.toHaveBeenCalled();
});
it('não reconfirma restrição individual sem autorização, com revisão antiga ou histórico ausente', async () => {
  const c = preparar();
  jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
  await expect(c.executarIndividual()).rejects.toBeInstanceOf(ForbiddenException);
  c.restricoes.findOne.mockResolvedValueOnce({ ...restricao, revisao: 2 });
  await expect(c.executarIndividual()).rejects.toBeInstanceOf(ConflictException);
  c.revisoesRestricao.findOne.mockResolvedValueOnce(null);
  await expect(c.executarIndividual()).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('não confunde chave de reconfirmação global com escopo individual', async () => {
  const c = preparar();
  c.reconfirmacoes.findOne.mockResolvedValueOnce({ id: '55555555-5555-4555-8555-555555555555', pacienteId: paciente, avaliacaoId,
    revisaoAvaliacao: 2, meio: dados.meio, restricaoId: null, venceEm: new Date(), resultadoCriptografado: Buffer.from('sintetico') });
  await expect(c.executarIndividual()).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('exige o par individual válido e não o aceita nos fluxos globais', async () => {
  const c = preparar();
  for (const entrada of [dados, { ...dados, restricaoId: restricao.id }, { ...dados, restricaoId: 'invalido', revisaoRestricao: 1 },
    { ...dados, restricaoId: restricao.id, revisaoRestricao: 0 }, { ...dados, restricaoId: restricao.id, revisaoRestricao: 1, confirmacaoExplicitaAusencia: true }]) {
    await expect(c.executarIndividual(entrada)).rejects.toBeInstanceOf(BadRequestException);
  }
  await expect(c.executarSemAlteracao({ ...dados, restricaoId: restricao.id, revisaoRestricao: 1 })).rejects.toBeInstanceOf(BadRequestException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it.each([
  { estado: 'inativa', confirmacao: 'confirmada' },
  { estado: 'ativa', confirmacao: 'pendente' },
  { estado: 'ativa', confirmacao: 'rejeitada' }
])('nega reconfirmação individual de estado não elegível: %j', async estado => {
  const c = preparar(); c.restricoes.findOne.mockResolvedValueOnce({ ...restricao, ...estado });
  await expect(c.executarIndividual()).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it.each([['pendência', 'inativa', 'confirmada'], ['pendência', 'ativa', 'rejeitada'],
  ['alteração', 'inativa', 'confirmada'], ['alteração', 'ativa', 'rejeitada']])
('nega %s individual com estado %s e confirmação %s', async (tipo, estado, confirmacao) => {
  const c = preparar(); c.restricoes.findOne.mockResolvedValueOnce({ ...restricao, estado, confirmacao });
  await expect(tipo === 'pendência' ? c.executarPendenciaIndividual() : c.executarAlteracaoIndividual()).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('nega conteúdo individual divergente, preferência ou cifra ilegível sem gravar', async () => {
  const c = preparar();
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ natureza: 'clinica', alvo: { tipo: 'alimento', id: 'a' } } as never)
    .mockReturnValueOnce({ natureza: 'clinica', alvo: { tipo: 'alimento', id: 'b' } } as never);
  await expect(c.executarIndividual()).rejects.toBeInstanceOf(ConflictException);
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ natureza: 'preferencia' } as never).mockReturnValueOnce({ natureza: 'preferencia' } as never);
  await expect(c.executarIndividual()).rejects.toBeInstanceOf(ConflictException);
  jest.mocked(decifrarConteudoRestricao).mockImplementationOnce(() => { throw new Error('CANARIO_INDIVIDUAL'); });
  const erro = await c.executarIndividual().catch(e => e);
  expect(erro).toMatchObject({ status: 500, message: 'Operação indisponível.' });
  expect(JSON.stringify(erro)).not.toContain('CANARIO_INDIVIDUAL');
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it.each(['inativacao', 'rejeicao'])('recusa histórico terminal %s incompatível com restrição vigente', async evento => {
  const c = preparar();
  c.revisoesRestricao.findOne.mockResolvedValueOnce({ numero: 1, evento, conteudoCriptografado: Buffer.from('sintetico') });
  await expect(c.executarIndividual()).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled(); expect(decifrarConteudoRestricao).not.toHaveBeenCalled();
});
it('recusa histórico de confirmação quando a linha atual permanece pendente', async () => {
  const c = preparar();
  c.restricoes.findOne.mockResolvedValueOnce({ ...restricao, confirmacao: 'pendente' });
  c.revisoesRestricao.findOne.mockResolvedValueOnce({ numero: 1, evento: 'confirmacao', conteudoCriptografado: Buffer.from('sintetico') });
  await expect(c.executarPendenciaIndividual()).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('replay individual identifica a revisão atestada e não altera os estados atuais', async () => {
  const c = preparar();
  const id = '55555555-5555-4555-8555-555555555555';
  c.reconfirmacoes.findOne.mockResolvedValueOnce({ id, pacienteId: paciente, avaliacaoId, revisaoAvaliacao: 2, meio: dados.meio,
    restricaoId: restricao.id, revisaoRestricao: 1, venceEm: null, resultadoCriptografado: Buffer.from('sintetico') });
  jest.mocked(decifrarCampo).mockReturnValueOnce({ resultado: 'sem_alteracao' });
  await expect(c.executarIndividual()).resolves.toEqual({ id, resultado: 'sem_alteracao', escopo: 'restricao_individual', revisaoAvaliacao: 2, revisaoRestricao: 1 });
  expect(autorizarRestricaoClinica).toHaveBeenCalled();
  expect(c.avaliacoes.update).not.toHaveBeenCalled(); expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
it('normaliza identificador da restrição antes de autorizar o vínculo cifrado', async () => {
  const c = preparar();
  const id = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
  c.restricoes.findOne.mockResolvedValueOnce({ ...restricao, id });
  const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'sintetico' } };
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce(conteudo as never).mockReturnValueOnce(conteudo as never);
  await c.executarIndividual({ ...dados, restricaoId: id.toUpperCase(), revisaoRestricao: 1 });
  expect(c.restricoes.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id, pacienteId: paciente, tenantId: usuario.tenantId }) }));
  expect(c.reconfirmacoes.insert).toHaveBeenCalledWith(expect.objectContaining({ restricaoId: id }));
});
it('não reaproveita chave individual para outra restrição nem outra revisão', async () => {
  const c = preparar();
  const existente = { id: '55555555-5555-4555-8555-555555555555', pacienteId: paciente, avaliacaoId, revisaoAvaliacao: 2,
    meio: dados.meio, restricaoId: restricao.id, revisaoRestricao: 1, venceEm: null, resultadoCriptografado: Buffer.from('sintetico') };
  c.reconfirmacoes.findOne.mockResolvedValueOnce(existente).mockResolvedValueOnce(existente);
  await expect(c.executarIndividual({ ...dados, restricaoId: '77777777-7777-4777-8777-777777777777', revisaoRestricao: 1 })).rejects.toBeInstanceOf(ConflictException);
  await expect(c.executarIndividual({ ...dados, restricaoId: restricao.id, revisaoRestricao: 2 })).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled(); expect(decifrarCampo).not.toHaveBeenCalled();
});
it.each([['pendência mantida', 'pendente', 'sem_restricoes_confirmadas'], ['alteração informada', 'confirmada', 'restricoes_registradas']])
('individual %s (%s) invalida avaliação %s e preserva restrição', async (tipo, confirmacao, situacao) => {
  const c = preparar();
  c.avaliacoes.findOne.mockResolvedValueOnce({ id: avaliacaoId, revisao: 2, situacao });
  c.restricoes.findOne.mockResolvedValueOnce({ ...restricao, confirmacao });
  const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'sintetico' } };
  jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce(conteudo as never).mockReturnValueOnce(conteudo as never);
  const resposta = await (tipo === 'pendência mantida' ? c.executarPendenciaIndividual() : c.executarAlteracaoIndividual());
  expect(resposta).toMatchObject({ resultado: tipo === 'pendência mantida' ? 'pendencia_mantida' : 'alteracao_informada', escopo: 'restricao_individual' });
  expect(c.avaliacoes.update).toHaveBeenCalledWith(expect.objectContaining({ id: avaliacaoId, revisao: 2 }),
    expect.objectContaining({ situacao: 'nao_informado', revisao: 3, confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null }));
  expect(c.revisoes.insert).toHaveBeenCalledWith(expect.objectContaining({ numero: 3, situacao: 'nao_informado' }));
  expect(c.reconfirmacoes.insert).toHaveBeenCalledWith(expect.objectContaining({ restricaoId: restricao.id, revisaoRestricao: 1, venceEm: null }));
});
it('rejeita chave individual reutilizada para outro resultado', async () => {
  const c = preparar();
  c.reconfirmacoes.findOne.mockResolvedValueOnce({ id: '55555555-5555-4555-8555-555555555555', pacienteId: paciente, avaliacaoId,
    revisaoAvaliacao: 2, meio: dados.meio, restricaoId: restricao.id, revisaoRestricao: 1, venceEm: null, resultadoCriptografado: Buffer.from('sintetico') });
  jest.mocked(decifrarCampo).mockReturnValueOnce({ resultado: 'pendencia_mantida' });
  await expect(c.executarAlteracaoIndividual()).rejects.toBeInstanceOf(ConflictException);
  expect(c.reconfirmacoes.insert).not.toHaveBeenCalled();
});
