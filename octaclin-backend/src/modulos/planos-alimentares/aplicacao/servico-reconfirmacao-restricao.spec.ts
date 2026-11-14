import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ServicoReconfirmacaoRestricao } from './servico-reconfirmacao-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../infraestrutura/revisao-avaliacao-restricoes.orm';
import { ReconfirmacaoRestricoesOrm } from '../infraestrutura/reconfirmacao-restricoes.orm';
import { cifrarCampo, decifrarCampo } from '../infraestrutura/codec-conteudo-restricao';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';

jest.mock('./autorizacao-restricao-clinica', () => ({ autorizarRestricaoClinica: jest.fn(async () => undefined) }));
jest.mock('../infraestrutura/codec-conteudo-restricao', () => ({ cifrarCampo: jest.fn(() => Buffer.from('sintetico')), decifrarCampo: jest.fn() }));
jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({ registrarAuditoriaNaTransacao: jest.fn(async () => undefined) }));
const usuario = { tenantId: '11111111-1111-4111-8111-111111111111', usuarioId: '22222222-2222-4222-8222-222222222222', papel: 'Professional', emailHash: '', permissoes: [] } as const;
const paciente = '33333333-3333-4333-8333-333333333333';
const avaliacaoId = '44444444-4444-4444-8444-444444444444';
const chaveIdempotencia = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dados = { avaliacaoId, revisaoAvaliacao: 2, chaveIdempotencia, meio: 'teleconsulta', atestacao: true };
function preparar() {
  const avaliacoes = { findOne: jest.fn(async (): Promise<unknown> => ({ id: avaliacaoId, revisao: 2, situacao: 'nao_informado' })), update: jest.fn() };
  const revisoes = { findOne: jest.fn(async (): Promise<unknown> => ({ numero: 2 })) };
  const reconfirmacoes = { findOne: jest.fn(async (): Promise<unknown> => null), insert: jest.fn(async () => undefined) };
  const g = { query: jest.fn(async () => []), getRepository: jest.fn((entidade: unknown) => {
    if (entidade === AvaliacaoRestricoesPacienteOrm) return avaliacoes;
    if (entidade === RevisaoAvaliacaoRestricoesOrm) return revisoes;
    if (entidade === ReconfirmacaoRestricoesOrm) return reconfirmacoes;
    throw new Error('Repositório inesperado');
  }) };
  const executor = { executar: jest.fn(async (_tenant: string, fn: (g: unknown) => unknown) => fn(g)) };
  const servico = new ServicoReconfirmacaoRestricao(executor as never, {} as never, {} as never);
  return { avaliacoes, revisoes, reconfirmacoes, g, executar: (entrada: unknown = dados) => servico.registrarPendencia(usuario as never, paciente, entrada) };
}
beforeEach(() => jest.clearAllMocks());
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
