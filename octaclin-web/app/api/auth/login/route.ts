import { NextRequest, NextResponse } from 'next/server';
import { comEsperaDeColdStart } from '@/lib/server/cold-start-bff';
import { obterConfiguracaoAcessoBff } from '@/lib/server/configuracao-acesso-bff';
import { ErroApiUrlInvalida, RespostaToken, salvarSessaoBff } from '@/lib/server/sessao-bff';

interface LoginBody {
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
    return 'O servico de acesso do OctaClin esta indisponivel no momento.';
  }

  return texto || `Falha HTTP ${resposta.status}`;
}

export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ mensagem: 'Dados de acesso invalidos.' }, { status: 400 });
  }

  let resposta: Response;
  let apiUrl: string;
  let tenantSlug: string;

  try {
    ({ apiUrl, tenantSlug } = obterConfiguracaoAcessoBff());
  } catch (erro) {
    if (erro instanceof ErroApiUrlInvalida) {
      return NextResponse.json({ mensagem: 'O servico de acesso do OctaClin esta configurado incorretamente.' }, { status: 500 });
    }
    return NextResponse.json({ mensagem: 'O servico de acesso do OctaClin esta configurado incorretamente.' }, { status: 500 });
  }

  if (typeof body.email !== 'string' || !body.email.trim() || typeof body.senha !== 'string' || !body.senha) {
    return NextResponse.json({ mensagem: 'Informe email e senha.' }, { status: 400 });
  }

  // Autenticar de novo e seguro (nao cria nem altera nada), e a espera evita que
  // um backend apenas hibernando apareca como "servico de acesso indisponivel".
  // Credencial errada volta 401, que nao e status de cold start e nao repete —
  // entao isto nao multiplica tentativa falha contra o bloqueio por senha.
  try {
    resposta = await comEsperaDeColdStart(
      () =>
        fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantSlug,
            email: body.email.trim(),
            senha: body.senha
          }),
          cache: 'no-store'
        }),
      true
    );
  } catch {
    return NextResponse.json(
      { mensagem: 'Não foi possível conectar ao servico de acesso do OctaClin.' },
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
      { mensagem: 'A API informada não retornou uma resposta de login valida.' },
      { status: 502 }
    );
  }
  await salvarSessaoBff(
    { apiUrl, tenantSlug, email: body.email.trim() },
    tokens
  );

  return NextResponse.json({
    email: body.email.trim(),
    tenantSlug,
    apiUrl,
    expiraEmSegundos: tokens.expiraEmSegundos,
    papel: tokens.papel,
    permissoes: tokens.permissoes ?? [],
    escopoDados: tokens.escopoDados,
    destinoInicial: tokens.destinoInicial
  });
}
