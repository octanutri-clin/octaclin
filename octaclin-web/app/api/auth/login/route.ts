import { NextRequest, NextResponse } from 'next/server';
import { ErroApiUrlInvalida, RespostaToken, normalizarApiUrlBff, salvarSessaoBff } from '@/lib/server/sessao-bff';

interface LoginBody {
  apiUrl: string;
  tenantSlug: string;
  email: string;
  senha: string;
}

async function extrairMensagemErro(resposta: Response): Promise<string> {
  const tipoConteudo = resposta.headers.get('Content-Type') ?? '';
  const texto = await resposta.text();

  if (tipoConteudo.includes('application/json')) {
    try {
      const corpo = JSON.parse(texto) as { mensagem?: string; message?: string };
      return corpo.mensagem ?? corpo.message ?? `Falha HTTP ${resposta.status}`;
    } catch {
      return `Falha HTTP ${resposta.status}`;
    }
  }

  if (texto.trim().startsWith('<!DOCTYPE html>') || texto.trim().startsWith('<html')) {
    return 'A URL informada em API nao respondeu como backend OctaClin. Verifique se ela aponta para o NestJS, nao para a web.';
  }

  return texto || `Falha HTTP ${resposta.status}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LoginBody;
  let resposta: Response;
  let apiUrl: string;

  try {
    apiUrl = normalizarApiUrlBff(body.apiUrl);
  } catch (erro) {
    if (erro instanceof ErroApiUrlInvalida) {
      return NextResponse.json({ mensagem: erro.message }, { status: 400 });
    }
    throw erro;
  }

  try {
    resposta = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: body.tenantSlug,
        email: body.email,
        senha: body.senha
      }),
      cache: 'no-store'
    });
  } catch {
    return NextResponse.json(
      { mensagem: 'Nao foi possivel conectar ao backend informado no campo API.' },
      { status: 502 }
    );
  }

  if (!resposta.ok) {
    return NextResponse.json({ mensagem: await extrairMensagemErro(resposta) }, { status: resposta.status });
  }

  let tokens: RespostaToken;
  try {
    tokens = (await resposta.json()) as RespostaToken;
  } catch {
    return NextResponse.json(
      { mensagem: 'A API informada nao retornou uma resposta de login valida.' },
      { status: 502 }
    );
  }
  salvarSessaoBff(
    { apiUrl, tenantSlug: body.tenantSlug, email: body.email },
    tokens
  );

  return NextResponse.json({
    email: body.email,
    tenantSlug: body.tenantSlug,
    apiUrl,
    expiraEmSegundos: tokens.expiraEmSegundos,
    papel: tokens.papel,
    permissoes: tokens.permissoes ?? [],
    escopoDados: tokens.escopoDados,
    destinoInicial: tokens.destinoInicial
  });
}
