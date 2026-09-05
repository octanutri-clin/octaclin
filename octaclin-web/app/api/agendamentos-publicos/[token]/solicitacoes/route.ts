import { NextResponse } from 'next/server';
import { criarHeadersProxyPublico } from '@/lib/server/agendamento-publico-bff';
import { obterApiUrlBff } from '@/lib/server/configuracao-acesso-bff';

export async function POST(request: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const resposta = await fetch(
    `${obterApiUrlBff()}/agendamentos-publicos/${encodeURIComponent(params.token)}/solicitacoes`,
    {
      method: 'POST',
      headers: await criarHeadersProxyPublico(request),
      body: await request.text(),
      cache: 'no-store'
    }
  );

  return new NextResponse(await resposta.text(), {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}
