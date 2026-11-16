import { BadRequestException, ConflictException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { inspect } from 'node:util';
import { ServicoSolicitacoesRestricao } from './servico-solicitacoes-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { cifrarCampo, decifrarCampo } from '../infraestrutura/codec-conteudo-restricao';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { SolicitacaoRestricaoPacienteOrm } from '../infraestrutura/solicitacao-restricao-paciente.orm';

/** FOOD06 P2c: o profissional analisa e decide pedidos do paciente. A solicitação nunca altera a restrição. */
jest.mock('./autorizacao-restricao-clinica', () => ({ autorizarRestricaoClinica: jest.fn(async () => undefined) }));
jest.mock('../infraestrutura/codec-conteudo-restricao', () => ({
  decifrarCampo: jest.fn((_c: unknown, campo: string) => campo.endsWith('conteudo_criptografado')
    ? { itens: [{ item: 'i1', texto: 'Texto sintético 1' }, { item: 'i2', texto: 'Texto sintético 2' }] }
    : campo.endsWith('desfecho_criptografado') ? { estadoFinal: 'recusada', alterados: [], inalterados: ['i1', 'i2'] } : 'Texto protegido sintético'),
  cifrarCampo: jest.fn(() => Buffer.from('cifra-sintetica'))
}));
jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({ registrarAuditoriaNaTransacao: jest.fn(async () => undefined) }));

const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', USUARIO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PACIENTE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', SOLICITACAO = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const RESTRICAO = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ator = { tenantId: TENANT, usuarioId: USUARIO, papel: 'Professional', emailHash: '', permissoes: [] } as const;

function preparar(estado = 'em_analise', tipo: 'inclusao' | 'correcao' | 'remocao' = 'correcao') {
  const linha: Record<string, unknown> = { id: SOLICITACAO, tenantId: TENANT, pacienteId: PACIENTE, tipo, estado, revisao: 2,
    restricaoId: tipo === 'inclusao' ? null : RESTRICAO, autorUsuarioId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    conteudoCriptografado: Buffer.from('pedido'), criadoEm: new Date('2026-11-10T10:00:00Z') };
  const repo = { findOne: jest.fn(async () => linha), find: jest.fn(async () => [linha]), update: jest.fn(async () => ({ affected: 1 })) };
  const g = {
    query: jest.fn(async (sql: string, _params?: unknown[]): Promise<Array<Record<string, unknown>>> =>
      sql === 'show transaction_isolation' ? [{ transaction_isolation: 'read committed' }] : [{ existe: true }]),
    getRepository: jest.fn((entidade: unknown) => { if (entidade === SolicitacaoRestricaoPacienteOrm) return repo; throw new Error('Repositório inesperado'); })
  };
  const executor = { executar: jest.fn(async (_t: string, fn: (g: unknown) => unknown) => fn(g)) };
  const servico = new ServicoSolicitacoesRestricao(executor as never, {} as never, {} as never);
  return { linha, repo, g, executor, servico };
}
const decisao = (extra: Record<string, unknown> = {}) => ({ estadoFinal: 'parcial', explicacaoPaciente: 'Explicação sintética ao paciente.',
  justificativaInterna: 'Justificativa interna sintética.', alterados: [{ item: 'i1', restricaoId: RESTRICAO, revisaoResultante: 3 }], inalterados: ['i2'], ...extra });

beforeEach(() => jest.clearAllMocks());

describe('início da análise', () => {
  it('passa de criada para em_analise com CAS, autorização na transação e auditoria sem conteúdo', async () => {
    const c = preparar('criada');
    await expect(c.servico.iniciarAnalise(ator as never, PACIENTE, SOLICITACAO, 2)).resolves.toEqual({ id: SOLICITACAO, revisao: 3, estado: 'em_analise' });
    expect(autorizarRestricaoClinica).toHaveBeenCalledWith(c.g, expect.anything(), ator, PACIENTE);
    expect(c.repo.update).toHaveBeenCalledWith(expect.objectContaining({ id: SOLICITACAO, tenantId: TENANT, pacienteId: PACIENTE, revisao: 2, estado: 'criada' }),
      expect.objectContaining({ estado: 'em_analise', revisao: 3 }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.solicitacao_iniciar_analise', metadados: {} }));
  });
  it.each(['em_analise', 'atendida', 'cancelada_pelo_paciente'])('recusa estado %s e revisão obsoleta', async estado => {
    const c = preparar(estado);
    await expect(c.servico.iniciarAnalise(ator as never, PACIENTE, SOLICITACAO, 2)).rejects.toBeInstanceOf(ConflictException);
    const d = preparar('criada');
    await expect(d.servico.iniciarAnalise(ator as never, PACIENTE, SOLICITACAO, 1)).rejects.toBeInstanceOf(ConflictException);
    expect(c.repo.update).not.toHaveBeenCalled(); expect(d.repo.update).not.toHaveBeenCalled();
  });
  it('nega sem autorização e não lê a solicitação', async () => {
    jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
    const c = preparar('criada');
    await expect(c.servico.iniciarAnalise(ator as never, PACIENTE, SOLICITACAO, 2)).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.repo.findOne).not.toHaveBeenCalled();
  });
  it('solicitação de outro paciente ou inexistente responde 403 sem existir oráculo', async () => {
    const c = preparar('criada'); c.repo.findOne.mockResolvedValueOnce(null as never);
    await expect(c.servico.iniciarAnalise(ator as never, PACIENTE, SOLICITACAO, 2)).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: SOLICITACAO, tenantId: TENANT, pacienteId: PACIENTE } }));
  });
  it('recusa isolamento diferente de READ COMMITTED antes da autorização', async () => {
    const c = preparar('criada'); c.g.query.mockResolvedValueOnce([{ transaction_isolation: 'repeatable read' }]);
    await expect(c.servico.iniciarAnalise(ator as never, PACIENTE, SOLICITACAO, 2)).rejects.toBeInstanceOf(ConflictException);
    expect(autorizarRestricaoClinica).not.toHaveBeenCalled();
  });
});

