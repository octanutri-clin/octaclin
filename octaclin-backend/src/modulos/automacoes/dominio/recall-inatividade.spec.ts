import {
  DIAS_SEM_CONSULTA_PADRAO,
  INTERVALO_MINIMO_DIAS_PADRAO,
  LIMITE_POR_EXECUCAO_PADRAO,
  PacienteParaRecall,
  ehGatilhoInatividade,
  normalizarConfiguracaoRecall,
  selecionarCandidatosRecall
} from './recall-inatividade';

const AGORA = new Date('2026-08-03T12:00:00.000Z');

function diasAtras(dias: number): Date {
  return new Date(AGORA.getTime() - dias * 24 * 60 * 60 * 1000);
}

function paciente(sobrescritas: Partial<PacienteParaRecall> = {}): PacienteParaRecall {
  return {
    pacienteId: 'paciente-1',
    statusAdesao: 'ativo',
    ultimaConsultaConcluidaEm: diasAtras(90),
    ultimoRecallEm: null,
    aceitaComunicacao: true,
    possuiContato: true,
    ...sobrescritas
  };
}

const configuracaoPadrao = normalizarConfiguracaoRecall({});

describe('normalizarConfiguracaoRecall', () => {
  it('deve aplicar padroes quando o gatilho nao trouxer numeros', () => {
    expect(normalizarConfiguracaoRecall({})).toEqual({
      diasSemConsulta: DIAS_SEM_CONSULTA_PADRAO,
      statusAdesao: [],
      intervaloMinimoDias: INTERVALO_MINIMO_DIAS_PADRAO,
      limitePorExecucao: LIMITE_POR_EXECUCAO_PADRAO
    });
  });

  it('deve prender valores fora da faixa em vez de aceitar disparo em massa', () => {
    const configuracao = normalizarConfiguracaoRecall({
      diasSemConsulta: 1,
      intervaloMinimoDias: 0,
      limitePorExecucao: 5000
    });

    expect(configuracao.diasSemConsulta).toBe(7);
    expect(configuracao.intervaloMinimoDias).toBe(1);
    expect(configuracao.limitePorExecucao).toBe(200);
  });

  it('deve ignorar entradas invalidas na lista de status de adesao', () => {
    expect(normalizarConfiguracaoRecall({ statusAdesao: ['ativo', '', 42, ' risco '] }).statusAdesao).toEqual([
      'ativo',
      'risco'
    ]);
  });
});

describe('ehGatilhoInatividade', () => {
  it('deve reconhecer apenas o gatilho de inatividade', () => {
    expect(ehGatilhoInatividade({ tipo: 'paciente.inativo' })).toBe(true);
    expect(ehGatilhoInatividade({ tipo: 'checkin.atrasado' })).toBe(false);
    expect(ehGatilhoInatividade(undefined)).toBe(false);
  });
});

