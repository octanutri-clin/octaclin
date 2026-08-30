import { NextRequest, NextResponse } from 'next/server';
import { obterConfiguracaoAcessoBff } from '@/lib/server/configuracao-acesso-bff';
import { limparDesafioMfa, obterDesafioMfa } from '@/lib/server/mfa-bff';
import { RespostaToken, salvarSessaoBff } from '@/lib/server/sessao-bff';

export async function POST(request: NextRequest) {
  const desafio = await obterDesafioMfa();
  if (!desafio) return NextResponse.json({ mensagem: 'Desafio MFA ausente ou expirado.' }, { status: 401 });
  const corpo = (await request.json()) as { codigo?: string };
  if (typeof corpo.codigo !== 'string') {
    return NextResponse.json({ mensagem: 'Informe o código de verificação.' }, { status: 400 });
  }
  const { apiUrl, tenantSlug } = obterConfiguracaoAcessoBff();
  const resposta = await fetch(`${apiUrl}/auth/mfa/login`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ desafioMfa: desafio.desafioMfa, codigo: corpo.codigo }),
    cache: 'no-store'
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    return new NextResponse(texto, { status: resposta.status, headers: { 'Content-Type': 'application/json' } });
  }
  const tokens = JSON.parse(texto) as RespostaToken & { codigosRecuperacao?: string[] };
  if (
    typeof tokens.accessToken !== 'string' ||
    typeof tokens.refreshToken !== 'string' ||
    typeof tokens.expiraEmSegundos !== 'number'
  ) {
    return NextResponse.json({ mensagem: 'O serviço de acesso retornou tokens inválidos.' }, { status: 502 });
  }
  await salvarSessaoBff({ apiUrl, tenantSlug, email: desafio.email }, tokens);
  await limparDesafioMfa();
  return NextResponse.json({
    destinoInicial: tokens.destinoInicial,
    codigosRecuperacao: tokens.codigosRecuperacao ?? []
  });
}
