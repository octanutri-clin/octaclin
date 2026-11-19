import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { inspect } from 'node:util';
import { ServicoLeituraRestricao } from './servico-leitura-restricao';
import { autorizarRestricaoClinica } from './autorizacao-restricao-clinica';
import { autorizarPendenciaRestricao } from './autorizacao-pendencia-restricao';
import { exigirHistoricoConsistente } from './integridade-avaliacao-restricoes';
import { decifrarConteudoRestricao } from '../infraestrutura/codec-conteudo-restricao';
import { registrarAuditoriaNaTransacao } from '../../../infraestrutura/auditoria/servico-auditoria';
import { RestricaoPacienteOrm } from '../infraestrutura/restricao-paciente.orm';
import { RevisaoRestricaoPacienteOrm } from '../infraestrutura/revisao-restricao-paciente.orm';
import { AvaliacaoRestricoesPacienteOrm } from '../infraestrutura/avaliacao-restricoes-paciente.orm';

// FOOD06 P3-0a: listagem para o profissional (completa com a concessão; só as próprias sem ela), para o colaborador
// delegado (só as próprias) e leitura da avaliação com vencimento. Dados sintéticos.
jest.mock('./autorizacao-restricao-clinica', () => ({ autorizarRestricaoClinica: jest.fn(async () => undefined) }));
jest.mock('./autorizacao-pendencia-restricao', () => ({ autorizarPendenciaRestricao: jest.fn(async () => 'profissional') }));
jest.mock('./integridade-avaliacao-restricoes', () => ({
  exigirReadCommitted: jest.fn(async () => undefined), exigirHistoricoConsistente: jest.fn(async () => undefined)
}));
jest.mock('../infraestrutura/codec-conteudo-restricao', () => ({ decifrarConteudoRestricao: jest.fn(() => ({ schemaVersao: 1, natureza: 'clinica', subtipoClinico: 'alergia_alimentar', alvo: { tipo: 'nao_catalogado' }, alvoDeclarado: 'Amendoim' })) }));
jest.mock('../../../infraestrutura/auditoria/servico-auditoria', () => ({ registrarAuditoriaNaTransacao: jest.fn(async () => undefined) }));

