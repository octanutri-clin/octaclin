import { NextRequest, NextResponse } from 'next/server';
import { obterApiUrlBff } from '@/lib/server/configuracao-acesso-bff';
import { cabecalhosCorrelacaoBff } from '@/lib/server/correlacao-requisicao-bff';

export async function POST(request: NextRequest) {
  const resposta = await fetch(`${obterApiUrlBff()}/auth/redefinir-senha`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(await cabecalhosCorrelacaoBff()) },
    body: await request.text(),
    cache: 'no-store'
  });

  return new NextResponse(await resposta.text(), {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}
