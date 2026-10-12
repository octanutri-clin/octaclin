import { NextRequest, NextResponse } from 'next/server';
import { ErroPermissaoAusente, ErroSessaoAusente, exigirPermissaoBff, obterSessaoValidaBff, requisitarBackendAutenticado } from '@/lib/server/sessao-bff';
import { origemMutacaoPermitida } from '@/lib/server/seguranca-bff';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resposta(status: number, body: unknown) { return NextResponse.json(body, { status, headers }); }

async function lerCorpoLimitado(request: NextRequest, limite: number): Promise<string | null> {
  const declarado = request.headers.get('content-length');
  if (declarado && (!/^\d+$/.test(declarado) || Number(declarado) > limite)) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const blocos: Uint8Array[] = [];
  let tamanho = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    tamanho += value.byteLength;
    if (tamanho > limite) { await reader.cancel(); return null; }
    blocos.push(value);
  }
  const bytes = new Uint8Array(tamanho);
  let offset = 0;
  for (const bloco of blocos) { bytes.set(bloco, offset); offset += bloco.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

async function caminho(request: NextRequest) {
  const sessao = await obterSessaoValidaBff();
  if (sessao.papel === 'Client') {
    await exigirPermissaoBff('cliente.configuracoes.gerenciar');
    if (request.nextUrl.searchParams.size) return null;
    return '/cliente/configuracoes/gamificacao-piloto';
  }
  if (sessao.papel === 'SuperAdmin') {
    await exigirPermissaoBff('operacoes.tenants.gerenciar');
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    if (!tenantId || !uuid.test(tenantId) || request.nextUrl.searchParams.getAll('tenantId').length !== 1 || [...request.nextUrl.searchParams.keys()].some((key) => key !== 'tenantId')) return null;
    return `/operacoes/tenants/${encodeURIComponent(tenantId)}/gamificacao-piloto`;
  }
  return null;
}

async function executar(request: NextRequest, method: 'GET' | 'PATCH') {
  if (!origemMutacaoPermitida(request)) return resposta(403, { mensagem: 'Origem não autorizada.' });
  try {
    const path = await caminho(request);
    if (!path) return resposta(403, { mensagem: 'Perfil ou clínica não disponível para esta configuração.' });
    let body: { conquistas: boolean; comunidade: boolean; versaoEsperada: number } | undefined;
    if (method === 'PATCH') {
      let raw: string | null;
      try { raw = await lerCorpoLimitado(request, 1_024); } catch { return resposta(400, { mensagem: 'Confira os campos da configuração.' }); }
      if (raw === null) return resposta(413, { mensagem: 'Solicitação acima do limite.' });
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { return resposta(400, { mensagem: 'Confira os campos da configuração.' }); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return resposta(400, { mensagem: 'Confira os campos da configuração.' });
      const value = parsed as Record<string, unknown>;
      if (Object.keys(value).sort().join(',') !== 'comunidade,conquistas,versaoEsperada' || typeof value.conquistas !== 'boolean' || typeof value.comunidade !== 'boolean' || !Number.isInteger(value.versaoEsperada) || Number(value.versaoEsperada) < 0) {
        return resposta(400, { mensagem: 'Confira os campos da configuração.' });
      }
      body = value as typeof body;
    }
    const upstream = await requisitarBackendAutenticado(path, { method, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
    let json: unknown;
    try { json = await upstream.json(); } catch { return resposta(502, { mensagem: 'O serviço retornou uma resposta inválida.' }); }
    if (!upstream.ok) {
      return resposta(upstream.status, { mensagem: 'Não foi possível salvar a configuração. Confira e tente novamente.' });
    }
    if (!json || typeof json !== 'object') return resposta(502, { mensagem: 'O serviço retornou dados fora do contrato.' });
    const value = json as Record<string, unknown>;
    if (typeof value.conquistas !== 'boolean' || typeof value.comunidade !== 'boolean' || !Number.isInteger(value.versao) || typeof value.operacaoAprovada !== 'boolean') return resposta(502, { mensagem: 'O serviço retornou dados fora do contrato.' });
    return resposta(upstream.status, { conquistas: value.conquistas, comunidade: value.comunidade, versao: value.versao, operacaoAprovada: value.operacaoAprovada });
  } catch (error) {
    if (error instanceof ErroSessaoAusente) return resposta(401, { mensagem: error.message });
    if (error instanceof ErroPermissaoAusente) return resposta(403, { mensagem: error.message });
    return resposta(502, { mensagem: 'Não foi possível acessar as configurações do piloto.' });
  }
}

export function GET(request: NextRequest) { return executar(request, 'GET'); }
export function PATCH(request: NextRequest) { return executar(request, 'PATCH'); }
