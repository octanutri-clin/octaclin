import { NextRequest, NextResponse } from 'next/server';
import { normalizarApiUrlBff } from '@/lib/server/sessao-bff';

interface SolicitarRecuperacaoBody {
  apiUrl?: string;
  tenantSlug: string;
  email: string;
}

function obterApiUrlPublica(apiUrl?: string) {
  return normalizarApiUrlBff(apiUrl ?? process.env.OCTACLIN_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SolicitarRecuperacaoBody;
  const apiUrl = obterApiUrlPublica(body.apiUrl);
  const resposta = await fetch(`${apiUrl}/auth/recuperar-senha`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug: body.tenantSlug, email: body.email }),
    cache: 'no-store'
  });

  return new NextResponse(await resposta.text(), {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}
