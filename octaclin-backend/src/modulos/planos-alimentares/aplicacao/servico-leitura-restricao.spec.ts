import { BadRequestException, ConflictException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { inspect } from 'node:util';
import { ServicoLeituraRestricao } from './servico-leitura-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { autorizarPendenciaRestricao } from './autorizacao-pendencia-restricao';
import { decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';

jest.mock('./autorizacao-restricao-clinica', () => ({ autorizarRestricaoClinica: jest.fn(async () => undefined) }));
jest.mock('./autorizacao-pendencia-restricao', () => ({ autorizarPendenciaRestricao: jest.fn(async () => 'colaborador') }));
jest.mock('../infraestrutura/codec-conteudo-restricao', () => ({ decifrarConteudoRestricao: jest.fn(() => ({ schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'sintetico' } })) }));
jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({ registrarAuditoriaNaTransacao: jest.fn(async () => undefined) }));
const ator = { tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', usuarioId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', papel: 'Professional' } as const;
const paciente = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
function preparar() {
  const linha = { id, tenantId: ator.tenantId, pacienteId: paciente, revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente', conteudoCriptografado: Buffer.from('cifra'), chaveCriacao: 'NAO_RETORNAR' };
  const atual = { findOne: jest.fn(async () => linha) };
  const revisoes = { findOne: jest.fn(async (): Promise<unknown> => ({ numero: 1, evento: 'criacao', conteudoCriptografado: Buffer.from('historico') })) };
  const g = { query: jest.fn(async () => [{ transaction_isolation: 'read committed' }]), getRepository: jest.fn((entidade: unknown) => {
    if (entidade === RestricaoPacienteOrm) return atual;
    if (entidade === RevisaoRestricaoPacienteOrm) return revisoes;
    throw new Error('Repositório inesperado');
  }) };
  const executor = { executar: jest.fn(async (_tenant: string, fn: (g: unknown) => unknown) => fn(g)) };
  const servico = new ServicoLeituraRestricao(executor as never, {} as never, {} as never);
  return { linha, atual, revisoes, g, executor, servico, consultar: () => servico.consultar(ator as never, paciente, id) };
}
beforeEach(() => jest.clearAllMocks());
describe('leitura clínica de restrição', () => {
  it('autoriza antes de ler e retorna projeção mínima, sem cifra nem chave interna', async () => {
    const c = preparar(); const resposta = await c.consultar();
    expect(autorizarRestricaoClinica).toHaveBeenCalledWith(c.g, expect.anything(), ator, paciente);
    expect(c.atual.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id, tenantId: ator.tenantId, pacienteId: paciente } }));
    expect(jest.mocked(autorizarRestricaoClinica).mock.invocationCallOrder[0]).toBeLessThan(c.atual.findOne.mock.invocationCallOrder[0]);
    expect(resposta).toEqual({ id, revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente', conteudo: { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'sintetico' } } });
    expect(inspect(resposta)).not.toMatch(/NAO_RETORNAR|conteudoCriptografado|tenantId|pacienteId/);
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.consultar', recursoId: id, metadados: {} }));
  });
  it('nega antes da consulta para carteira não autorizada e trata inexistente como acesso negado', async () => {
    const c = preparar(); jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
    await expect(c.consultar()).rejects.toBeInstanceOf(ForbiddenException); expect(c.atual.findOne).not.toHaveBeenCalled();
    c.atual.findOne.mockResolvedValueOnce(null as never); await expect(c.consultar()).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejeita histórico ausente ou divergente sem retornar dados', async () => {
    const c = preparar(); c.revisoes.findOne.mockResolvedValueOnce(null); await expect(c.consultar()).rejects.toBeInstanceOf(ConflictException);
    jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ schemaVersao: 1, natureza: 'preferencia', alvo: { tipo: 'alimento', id: 'a' } });
    await expect(c.consultar()).rejects.toBeInstanceOf(ConflictException); expect(registrarAuditoriaNaTransacao).not.toHaveBeenCalled();
  });
  it('não retorna dados quando a cifra é ilegível', async () => {
    const c = preparar(); jest.mocked(decifrarConteudoRestricao).mockImplementationOnce(() => { throw new Error('CANARIO_CIFRA'); });
    const erro = await c.consultar().catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(InternalServerErrorException); expect(inspect(erro)).not.toContain('CANARIO_CIFRA');
    expect(registrarAuditoriaNaTransacao).not.toHaveBeenCalled();
  });
  it.each([
    ['inativa', 'confirmada', 'criacao'], ['ativa', 'rejeitada', 'criacao'],
    ['ativa', 'confirmada', 'reavaliacao'], ['em_reavaliacao', 'confirmada', 'reativacao'],
    ['ativa', 'confirmada', 'inativacao'], ['ativa', 'pendente', 'rejeicao'],
    ['ativa', 'confirmada', 'criacao'], ['em_reavaliacao', 'pendente', 'reavaliacao'],
    ['ativa', 'pendente', 'reativacao'], ['em_reavaliacao', 'confirmada', 'confirmacao']
  ])('recusa estado %s e confirmação %s contraditos pelo evento %s', async (estado, confirmacao, evento) => {
    const c = preparar(); c.linha.estado = estado; c.linha.confirmacao = confirmacao;
    c.revisoes.findOne.mockResolvedValueOnce({ numero: 1, evento, conteudoCriptografado: Buffer.from('historico') });
    await expect(c.consultar()).rejects.toBeInstanceOf(ConflictException); expect(registrarAuditoriaNaTransacao).not.toHaveBeenCalled();
  });
  it.each([
    ['ativa', 'pendente', 'criacao'], ['ativa', 'confirmada', 'confirmacao'],
    ['ativa', 'rejeitada', 'rejeicao'], ['em_reavaliacao', 'confirmada', 'reavaliacao'],
    ['ativa', 'confirmada', 'reativacao'], ['inativa', 'confirmada', 'inativacao'],
    ['em_reavaliacao', 'confirmada', 'edicao']
  ])('permite estado %s e confirmação %s compatíveis com o evento %s', async (estado, confirmacao, evento) => {
    const c = preparar(); c.linha.estado = estado; c.linha.confirmacao = confirmacao;
    c.revisoes.findOne.mockResolvedValueOnce({ numero: 1, evento, conteudoCriptografado: Buffer.from('historico') });
    await expect(c.consultar()).resolves.toMatchObject({ estado, confirmacao });
  });
  it('recusa isolamento inadequado e sanitiza falha de auditoria', async () => {
    const c = preparar(); c.g.query.mockResolvedValueOnce([{ transaction_isolation: 'serializable' }]);
    await expect(c.consultar()).rejects.toBeInstanceOf(ConflictException);
    jest.mocked(registrarAuditoriaNaTransacao).mockRejectedValueOnce(new Error('CANARIO_AUDITORIA'));
    const erro = await c.consultar().catch((e: unknown) => e); expect(erro).toBeInstanceOf(InternalServerErrorException); expect(inspect(erro)).not.toContain('CANARIO_AUDITORIA');
  });
  it('rejeita identificadores inválidos antes da transação', async () => {
    const c = preparar(); const servico = new ServicoLeituraRestricao(c.executor as never, {} as never, {} as never);
    await expect(servico.consultar(ator as never, 'invalido', id)).rejects.toBeInstanceOf(BadRequestException); expect(c.executor.executar).not.toHaveBeenCalled();
  });
});

