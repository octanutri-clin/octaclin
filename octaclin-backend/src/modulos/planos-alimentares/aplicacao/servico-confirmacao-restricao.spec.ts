import { BadRequestException, ConflictException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { inspect } from 'node:util';
import { QueryFailedError } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ServicoConcessoesPermissao } from '../../auth/aplicacao/servico-concessoes-permissao';
import { ServicoConfirmacaoRestricao } from './servico-confirmacao-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { decifrarConteudoRestricao, cifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { cifrarCampo } from '../infraestrutura/codec-conteudo-restricao';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../infraestrutura/revisao-avaliacao-restricoes.orm';

jest.mock('./autorizacao-restricao-clinica', () => ({ autorizarRestricaoClinica: jest.fn(async () => undefined) }));
jest.mock('../infraestrutura/codec-conteudo-restricao', () => ({
  decifrarConteudoRestricao: jest.fn(() => ({ schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'alvo' } })),
  cifrarConteudoRestricao: jest.fn(() => Buffer.from('cifra-sintetica')),
  cifrarCampo: jest.fn(() => Buffer.from('justificativa-sintetica'))
}));
jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({ registrarAuditoriaNaTransacao: jest.fn(async () => undefined) }));

const ator = { tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', usuarioId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', papel: 'Professional', emailHash: '', permissoes: [] } as const;
function preparar() {
  const linha = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pacienteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', estado: 'ativa', confirmacao: 'pendente', revisao: 1, conteudoCriptografado: Buffer.from('anterior') };
  const atual = { findOne: jest.fn(async () => linha), update: jest.fn(async () => ({ affected: 1 })) };
  const revisoes = { findOne: jest.fn(async (): Promise<unknown> => ({ numero: 1, evento: 'criacao', conteudoCriptografado: Buffer.from('historico') })), insert: jest.fn(async () => undefined) };
  const avaliacao = { findOne: jest.fn(async (): Promise<{ id: string; revisao: number; situacao: string } | null> => null), update: jest.fn(async () => ({ affected: 1 })) };
  const historicoAvaliacao = { findOne: jest.fn(async (): Promise<unknown> => {
    const atual = await avaliacao.findOne.mock.results.at(-1)?.value as { situacao?: string; venceEm?: Date | null } | null | undefined;
    return { situacao: atual?.situacao, venceEm: atual?.venceEm ?? null };
  }), insert: jest.fn(async () => undefined) };
  const g = { query: jest.fn(async (sql: string): Promise<Array<Record<string, unknown>>> =>
    sql === 'show transaction_isolation' ? [{ transaction_isolation: 'read committed' }] : [{ consistente: true }]), getRepository: jest.fn((entidade: unknown) => {
    if (entidade === RestricaoPacienteOrm) return atual;
    if (entidade === RevisaoRestricaoPacienteOrm) return revisoes;
    if (entidade === AvaliacaoRestricoesPacienteOrm) return avaliacao;
    if (entidade === RevisaoAvaliacaoRestricoesOrm) return historicoAvaliacao;
    throw new Error('Repositório inesperado');
  }) };
  const executor = { executar: jest.fn(async (_tenant: string, fn: (g: unknown) => unknown) => fn(g)) };
  const servico = new ServicoConfirmacaoRestricao(executor as never, {} as never, {} as never);
  return { linha, atual, revisoes, avaliacao, historicoAvaliacao, g, executor,
    confirmar: (revisao = 1) => servico.confirmar(ator as never, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revisao),
    rejeitar: (dados: unknown = { justificativa: 'Justificativa sintética' }, revisao = 1) => servico.rejeitar(ator as never, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revisao, dados),
    confirmarMaiusculo: () => servico.confirmar(ator as never, 'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC', 'DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD', 1),
    inativarMaiusculo: (dados: { motivo: string; justificativa: string; confirmacaoEmDoisPassos: boolean }) => servico.inativar(ator as never, 'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC', 'DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD', 1, dados),
    inativar: (dados: { motivo: string; justificativa: string; confirmacaoEmDoisPassos: boolean }) => servico.inativar(ator as never, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1, dados) };
}
beforeEach(() => jest.clearAllMocks());
describe('rejeição de pendência clínica', () => {
  it('rejeita com justificativa cifrada, revisão e auditoria sem conteúdo', async () => {
    const c = preparar();
    await expect(c.rejeitar()).resolves.toEqual({ id: c.linha.id, revisao: 2, confirmacao: 'rejeitada' });
    expect(autorizarRestricaoClinica).toHaveBeenCalledWith(c.g, expect.anything(), ator, c.linha.pacienteId);
    expect(cifrarCampo).toHaveBeenCalledWith(expect.anything(), 'restricoes_pacientes_revisoes.justificativa_criptografada', 'Justificativa sintética',
      expect.objectContaining({ tenantId: ator.tenantId, pacienteId: c.linha.pacienteId, registroId: c.linha.id, revisao: 2 }));
    expect(c.atual.update).toHaveBeenCalledWith(expect.objectContaining({ id: c.linha.id, tenantId: ator.tenantId, pacienteId: c.linha.pacienteId, revisao: 1 }),
      expect.objectContaining({ confirmacao: 'rejeitada', revisao: 2, conteudoCriptografado: expect.any(Buffer) }));
    expect(c.revisoes.insert).toHaveBeenCalledWith(expect.objectContaining({ evento: 'rejeicao', numero: 2, justificativaCriptografada: expect.any(Buffer) }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.rejeitar', metadados: {} }));
  });
  it('rejeita entrada inválida e não executa getters', async () => {
    const c = preparar(); const getter = jest.fn(() => 'canario');
    const entrada = Object.defineProperty({}, 'justificativa', { enumerable: true, get: getter });
    for (const ruim of [null, {}, { justificativa: '' }, { justificativa: 'motivo', extra: 'canario' }, entrada]) {
      await expect(c.rejeitar(ruim)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(getter).not.toHaveBeenCalled(); expect(c.atual.update).not.toHaveBeenCalled();
  });
  it('nega acesso sem autorização e não altera decisões ou revisões antigas', async () => {
    jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
    const c = preparar(); await expect(c.rejeitar()).rejects.toBeInstanceOf(ForbiddenException);
    c.linha.confirmacao = 'confirmada'; await expect(c.rejeitar()).rejects.toBeInstanceOf(ConflictException);
    c.linha.confirmacao = 'rejeitada'; await expect(c.rejeitar()).rejects.toBeInstanceOf(ConflictException);
    c.linha.confirmacao = 'pendente'; await expect(c.rejeitar(undefined, 2)).rejects.toBeInstanceOf(ConflictException);
    expect(c.atual.update).not.toHaveBeenCalled(); expect(c.revisoes.insert).not.toHaveBeenCalled();
  });
  it.each(['sem_restricoes_confirmadas', 'restricoes_registradas'])('invalida avaliação %s sem criar declaração de ausência', async situacao => {
    const c = preparar(); c.avaliacao.findOne.mockResolvedValueOnce({ id: 'avaliacao', revisao: 3, situacao });
    await c.rejeitar();
    expect(c.avaliacao.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'avaliacao', revisao: 3, tenantId: ator.tenantId, pacienteId: c.linha.pacienteId }),
      expect.objectContaining({ situacao: 'nao_informado', revisao: 4, confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null }));
    expect(c.historicoAvaliacao.insert).toHaveBeenCalledWith(expect.objectContaining({ numero: 4, situacao: 'nao_informado' }));
  });
  it('falha fechado em CAS ou cifra inválida', async () => {
    const c = preparar(); c.atual.update.mockResolvedValueOnce({ affected: 0 });
    await expect(c.rejeitar()).rejects.toBeInstanceOf(ConflictException);
    expect(c.revisoes.insert).not.toHaveBeenCalled();
    jest.mocked(cifrarCampo).mockImplementationOnce(() => { throw new Error('CANARIO_CIFRA_REJEICAO'); });
    const erro = await c.rejeitar().catch(e => e);
    expect(erro).toMatchObject({ status: 500, message: 'Operação indisponível.' });
    expect(inspect(erro)).not.toContain('CANARIO_CIFRA_REJEICAO');
  });
  it.each(['repeatable read', 'serializable'])('recusa isolamento %s antes da autorização', async isolamento => {
    const c = preparar(); c.g.query.mockResolvedValueOnce([{ transaction_isolation: isolamento }]);
    await expect(c.rejeitar()).rejects.toBeInstanceOf(ConflictException);
    expect(autorizarRestricaoClinica).not.toHaveBeenCalled(); expect(c.atual.update).not.toHaveBeenCalled();
  });
  it('recusa histórico ausente ou conteúdo anterior divergente antes da transição', async () => {
    const c = preparar(); c.revisoes.findOne.mockResolvedValueOnce(null);
    await expect(c.rejeitar()).rejects.toBeInstanceOf(ConflictException);
    jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'a' } });
    jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'b' } });
    await expect(c.rejeitar()).rejects.toBeInstanceOf(ConflictException);
    expect(c.atual.update).not.toHaveBeenCalled(); expect(c.revisoes.insert).not.toHaveBeenCalled();
  });
  it('recusa histórico da avaliação divergente antes de qualquer gravação', async () => {
    const c = preparar(); c.avaliacao.findOne.mockResolvedValueOnce({ id: 'avaliacao', revisao: 3, situacao: 'sem_restricoes_confirmadas' });
    c.historicoAvaliacao.findOne.mockResolvedValueOnce({ situacao: 'restricoes_registradas', venceEm: null });
    await expect(c.rejeitar()).rejects.toBeInstanceOf(ConflictException);
    expect(c.atual.update).not.toHaveBeenCalled(); expect(c.avaliacao.update).not.toHaveBeenCalled();
  });
  it.each(['confirmacao', 'rejeicao', 'inativacao'])('recusa pendência contradita pelo evento %s', async evento => {
    const c = preparar(); c.revisoes.findOne.mockResolvedValueOnce({ numero: 1, evento, conteudoCriptografado: Buffer.from('historico') });
    await expect(c.rejeitar()).rejects.toBeInstanceOf(ConflictException);
    expect(c.atual.update).not.toHaveBeenCalled();
  });
  it('não transforma preferência em decisão clínica', async () => {
    const c = preparar();
    jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ schemaVersao: 1, natureza: 'preferencia', alvo: { tipo: 'alimento', id: 'a' } });
    jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ schemaVersao: 1, natureza: 'preferencia', alvo: { tipo: 'alimento', id: 'a' } });
    await expect(c.rejeitar()).rejects.toBeInstanceOf(ConflictException);
    expect(c.atual.update).not.toHaveBeenCalled();
  });
});
describe('confirmação de restrição', () => {
  it('pode ser construído pelo Nest com as dependências de transação e concessão', async () => {
    const g = { getRepository: jest.fn((entidade: unknown) => {
      if (entidade === AvaliacaoRestricoesPacienteOrm) return { findOne: async () => null };
      if (entidade === RestricaoPacienteOrm) return { findOne: async () => null };
      if (entidade === RevisaoRestricaoPacienteOrm) return {};
      throw new Error('Repositório inesperado');
    }) };
    const executor = { executar: jest.fn(async (_tenant: string, fn: (g: unknown) => unknown) => fn(g)) };
    const concessoes = { exigir: jest.fn() };
    const modulo = await Test.createTestingModule({ providers: [ServicoConfirmacaoRestricao,
      { provide: ExecutorTenant, useValue: executor }, { provide: CriptografiaDadosSensiveis, useValue: {} },
      { provide: ServicoConcessoesPermissao, useValue: concessoes }] }).compile();
    try {
      const servico = modulo.get(ServicoConfirmacaoRestricao);
      await expect(servico.confirmar(ator as never, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1)).rejects.toBeInstanceOf(ForbiddenException);
      expect(autorizarRestricaoClinica).toHaveBeenCalledWith(g, concessoes, ator, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    } finally { await modulo.close(); }
  });
  it('autoriza na mesma transação, preserva histórico cifrado e audita sem conteúdo', async () => {
    const c = preparar(); await expect(c.confirmar()).resolves.toEqual({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revisao: 2, confirmacao: 'confirmada' });
    expect(autorizarRestricaoClinica).toHaveBeenCalledWith(c.g, expect.anything(), ator, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(decifrarConteudoRestricao).toHaveBeenCalled();
    expect(cifrarConteudoRestricao).toHaveBeenCalledTimes(2);
    expect(c.atual.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pacienteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', revisao: 1 }), expect.objectContaining({ confirmacao: 'confirmada', revisao: 2, atualizadoEm: expect.any(Function) }));
    expect(c.revisoes.insert).toHaveBeenCalledWith(expect.objectContaining({ evento: 'confirmacao', numero: 2, tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pacienteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ metadados: {} }));
  });
  it('rejeita revisão desatualizada antes de gravar', async () => {
    const c = preparar(); await expect(c.confirmar(2)).rejects.toBeInstanceOf(ConflictException);
    expect(c.atual.update).not.toHaveBeenCalled(); expect(c.revisoes.insert).not.toHaveBeenCalled();
  });
  it('normaliza identificadores antes da autorização e do vínculo do codec', async () => {
    const c = preparar(); await c.confirmarMaiusculo();
    expect(autorizarRestricaoClinica).toHaveBeenCalledWith(c.g, expect.anything(), ator, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(decifrarConteudoRestricao).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ pacienteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', restricaoId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }));
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
    expect(c.avaliacao.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'avaliacao', tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pacienteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', revisao: 3 }),
      expect.objectContaining({ situacao: 'nao_informado', revisao: 4, confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null }));
    expect(c.historicoAvaliacao.insert).toHaveBeenCalledWith(expect.objectContaining({ avaliacaoId: 'avaliacao', numero: 4, situacao: 'nao_informado', autorUsuarioId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }));
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
    jest.mocked(registrarAuditoriaNaTransacao).mockRejectedValueOnce(new Error('CANARIO_CLINICO_SINTETICO'));
    const c = preparar(); const erro = await c.confirmar().catch(e => e);
    expect(erro).toBeInstanceOf(InternalServerErrorException);
    expect(String(erro)).not.toContain('CANARIO_CLINICO_SINTETICO');
    if (!(erro instanceof InternalServerErrorException)) throw new Error('Exceção inesperada.');
    expect(JSON.stringify(erro.getResponse())).not.toContain('CANARIO_CLINICO_SINTETICO');
  });
  it('não conserva query, parâmetros ou detalhes de QueryFailedError real', async () => {
    const c = preparar();
    c.executor.executar.mockRejectedValueOnce(new QueryFailedError('select CANARIO_QUERY', ['CANARIO_PARAMETRO'], Object.assign(new Error('CANARIO_ERRO'), { code: '23503', detail: 'CANARIO_DETALHE' })));
    const erro = await c.confirmar().catch(e => e);
    expect(erro).toBeInstanceOf(InternalServerErrorException);
    expect(inspect(erro)).not.toMatch(/CANARIO_QUERY|CANARIO_PARAMETRO|CANARIO_ERRO|CANARIO_DETALHE/);
  });
  it('inativa restrição confirmada com justificativa cifrada, confirmação e histórico', async () => {
    const c = preparar(); c.linha.confirmacao = 'confirmada';
    await expect(c.inativar({ motivo: 'informacao_clinica_revisada', justificativa: 'Justificativa sintética', confirmacaoEmDoisPassos: true })).resolves.toMatchObject({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revisao: 2, estado: 'inativa' });
    expect(c.atual.update).toHaveBeenCalledWith(expect.objectContaining({ revisao: 1, tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pacienteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }), expect.objectContaining({ estado: 'inativa', revisao: 2, atualizadoEm: expect.any(Function) }));
    expect(cifrarCampo).toHaveBeenCalled();
    expect(c.revisoes.insert).toHaveBeenCalledWith(expect.objectContaining({ evento: 'inativacao', motivoInativacao: 'informacao_clinica_revisada', confirmacaoDoisPassos: true }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ metadados: {} }));
  });
  it('normaliza UUIDs da inativação antes da autorização e da cifra', async () => {
    const c = preparar(); c.linha.confirmacao = 'confirmada';
    await c.inativarMaiusculo({ motivo: 'outro', justificativa: 'Sintético', confirmacaoEmDoisPassos: true });
    expect(autorizarRestricaoClinica).toHaveBeenCalledWith(c.g, expect.anything(), ator, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(cifrarCampo).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Sintético', expect.objectContaining({ pacienteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', registroId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }));
  });
  it.each([{ motivo: '', justificativa: 'x', confirmacaoEmDoisPassos: true }, { motivo: 'outro', justificativa: '', confirmacaoEmDoisPassos: true }, { motivo: 'outro', justificativa: 'x', confirmacaoEmDoisPassos: false }])('recusa inativação sem pré-condições %p', async dados => {
    const c = preparar(); c.linha.confirmacao = 'confirmada';
    await expect(c.inativar(dados)).rejects.toThrow(); expect(c.atual.update).not.toHaveBeenCalled();
  });
  it('invalida avaliação global anterior ao inativar e não infere ausência', async () => {
    const c = preparar(); c.linha.confirmacao = 'confirmada';
    c.avaliacao.findOne.mockResolvedValueOnce({ id: 'avaliacao', revisao: 3, situacao: 'restricoes_registradas' });
    await c.inativar({ motivo: 'outro', justificativa: 'Justificativa sintética', confirmacaoEmDoisPassos: true });
    expect(c.avaliacao.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'avaliacao', revisao: 3 }),
      expect.objectContaining({ situacao: 'nao_informado', revisao: 4, confirmadoPorUsuarioId: null, confirmadoEm: null, venceEm: null }));
    expect(c.historicoAvaliacao.insert).toHaveBeenCalledWith(expect.objectContaining({ numero: 4, situacao: 'nao_informado' }));
  });
  it('não preserva uma avaliação de ausência contraditória ao inativar restrição confirmada', async () => {
    const c = preparar(); c.linha.confirmacao = 'confirmada';
    c.avaliacao.findOne.mockResolvedValueOnce({ id: 'avaliacao', revisao: 3, situacao: 'sem_restricoes_confirmadas' });
    await expect(c.inativar({ motivo: 'outro', justificativa: 'Sintético', confirmacaoEmDoisPassos: true })).rejects.toBeInstanceOf(ConflictException);
    expect(c.atual.update).not.toHaveBeenCalled();
  });
  it('nega inativação quando a concessão ou carteira falha', async () => {
    jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
    const c = preparar(); c.linha.confirmacao = 'confirmada';
    await expect(c.inativar({ motivo: 'outro', justificativa: 'Sintético', confirmacaoEmDoisPassos: true })).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.atual.update).not.toHaveBeenCalled();
  });
  it('sanitiza falha inesperada durante inativação', async () => {
    jest.mocked(registrarAuditoriaNaTransacao).mockRejectedValueOnce(new Error('CANARIO_CLINICO_SINTETICO'));
    const c = preparar(); c.linha.confirmacao = 'confirmada';
    const erro = await c.inativar({ motivo: 'outro', justificativa: 'Sintético', confirmacaoEmDoisPassos: true }).catch(e => e);
    expect(erro).toBeInstanceOf(InternalServerErrorException);
    expect(String(erro)).not.toContain('CANARIO_CLINICO_SINTETICO');
  });
  it.each(['linha\nseguinte', 'tab\taqui', 'x'.repeat(1001)])('rejeita justificativa incompatível sem eco', async justificativa => {
    const c = preparar(); c.linha.confirmacao = 'confirmada';
    const erro = await c.inativar({ motivo: 'outro', justificativa, confirmacaoEmDoisPassos: true }).catch(e => e);
    expect(erro).toBeInstanceOf(BadRequestException);
    if (!(erro instanceof BadRequestException)) throw new Error('Exceção inesperada.');
    expect(JSON.stringify(erro.getResponse())).not.toContain(justificativa);
    expect(c.atual.update).not.toHaveBeenCalled();
  });
});
