import { NextResponse } from 'next/server';
import { criarHeadersProxyPublico } from '@/lib/server/agendamento-publico-bff';
import { obterApiUrlBff } from '@/lib/server/configuracao-acesso-bff';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const apiUrl = obterApiUrlBff();
  const resposta = await fetch(`${apiUrl}/formularios/${encodeURIComponent(token)}/anexos`, {
    method: 'POST',
    headers: await criarHeadersProxyPublico(request),
    body: await request.text(),
    cache: 'no-store'
  });
  return new NextResponse(await resposta.text(), {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}
