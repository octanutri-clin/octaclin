import { NextRequest, NextResponse } from 'next/server';
import { RespostaToken, normalizarApiUrlBff, salvarSessaoBff } from '@/lib/server/sessao-bff';

function obterApiUrlPublica() {
  return normalizarApiUrlBff(process.env.OCTACLIN_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');
}

export async function POST(request: NextRequest) {
  const apiUrl = obterApiUrlPublica();
  const resposta = await fetch(`${apiUrl}/pacientes/convites-acesso/ativar`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: await request.text(),
    cache: 'no-store'
  });

  const texto = await resposta.text();
  if (!resposta.ok) {
    return new NextResponse(texto, {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  }

  let ativacao: {
    tenantId: string;
    tenantSlug?: string;
    email: string;
  } & RespostaToken;
  try {
    ativacao = JSON.parse(texto) as typeof ativacao;
  } catch {
    return NextResponse.json(
      { mensagem: 'A API não retornou uma resposta valida para ativação do convite.' },
      { status: 502 }
    );
  }

  if (ativacao.accessToken && ativacao.refreshToken && ativacao.expiraEmSegundos) {
    await salvarSessaoBff(
      { apiUrl, tenantSlug: ativacao.tenantSlug ?? ativacao.tenantId, email: ativacao.email },
      ativacao
    );
  }

  const ativacaoPublica = Object.fromEntries(
    Object.entries(ativacao).filter(([chave]) => chave !== 'accessToken' && chave !== 'refreshToken')
  );
  return NextResponse.json(ativacaoPublica, { status: resposta.status });
}
