import { dataCivilHoje, exigirAdulto, exigirAutorProfissional, exigirGestorPiloto, exigirNomeExibicao, prazoRetencao } from './piloto-gamificacao';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
const usuario = (papel: UsuarioAutenticado['papel']): UsuarioAutenticado => ({ tenantId: 'sintetico', usuarioId: 'sintetico', papel, emailHash: '', permissoes: [] });
describe('contratos do piloto317', () => {
  it.each([
    ['America/Rio_Branco','2026-10-13T04:59:59Z','2026-10-12',false],
    ['America/Rio_Branco','2026-10-13T05:00:00Z','2026-10-13',true],
    ['America/Sao_Paulo','2026-10-13T02:59:59Z','2026-10-12',false],
    ['America/Sao_Paulo','2026-10-13T03:00:00Z','2026-10-13',true],
    ['Pacific/Kiritimati','2026-10-12T09:59:59Z','2026-10-12',false],
    ['Pacific/Kiritimati','2026-10-12T10:00:00Z','2026-10-13',true],
  ] as const)('revalida maioridade em %s no instante %s', (timezone,instante,esperado,adulto) => {
    const hoje=dataCivilHoje(new Date(instante),timezone);
    expect(hoje).toBe(esperado);
    if(adulto) expect(()=>exigirAdulto('2008-10-13',hoje)).not.toThrow();
    else expect(()=>exigirAdulto('2008-10-13',hoje)).toThrow();
  });
  it('o fuso efetivo da clinica prevalece sobre a configuracao global', () => {
    const anterior=process.env.GOOGLE_CALENDAR_TIMEZONE;
    try {
      process.env.GOOGLE_CALENDAR_TIMEZONE='America/Sao_Paulo';
      const calcular=dataCivilHoje as (agora:Date,timezone:string)=>string;
      expect(calcular(new Date('2026-10-13T03:30:00Z'),'America/Rio_Branco')).toBe('2026-10-12');
    } finally {
      if(anterior===undefined) delete process.env.GOOGLE_CALENDAR_TIMEZONE;
      else process.env.GOOGLE_CALENDAR_TIMEZONE=anterior;
    }
  });
  it.each([undefined, '', 'fuso/invalido'])('usa fallback para configuracao %s', timezone => {
    const anterior=process.env.GOOGLE_CALENDAR_TIMEZONE;
    try {
      if(timezone===undefined) delete process.env.GOOGLE_CALENDAR_TIMEZONE;
      else process.env.GOOGLE_CALENDAR_TIMEZONE=timezone;
      expect(dataCivilHoje(new Date('2026-10-12T01:00:00Z'))).toBe('2026-10-11');
    } finally {
      if(anterior===undefined) delete process.env.GOOGLE_CALENDAR_TIMEZONE;
      else process.env.GOOGLE_CALENDAR_TIMEZONE=anterior;
    }
  });
  it('respeita o aniversario no fuso clinico configurado', () => {
    const anterior = process.env.GOOGLE_CALENDAR_TIMEZONE;
    try {
      process.env.GOOGLE_CALENDAR_TIMEZONE = 'America/Rio_Branco';
      const hoje = dataCivilHoje(new Date('2026-10-13T03:30:00Z'));
      expect(hoje).toBe('2026-10-12');
      expect(() => exigirAdulto('2008-10-13', hoje)).toThrow();
      expect(dataCivilHoje(new Date('2026-10-13T05:00:00Z'))).toBe('2026-10-13');
    } finally {
      if (anterior === undefined) delete process.env.GOOGLE_CALENDAR_TIMEZONE;
      else process.env.GOOGLE_CALENDAR_TIMEZONE = anterior;
    }
  });
  it('usa data civil brasileira e nao o dia UTC', () => expect(dataCivilHoje(new Date('2026-10-12T01:00:00Z'))).toBe('2026-10-11'));
  it('aceita apenas a partir do aniversario18', () => {
    expect(() => exigirAdulto('2008-10-12', '2026-10-12')).not.toThrow();
    expect(() => exigirAdulto('2008-10-13', '2026-10-12')).toThrow();
  });
  it.each([undefined, '', '2008-02-30', '2027-01-01', '2008-1-1'])('recusa DOB ausente/invalida/futura %s', dob => expect(() => exigirAdulto(dob, '2026-10-12')).toThrow());
  it('conserva aniversario29fev ate01mar em ano comum', () => {
    expect(() => exigirAdulto('2008-02-29', '2026-02-28')).toThrow();
    expect(() => exigirAdulto('2008-02-29', '2026-03-01')).not.toThrow();
  });
  it.each(['America/Rio_Branco','America/Sao_Paulo','Pacific/Kiritimati'])('preserva nascimento29fev em %s', timezone => {
    // Civil dates remain explicit; no invalid anniversary is rounded to February28.
    for(const instante of ['2026-02-28T23:59:59Z','2026-03-01T00:00:00Z']) {
      const hoje=dataCivilHoje(new Date(instante),timezone);
      if(hoje<'2026-03-01') expect(()=>exigirAdulto('2008-02-29',hoje)).toThrow();
      else expect(()=>exigirAdulto('2008-02-29',hoje)).not.toThrow();
    }
  });
  it.each(['Client', 'Collaborator', 'SuperAdmin', 'Patient'] as const)('nao concede autoria clinica ao papel %s', role => expect(() => exigirAutorProfissional(usuario(role))).toThrow());
  it('exige permissoes clinicas alem do papel', () => {
    const u = usuario('Professional'); expect(() => exigirAutorProfissional(u)).toThrow();
    u.permissoes = ['gamificacao.gerenciar', 'pacientes.gerenciar']; expect(() => exigirAutorProfissional(u)).not.toThrow();
  });
  it('separa configuracao administrativa de autoria', () => {
    const u = usuario('Client'); u.permissoes = ['cliente.configuracoes.gerenciar']; expect(() => exigirGestorPiloto(u)).not.toThrow();
    expect(() => exigirGestorPiloto(usuario('Professional'))).toThrow();
  });
  it('nao aceita nome vazio ou contato como nome de exibicao', () => {
    for (const name of ['', 'a@octaclin.test', 'https://octaclin.test', 'x'.repeat(81)]) expect(() => exigirNomeExibicao(name)).toThrow();
    expect(exigirNomeExibicao('  Pessoa Sintetica  ')).toBe('Pessoa Sintetica');
  });
  it('fixa90dias sem depender de horario de verao', () => expect(prazoRetencao(new Date('2026-10-12T12:00:00Z')).toISOString()).toBe('2027-01-10T12:00:00.000Z'));
});
