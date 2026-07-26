import { NextResponse } from 'next/server';
import { normalizarApiUrlBff } from '@/lib/server/sessao-bff';

function obterApiUrlPublica() {
  return normalizarApiUrlBff(process.env.OCTACLIN_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');
}

export async function GET(_: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const resposta = await fetch(`${obterApiUrlPublica()}/formularios/${encodeURIComponent(params.token)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });

  return new NextResponse(await resposta.text(), {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}
