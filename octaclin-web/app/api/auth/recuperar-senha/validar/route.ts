import { NextRequest, NextResponse } from 'next/server';
import { normalizarApiUrlBff } from '@/lib/server/sessao-bff';

function obterApiUrlPublica() {
  return normalizarApiUrlBff(process.env.OCTACLIN_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');
}

export async function POST(request: NextRequest) {
  const resposta = await fetch(`${obterApiUrlPublica()}/auth/recuperar-senha/validar`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: await request.text(),
    cache: 'no-store'
  });

  return new NextResponse(await resposta.text(), {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}
