import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ambienteExigeFalhaFechada, obterAmbienteExecucao } from './ambiente-execucao';

const ENDPOINT_TOKEN_GOOGLE = 'https://oauth2.googleapis.com/token';
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

export function endpointTokenGoogleSeguro(valor: string | undefined): string {
  const configurado = valor?.trim() || ENDPOINT_TOKEN_GOOGLE;
  let url: URL;
  try {
    url = new URL(configurado);
  } catch {
    throw new InternalServerErrorException('Configuracao de endpoint OAuth Google invalida.');
  }

  if (url.toString() === ENDPOINT_TOKEN_GOOGLE) return ENDPOINT_TOKEN_GOOGLE;

  const ambiente = obterAmbienteExecucao();
  const mockSintetico =
    ambiente === 'test' &&
    url.protocol === 'https:' &&
    url.hostname.endsWith('.test') &&
    url.pathname === '/token' &&
    urlSemComponentesInesperados(url);
  if (mockSintetico) return url.toString();

  throw new InternalServerErrorException('Configuracao de endpoint OAuth Google nao autorizada.');
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