describe('leitura de autoria do colaborador (P2d-2)', () => {
  const colaborador = { ...ator, papel: 'Collaborator' } as const;
  it('prova a delegação antes de ler e filtra pela autoria do próprio colaborador, sem concessão clínica', async () => {
    const c = preparar(); c.linha.origem = 'colaborador';
    const r = await c.servico.consultarAutoria(colaborador as never, paciente, id);
    expect(autorizarPendenciaRestricao).toHaveBeenCalledWith(c.g, colaborador, paciente);
    expect(autorizarRestricaoClinica).not.toHaveBeenCalled();
    expect(c.atual.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id, tenantId: ator.tenantId, pacienteId: paciente, autorUsuarioId: ator.usuarioId } }));
    expect(jest.mocked(autorizarPendenciaRestricao).mock.invocationCallOrder[0]).toBeLessThan(c.atual.findOne.mock.invocationCallOrder[0]);
    expect(r).toMatchObject({ id, origem: 'colaborador' });
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.consultar_autoria', recursoId: id, metadados: {} }));
  });
  it('restrição de outro autor é indistinguível de inexistente (403)', async () => {
    const c = preparar(); c.atual.findOne.mockResolvedValueOnce(null as never);
    await expect(c.servico.consultarAutoria(colaborador as never, paciente, id)).rejects.toMatchObject({ status: 403, message: 'Operação não autorizada.' });
  });
  it.each(['Professional', 'Patient', 'SuperAdmin', 'Client'] as const)('papel %s não usa a leitura de autoria', async papel => {
    const c = preparar();
    await expect(c.servico.consultarAutoria({ ...ator, papel } as never, paciente, id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.executor.executar).not.toHaveBeenCalled();
  });
  it('sem delegação vigente nega antes de ler', async () => {
    const c = preparar(); jest.mocked(autorizarPendenciaRestricao).mockRejectedValueOnce(new ForbiddenException());
    await expect(c.servico.consultarAutoria(colaborador as never, paciente, id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.atual.findOne).not.toHaveBeenCalled();
  });
  it('se a autorização não for a do colaborador, nega', async () => {
    const c = preparar(); jest.mocked(autorizarPendenciaRestricao).mockResolvedValueOnce('profissional');
    await expect(c.servico.consultarAutoria(colaborador as never, paciente, id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.atual.findOne).not.toHaveBeenCalled();
  });
});
