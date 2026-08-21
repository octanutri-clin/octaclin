import { NextRequest, NextResponse } from 'next/server';
import { obterConfiguracaoAcessoBff } from '@/lib/server/configuracao-acesso-bff';

interface SolicitarRecuperacaoBody {
  email: string;
}

export async function POST(request: NextRequest) {
  let body: SolicitarRecuperacaoBody;
  try {
    body = (await request.json()) as SolicitarRecuperacaoBody;
  } catch {
    return NextResponse.json({ mensagem: 'Dados de recuperacao invalidos.' }, { status: 400 });
  }

  if (typeof body.email !== 'string' || !body.email.trim()) {
    return NextResponse.json({ mensagem: 'Informe o email.' }, { status: 400 });
  }

  let apiUrl: string;
  let tenantSlug: string;
  try {
    ({ apiUrl, tenantSlug } = obterConfiguracaoAcessoBff());
  } catch {
    return NextResponse.json(
      { mensagem: 'O servico de acesso do OctaClin esta configurado incorretamente.' },
      { status: 500 }
    );
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}/auth/recuperar-senha`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug, email: body.email.trim() }),
      cache: 'no-store'
    });
  } catch {
    return NextResponse.json(
      { mensagem: 'Não foi possível conectar ao servico de acesso do OctaClin.' },
      { status: 502 }
    );
  }

  const conteudo = await resposta.text();
  if ((resposta.headers.get('Content-Type') ?? '').includes('text/html')) {
    return NextResponse.json(
      { mensagem: 'O servico de acesso do OctaClin esta indisponível no momento.' },
      { status: 502 }
    );
  }

  return new NextResponse(conteudo, {
    status: resposta.status,
    headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
  });
}
