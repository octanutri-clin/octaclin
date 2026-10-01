import { BadRequestException } from '@nestjs/common';
import { ServicoPainelOperacao } from './servico-painel-operacao';

describe('ServicoPainelOperacao', () => {
  const tenantId = 'tenant-a';
  const consultas = [
    { profissional_id: 'prof-a', status: 'concluida', inicio_em: new Date('2026-09-07T12:00:00Z'), fim_em: new Date('2026-09-07T13:00:00Z') },
    { profissional_id: 'prof-a', status: 'falta', inicio_em: new Date('2026-09-07T13:00:00Z'), fim_em: new Date('2026-09-07T14:00:00Z') },
    { profissional_id: 'prof-a', status: 'cancelada', inicio_em: new Date('2026-09-07T14:00:00Z'), fim_em: new Date('2026-09-07T15:00:00Z') }
  ];
  const query = jest.fn(async (sql: string, parametros: unknown[]) => {
    if (sql.includes('/* fase301-periodo */')) expect(parametros).toEqual(['2026-09-01', '2026-10-01', 'America/Sao_Paulo']);
    else {
      expect(parametros[0]).toBe(tenantId);
      expect(sql).toContain('tenant_id = $1');
    }
    if (sql.includes('/* pb26-pacientes */')) {
      expect(sql).toContain('prioridades_acompanhamento_paciente');
      expect(sql).toContain('paciente.criado_em');
      expect(sql).toContain("historico.tipo_evento = 'calculo'");
      expect(sql).not.toContain('score_risco');
      return [{ novos: '2', ativos: '5', em_risco: '1' }];
    }
    if (sql.includes('/* fase301-periodo */')) return [{ inicio_em: new Date('2026-09-01T03:00:00Z'), fim_em: new Date('2026-10-01T03:00:00Z') }];
    if (sql.includes('/* pb26-consultas */')) return consultas;
    if (sql.includes('/* pb26-expedientes */')) return [{ profissional_id: 'prof-a', inicio_em: new Date('2026-09-07T12:00:00Z'), fim_em: new Date('2026-09-07T14:00:00Z') }];
    if (sql.includes('/* pb26-carga */')) return [{ profissional_responsavel_id: 'prof-a', total: '5' }];
    throw new Error('Consulta nao prevista');
  });
  const gerenciador = {
    query,
    getRepository: jest.fn(() => ({
      find: jest.fn(async () => [{ id: 'prof-a', nomeCriptografado: Buffer.from('nome') }]),
      findOne: jest.fn(async () => ({ valor: { timezone: 'America/Sao_Paulo' } }))
    }))
  };
  const executorTenant = { executar: jest.fn(async (_tenantId: string, operacao: (manager: typeof gerenciador) => Promise<unknown>) => operacao(gerenciador)) };
  const criptografia = { descriptografar: jest.fn(() => 'Profissional A') };
  const servico = new ServicoPainelOperacao(executorTenant as never, criptografia as never);

  beforeEach(() => jest.clearAllMocks());

  it('calcula indicadores do mes no tenant autenticado, exclui cancelamentos e inclui faltas na ocupacao', async () => {
    const resultado = await servico.obter(tenantId, '2026-09');
    expect(executorTenant.executar).toHaveBeenCalledWith(tenantId, expect.any(Function));
    expect(resultado.pacientes).toEqual({ novos: 2, ativos: 5, emRisco: 1 });
    expect(resultado.profissionais[0]).toEqual(expect.objectContaining({
      nome: 'Profissional A', concluidas: 1, faltas: 1, taxaNoShow: 50, consultasForaExpediente: 0
    }));
    expect(resultado.profissionais[0]).toEqual(expect.objectContaining({ consultas: 2, canceladas: 1, taxaConclusao: 50, arquivado: false }));
    expect(resultado.profissionais[0].ocupacaoPercentual).not.toBeNull();
  });

  it('rejeita mes invalido antes de consultar o banco', async () => {
    await expect(servico.obter(tenantId, '2026-13')).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.obter(tenantId, '0000-01')).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.obter(tenantId, ['2026-09', '2026-08'])).rejects.toBeInstanceOf(BadRequestException);
    expect(executorTenant.executar).not.toHaveBeenCalled();
  });

  it('distingue falta de expediente de zero e conta consulta parcialmente fora', async () => {
    const consulta = { profissional_id: 'prof-a', status: 'agendada', inicio_em: new Date('2026-09-07T12:00:00Z'), fim_em: new Date('2026-09-07T13:00:00Z') };
    const faixa = { profissional_id: 'prof-a', inicio_em: new Date('2026-09-07T12:30:00Z'), fim_em: new Date('2026-09-07T13:30:00Z') };
    const gerenciadorLocal = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('/* fase301-periodo */')) return [{ inicio_em: new Date('2026-09-01T03:00:00Z'), fim_em: new Date('2026-10-01T03:00:00Z') }];
        if (sql.includes('/* pb26-pacientes */')) return [{ novos: '0', ativos: '0', em_risco: '0' }];
        if (sql.includes('/* pb26-consultas */')) return [consulta];
        if (sql.includes('/* pb26-expedientes */')) return [faixa];
        return [];
      }),
      getRepository: jest.fn(() => ({ findOne: jest.fn(async () => null), find: jest.fn(async () => [{ id: 'prof-a', nomeCriptografado: Buffer.from('nome') }]) }))
    };
    const painel = new ServicoPainelOperacao({ executar: async (_id: string, operacao: (manager: typeof gerenciadorLocal) => Promise<unknown>) => operacao(gerenciadorLocal) } as never, criptografia as never);
    const comExpediente = await painel.obter(tenantId, '2026-09');
    expect(comExpediente.profissionais[0]).toEqual(expect.objectContaining({ ocupacaoPercentual: 50, consultasForaExpediente: 1, taxaNoShow: null }));
    gerenciadorLocal.query.mockImplementation(async (sql: string) => {
      if (sql.includes('/* fase301-periodo */')) return [{ inicio_em: new Date('2026-09-01T03:00:00Z'), fim_em: new Date('2026-10-01T03:00:00Z') }];
      if (sql.includes('/* pb26-pacientes */')) return [{ novos: '0', ativos: '0', em_risco: '0' }];
      if (sql.includes('/* pb26-consultas */')) return [consulta];
      return [];
    });
    const semExpediente = await painel.obter(tenantId, '2026-09');
    expect(semExpediente.profissionais[0]).toEqual(expect.objectContaining({ ocupacaoPercentual: null, consultasForaExpediente: null }));
  });

  it('une consultas e expedientes sobrepostos sem ultrapassar 100% e mantém sem dados sem desfecho', async () => {
    const consultasSobrepostas = [
      { profissional_id: 'prof-a', status: 'agendada', inicio_em: new Date('2026-09-07T12:00:00Z'), fim_em: new Date('2026-09-07T13:30:00Z') },
      { profissional_id: 'prof-a', status: 'reagendada', inicio_em: new Date('2026-09-07T12:30:00Z'), fim_em: new Date('2026-09-07T14:00:00Z') }
    ];
    const original = query.getMockImplementation();
    query.mockImplementation(async (sql: string, parametros: unknown[]) => {
      if (!sql.includes('/* fase301-periodo */')) expect(parametros[0]).toBe(tenantId);
      if (sql.includes('/* fase301-periodo */')) return [{ inicio_em: new Date('2026-09-01T03:00:00Z'), fim_em: new Date('2026-10-01T03:00:00Z') }];
      if (sql.includes('/* pb26-consultas */')) return consultasSobrepostas;
      if (sql.includes('/* pb26-expedientes */')) return [
        { profissional_id: 'prof-a', inicio_em: new Date('2026-09-07T12:00:00Z'), fim_em: new Date('2026-09-07T13:00:00Z') },
        { profissional_id: 'prof-a', inicio_em: new Date('2026-09-07T12:30:00Z'), fim_em: new Date('2026-09-07T14:00:00Z') }
      ];
      if (sql.includes('/* pb26-carga */')) return [];
      return [{ novos: '0', ativos: '0', em_risco: '0' }];
    });
    const resultado = await servico.obter(tenantId, '2026-09');
    expect(resultado.profissionais[0]).toEqual(expect.objectContaining({
      consultas: 2, taxaConclusao: null, minutosDisponiveis: 120, minutosOcupados: 120,
      ocupacaoPercentual: 100, consultasForaExpediente: 0
    }));
    query.mockImplementation(original!);
  });

  it('inclui ocupação do começo do mês, conta desfechos só pelo início e preserva arquivado com atividade', async () => {
    const consultaAnterior = { profissional_id: 'prof-a', status: 'concluida', inicio_em: new Date('2026-09-01T02:30:00Z'), fim_em: new Date('2026-09-01T04:00:00Z') };
    const consultaAtual = { profissional_id: 'prof-a', status: 'concluida', inicio_em: new Date('2026-09-01T12:00:00Z'), fim_em: new Date('2026-09-01T13:00:00Z') };
    query.mockImplementation(async (sql: string, parametros: unknown[]) => {
      if (!sql.includes('/* fase301-periodo */')) expect(parametros[0]).toBe(tenantId);
      if (sql.includes('/* fase301-periodo */')) return [{ inicio_em: new Date('2026-09-01T03:00:00Z'), fim_em: new Date('2026-10-01T03:00:00Z') }];
      if (sql.includes('/* pb26-consultas */')) {
        expect(sql).toContain('fim_em >');
        return [consultaAnterior, consultaAtual];
      }
      if (sql.includes('/* pb26-expedientes */')) return [
        { profissional_id: 'prof-a', inicio_em: new Date('2026-09-01T03:00:00Z'), fim_em: new Date('2026-09-01T03:30:00Z') }
      ];
      if (sql.includes('/* pb26-carga */')) return [];
      return [{ novos: '0', ativos: '0', em_risco: '0' }];
    });
    const buscarProfissionais = jest.fn(async () => [
      { id: 'prof-a', nomeCriptografado: Buffer.from('nome'), arquivadoEm: new Date('2026-09-10T00:00:00Z') },
      { id: 'prof-b', nomeCriptografado: Buffer.from('nome'), arquivadoEm: new Date('2026-09-10T00:00:00Z') }
    ]);
    gerenciador.getRepository.mockImplementation(() => ({
      findOne: jest.fn(async () => ({ valor: { timezone: 'America/Sao_Paulo' } })),
      find: buscarProfissionais
    }));
    const resultado = await servico.obter(tenantId, '2026-09');
    expect(buscarProfissionais).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId }, select: { id: true, nomeCriptografado: true, arquivadoEm: true }
    }));
    expect(resultado.profissionais).toHaveLength(1);
    expect(resultado.profissionais[0]).toEqual(expect.objectContaining({
      arquivado: true, consultas: 1, concluidas: 1, minutosDisponiveis: 30,
      minutosOcupados: 30, ocupacaoPercentual: 100, consultasForaExpediente: 1
    }));
  });
});
