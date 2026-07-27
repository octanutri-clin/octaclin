import { NextResponse } from 'next/server';
import { criarHeadersProxyPublico } from '@/lib/server/agendamento-publico-bff';
import { normalizarApiUrlBff } from '@/lib/server/sessao-bff';

function obterApiUrlPublica() {
  return normalizarApiUrlBff(process.env.OCTACLIN_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');
}

export async function POST(request: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const resposta = await fetch(
    `${obterApiUrlPublica()}/agendamentos-publicos/${encodeURIComponent(params.token)}/solicitacoes`,
    {
      method: 'POST',
      headers: criarHeadersProxyPublico(request),
      body: await request.text(),
      cache: 'no-store'
    }
  );

  return new NextResponse(await resposta.text(), {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}
