import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { registrarNotificacao } from '../../notificacoes/aplicacao/registrar-notificacao';
import { AcompanhamentoTarefaOrm } from '../../pacientes/infraestrutura/acompanhamento-tarefa.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import {
  AcaoAutomacaoNaoDisponivel,
  DestinoAcaoAutomacaoInvalido,
  DespachanteAcoesAutomacao
} from './despachante-acoes-automacao';

jest.mock('../../notificacoes/aplicacao/registrar-notificacao', () => ({
  registrarNotificacao: jest.fn()
}));

const registrarNotificacaoMock = jest.mocked(registrarNotificacao);
const usuarioProfissionalId = '66666666-6666-4666-8666-666666666666';

function criarDespachante() {
  const tarefasExistentes = new Set<string>();
  const inserir = jest.fn().mockReturnThis();
  const em = jest.fn().mockReturnThis();
  const valores = jest.fn().mockReturnThis();
  const ignorarConflito = jest.fn().mockReturnThis();
  const executarInsert = jest.fn(async () => {
    tarefasExistentes.add(valores.mock.calls.at(-1)?.[0]?.id as string);
    return { identifiers: [] };
  });
  const queryBuilder = {
    insert: inserir,
    into: em,
    values: valores,
    orIgnore: ignorarConflito,
    execute: executarInsert
  };
  const repositorioTarefas = {
    findOne: jest.fn(async (opcoes: { where: { id: string } }) =>
      tarefasExistentes.has(opcoes.where.id) ? { id: opcoes.where.id } : null
    ),
    createQueryBuilder: jest.fn(() => queryBuilder)
  };
  const repositorioPacientes = { findOne: jest.fn().mockResolvedValue({ id: entrada.pacienteId }) };
  const repositorioProfissionais = {
    findOne: jest.fn().mockResolvedValue({ id: entrada.profissionalId, usuarioId: usuarioProfissionalId })
  };
  const repositorioUsuarios = { findOne: jest.fn().mockResolvedValue({ id: usuarioProfissionalId }) };
  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === AcompanhamentoTarefaOrm) return repositorioTarefas;
      if (entidade === PacienteOrm) return repositorioPacientes;
      if (entidade === ProfissionalOrm) return repositorioProfissionais;
      if (entidade === UsuarioOrm) return repositorioUsuarios;
      throw new Error('Repositorio inesperado.');
    })
  } as unknown as EntityManager;
  const executar = jest.fn(async (_tenantId: string, operacao: (manager: EntityManager) => Promise<unknown>) =>
    operacao(gerenciador)
  );
  const criptografar = jest.fn((valor: string) => Buffer.from(`cifrado:${valor}`, 'utf8'));
  const despachante = new DespachanteAcoesAutomacao(
    { executar } as unknown as ExecutorTenant,
    { criptografar } as unknown as CriptografiaDadosSensiveis
  );
  return {
    despachante,
    executar,
    gerenciador,
    valores,
    ignorarConflito,
    executarInsert,
    criptografar,
    repositorioTarefas,
    repositorioPacientes,
    repositorioProfissionais,
    repositorioUsuarios
  };
}

const entrada = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  execucaoId: '22222222-2222-4222-8222-222222222222',
  regraId: '33333333-3333-4333-8333-333333333333',
  profissionalId: '44444444-4444-4444-8444-444444444444',
  pacienteId: '55555555-5555-4555-8555-555555555555',
  contexto: { observacaoPrivada: 'nao deve ir para o efeito' },
  acao: { tipo: 'notificar_profissional' as const },
  chaveIdempotencia: 'automacao:22222222-2222-4222-8222-222222222222:acao:0'
};

const acaoCriarTarefa = {
  tipo: 'criar_tarefa' as const,
  titulo: 'Revisar acompanhamento',
  prioridade: 'alta' as const,
  prazoDias: 2
};

