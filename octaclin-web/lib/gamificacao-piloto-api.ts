export type LadoPiloto = 'console' | 'portal';
export interface PaginaPiloto<T> { itens: T[]; temMais: boolean; proximoCursor?: string }
export interface ConquistaPilotoApi {
  id: string; titulo?: string; descricao?: string; icone?: string; criadoEm?: string; origem?: string;
  versao?: number; compartilhado?: boolean; geracao: number; aceito?: boolean; termoVersao: string; consentimentoVersao?: number;
}
export interface CirculoPilotoApi {
  id: string; nome?: string; objetivo?: string; estado: string; versao?: number; participacao?: string;
  destinatarios?:{clinica:string;profissional:string};
  participacaoVersao?: number; geracao?: number; conviteExpiraEm?: string | null; termoVersao?: string;
}
export interface PublicacaoPilotoApi {
  id: string; texto: string; autor: string; criadoEm: string; versao: number; proprio: boolean;
  reacoes: { total: number; curti: boolean };
}
export interface ConfiguracaoPilotoApi { conquistas: boolean; comunidade: boolean; versao: number; operacaoAprovada: boolean }
export interface ItemRetencaoPilotoApi { id: string; versao: number; eliminarEm: string; holdAte: string | null }

async function solicitar<T>(lado: LadoPiloto, dados: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/gamificacao-piloto/${lado}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(dados),
    cache: 'no-store'
  });
  let result: unknown;
  try { result = await response.json(); } catch { throw new Error('O serviço retornou uma resposta inválida.'); }
  if (!response.ok) {
    const mensagem = result && typeof result === 'object' && 'mensagem' in result && typeof result.mensagem === 'string'
      ? result.mensagem
      : response.status === 409 ? 'Os dados mudaram. Atualize a tela e confira antes de continuar.'
        : response.status === 429 ? 'Aguarde um pouco antes de tentar novamente.'
          : 'Não foi possível concluir a solicitação.';
    throw new Error(mensagem);
  }
  return result as T;
}

export function consultarConsole<T>(acao: string, dados: Record<string, unknown> = {}) { return solicitar<T>('console', { ...dados, acao }); }
export function consultarPortal<T>(acao: string, dados: Record<string, unknown> = {}) { return solicitar<T>('portal', { ...dados, acao }); }
export function chavePiloto() { return crypto.randomUUID(); }

export async function obterConfiguracaoPiloto(tenantId?: string) {
  const url = new URL('/api/gamificacao-piloto/configuracao', window.location.origin);
  if (tenantId) url.searchParams.set('tenantId', tenantId);
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null) as (ConfiguracaoPilotoApi & { mensagem?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.mensagem ?? 'Não foi possível ler a configuração.');
  return body;
}

export async function atualizarConfiguracaoPiloto(dados: Pick<ConfiguracaoPilotoApi, 'conquistas'|'comunidade'|'versao'>, tenantId?: string) {
  const url = new URL('/api/gamificacao-piloto/configuracao', window.location.origin);
  if (tenantId) url.searchParams.set('tenantId', tenantId);
  const response = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conquistas: dados.conquistas, comunidade: dados.comunidade, versaoEsperada: dados.versao }), cache: 'no-store' });
  const body = await response.json().catch(() => null) as (ConfiguracaoPilotoApi & { mensagem?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.mensagem ?? 'Não foi possível salvar a configuração.');
  return body;
}

export async function listarRetencoesPiloto(cursor?: string) {
  const url = new URL('/api/gamificacao-piloto/configuracao/retencao', window.location.origin);
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null) as (PaginaPiloto<ItemRetencaoPilotoApi> & { mensagem?: string }) | null;
  if (!response.ok || !body || !Array.isArray(body.itens) || typeof body.temMais !== 'boolean') throw new Error(body?.mensagem ?? 'Não foi possível consultar prazos de retenção.');
  return body;
}

export async function registrarExcecaoRetencaoPiloto(dados: { denunciaId: string; chave: string; versaoEsperada: number; holdAte: string; justificativa: string; confirmacaoLegal: true }) {
  const response = await fetch('/api/gamificacao-piloto/configuracao/retencao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados), cache: 'no-store' });
  const body = await response.json().catch(() => null) as ({ id: string; versao: number; holdAte: string; mensagem?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.mensagem ?? 'Não foi possível registrar a exceção de retenção.');
  return body;
}