describe('selecionarCandidatosRecall', () => {
  it('deve incluir paciente sem consulta concluida ha mais dias que o configurado', () => {
    const resultado = selecionarCandidatosRecall([paciente()], configuracaoPadrao, AGORA);

    expect(resultado.candidatos).toEqual([
      { pacienteId: 'paciente-1', diasSemConsulta: 90, ultimaConsultaConcluidaEm: diasAtras(90) }
    ]);
    expect(resultado.excluidos).toEqual([]);
  });

  it('deve excluir paciente com opt-out mesmo que esteja inativo ha muito tempo', () => {
    const resultado = selecionarCandidatosRecall(
      [paciente({ aceitaComunicacao: false, ultimaConsultaConcluidaEm: diasAtras(400) })],
      configuracaoPadrao,
      AGORA
    );

    expect(resultado.candidatos).toEqual([]);
    expect(resultado.excluidos).toEqual([{ pacienteId: 'paciente-1', motivo: 'opt_out' }]);
  });

  it('deve excluir paciente sem contato cadastrado', () => {
    const resultado = selecionarCandidatosRecall([paciente({ possuiContato: false })], configuracaoPadrao, AGORA);

    expect(resultado.excluidos).toEqual([{ pacienteId: 'paciente-1', motivo: 'sem_contato' }]);
  });

  it('deve distinguir contato ilegivel de contato ausente', () => {
    const resultado = selecionarCandidatosRecall(
      [paciente({ possuiContato: false, contatoIlegivel: true })],
      configuracaoPadrao,
      AGORA
    );

    expect(resultado.excluidos).toEqual([{ pacienteId: 'paciente-1', motivo: 'contato_ilegivel' }]);
  });

  it('deve excluir paciente com consulta recente', () => {
    const resultado = selecionarCandidatosRecall(
      [paciente({ ultimaConsultaConcluidaEm: diasAtras(10) })],
      configuracaoPadrao,
      AGORA
    );

    expect(resultado.excluidos).toEqual([{ pacienteId: 'paciente-1', motivo: 'consulta_recente' }]);
  });

  it('deve respeitar o teto de frequencia e nao recontatar quem ja recebeu recall recente', () => {
    const resultado = selecionarCandidatosRecall(
      [paciente({ ultimoRecallEm: diasAtras(5) })],
      configuracaoPadrao,
      AGORA
    );

    expect(resultado.candidatos).toEqual([]);
    expect(resultado.excluidos).toEqual([{ pacienteId: 'paciente-1', motivo: 'recall_recente' }]);
  });

  it('deve voltar a aceitar o paciente depois do intervalo minimo', () => {
    const resultado = selecionarCandidatosRecall(
      [paciente({ ultimoRecallEm: diasAtras(INTERVALO_MINIMO_DIAS_PADRAO) })],
      configuracaoPadrao,
      AGORA
    );

    expect(resultado.candidatos).toHaveLength(1);
  });

  it('deve filtrar por status de adesao quando o gatilho pedir', () => {
    const configuracao = normalizarConfiguracaoRecall({ statusAdesao: ['risco'] });
    const resultado = selecionarCandidatosRecall(
      [paciente({ pacienteId: 'no-escopo', statusAdesao: 'risco' }), paciente({ pacienteId: 'fora', statusAdesao: 'alta' })],
      configuracao,
      AGORA
    );

    expect(resultado.candidatos.map((candidato) => candidato.pacienteId)).toEqual(['no-escopo']);
    expect(resultado.excluidos).toEqual([{ pacienteId: 'fora', motivo: 'status_adesao_fora_do_filtro' }]);
  });

  it('deve priorizar quem sumiu ha mais tempo ao aplicar o limite por execucao', () => {
    const configuracao = normalizarConfiguracaoRecall({ limitePorExecucao: 2 });
    const resultado = selecionarCandidatosRecall(
      [
        paciente({ pacienteId: 'recente', ultimaConsultaConcluidaEm: diasAtras(70) }),
        paciente({ pacienteId: 'nunca-atendido', ultimaConsultaConcluidaEm: null }),
        paciente({ pacienteId: 'antigo', ultimaConsultaConcluidaEm: diasAtras(300) })
      ],
      configuracao,
      AGORA
    );

    expect(resultado.candidatos.map((candidato) => candidato.pacienteId)).toEqual(['antigo', 'recente']);
    expect(resultado.excluidos).toEqual([{ pacienteId: 'nunca-atendido', motivo: 'limite_por_execucao' }]);
  });

  it('deve tratar paciente sem nenhuma consulta concluida como candidato de menor prioridade', () => {
    const resultado = selecionarCandidatosRecall(
      [paciente({ pacienteId: 'nunca-atendido', ultimaConsultaConcluidaEm: null })],
      configuracaoPadrao,
      AGORA
    );

    expect(resultado.candidatos).toEqual([
      { pacienteId: 'nunca-atendido', diasSemConsulta: null, ultimaConsultaConcluidaEm: null }
    ]);
  });
});
