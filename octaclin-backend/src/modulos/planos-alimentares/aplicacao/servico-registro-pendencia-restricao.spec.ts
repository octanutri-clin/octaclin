import { BadRequestException, ConflictException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { inspect } from 'node:util';
import { QueryFailedError } from 'typeorm';
import { ServicoRegistroPendenciaRestricao } from './servico-registro-pendencia-restricao';
import { autorizarPendenciaRestricao } from './autorizacao-pendencia-restricao';
import { cifrarConteudoRestricao, decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';
import { RevisaoAvaliacaoRestricoesOrm } from '../infraestrutura/revisao-avaliacao-restricoes.orm';

jest.mock('./autorizacao-pendencia-restricao', () => ({ autorizarPendenciaRestricao: jest.fn(async () => 'profissional') }));
jest.mock('../infraestrutura/codec-conteudo-restricao', () => ({ cifrarConteudoRestricao: jest.fn(() => Buffer.from('sintetico')), decifrarConteudoRestricao: jest.fn() }));
jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({ registrarAuditoriaNaTransacao: jest.fn(async () => undefined) }));
const ator = { tenantId: '11111111-1111-4111-8111-111111111111', usuarioId: '22222222-2222-4222-8222-222222222222', papel: 'Professional', emailHash: '', permissoes: [] } as const;
const pacienteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const chaveCriacao = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const conteudo = { schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'alimento', id: 'sintetico' } } as const;
function preparar() {
  const atuais = { findOne: jest.fn(async (): Promise<unknown> => null), insert: jest.fn(async () => undefined) };
  const historico = { insert: jest.fn(async () => undefined), findOne: jest.fn(async (): Promise<unknown> => null) };
  const avaliacoes = { findOne: jest.fn(async (): Promise<unknown> => null), update: jest.fn(async () => ({ affected: 1 })) };
  const historicoAvaliacao = { insert: jest.fn(async () => undefined) };
  const g = { query: jest.fn(async () => []), getRepository: jest.fn((entidade: unknown) => {
    if (entidade === RestricaoPacienteOrm) return atuais; if (entidade === RevisaoRestricaoPacienteOrm) return historico;
    if (entidade === AvaliacaoRestricoesPacienteOrm) return avaliacoes; if (entidade === RevisaoAvaliacaoRestricoesOrm) return historicoAvaliacao;
    throw new Error('Repositório inesperado');
  }) };
  const executor = { executar: jest.fn(async (_tenant: string, fn: (g: unknown) => unknown) => fn(g)) };
  const service = new ServicoRegistroPendenciaRestricao(executor as never, {} as never);
  return { atuais, historico, avaliacoes, historicoAvaliacao, g, executor, registrar: (dados = { chaveCriacao, conteudo }, paciente = pacienteId) => service.registrar(ator as never, paciente, dados) };
}
beforeEach(() => jest.clearAllMocks());
describe('registro de pendência de restrição', () => {
  it('cria somente pendente com conteúdo e histórico cifrados, sem eco e com auditoria', async () => {
    const c = preparar(); const resposta = await c.registrar();
    expect(autorizarPendenciaRestricao).toHaveBeenCalledWith(c.g, ator, pacienteId);
    expect(cifrarConteudoRestricao).toHaveBeenCalledTimes(2);
    expect(c.atuais.insert).toHaveBeenCalledWith(expect.objectContaining({ tenantId: ator.tenantId, pacienteId, autorUsuarioId: ator.usuarioId, chaveCriacao, origem: 'profissional', confirmacao: 'pendente', revisao: 1 }));
    expect(c.historico.insert).toHaveBeenCalledWith(expect.objectContaining({ evento: 'criacao', numero: 1, tenantId: ator.tenantId, pacienteId }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ metadados: {} }));
    expect(JSON.stringify(resposta)).not.toContain('alergia');
  });
  it('nega antes de acessar ou gravar conteúdo quando não autorizado', async () => {
    jest.mocked(autorizarPendenciaRestricao).mockRejectedValueOnce(new ForbiddenException());
    const c = preparar(); await expect(c.registrar()).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.atuais.insert).not.toHaveBeenCalled(); expect(cifrarConteudoRestricao).not.toHaveBeenCalled();
  });
  it('repetição igual devolve o registro sem duplicar histórico', async () => {
    const c = preparar(); c.atuais.findOne.mockResolvedValueOnce({ id: 'existente', pacienteId, revisao: 3, confirmacao: 'confirmada', estado: 'inativa', conteudoCriptografado: Buffer.from('sintetico') });
    c.historico.findOne.mockResolvedValueOnce({ conteudoCriptografado: Buffer.from('sintetico') });
    jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce(conteudo as never);
    await expect(c.registrar()).resolves.toMatchObject({ id: 'existente', revisao: 3, confirmacao: 'confirmada', estado: 'inativa' });
    expect(c.atuais.insert).not.toHaveBeenCalled(); expect(c.historico.insert).not.toHaveBeenCalled();
  });
  it('chave reutilizada em outro paciente falha com conflito', async () => {
    const c = preparar(); c.atuais.findOne.mockResolvedValueOnce({ id: 'existente', pacienteId: 'outro' });
    await expect(c.registrar()).rejects.toBeInstanceOf(ConflictException);
    expect(c.atuais.insert).not.toHaveBeenCalled();
  });
  it('invalida avaliação de ausência ao criar pendência clínica', async () => {
    const c = preparar(); c.avaliacoes.findOne.mockResolvedValueOnce({ id: 'avaliacao', revisao: 2, situacao: 'sem_restricoes_confirmadas' });
    await c.registrar();
    expect(c.avaliacoes.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'avaliacao', tenantId: ator.tenantId, pacienteId, revisao: 2 }),
      expect.objectContaining({ situacao: 'nao_informado', revisao: 3, confirmadoEm: null, confirmadoPorUsuarioId: null, venceEm: null }));
    expect(c.historicoAvaliacao.insert).toHaveBeenCalledWith(expect.objectContaining({ avaliacaoId: 'avaliacao', numero: 3, situacao: 'nao_informado' }));
  });
  it('rejeita reutilização de chave com conteúdo diferente do histórico de criação', async () => {
    const c = preparar(); c.atuais.findOne.mockResolvedValueOnce({ id: 'existente', pacienteId, revisao: 2 });
    c.historico.findOne.mockResolvedValueOnce({ conteudoCriptografado: Buffer.from('sintetico') });
    jest.mocked(decifrarConteudoRestricao).mockReturnValueOnce({ ...conteudo, alvo: { tipo: 'alimento', id: 'outro' } } as never);
    await expect(c.registrar()).rejects.toBeInstanceOf(ConflictException);
  });
  it('não transforma preferência em pendência clínica sem fluxo próprio', async () => {
    const c = preparar();
    await expect(c.registrar({ chaveCriacao, conteudo: { schemaVersao: 1, natureza: 'preferencia', alvo: { tipo: 'alimento', id: 'sintetico' } } as never }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(c.atuais.insert).not.toHaveBeenCalled();
  });
  it('normaliza a chave antes do lock e gravação', async () => {
    const c = preparar(); await c.registrar({ chaveCriacao: chaveCriacao.toUpperCase(), conteudo });
    expect(c.g.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [expect.stringMatching(new RegExp(`${chaveCriacao}$`))]);
    expect(c.atuais.insert).toHaveBeenCalledWith(expect.objectContaining({ chaveCriacao }));
  });
  it('normaliza paciente antes do vínculo cifrado e autorização', async () => {
    const c = preparar(); await c.registrar({ chaveCriacao, conteudo }, pacienteId.toUpperCase());
    expect(autorizarPendenciaRestricao).toHaveBeenCalledWith(c.g, ator, pacienteId);
    expect(cifrarConteudoRestricao).toHaveBeenCalledWith(expect.anything(), conteudo, expect.objectContaining({ pacienteId }));
  });
  it('traduz conflito de unicidade sem expor detalhes do banco', async () => {
    const c = preparar(); c.executor.executar.mockRejectedValueOnce(Object.assign(new Error('detalhe-sintetico'), { code: '23505', constraint: 'ux_restricoes_pacientes_criacao' }));
    const erro = await c.registrar().catch(e => e);
    expect(erro).toBeInstanceOf(ConflictException);
    if (!(erro instanceof ConflictException)) throw new Error('Exceção inesperada.');
    expect(JSON.stringify(erro.getResponse())).not.toContain('detalhe-sintetico');
  });
  it('não confunde violação de outra unicidade com chave repetida nem expõe detalhes', async () => {
    const c = preparar(); c.executor.executar.mockRejectedValueOnce(Object.assign(new Error('detalhe-sintetico'), { code: '23505', constraint: 'outra_constraint' }));
    const erro = await c.registrar().catch(e => e);
    expect(erro).toBeInstanceOf(InternalServerErrorException);
    if (!(erro instanceof InternalServerErrorException)) throw new Error('Exceção inesperada.');
    expect(JSON.stringify(erro.getResponse())).not.toContain('detalhe-sintetico');
  });
  it('sanitiza erro inesperado de banco que contém parâmetros', async () => {
    const c = preparar(); c.executor.executar.mockRejectedValueOnce(Object.assign(new Error('CANARIO_CLINICO_SINTETICO'), { code: '23503' }));
    const erro = await c.registrar().catch(e => e);
    expect(erro).toBeInstanceOf(InternalServerErrorException);
    expect(String(erro)).not.toContain('CANARIO_CLINICO_SINTETICO');
    if (!(erro instanceof InternalServerErrorException)) throw new Error('Exceção inesperada.');
    expect(JSON.stringify(erro.getResponse())).not.toContain('CANARIO_CLINICO_SINTETICO');
  });
  it('não conserva query, parâmetros ou detalhes de QueryFailedError real', async () => {
    const c = preparar();
    const falha = new QueryFailedError('select CANARIO_QUERY', ['CANARIO_PARAMETRO'], Object.assign(new Error('CANARIO_ERRO'), { code: '23503', detail: 'CANARIO_DETALHE' }));
    c.executor.executar.mockRejectedValueOnce(falha);
    const erro = await c.registrar().catch(e => e);
    expect(erro).toBeInstanceOf(InternalServerErrorException);
    expect(inspect(erro)).not.toMatch(/CANARIO_QUERY|CANARIO_PARAMETRO|CANARIO_ERRO|CANARIO_DETALHE/);
  });
  it('sanitiza mensagem e corpo de exceção HTTP de dependência', async () => {
    jest.mocked(autorizarPendenciaRestricao).mockRejectedValueOnce(new ForbiddenException({ motivo: 'CANARIO_CLINICO_SINTETICO' }, { cause: new Error('CAUSA_SINTETICA') }));
    const c = preparar(); const erro = await c.registrar().catch(e => e);
    expect(erro).toBeInstanceOf(ForbiddenException);
    if (!(erro instanceof ForbiddenException)) throw new Error('Exceção inesperada.');
    expect(JSON.stringify(erro.getResponse())).not.toContain('CANARIO_CLINICO_SINTETICO');
    expect(String(erro)).not.toContain('CANARIO_CLINICO_SINTETICO');
    expect(inspect(erro)).not.toMatch(/CANARIO_CLINICO_SINTETICO|CAUSA_SINTETICA/);
  });
});