describe('DespachanteAcoesAutomacao', () => {
  beforeEach(() => {
    registrarNotificacaoMock.mockReset().mockResolvedValue(1);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registra a notificacao em transacao tenant-aware sem copiar o contexto', async () => {
    const { despachante, executar, gerenciador } = criarDespachante();

    await expect(despachante.executar(entrada)).resolves.toEqual({ status: 'executada' });

    expect(executar).toHaveBeenCalledWith(entrada.tenantId, expect.any(Function));
    expect(registrarNotificacaoMock).toHaveBeenCalledWith(gerenciador, entrada.tenantId, {
      tipo: 'automacao_executada',
      recursoTipo: 'execucao_automacao',
      recursoId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      pacienteId: entrada.pacienteId,
      profissionalId: entrada.profissionalId
    });
    expect(JSON.stringify(registrarNotificacaoMock.mock.calls)).not.toContain('observacaoPrivada');
  });

  it('usa a mesma identidade de notificacao em retry e outra identidade para outra acao', async () => {
    const { despachante } = criarDespachante();

    await despachante.executar(entrada);
    await despachante.executar(entrada);
    await despachante.executar({ ...entrada, chaveIdempotencia: `${entrada.chaveIdempotencia.slice(0, -1)}1` });

    const recursos = registrarNotificacaoMock.mock.calls.map(([, , evento]) => evento.recursoId);
    expect(recursos[0]).toBe(recursos[1]);
    expect(recursos[2]).not.toBe(recursos[0]);
  });

  it('cria tarefa cifrada, com prazo e usuario do profissional dentro do tenant', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-19T15:00:00.000Z'));
    const {
      despachante,
      executar,
      valores,
      ignorarConflito,
      criptografar,
      repositorioTarefas,
      repositorioPacientes,
      repositorioProfissionais,
      repositorioUsuarios
    } = criarDespachante();

    await expect(despachante.executar({ ...entrada, acao: acaoCriarTarefa })).resolves.toEqual({
      status: 'executada'
    });

    expect(executar).toHaveBeenCalledWith(entrada.tenantId, expect.any(Function));
    expect(repositorioTarefas.findOne).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
        tenantId: entrada.tenantId
      }
    });
    expect(repositorioPacientes.findOne).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: entrada.pacienteId, tenantId: entrada.tenantId }
    });
    expect(repositorioProfissionais.findOne).toHaveBeenCalledWith({
      select: { id: true, usuarioId: true },
      where: {
        id: entrada.profissionalId,
        tenantId: entrada.tenantId,
        arquivadoEm: expect.objectContaining({ _type: 'isNull' })
      }
    });
    expect(repositorioUsuarios.findOne).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: usuarioProfissionalId, tenantId: entrada.tenantId, ativo: true }
    });
    expect(criptografar).toHaveBeenCalledWith('Revisar acompanhamento');
    expect(valores).toHaveBeenCalledWith({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      tenantId: entrada.tenantId,
      pacienteId: entrada.pacienteId,
      profissionalId: usuarioProfissionalId,
      tituloCriptografado: Buffer.from('cifrado:Revisar acompanhamento', 'utf8'),
      categoria: 'tarefa',
      prioridade: 'alta',
      status: 'pendente',
      vencimentoEm: new Date('2026-09-21T15:00:00.000Z')
    });
    expect(ignorarConflito).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(valores.mock.calls)).not.toContain('observacaoPrivada');
  });

  it('deduplica retry da tarefa pela mesma identidade deterministica', async () => {
    const { despachante, valores, executarInsert, criptografar, repositorioProfissionais } = criarDespachante();
    const entradaTarefa = { ...entrada, acao: acaoCriarTarefa };

    await despachante.executar(entradaTarefa);
    await despachante.executar(entradaTarefa);
    await despachante.executar({
      ...entradaTarefa,
      chaveIdempotencia: `${entradaTarefa.chaveIdempotencia.slice(0, -1)}1`
    });

    expect(executarInsert).toHaveBeenCalledTimes(2);
    expect(valores).toHaveBeenCalledTimes(2);
    expect(criptografar).toHaveBeenCalledTimes(2);
    expect(repositorioProfissionais.findOne).toHaveBeenCalledTimes(2);
    expect(valores.mock.calls[0][0].id).not.toBe(valores.mock.calls[1][0].id);
  });

  it('falha de forma definitiva quando criar_tarefa nao possui paciente', async () => {
    const { despachante, executarInsert } = criarDespachante();

    await expect(
      despachante.executar({ ...entrada, pacienteId: undefined, acao: acaoCriarTarefa })
    ).rejects.toMatchObject({ codigo: 'paciente_obrigatorio', retriavel: false });
    expect(executarInsert).not.toHaveBeenCalled();
  });

  it('falha de forma definitiva quando o profissional nao resolve para usuario ativo do tenant', async () => {
    const { despachante, repositorioProfissionais, executarInsert } = criarDespachante();
    repositorioProfissionais.findOne.mockResolvedValueOnce(null);

    await expect(despachante.executar({ ...entrada, acao: acaoCriarTarefa })).rejects.toBeInstanceOf(
      DestinoAcaoAutomacaoInvalido
    );
    expect(executarInsert).not.toHaveBeenCalled();
  });

  it('mantem enviar_template indisponivel neste incremento', async () => {
    const { despachante, executar } = criarDespachante();

    await expect(despachante.executar({ ...entrada, acao: { tipo: 'enviar_template' } })).rejects.toBeInstanceOf(
      AcaoAutomacaoNaoDisponivel
    );
    expect(executar).not.toHaveBeenCalled();
  });

  it('propaga falha de persistencia para o retry do processador', async () => {
    registrarNotificacaoMock.mockRejectedValueOnce(new Error('banco indisponivel'));
    const { despachante } = criarDespachante();

    await expect(despachante.executar(entrada)).rejects.toThrow('banco indisponivel');
  });
});
