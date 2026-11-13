import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ServicoConfirmacaoRestricao } from './servico-confirmacao-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { decifrarConteudoRestricao, cifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../infraestrutura/revisao-avaliacao-restricoes.orm';

jest.mock('./autorizacao-restricao-clinica', () => ({ autorizarRestricaoClinica: jest.fn(async () => undefined) }));
jest.mock('../infraestrutura/codec-conteudo-restricao', () => ({
  decifrarConteudoRestricao: jest.fn(() => ({ schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'alvo' } })),
  cifrarConteudoRestricao: jest.fn(() => Buffer.from('cifra-sintetica'))
}));
jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({ registrarAuditoriaNaTransacao: jest.fn(async () => undefined) }));

const ator = { tenantId: 'tenant', usuarioId: 'usuario', papel: 'Professional', emailHash: '', permissoes: [] } as const;
function preparar() {
  const linha = { id: 'restricao', tenantId: 'tenant', pacienteId: 'paciente', estado: 'ativa', confirmacao: 'pendente', revisao: 1, conteudoCriptografado: Buffer.from('anterior') };
  const atual = { findOne: jest.fn(async () => linha), update: jest.fn(async () => ({ affected: 1 })) };
  const revisoes = { insert: jest.fn(async () => undefined) };
  const avaliacao = { findOne: jest.fn(async (): Promise<{ id: string; revisao: number; situacao: string } | null> => null), update: jest.fn(async () => ({ affected: 1 })) };
  const historicoAvaliacao = { insert: jest.fn(async () => undefined) };
  const g = { getRepository: jest.fn((entidade: unknown) => {
    if (entidade === RestricaoPacienteOrm) return atual;
    if (entidade === RevisaoRestricaoPacienteOrm) return revisoes;
    if (entidade === AvaliacaoRestricoesPacienteOrm) return avaliacao;
    if (entidade === RevisaoAvaliacaoRestricoesOrm) return historicoAvaliacao;
    throw new Error('Repositório inesperado');
  }) };
  const executor = { executar: jest.fn(async (_tenant: string, fn: (g: unknown) => unknown) => fn(g)) };
  const servico = new ServicoConfirmacaoRestricao(executor as never, {} as never, {} as never);
  return { linha, atual, revisoes, avaliacao, historicoAvaliacao, g, executor, confirmar: (revisao = 1) => servico.confirmar(ator as never, 'paciente', 'restricao', revisao) };
}
beforeEach(() => jest.clearAllMocks());
describe('confirmação de restrição', () => {
  it('autoriza na mesma transação, preserva histórico cifrado e audita sem conteúdo', async () => {
    const c = preparar(); await expect(c.confirmar()).resolves.toEqual({ id: 'restricao', revisao: 2, confirmacao: 'confirmada' });
    expect(autorizarRestricaoClinica).toHaveBeenCalledWith(c.g, expect.anything(), ator, 'paciente');
    expect(decifrarConteudoRestricao).toHaveBeenCalled();
    expect(cifrarConteudoRestricao).toHaveBeenCalledTimes(2);
    expect(c.atual.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'restricao', tenantId: 'tenant', pacienteId: 'paciente', revisao: 1 }), expect.objectContaining({ confirmacao: 'confirmada', revisao: 2 }));
    expect(c.revisoes.insert).toHaveBeenCalledWith(expect.objectContaining({ evento: 'confirmacao', numero: 2, tenantId: 'tenant', pacienteId: 'paciente' }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ metadados: {} }));
  });
  it('rejeita revisão desatualizada antes de gravar', async () => {
    const c = preparar(); await expect(c.confirmar(2)).rejects.toBeInstanceOf(ConflictException);
    expect(c.atual.update).not.toHaveBeenCalled(); expect(c.revisoes.insert).not.toHaveBeenCalled();
  });
  it('falha fechado se a autorização for negada', async () => {
    jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
    const c = preparar(); await expect(c.confirmar()).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.atual.findOne).not.toHaveBeenCalled();
  });
  it('não atualiza uma restrição já confirmada', async () => {
    const c = preparar(); c.linha.confirmacao = 'confirmada';
    await expect(c.confirmar()).rejects.toBeInstanceOf(ConflictException);
    expect(c.atual.update).not.toHaveBeenCalled();
  });
  it('não transforma preferência em restrição confirmada', async () => {
    jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ schemaVersao: 1, natureza: 'preferencia', alvo: { tipo: 'alimento', id: 'alvo' } });
    const c = preparar(); await expect(c.confirmar()).rejects.toBeInstanceOf(ConflictException);
    expect(c.atual.update).not.toHaveBeenCalled(); expect(c.revisoes.insert).not.toHaveBeenCalled();
  });
  it('invalida avaliação de ausência e registra revisão na mesma transação', async () => {
    const c = preparar(); c.avaliacao.findOne.mockResolvedValueOnce({ id: 'avaliacao', revisao: 3, situacao: 'sem_restricoes_confirmadas' });
    await expect(c.confirmar()).resolves.toMatchObject({ confirmacao: 'confirmada', revisao: 2 });
    expect(c.avaliacao.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'avaliacao', tenantId: 'tenant', pacienteId: 'paciente', revisao: 3 }),
      expect.objectContaining({ situacao: 'nao_informado', revisao: 4, confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null }));
    expect(c.historicoAvaliacao.insert).toHaveBeenCalledWith(expect.objectContaining({ avaliacaoId: 'avaliacao', numero: 4, situacao: 'nao_informado', autorUsuarioId: 'usuario' }));
  });
  it('rejeita CAS sem efeito e não registra histórico', async () => {
    const c = preparar(); c.atual.update.mockResolvedValueOnce({ affected: 0 });
    await expect(c.confirmar()).rejects.toBeInstanceOf(ConflictException);
    expect(c.revisoes.insert).not.toHaveBeenCalled();
  });
  it('não grava se conteúdo cifrado for ilegível', async () => {
    jest.mocked(decifrarConteudoRestricao).mockImplementationOnce(() => { throw new Error('ilegível'); });
    const c = preparar(); await expect(c.confirmar()).rejects.toThrow();
    expect(c.atual.update).not.toHaveBeenCalled(); expect(c.revisoes.insert).not.toHaveBeenCalled();
  });
  it('propaga falha de auditoria para abortar a transação', async () => {
    jest.mocked(registrarAuditoriaNaTransacao).mockRejectedValueOnce(new Error('auditoria indisponível'));
    const c = preparar(); await expect(c.confirmar()).rejects.toThrow('auditoria indisponível');
  });
});
