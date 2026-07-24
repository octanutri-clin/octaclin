'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { autenticar, obterSessao } from '@/lib/auth-api';

const API_PADRAO = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function LoginForm() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState(API_PADRAO);
  const [tenantSlug, setTenantSlug] = useState('clinica-carla');
  const [email, setEmail] = useState('admin@octaclin.local');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    void obterSessao().then((sessao) => {
      if (!sessao) return;
      setApiUrl(sessao.apiUrl);
      setTenantSlug(sessao.tenantSlug);
      setEmail(sessao.email);
    });
  }, []);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const sessao = await autenticar({ apiUrl, tenantSlug, email, senha });
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      const destino =
        redirect?.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/api')
          ? redirect
          : sessao.destinoInicial ?? '/operacoes';
      router.replace(destino as any);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao autenticar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-fundo px-6 py-10 text-tinta">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <header>
          <p className="text-xs font-semibold uppercase text-texto-suave">OctaClin</p>
          <h1 className="mt-1 text-3xl font-bold">Acesso OctaClin</h1>
          <p className="mt-2 text-sm text-texto-suave">Entre como profissional, equipe ou paciente.</p>
        </header>

        <Cartao>
          <CartaoConteudo>
            <form onSubmit={enviar} className="grid gap-4">
              <label className="grid gap-1">
                <Rotulo>API</Rotulo>
                <Campo value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} required />
              </label>

              <label className="grid gap-1">
                <Rotulo>Tenant</Rotulo>
                <Campo value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} required />
              </label>

              <label className="grid gap-1">
                <Rotulo>Email</Rotulo>
                <Campo value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
              </label>

              <label className="grid gap-1">
                <Rotulo>Senha</Rotulo>
                <Campo
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>

              {erro ? (
                <div className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">
                  {erro}
                </div>
              ) : null}

              <Botao type="submit" variante="primario" disabled={enviando}>
                <LogIn size={16} />
                {enviando ? 'Entrando' : 'Entrar'}
              </Botao>
              <Link href={'/esqueci-senha' as any} className="text-center text-sm font-medium text-primaria hover:underline">
                Esqueci minha senha
              </Link>
            </form>
          </CartaoConteudo>
        </Cartao>
      </div>
    </main>
  );
}
