import { dataCivilHoje, exigirAdulto, exigirAutorProfissional, exigirGestorPiloto, exigirNomeExibicao, prazoRetencao } from './piloto-gamificacao';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
const usuario = (papel: UsuarioAutenticado['papel']): UsuarioAutenticado => ({ tenantId: 'sintetico', usuarioId: 'sintetico', papel, emailHash: '', permissoes: [] });
describe('contratos do piloto317', () => {
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
