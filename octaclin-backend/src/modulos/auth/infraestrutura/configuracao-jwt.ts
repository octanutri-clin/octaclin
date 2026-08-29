import { randomBytes } from 'crypto';
import type { JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';
import { ambienteExigeFalhaFechada } from '../../../infraestrutura/seguranca/ambiente-execucao';
import { TIPO_TOKEN_ACESSO, type TipoToken } from '../dominio/claims-token';

export const ALGORITMO_JWT = 'HS256' as const;

/** Formato de duracao aceito pelo `jsonwebtoken` (ex.: '15m', '30d'). */
type DuracaoJwt = NonNullable<JwtSignOptions['expiresIn']>;
export const TAMANHO_MINIMO_SEGREDO_BYTES = 32;

const EMISSOR_PADRAO = 'octaclin';
const AUDIENCIA_PADRAO = 'octaclin-api';

const EXPIRACAO_ACESSO_PADRAO: DuracaoJwt = '15m';
const EXPIRACAO_RENOVACAO_PADRAO: DuracaoJwt = '30d';

const DURACAO_JWT_VALIDA = /^(\d+)\s*(milliseconds?|seconds?|minutes?|hours?|days?|weeks?|years?|ms|s|m|h|d|w|y)$/i;

const SEGUNDOS_POR_UNIDADE: Record<string, number> = {
  ms: 0.001,
  millisecond: 0.001,
  milliseconds: 0.001,
  s: 1,
  second: 1,
  seconds: 1,
  m: 60,
  minute: 60,
  minutes: 60,
  h: 3600,
  hour: 3600,
  hours: 3600,
  d: 86400,
  day: 86400,
  days: 86400,
  w: 604800,
  week: 604800,
  weeks: 604800,
  y: 31536000,
  year: 31536000,
  years: 31536000
};

/**
 * Segredo aleatorio por processo, usado somente onde a falha fechada nao se
 * aplica (local e teste). Nao existe literal publico no repositorio: um valor
 * versionado seria material conhecido, e era exatamente esse o problema dos
 * antigos fallbacks `dev-*-secret`.
 */
const segredosEfemeros = new Map<TipoToken, string>();

function segredoEfemero(finalidade: TipoToken): string {
  const existente = segredosEfemeros.get(finalidade);
  if (existente) return existente;

  const gerado = randomBytes(32).toString('hex');
  segredosEfemeros.set(finalidade, gerado);
  return gerado;
}

function resolverSegredo(variavel: string, finalidade: TipoToken): string {
  const valor = process.env[variavel]?.trim();

  if (!valor) {
    if (ambienteExigeFalhaFechada()) {
      throw new Error(`${variavel} e obrigatorio em staging e producao.`);
    }
    return segredoEfemero(finalidade);
  }

  if (ambienteExigeFalhaFechada() && Buffer.byteLength(valor, 'utf8') < TAMANHO_MINIMO_SEGREDO_BYTES) {
    throw new Error(`${variavel} precisa ter pelo menos ${TAMANHO_MINIMO_SEGREDO_BYTES} bytes em staging e producao.`);
  }

  return valor;
}

export function obterSegredoAcesso(): string {
  return resolverSegredo('JWT_SEGREDO', 'acesso');
}

/**
 * Nao ha heranca de `JWT_SEGREDO`: access e refresh precisam de material
 * separado para que um refresh token nunca seja verificavel pela chave do
 * access token, e vice-versa.
 */
export function obterSegredoRenovacao(): string {
  return resolverSegredo('JWT_REFRESH_SEGREDO', 'renovacao');
}

export function validarSegredosJwt(): void {
  const acesso = obterSegredoAcesso();
  const renovacao = obterSegredoRenovacao();

  if (acesso === renovacao) {
    throw new Error('JWT_REFRESH_SEGREDO deve ser diferente de JWT_SEGREDO.');
  }
}

export function obterEmissorJwt(): string {
  return process.env.JWT_EMISSOR?.trim() || EMISSOR_PADRAO;
}

export function obterAudienciaJwt(): string {
  return process.env.JWT_AUDIENCIA?.trim() || AUDIENCIA_PADRAO;
}

export function obterExpiracaoJwt(
  valorAmbiente: string | undefined,
  padrao: DuracaoJwt
): DuracaoJwt {
  const valor = valorAmbiente?.trim() || padrao;

  if (typeof valor === 'number') return valor;

  if (!DURACAO_JWT_VALIDA.test(valor)) {
    throw new Error('A duracao de expiracao JWT deve usar numero e unidade, por exemplo 15m ou 30d.');
  }

  return valor as DuracaoJwt;
}

export function duracaoEmSegundos(valor: DuracaoJwt): number {
  if (typeof valor === 'number') return valor;

  const partes = DURACAO_JWT_VALIDA.exec(valor.trim());
  if (!partes) {
    throw new Error('A duracao de expiracao JWT deve usar numero e unidade, por exemplo 15m ou 30d.');
  }

  return Math.floor(Number(partes[1]) * SEGUNDOS_POR_UNIDADE[partes[2].toLowerCase()]);
}

export function expiracaoConfigurada(tipo: TipoToken): DuracaoJwt {
  return tipo === TIPO_TOKEN_ACESSO
    ? obterExpiracaoJwt(process.env.JWT_EXPIRA_EM, EXPIRACAO_ACESSO_PADRAO)
    : obterExpiracaoJwt(process.env.JWT_REFRESH_EXPIRA_EM, EXPIRACAO_RENOVACAO_PADRAO);
}

export function opcoesAssinatura(tipo: TipoToken, jti: string): JwtSignOptions {
  return {
    secret: tipo === TIPO_TOKEN_ACESSO ? obterSegredoAcesso() : obterSegredoRenovacao(),
    algorithm: ALGORITMO_JWT,
    issuer: obterEmissorJwt(),
    audience: obterAudienciaJwt(),
    jwtid: jti,
    expiresIn: expiracaoConfigurada(tipo)
  };
}

export function opcoesVerificacao(tipo: TipoToken): JwtVerifyOptions {
  return {
    secret: tipo === TIPO_TOKEN_ACESSO ? obterSegredoAcesso() : obterSegredoRenovacao(),
    algorithms: [ALGORITMO_JWT],
    issuer: obterEmissorJwt(),
    audience: obterAudienciaJwt(),
    ignoreExpiration: false
  };
}
