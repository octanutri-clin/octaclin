import type { PapelUsuario } from './usuario-autenticado';

export const TIPO_TOKEN_ACESSO = 'acesso' as const;
export const TIPO_TOKEN_RENOVACAO = 'renovacao' as const;

export type TipoToken = typeof TIPO_TOKEN_ACESSO | typeof TIPO_TOKEN_RENOVACAO;

export const PAPEIS_USUARIO: readonly PapelUsuario[] = [
  'SuperAdmin',
  'Professional',
  'Collaborator',
  'Patient',
  'Client'
];

/**
 * Claims aceitas pelo OctaClin. `sid` identifica a sessao (familia de refresh
 * tokens) e `jti` identifica o token individual; os dois sao obrigatorios nos
 * dois tipos, porque a revogacao por sessao depende deles.
 */
export interface ClaimsToken {
  sub: string;
  tenantId: string;
  sid: string;
  jti: string;
  tipo: TipoToken;
  iat: number;
  exp: number;
  papel?: PapelUsuario;
  emailHash?: string;
  permissoes?: string[];
}

export class ErroClaimsInvalidas extends Error {
  constructor(claim: string) {
    super(`Claim ${claim} ausente ou invalida no token.`);
    this.name = 'ErroClaimsInvalidas';
  }
}

function exigirTexto(payload: Record<string, unknown>, claim: string): string {
  const valor = payload[claim];
  if (typeof valor !== 'string' || valor.trim() === '') throw new ErroClaimsInvalidas(claim);
  return valor;
}

function exigirNumero(payload: Record<string, unknown>, claim: string): number {
  const valor = payload[claim];
  if (typeof valor !== 'number' || !Number.isFinite(valor)) throw new ErroClaimsInvalidas(claim);
  return valor;
}

/**
 * Valida o conteudo do token ja verificado criptograficamente e devolve somente
 * as claims conhecidas. Claims extras sao descartadas: nada fora desta lista
 * chega ao contexto autenticado.
 */
export function validarClaimsToken(payload: unknown, tipoEsperado: TipoToken): ClaimsToken {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new ErroClaimsInvalidas('payload');
  }

  const dados = payload as Record<string, unknown>;

  if (dados.tipo !== tipoEsperado) throw new ErroClaimsInvalidas('tipo');

  const claims: ClaimsToken = {
    sub: exigirTexto(dados, 'sub'),
    tenantId: exigirTexto(dados, 'tenantId'),
    sid: exigirTexto(dados, 'sid'),
    jti: exigirTexto(dados, 'jti'),
    tipo: tipoEsperado,
    iat: exigirNumero(dados, 'iat'),
    exp: exigirNumero(dados, 'exp')
  };

  if (tipoEsperado === TIPO_TOKEN_RENOVACAO) return claims;

  const papel = dados.papel;
  if (typeof papel !== 'string' || !PAPEIS_USUARIO.includes(papel as PapelUsuario)) {
    throw new ErroClaimsInvalidas('papel');
  }
  claims.papel = papel as PapelUsuario;
  claims.emailHash = exigirTexto(dados, 'emailHash');

  const permissoes = dados.permissoes;
  if (permissoes !== undefined) {
    if (!Array.isArray(permissoes) || permissoes.some((item) => typeof item !== 'string')) {
      throw new ErroClaimsInvalidas('permissoes');
    }
    claims.permissoes = permissoes as string[];
  }

  return claims;
}
