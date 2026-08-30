import { cookies } from 'next/headers';
import { validarConfiguracaoSegurancaBff } from './seguranca-bff';

const NOMES = {
  desafio: 'octaclin_mfa_desafio',
  email: 'octaclin_mfa_email',
  modo: 'octaclin_mfa_modo',
  provaReautenticacao: 'octaclin_reauth_prova'
};

function opcoes(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: validarConfiguracaoSegurancaBff().cookieSecure,
    path: '/',
    maxAge
  };
}

export async function salvarDesafioMfa(entrada: {
  desafioMfa: string;
  email: string;
  modo: 'configurar' | 'verificar';
}) {
  const jar = await cookies();
  jar.set(NOMES.desafio, entrada.desafioMfa, opcoes(5 * 60));
  jar.set(NOMES.email, encodeURIComponent(entrada.email), opcoes(5 * 60));
  jar.set(NOMES.modo, entrada.modo, opcoes(5 * 60));
}

export async function obterDesafioMfa() {
  const jar = await cookies();
  const desafioMfa = jar.get(NOMES.desafio)?.value;
  const email = jar.get(NOMES.email)?.value;
  const modo = jar.get(NOMES.modo)?.value;
  if (!desafioMfa || !email || (modo !== 'configurar' && modo !== 'verificar')) return null;
  return { desafioMfa, email: decodeURIComponent(email), modo };
}

export async function limparDesafioMfa() {
  const jar = await cookies();
  jar.delete(NOMES.desafio);
  jar.delete(NOMES.email);
  jar.delete(NOMES.modo);
}

export async function salvarProvaReautenticacao(prova: string, expiraEmSegundos: number) {
  const jar = await cookies();
  jar.set(NOMES.provaReautenticacao, prova, opcoes(Math.min(expiraEmSegundos, 300)));
}

export async function obterProvaReautenticacao() {
  return (await cookies()).get(NOMES.provaReautenticacao)?.value;
}

export async function limparProvaReautenticacao() {
  (await cookies()).delete(NOMES.provaReautenticacao);
}
