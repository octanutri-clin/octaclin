import {
  linkTeleconsultaDisponivel,
  linkTeleconsultaParaPaciente,
  linkTeleconsultaValido,
  normalizarLinkTeleconsulta,
  normalizarModalidadeConsulta
} from './teleconsulta';

const INICIO = new Date('2026-08-10T14:00:00.000Z');
const FIM = new Date('2026-08-10T15:00:00.000Z');

function consultaOnline(sobrescritas: Partial<Parameters<typeof linkTeleconsultaDisponivel>[0]> = {}) {
  return {
    modalidade: 'online',
    linkTeleconsulta: 'https://meet.google.com/abc-defg-hij',
    inicioEm: INICIO,
    fimEm: FIM,
    status: 'agendada',
    ...sobrescritas
  };
}

describe('teleconsulta', () => {
  it('deve tratar qualquer valor desconhecido de modalidade como presencial', () => {
    expect(normalizarModalidadeConsulta('online')).toBe('online');
    expect(normalizarModalidadeConsulta('presencial')).toBe('presencial');
    expect(normalizarModalidadeConsulta(undefined)).toBe('presencial');
    expect(normalizarModalidadeConsulta('teleconsulta')).toBe('presencial');
  });

  it('deve aceitar apenas https no link da sala', () => {
    expect(linkTeleconsultaValido('https://meet.google.com/abc')).toBe(true);
    expect(linkTeleconsultaValido('http://meet.google.com/abc')).toBe(false);
    expect(linkTeleconsultaValido('javascript:alert(1)')).toBe(false);
    expect(linkTeleconsultaValido('data:text/html,<script>')).toBe(false);
    expect(linkTeleconsultaValido('meet.google.com/abc')).toBe(false);
    expect(linkTeleconsultaValido('')).toBe(false);
  });

  it('deve recusar link acima do limite de tamanho', () => {
    expect(linkTeleconsultaValido(`https://zoom.us/j/${'9'.repeat(500)}`)).toBe(false);
  });

  it('deve normalizar link invalido para undefined em vez de propagar lixo', () => {
    expect(normalizarLinkTeleconsulta('  https://zoom.us/j/1  ')).toBe('https://zoom.us/j/1');
    expect(normalizarLinkTeleconsulta('http://zoom.us/j/1')).toBeUndefined();
    expect(normalizarLinkTeleconsulta(null)).toBeUndefined();
  });

  it('nao deve liberar link de consulta presencial', () => {
    expect(linkTeleconsultaDisponivel(consultaOnline({ modalidade: 'presencial' }), INICIO)).toBe(false);
  });

  it('nao deve liberar link antes da abertura da sala', () => {
    const umaHoraEUmMinutoAntes = new Date(INICIO.getTime() - 61 * 60_000);
    expect(linkTeleconsultaDisponivel(consultaOnline(), umaHoraEUmMinutoAntes)).toBe(false);
  });

  it('deve liberar link na janela de uma hora antes ate trinta minutos depois do fim', () => {
    expect(linkTeleconsultaDisponivel(consultaOnline(), new Date(INICIO.getTime() - 60 * 60_000))).toBe(true);
    expect(linkTeleconsultaDisponivel(consultaOnline(), INICIO)).toBe(true);
    expect(linkTeleconsultaDisponivel(consultaOnline(), new Date(FIM.getTime() + 30 * 60_000))).toBe(true);
  });

  it('deve ocultar link depois do fechamento da sala', () => {
    expect(linkTeleconsultaDisponivel(consultaOnline(), new Date(FIM.getTime() + 31 * 60_000))).toBe(false);
  });

  it('nao deve liberar link de consulta cancelada ou encerrada', () => {
    for (const status of ['cancelada', 'concluida', 'falta']) {
      expect(linkTeleconsultaDisponivel(consultaOnline({ status }), INICIO)).toBe(false);
    }
    expect(linkTeleconsultaDisponivel(consultaOnline({ status: 'reagendada' }), INICIO)).toBe(true);
  });

  it('deve devolver o link apenas dentro da janela', () => {
    expect(linkTeleconsultaParaPaciente(consultaOnline(), INICIO)).toBe('https://meet.google.com/abc-defg-hij');
    expect(linkTeleconsultaParaPaciente(consultaOnline(), new Date(FIM.getTime() + 60 * 60_000))).toBeUndefined();
  });
});