describe('decisão do profissional', () => {
  it('decide parcial cifrando explicação, justificativa e desfecho na revisão da decisão, sem tocar a restrição', async () => {
    const c = preparar();
    await expect(c.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2, decisao())).resolves.toEqual({ id: SOLICITACAO, revisao: 3, estado: 'parcial' });
    const vinculo = { tenantId: TENANT, pacienteId: PACIENTE, registroId: SOLICITACAO, revisao: 3 };
    expect(cifrarCampo).toHaveBeenCalledWith(expect.anything(), 'solicitacoes_restricoes_pacientes.explicacao_paciente_criptografada', 'Explicação sintética ao paciente.', vinculo);
    expect(cifrarCampo).toHaveBeenCalledWith(expect.anything(), 'solicitacoes_restricoes_pacientes.justificativa_interna_criptografada', 'Justificativa interna sintética.', vinculo);
    expect(cifrarCampo).toHaveBeenCalledWith(expect.anything(), 'solicitacoes_restricoes_pacientes.desfecho_criptografado',
      { estadoFinal: 'parcial', alterados: [{ item: 'i1', restricaoId: RESTRICAO, revisaoResultante: 3 }], inalterados: ['i2'] }, vinculo);
    expect(c.repo.update).toHaveBeenCalledWith(expect.objectContaining({ id: SOLICITACAO, revisao: 2, estado: 'em_analise' }),
      expect.objectContaining({ estado: 'parcial', revisao: 3, decididoPorUsuarioId: USUARIO }));
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.solicitacao_decidir', metadados: {} }));
  });
  it('a revisão alterada precisa existir e ser posterior ao pedido (consulta escopada por tenant e paciente)', async () => {
    const c = preparar(); c.g.query.mockImplementation(async (sql: string, _params?: unknown[]) =>
      sql === 'show transaction_isolation' ? [{ transaction_isolation: 'read committed' }] : []);
    await expect(c.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2, decisao())).rejects.toBeInstanceOf(ConflictException);
    expect(c.repo.update).not.toHaveBeenCalled();
    const consulta = c.g.query.mock.calls.find(([sql]) => sql !== 'show transaction_isolation')!;
    expect(consulta[0]).toMatch(/criado_em > s\.criado_em/);
    expect(consulta[1]).toEqual([TENANT, PACIENTE, RESTRICAO, 3, SOLICITACAO]);
  });
  it('itens do desfecho precisam ser exatamente os do pedido', async () => {
    for (const extra of [{ inalterados: [] , estadoFinal: 'atendida' }, { inalterados: ['i2', 'i3'] }, { inalterados: ['x9'] }]) {
      const c = preparar();
      await expect(c.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2, decisao(extra))).rejects.toBeInstanceOf(BadRequestException);
      expect(c.repo.update).not.toHaveBeenCalled();
    }
  });
  it('em correção ou remoção, a restrição alterada é a do pedido', async () => {
    const c = preparar('em_analise', 'remocao');
    await expect(c.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2,
      decisao({ alterados: [{ item: 'i1', restricaoId: '99999999-9999-4999-8999-999999999999', revisaoResultante: 3 }] }))).rejects.toBeInstanceOf(BadRequestException);
    expect(c.repo.update).not.toHaveBeenCalled();
  });
  it('em inclusão, a restrição alterada pode ser nova (sem restrição no pedido)', async () => {
    const c = preparar('em_analise', 'inclusao');
    await expect(c.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2,
      decisao({ alterados: [{ item: 'i1', restricaoId: '99999999-9999-4999-8999-999999999999', revisaoResultante: 1 }] }))).resolves.toMatchObject({ estado: 'parcial' });
  });
  it('recusa sem itens alterados e sem justificativa é válida; explicação ao paciente é obrigatória', async () => {
    const c = preparar();
    await expect(c.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2,
      { estadoFinal: 'recusada', explicacaoPaciente: 'Mantido após conferência.', alterados: [], inalterados: ['i1', 'i2'] })).resolves.toMatchObject({ estado: 'recusada' });
    expect(cifrarCampo).not.toHaveBeenCalledWith(expect.anything(), 'solicitacoes_restricoes_pacientes.justificativa_interna_criptografada', expect.anything(), expect.anything());
    const d = preparar();
    await expect(d.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2, decisao({ explicacaoPaciente: '  ' }))).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each([null, [], 'x', { ...decisao(), extra: 1 }, { ...decisao(), estadoFinal: 'cancelada_pelo_paciente' }])('entrada inválida %p responde 400 sem eco', async dados => {
    const c = preparar();
    const erro = await c.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2, dados).catch(e => e);
    expect(erro).toBeInstanceOf(BadRequestException); expect(c.executor.executar).not.toHaveBeenCalled();
  });
  it.each(['criada', 'atendida', 'recusada', 'cancelada_pelo_paciente'])('só decide em_analise (estado %s responde 409)', async estado => {
    const c = preparar(estado);
    await expect(c.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2, decisao())).rejects.toBeInstanceOf(ConflictException);
    expect(c.repo.update).not.toHaveBeenCalled();
  });
  it('CAS sem efeito responde 409 e falha de auditoria aborta sem eco', async () => {
    const c = preparar(); c.repo.update.mockResolvedValueOnce({ affected: 0 });
    await expect(c.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2, decisao())).rejects.toBeInstanceOf(ConflictException);
    jest.mocked(registrarAuditoriaNaTransacao).mockRejectedValueOnce(new Error('CANARIO_AUDITORIA'));
    const d = preparar();
    const erro = await d.servico.decidir(ator as never, PACIENTE, SOLICITACAO, 2, decisao()).catch(e => e);
    expect(erro).toBeInstanceOf(InternalServerErrorException); expect(inspect(erro)).not.toContain('CANARIO_AUDITORIA');
  });
});

