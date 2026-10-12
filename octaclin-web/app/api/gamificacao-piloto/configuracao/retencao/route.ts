import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, obterSessaoValidaBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { origemMutacaoPermitida } from '@/lib/server/seguranca-bff';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function response(status: number, body: unknown) { return NextResponse.json(body, { status, headers }); }

async function autorizar() {
  const session = await obterSessaoValidaBff();
  if (session.papel !== 'Client') return false;
  await exigirPermissaoBff('cliente.configuracoes.gerenciar');
  return true;
}

async function lerCorpo(request: NextRequest) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 8_192)) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8_192) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function safeError(error: unknown) {
  if (error instanceof ErroSessaoAusente) return response(401, { mensagem: error.message });
  if (error instanceof ErroPermissaoAusente) return response(403, { mensagem: error.message });
  return response(502, { mensagem: 'Não foi possível acessar os controles de retenção.' });
}

export async function GET(request: NextRequest) {
  if (!origemMutacaoPermitida(request)) return response(403, { mensagem: 'Origem não autorizada.' });
  try {
    if (!await autorizar()) return response(403, { mensagem: 'Recurso exclusivo do gestor da clínica.' });
    const params = request.nextUrl.searchParams;
    const cursor = params.get('cursor');
    if ([...params.keys()].some((key) => key !== 'cursor') || params.getAll('cursor').length > 1 || (cursor !== null && (!cursor || cursor.length > 1_024))) return response(400, { mensagem: 'Confira a página solicitada.' });
    const upstream = await requisitarBackendAutenticado(`/cliente/configuracoes/gamificacao-piloto/denuncias-retencao${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { method: 'GET', cache: 'no-store' });
    const value: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) return response(upstream.status, { mensagem: 'Não foi possível consultar os prazos de retenção.' });
    if (!value || typeof value !== 'object' || Array.isArray(value)) return response(502, { mensagem: 'O serviço retornou dados fora do contrato.' });
    const page = value as Record<string, unknown>;
    if (!Array.isArray(page.itens) || page.itens.length > 100 || typeof page.temMais !== 'boolean' || (page.proximoCursor !== undefined && (typeof page.proximoCursor !== 'string' || page.proximoCursor.length > 1_024))) return response(502, { mensagem: 'O serviço retornou dados fora do contrato.' });
    const itens = page.itens.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const row = item as Record<string, unknown>;
      if (typeof row.id !== 'string' || !uuid.test(row.id) || !Number.isSafeInteger(row.versao) || typeof row.eliminarEm !== 'string' || !Number.isFinite(Date.parse(row.eliminarEm)) || (row.holdAte !== null && (typeof row.holdAte !== 'string' || !Number.isFinite(Date.parse(row.holdAte))))) return [];
      return [{ id: row.id, versao: row.versao, eliminarEm: row.eliminarEm, holdAte: row.holdAte }];
    });
    return response(200, { itens, temMais: page.temMais, ...(typeof page.proximoCursor === 'string' ? { proximoCursor: page.proximoCursor.slice(0, 1_024) } : {}) });
  } catch (error) { return safeError(error); }
}

export async function POST(request: NextRequest) {
  if (!origemMutacaoPermitida(request)) return response(403, { mensagem: 'Origem não autorizada.' });
  try {
    if (!await autorizar()) return response(403, { mensagem: 'Recurso exclusivo do gestor da clínica.' });
    const raw = await lerCorpo(request).catch(() => null);
    if (raw === null) return response(413, { mensagem: 'Solicitação acima do limite.' });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return response(400, { mensagem: 'Confira os campos enviados.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return response(400, { mensagem: 'Confira os campos enviados.' });
    const input = body as Record<string, unknown>;
    const keys = ['denunciaId', 'chave', 'versaoEsperada', 'holdAte', 'justificativa', 'confirmacaoLegal'];
    if (Object.keys(input).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(input, key)) || typeof input.denunciaId !== 'string' || !uuid.test(input.denunciaId) || typeof input.chave !== 'string' || !uuid.test(input.chave) || !Number.isInteger(input.versaoEsperada) || Number(input.versaoEsperada) < 0 || typeof input.holdAte !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.holdAte) || !Number.isFinite(Date.parse(input.holdAte)) || typeof input.justificativa !== 'string' || !input.justificativa.trim() || input.justificativa.length > 1_000 || input.confirmacaoLegal !== true) return response(400, { mensagem: 'Confira os campos enviados.' });
    const { denunciaId, ...payload } = input;
    const upstream = await requisitarBackendAutenticado(`/cliente/configuracoes/gamificacao-piloto/denuncias/${encodeURIComponent(denunciaId as string)}/excecao-retencao`, { method: 'POST', body: JSON.stringify(payload), cache: 'no-store' });
    const value: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) return response(upstream.status, { mensagem: 'Não foi possível registrar a exceção de retenção. Confira os dados e tente novamente.' });
    if (!value || typeof value !== 'object' || Array.isArray(value)) return response(502, { mensagem: 'O serviço retornou dados fora do contrato.' });
    const result = value as Record<string, unknown>;
    if (result.id !== denunciaId || !Number.isSafeInteger(result.versao) || typeof result.holdAte !== 'string') return response(502, { mensagem: 'O serviço retornou dados fora do contrato.' });
    return response(200, { id: result.id, versao: result.versao, holdAte: result.holdAte });
  } catch (error) { return safeError(error); }
}