const profissional = { tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', usuarioId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', papel: 'Professional' } as const;
const colaborador = { ...profissional, usuarioId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', papel: 'Collaborator' } as const;
const paciente = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const linha = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12, '0')}`, revisao: 1, origem: 'profissional', estado: 'ativa', confirmacao: 'pendente',
  conteudoCriptografado: Buffer.from('cifra'), criadoEm: new Date('2026-11-18T10:00:00Z'), chaveCriacao: 'NAO_RETORNAR', autorUsuarioId: 'NAO_RETORNAR', ...extra
});

function preparar(linhas: unknown[] = [linha(1)]) {
  const restricoes = { find: jest.fn(async () => linhas) };
  const revisoes = { find: jest.fn(async () => (linhas as Array<{ id: string; revisao: number }>).map(l => ({ restricaoId: l.id, numero: l.revisao, evento: 'criacao', conteudoCriptografado: Buffer.from('h') }))) };
  const avaliacoes = { findOne: jest.fn(async (): Promise<unknown> => ({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', revisao: 3, situacao: 'restricoes_registradas',
    confirmadoEm: new Date('2026-09-12T10:00:00Z'), venceEm: new Date('2027-03-11T10:00:00Z'), confirmadoPorUsuarioId: 'NAO_RETORNAR' })) };
  const g = { query: jest.fn(async () => [{ transaction_isolation: 'read committed' }]), getRepository: jest.fn((e: unknown) => {
    if (e === RestricaoPacienteOrm) return restricoes;
    if (e === RevisaoRestricaoPacienteOrm) return revisoes;
    if (e === AvaliacaoRestricoesPacienteOrm) return avaliacoes;
    throw new Error('Repositório inesperado');
  }) };
  const executor = { executar: jest.fn(async (_t: string, fn: (g: unknown) => unknown) => fn(g)) };
  const concessoes = { exigir: jest.fn(async () => undefined) };
  const servico = new ServicoLeituraRestricao(executor as never, {} as never, concessoes as never);
  return { restricoes, revisoes, avaliacoes, g, concessoes, servico };
}
beforeEach(() => jest.clearAllMocks());

describe('listar restrições (P3-0a)', () => {
  it('profissional com a concessão vê todas as do paciente, com projeção mínima e uma auditoria', async () => {
    const c = preparar([linha(1), linha(2, { origem: 'declaracao_paciente' })]);
    const r = await c.servico.listar(profissional as never, paciente) as { escopo: string; itens: Array<Record<string, unknown>> };
    expect(autorizarPendenciaRestricao).toHaveBeenCalledWith(c.g, profissional, paciente);
    expect(c.concessoes.exigir).toHaveBeenCalledWith(profissional.tenantId, profissional.usuarioId, 'restricoes.confirmar', c.g);
    expect(c.restricoes.find).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: profissional.tenantId, pacienteId: paciente } }));
    expect(r.escopo).toBe('completo');
    expect(r.itens).toHaveLength(2);
    expect(Object.keys(r.itens[0]).sort()).toEqual(['confirmacao', 'conteudo', 'criadoEm', 'estado', 'id', 'origem', 'revisao']);
    expect(inspect(r)).not.toMatch(/NAO_RETORNAR|conteudoCriptografado|tenantId/);
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledTimes(1);
    expect(registrarAuditoriaNaTransacao).toHaveBeenCalledWith(c.g, expect.objectContaining({ acao: 'restricoes.listar', recursoTipo: 'paciente', recursoId: paciente, metadados: {} }));
  });

  it('profissional sem a concessão vê só as que registrou (Q6)', async () => {
    const c = preparar();
    c.concessoes.exigir.mockRejectedValueOnce(new ForbiddenException());
    const r = await c.servico.listar(profissional as never, paciente) as { escopo: string };
    expect(r.escopo).toBe('autoria');
    expect(c.restricoes.find).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: profissional.tenantId, pacienteId: paciente, autorUsuarioId: profissional.usuarioId } }));
  });

  it('erro de banco na verificação da concessão é relançado e nunca vira listagem por autoria (revisão R4)', async () => {
    const c = preparar();
    c.concessoes.exigir.mockRejectedValueOnce(Object.assign(new Error('lock timeout sintético'), { code: '55P03' }));
    await expect(c.servico.listar(profissional as never, paciente)).rejects.toBeInstanceOf(ConflictException);
    expect(c.restricoes.find).not.toHaveBeenCalled();
  });

  it('busca só a revisão atual de cada restrição no histórico (revisão R4)', async () => {
    const c = preparar([linha(1, { revisao: 3, estado: 'ativa', confirmacao: 'confirmada' })]);
    c.revisoes.find.mockResolvedValueOnce([{ restricaoId: linha(1).id, numero: 3, evento: 'confirmacao', conteudoCriptografado: Buffer.from('h') }]);
    await c.servico.listar(profissional as never, paciente);
    expect(c.revisoes.find).toHaveBeenCalledWith({ where: [{ tenantId: profissional.tenantId, pacienteId: paciente, restricaoId: linha(1).id, numero: 3 }] });
  });

  it('colaborador delegado vê só as que registrou; sem delegação, nega antes de ler', async () => {
    const c = preparar();
    jest.mocked(autorizarPendenciaRestricao).mockResolvedValueOnce('colaborador');
    const r = await c.servico.listar(colaborador as never, paciente) as { escopo: string };
    expect(r.escopo).toBe('autoria');
    expect(c.concessoes.exigir).not.toHaveBeenCalled();
    expect(c.restricoes.find).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: colaborador.tenantId, pacienteId: paciente, autorUsuarioId: colaborador.usuarioId } }));
    jest.mocked(autorizarPendenciaRestricao).mockRejectedValueOnce(new ForbiddenException());
    await expect(c.servico.listar(colaborador as never, paciente)).rejects.toBeInstanceOf(ForbiddenException);
    expect(c.restricoes.find).toHaveBeenCalledTimes(1);
  });

  it('paciente, cliente e ids inválidos são recusados; Patient nunca chega à autorização', async () => {
    const c = preparar();
    await expect(c.servico.listar({ ...profissional, papel: 'Patient' } as never, paciente)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(c.servico.listar({ ...profissional, papel: 'Client' } as never, paciente)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(c.servico.listar(profissional as never, '../x')).rejects.toBeInstanceOf(BadRequestException);
    expect(autorizarPendenciaRestricao).not.toHaveBeenCalled();
  });

  it('mais de 200 registros responde 409 sem devolver nada', async () => {
    const c = preparar(Array.from({ length: 201 }, (_, i) => linha(i)));
    await expect(c.servico.listar(profissional as never, paciente)).rejects.toBeInstanceOf(ConflictException);
    expect(c.restricoes.find).toHaveBeenCalledWith(expect.objectContaining({ take: 201 }));
    expect(registrarAuditoriaNaTransacao).not.toHaveBeenCalled();
  });

  it('histórico divergente ou ausente falha fechado (409), sem devolver as demais', async () => {
    const c = preparar([linha(1), linha(2)]);
    c.revisoes.find.mockResolvedValueOnce([{ restricaoId: linha(1).id, numero: 1, evento: 'criacao', conteudoCriptografado: Buffer.from('h') }]);
    await expect(c.servico.listar(profissional as never, paciente)).rejects.toBeInstanceOf(ConflictException);
    const d = preparar([linha(1, { estado: 'inativa' })]);
    await expect(d.servico.listar(profissional as never, paciente)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('consultar avaliação (P3-0a)', () => {
  it('com a concessão devolve situação, revisão e vencimento, sem quem confirmou', async () => {
    const c = preparar();
    const r = await c.servico.consultarAvaliacao(profissional as never, paciente);
    expect(autorizarRestricaoClinica).toHaveBeenCalledWith(c.g, expect.anything(), profissional, paciente);
    expect(exigirHistoricoConsistente).toHaveBeenCalled();
    expect(r).toEqual({ avaliacao: { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', revisao: 3, situacao: 'restricoes_registradas',
      confirmadoEm: '2026-09-12T10:00:00.000Z', venceEm: '2027-03-11T10:00:00.000Z' } });
    expect(inspect(r)).not.toContain('NAO_RETORNAR');
  });

  it('sem avaliação criada devolve null (não cria) e sem a concessão nega', async () => {
    const c = preparar();
    c.avaliacoes.findOne.mockResolvedValueOnce(null);
    expect(await c.servico.consultarAvaliacao(profissional as never, paciente)).toEqual({ avaliacao: null });
    jest.mocked(autorizarRestricaoClinica).mockRejectedValueOnce(new ForbiddenException());
    await expect(c.servico.consultarAvaliacao(profissional as never, paciente)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
