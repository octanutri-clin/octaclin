import {
  ConfiguracaoCheckinAtrasado,
  ehGatilhoCheckinAtrasado,
  normalizarConfiguracaoCheckinAtrasado,
  selecionarCandidatosCheckinAtrasado
} from './checkin-atrasado';

const AGORA = new Date('2026-09-20T09:00:00.000Z');
const DIA_MS = 24 * 60 * 60 * 1000;

function diasAtras(dias: number): Date {
  return new Date(AGORA.getTime() - dias * DIA_MS);
}

const configuracaoPadrao: ConfiguracaoCheckinAtrasado = {
  diasSemCheckin: 7,
  intervaloMinimoDias: 7,
  limitePorExecucao: 100
};

describe('normalizarConfiguracaoCheckinAtrasado', () => {
  it('aplica os defaults de produto quando o gatilho nao informa parametros', () => {
    expect(normalizarConfiguracaoCheckinAtrasado({ tipo: 'checkin.atrasado' })).toEqual({
      diasSemCheckin: 7,
      intervaloMinimoDias: 7,
      limitePorExecucao: 100
    });
  });

  it('preserva valores explicitos dentro da faixa', () => {
    expect(
      normalizarConfiguracaoCheckinAtrasado({ diasSemCheckin: 14, intervaloMinimoDias: 30, limitePorExecucao: 50 })
    ).toEqual({ diasSemCheckin: 14, intervaloMinimoDias: 30, limitePorExecucao: 50 });
  });

  it('nunca lanca e sempre cai dentro da faixa, mesmo com entrada invalida ou fora do contrato antigo', () => {
    expect(normalizarConfiguracaoCheckinAtrasado(undefined)).toEqual(configuracaoPadrao);
    expect(normalizarConfiguracaoCheckinAtrasado({ diasSemCheckin: -5, limitePorExecucao: 9999 })).toEqual({
      diasSemCheckin: 1,
      intervaloMinimoDias: 7,
      limitePorExecucao: 200
    });
  });
});

describe('ehGatilhoCheckinAtrasado', () => {
  it('identifica o tipo correto e rejeita os demais', () => {
    expect(ehGatilhoCheckinAtrasado({ tipo: 'checkin.atrasado' })).toBe(true);
    expect(ehGatilhoCheckinAtrasado({ tipo: 'paciente.inativo' })).toBe(false);
    expect(ehGatilhoCheckinAtrasado(undefined)).toBe(false);
  });
});

describe('selecionarCandidatosCheckinAtrasado', () => {
  it('inclui paciente vencido (dias sem checkin >= limiar)', () => {
    const { candidatos, excluidos } = selecionarCandidatosCheckinAtrasado(
      [{ pacienteId: 'paciente-1', ultimoCheckinEm: diasAtras(7), criadoEm: diasAtras(400), ultimoDisparoEm: null }],
      configuracaoPadrao,
      AGORA
    );
    expect(candidatos).toEqual([{ pacienteId: 'paciente-1', diasSemCheckin: 7, referenciaEm: diasAtras(7) }]);
    expect(excluidos).toEqual([]);
  });

  it('exclui paciente dentro do prazo', () => {
    const { candidatos, excluidos } = selecionarCandidatosCheckinAtrasado(
      [{ pacienteId: 'paciente-1', ultimoCheckinEm: diasAtras(3), criadoEm: diasAtras(400), ultimoDisparoEm: null }],
      configuracaoPadrao,
      AGORA
    );
    expect(candidatos).toEqual([]);
    expect(excluidos).toEqual([{ pacienteId: 'paciente-1', motivo: 'dentro_do_prazo' }]);
  });

  it('usa criadoEm como referencia quando o paciente nunca fez check-in', () => {
    const { candidatos } = selecionarCandidatosCheckinAtrasado(
      [{ pacienteId: 'paciente-1', ultimoCheckinEm: null, criadoEm: diasAtras(10), ultimoDisparoEm: null }],
      configuracaoPadrao,
      AGORA
    );
    expect(candidatos).toEqual([{ pacienteId: 'paciente-1', diasSemCheckin: 10, referenciaEm: diasAtras(10) }]);
  });

  it('exclui por intervalo minimo quando o ultimo disparo desta regra foi recente', () => {
    const { candidatos, excluidos } = selecionarCandidatosCheckinAtrasado(
      [
        {
          pacienteId: 'paciente-1',
          ultimoCheckinEm: diasAtras(20),
          criadoEm: diasAtras(400),
          ultimoDisparoEm: diasAtras(2)
        }
      ],
      configuracaoPadrao,
      AGORA
    );
    expect(candidatos).toEqual([]);
    expect(excluidos).toEqual([{ pacienteId: 'paciente-1', motivo: 'disparo_recente' }]);
  });

  it('volta a incluir quando o intervalo minimo desde o ultimo disparo ja passou', () => {
    const { candidatos } = selecionarCandidatosCheckinAtrasado(
      [
        {
          pacienteId: 'paciente-1',
          ultimoCheckinEm: diasAtras(20),
          criadoEm: diasAtras(400),
          ultimoDisparoEm: diasAtras(8)
        }
      ],
      configuracaoPadrao,
      AGORA
    );
    expect(candidatos).toHaveLength(1);
  });

  it('ordena do mais atrasado para o menos atrasado e aplica o limite deterministicamente', () => {
    const { candidatos, excluidos } = selecionarCandidatosCheckinAtrasado(
      [
        { pacienteId: 'paciente-pouco-atrasado', ultimoCheckinEm: diasAtras(8), criadoEm: diasAtras(400), ultimoDisparoEm: null },
        { pacienteId: 'paciente-muito-atrasado', ultimoCheckinEm: diasAtras(30), criadoEm: diasAtras(400), ultimoDisparoEm: null },
        { pacienteId: 'paciente-medio-atrasado', ultimoCheckinEm: diasAtras(15), criadoEm: diasAtras(400), ultimoDisparoEm: null }
      ],
      { ...configuracaoPadrao, limitePorExecucao: 2 },
      AGORA
    );
    expect(candidatos.map((candidato) => candidato.pacienteId)).toEqual([
      'paciente-muito-atrasado',
      'paciente-medio-atrasado'
    ]);
    expect(excluidos).toEqual([{ pacienteId: 'paciente-pouco-atrasado', motivo: 'limite_por_execucao' }]);
  });
});
