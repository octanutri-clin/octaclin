import { NextResponse } from 'next/server';
import { obterConfiguracaoAcessoBff } from '@/lib/server/configuracao-acesso-bff';
import { obterDesafioMfa } from '@/lib/server/mfa-bff';
import { cabecalhosCorrelacaoBff } from '@/lib/server/correlacao-requisicao-bff';

export async function POST() {
  const desafio = await obterDesafioMfa();
  if (!desafio || desafio.modo !== 'configurar') {
    return NextResponse.json({ mensagem: 'Desafio de configuração ausente ou expirado.' }, { status: 401 });
  }
  const { apiUrl } = obterConfiguracaoAcessoBff();
  const resposta = await fetch(`${apiUrl}/auth/mfa/login/configuracao`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(await cabecalhosCorrelacaoBff()) },
    body: JSON.stringify({ desafioMfa: desafio.desafioMfa }),
    cache: 'no-store'
  });
  return new NextResponse(await resposta.text(), {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-store' }
  });
}