describe('lista para o profissional', () => {
  it('lista as últimas 100 do paciente com pedido decifrado e audita sem conteúdo', async () => {
    const c = preparar('criada');
    const lista = await c.servico.listar(ator as never, PACIENTE) as Array<Record<string, unknown>>;
    expect(lista).toEqual([{ id: SOLICITACAO, tipo: 'correcao', estado: 'criada', revisao: 2, restricaoId: RESTRICAO,
      criadoEm: '2026-11-10T10:00:00.000Z', pedido: { itens: [{ item: 'i1', texto: 'Texto sintético 1' }, { item: 'i2', texto: 'Texto sintético 2' }] } }]);
    expect(c.repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: TENANT, pacienteId: PACIENTE }, take: 100 }));
    expect(decifrarCampo).toHaveBeenCalledWith(expect.anything(), 'solicitacoes_restricoes_pacientes.conteudo_criptografado', Buffer.from('pedido'),
      { tenantId: TENANT, pacienteId: PACIENTE, registroId: SOLICITACAO, revisao: 1 });
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.solicitacoes_listar', metadados: {} }));
  });
  it('decidida inclui explicação, justificativa e desfecho decifrados na revisão da decisão', async () => {
    const c = preparar('recusada');
    Object.assign(c.linha, { explicacaoPacienteCriptografada: Buffer.from('e'), justificativaInternaCriptografada: Buffer.from('j'),
      desfechoCriptografado: Buffer.from('d'), decididoEm: new Date('2026-11-11T10:00:00Z') });
    const [item] = await c.servico.listar(ator as never, PACIENTE) as Array<Record<string, unknown>>;
    expect(item).toMatchObject({ estado: 'recusada', decididoEm: '2026-11-11T10:00:00.000Z', explicacaoPaciente: 'Texto protegido sintético',
      justificativaInterna: 'Texto protegido sintético', desfecho: { estadoFinal: 'recusada', alterados: [], inalterados: ['i1', 'i2'] } });
    expect(decifrarCampo).toHaveBeenCalledWith(expect.anything(), 'solicitacoes_restricoes_pacientes.desfecho_criptografado', Buffer.from('d'),
      { tenantId: TENANT, pacienteId: PACIENTE, registroId: SOLICITACAO, revisao: 2 });
  });
  it('conteúdo ilegível falha fechado em vez de omitir o pedido', async () => {
    jest.mocked(decifrarCampo).mockImplementationOnce(() => { throw new Error('ilegível'); });
    const c = preparar('criada');
    await expect(c.servico.listar(ator as never, PACIENTE)).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
