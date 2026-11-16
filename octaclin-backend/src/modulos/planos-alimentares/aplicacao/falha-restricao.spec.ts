import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { falharRestricao } from './falha-restricao';

/** Revisão R4 da P2a: corridas em chaves idempotentes viram 409, sem eco do erro do banco. */
const erroBanco = (constraint: string) => new QueryFailedError('insert CANARIO_QUERY', ['CANARIO_PARAMETRO'],
  Object.assign(new Error('CANARIO_ERRO'), { code: '23505', constraint }));
const capturar = (f: () => never): unknown => { try { f(); } catch (e) { return e; } return undefined; };

describe('falharRestricao', () => {
  it('corrida na chave idempotente da reconfirmação vira conflito, não erro interno', () => {
    const erro = capturar(() => falharRestricao(erroBanco('ux_reconfirmacoes_idempotencia')));
    expect(erro).toBeInstanceOf(ConflictException);
    expect(JSON.stringify((erro as ConflictException).getResponse())).not.toMatch(/CANARIO_/);
  });
  it('chave de criação só vira conflito quando o chamador declara criação', () => {
    expect(capturar(() => falharRestricao(erroBanco('ux_restricoes_pacientes_criacao'), true))).toBeInstanceOf(ConflictException);
    expect(capturar(() => falharRestricao(erroBanco('ux_restricoes_pacientes_criacao')))).toBeInstanceOf(InternalServerErrorException);
  });
  it('outra violação de unicidade continua erro interno genérico', () => {
    const erro = capturar(() => falharRestricao(erroBanco('qualquer_outra')));
    expect(erro).toBeInstanceOf(InternalServerErrorException);
    expect(JSON.stringify((erro as InternalServerErrorException).getResponse())).not.toMatch(/CANARIO_/);
  });
});
