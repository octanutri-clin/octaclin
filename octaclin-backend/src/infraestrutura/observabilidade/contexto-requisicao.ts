import { randomUUID } from 'crypto';
import type { UsuarioAutenticado } from '../../modulos/auth/dominio/usuario-autenticado';

const TAMANHO_MAXIMO_REQUEST_ID = 128;
const TAMANHO_MAXIMO_ROTA = 200;

export interface ContextoCorrelacao {
  requestId: string;
  tenantId?: string;
  usuarioId?: string;
  metodo?: string;
  rota?: string;
}

export interface RequisicaoComContexto {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  url?: string;
  baseUrl?: string;
  route?: { path?: unknown };
  requestId?: string;
  correlacao?: ContextoCorrelacao;
  usuarioAutenticado?: UsuarioAutenticado;
}

function obterCabecalho(
  cabecalhos: Record<string, string | string[] | undefined> | undefined,
  nome: string
): string | undefined {
  const entrada = Object.entries(cabecalhos ?? {}).find(([chave]) => chave.toLowerCase() === nome);
  const valor = entrada?.[1];

  if (Array.isArray(valor)) return valor[0];
  return valor;
}

function sanitizarRequestId(valor: string | undefined): string | undefined {
  const sanitizado = valor
    ?.trim()
    .replace(/[^a-zA-Z0-9._:/-]/g, '')
    .slice(0, TAMANHO_MAXIMO_REQUEST_ID);

  return sanitizado || undefined;
}

/**
 * Rota sem querystring e com tamanho limitado.
 *
 * Exportada para quem precisa so de rota e nao de correlacao inteira:
 * `obterContextoCorrelacao` varre cabecalhos e chega a gerar `randomUUID()`, o
 * que e caro num caminho de rejeicao em rajada (ver `auditoria-autorizacao.ts`).
 */
export function obterRotaSegura(requisicao: RequisicaoComContexto): string | undefined {
  const caminhoRota = requisicao.route?.path;
  if (typeof caminhoRota === 'string' && caminhoRota) {
    return `${requisicao.baseUrl ?? ''}${caminhoRota}`.slice(0, TAMANHO_MAXIMO_ROTA);
  }
  const rota = requisicao.originalUrl ?? requisicao.url;
  if (!rota) return undefined;

  return rota.split('?')[0].slice(0, TAMANHO_MAXIMO_ROTA);
}

export function obterRequestId(cabecalhos: Record<string, string | string[] | undefined> | undefined): string {
  return (
    sanitizarRequestId(obterCabecalho(cabecalhos, 'x-request-id')) ??
    sanitizarRequestId(obterCabecalho(cabecalhos, 'x-correlation-id')) ??
    randomUUID()
  );
}

export function obterContextoCorrelacao(requisicao: RequisicaoComContexto): ContextoCorrelacao {
  const requestId = requisicao.requestId ?? obterRequestId(requisicao.headers);
  const usuario = requisicao.usuarioAutenticado;

  return {
    requestId,
    tenantId: usuario?.tenantId,
    usuarioId: usuario?.usuarioId,
    metodo: requisicao.method,
    rota: obterRotaSegura(requisicao)
  };
}
