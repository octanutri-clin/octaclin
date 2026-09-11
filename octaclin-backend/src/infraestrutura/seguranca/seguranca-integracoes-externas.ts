import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ambienteExigeFalhaFechada, obterAmbienteExecucao } from './ambiente-execucao';

const ENDPOINT_TOKEN_GOOGLE = 'https://oauth2.googleapis.com/token';
const ENDPOINT_REVOGACAO_GOOGLE = 'https://oauth2.googleapis.com/revoke';
const TIMEOUT_INTEGRACAO_MS = 15_000;

function urlSemComponentesInesperados(url: URL): boolean {
  return !url.username && !url.password && !url.search && !url.hash;
}

export function opcoesSegurasFetchExterno(): Pick<RequestInit, 'redirect' | 'signal'> {
  return {
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_INTEGRACAO_MS)
  };
}

function endpointOAuthGoogleSeguro(valor: string | undefined, endpointPadrao: string, pathnameSintetico: string): string {
  const configurado = valor?.trim() || endpointPadrao;
  let url: URL;
  try {
    url = new URL(configurado);
  } catch {
    throw new InternalServerErrorException('Configuracao de endpoint OAuth Google invalida.');
  }

  if (url.toString() === endpointPadrao) return endpointPadrao;

  const ambiente = obterAmbienteExecucao();
  const mockSintetico =
    ambiente === 'test' &&
    url.protocol === 'https:' &&
    url.hostname.endsWith('.test') &&
    url.pathname === pathnameSintetico &&
    urlSemComponentesInesperados(url);
  if (mockSintetico) return url.toString();

  throw new InternalServerErrorException('Configuracao de endpoint OAuth Google nao autorizada.');
}

export function endpointTokenGoogleSeguro(valor: string | undefined): string {
  return endpointOAuthGoogleSeguro(valor, ENDPOINT_TOKEN_GOOGLE, '/token');
}

export function endpointRevogacaoGoogleSeguro(valor: string | undefined): string {
  return endpointOAuthGoogleSeguro(valor, ENDPOINT_REVOGACAO_GOOGLE, '/revoke');
}

export function urlAutorizacaoGoogleSegura(valor: string): string {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new InternalServerErrorException('URL de autorizacao Google invalida.');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'accounts.google.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/o/oauth2/v2/auth' ||
    url.hash
  ) {
    throw new InternalServerErrorException('URL de autorizacao Google nao autorizada.');
  }

  return url.toString();
}

export function origemPublicaConfigurada(valor: string | undefined, nome: string, fallbackLocal?: string): string {
  const configurado = valor?.trim() || fallbackLocal;
  if (!configurado) throw new InternalServerErrorException(`${nome} nao configurada.`);

  let url: URL;
  try {
    url = new URL(configurado);
  } catch {
    throw new InternalServerErrorException(`${nome} deve ser uma URL publica valida.`);
  }

  const somenteOrigem = url.pathname === '/' && urlSemComponentesInesperados(url);
  const loopback =
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.localhost') ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '::1';
  const ambienteFechado = ambienteExigeFalhaFechada();
  const protocoloPermitido =
    (!ambienteFechado && loopback && url.protocol === 'http:') ||
    (url.protocol === 'https:' && (!ambienteFechado || !loopback));
  if (!somenteOrigem || !protocoloPermitido) {
    throw new InternalServerErrorException(`${nome} deve ser uma URL publica HTTPS sem caminho, credenciais, query ou fragmento.`);
  }

  return url.origin;
}

export function validarSegmentosMeta(versao: string, phoneNumberId: string): void {
  if (!/^v\d{1,2}\.\d{1,2}$/.test(versao) || !/^\d{5,30}$/.test(phoneNumberId)) {
    throw new InternalServerErrorException('Configuracao WhatsApp invalida.');
  }
}

export function permitirRedeInternaSmtp(valor: unknown): boolean {
  if (ambienteExigeFalhaFechada()) return false;
  return typeof valor === 'string' && valor.trim().toLowerCase() === 'true';
}

export function validarCodigoOAuth(codigo: unknown): string {
  if (typeof codigo !== 'string' || codigo.length < 4 || codigo.length > 4096 || /[\r\n]/.test(codigo)) {
    throw new BadRequestException('Codigo OAuth invalido.');
  }
  return codigo;
}
