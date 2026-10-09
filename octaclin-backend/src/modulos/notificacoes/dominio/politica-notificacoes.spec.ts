import {
  MODO_ENTREGA_PADRAO,
  TIPOS_NOTIFICACAO_CONFIGURAVEIS,
  obterModoEntregaNotificacao,
  tipoNotificacaoConfiguravel
} from './politica-notificacoes';
import { proximoResumoNotificacao, validarTimezoneNotificacao } from './calendario-resumo';
import { criarSnapshotEntregaNotificacao } from './snapshot-entrega-notificacao';
import type { TipoNotificacao } from './tipo-notificacao';

describe('politica de entrega das notificacoes internas', () => {
  it.each<TipoNotificacao>([
    'mensagem_recebida',
    'solicitacao_agendamento',
    'falha_envio'
  ])('mantem %s imediato mesmo se receber preferencia invalida', (tipo) => {
    expect(tipoNotificacaoConfiguravel(tipo)).toBe(false);
    expect(obterModoEntregaNotificacao(tipo, 'silenciado')).toBe('imediato');
  });

  it.each<TipoNotificacao>([
    'formulario_respondido',
    'tarefa_concluida',
    'automacao_executada'
  ])('usa imediato por padrao para %s', (tipo) => {
    expect(tipoNotificacaoConfiguravel(tipo)).toBe(true);
    expect(obterModoEntregaNotificacao(tipo)).toBe(MODO_ENTREGA_PADRAO);
  });

  it('expõe exatamente as tres classes opcionais aprovadas', () => {
    expect(TIPOS_NOTIFICACAO_CONFIGURAVEIS).toEqual([
      'formulario_respondido',
      'tarefa_concluida',
      'automacao_executada'
    ]);
  });

  it.each(['imediato', 'diario', 'semanal', 'silenciado'] as const)(
    'aceita o modo %s para uma classe configuravel',
    (modo) => {
      expect(obterModoEntregaNotificacao('tarefa_concluida', modo)).toBe(modo);
    }
  );

  it('descarta modo desconhecido persistido e volta ao padrao imediato', () => {
    expect(obterModoEntregaNotificacao('tarefa_concluida', 'legado-invalido' as never)).toBe('imediato');
  });
});

describe('calendario do resumo interno', () => {
  it('agenda diario as 09:00 locais e avanca do instante exato', () => {
    expect(proximoResumoNotificacao(
      'diario', new Date('2026-10-09T11:59:00.000Z'), 'America/Sao_Paulo'
    ).toISOString()).toBe('2026-10-09T12:00:00.000Z');
    expect(proximoResumoNotificacao(
      'diario', new Date('2026-10-09T12:00:00.000Z'), 'America/Sao_Paulo'
    ).toISOString()).toBe('2026-10-10T12:00:00.000Z');
  });

  it('agenda semanal para segunda-feira as 09:00 locais', () => {
    expect(proximoResumoNotificacao(
      'semanal', new Date('2026-10-09T12:00:00.000Z'), 'America/Sao_Paulo'
    ).toISOString()).toBe('2026-10-12T12:00:00.000Z');
  });

  it('calcula 09:00 no fuso e trata mudanca sazonal sem deslocar o horario civil', () => {
    expect(proximoResumoNotificacao(
      'diario', new Date('2026-03-08T12:00:00.000Z'), 'America/New_York'
    ).toISOString()).toBe('2026-03-08T13:00:00.000Z');
    expect(proximoResumoNotificacao(
      'diario', new Date('2026-03-08T13:00:00.000Z'), 'America/New_York'
    ).toISOString()).toBe('2026-03-09T13:00:00.000Z');
  });

  it('valida fuso IANA sem truncar ou substituir o valor incorreto', () => {
    expect(validarTimezoneNotificacao(' America/Sao_Paulo ')).toBe('America/Sao_Paulo');
    expect(() => validarTimezoneNotificacao('Mars/Olympus')).toThrow();
    expect(() => validarTimezoneNotificacao('A'.repeat(81))).toThrow();
    expect(() => validarTimezoneNotificacao('   ')).toThrow();
  });

  it('nao permite agendar resumo em modo imediato ou silenciado', () => {
    expect(() => proximoResumoNotificacao(
      'imediato', new Date(), 'UTC'
    )).toThrow();
    expect(() => proximoResumoNotificacao(
      'silenciado', new Date(), 'UTC'
    )).toThrow();
  });
});

describe('snapshot da preferencia na transacao do evento', () => {
  it('congela modo, fuso, vencimento e opt-in para evento diario', () => {
    const eventoEm = new Date('2026-10-09T12:30:00.000Z');
    expect(criarSnapshotEntregaNotificacao('tarefa_concluida', {
      modoTarefaConcluida: 'diario',
      timezone: 'America/Sao_Paulo',
      emailResumo: true
    }, eventoEm)).toEqual({
      modoEntrega: 'diario',
      timezoneResumo: 'America/Sao_Paulo',
      resumoPrevistoEm: new Date('2026-10-10T12:00:00.000Z'),
      emailResumo: true,
      emailCanceladoEm: null
    });
  });

  it('armazena modo silenciado sem entrar em digest ou e-mail', () => {
    expect(criarSnapshotEntregaNotificacao('automacao_executada', {
      modoAutomacaoExecutada: 'silenciado',
      timezone: 'UTC',
      emailResumo: true
    }, new Date('2026-10-09T12:30:00.000Z'))).toEqual({
      modoEntrega: 'silenciado',
      timezoneResumo: null,
      resumoPrevistoEm: null,
      emailResumo: false,
      emailCanceladoEm: null
    });
  });

  it('preserva modo imediato seguro quando dados legados de fuso sao invalidos', () => {
    expect(criarSnapshotEntregaNotificacao('tarefa_concluida', {
      modoTarefaConcluida: 'diario',
      timezone: 'Mars/Olympus',
      emailResumo: true
    }, new Date('2026-10-09T12:30:00.000Z'))).toMatchObject({
      modoEntrega: 'imediato',
      timezoneResumo: null,
      resumoPrevistoEm: null,
      emailResumo: false
    });
  });

  it('nunca permite preferencia sobre tipo obrigatorio', () => {
    expect(criarSnapshotEntregaNotificacao('falha_envio', {
      modoTarefaConcluida: 'semanal', timezone: 'UTC', emailResumo: true
    }, new Date('2026-10-09T12:30:00.000Z'))).toMatchObject({
      modoEntrega: 'imediato', emailResumo: false, resumoPrevistoEm: null
    });
  });
});
