'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { CampoSenha } from '@/components/auth/campo-senha';
import { AuthShell } from '@/components/auth/auth-shell';
import { autenticar } from '@/lib/auth-api';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const sessao = await autenticar({ email, senha });
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      const destino = (
        redirect?.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/api')
          ? redirect
          : sessao.destinoInicial ?? '/operacoes'
      ) as Route;
      router.replace(destino);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao autenticar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell
      titulo="Acesso OctaClin"
      subtitulo="Entre com as credenciais da sua conta."
      rodape={
        <p className="text-center text-xs text-texto-suave">
          Seu acesso e individual e protegido. Nao compartilhe sua senha.
        </p>
      }
    >
      <form onSubmit={enviar} className="grid gap-4">
        <div className="grid gap-1.5">
          <Rotulo htmlFor="email">Email</Rotulo>
          <Campo
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
          />
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <Rotulo htmlFor="senha">Senha</Rotulo>
            <Link href="/esqueci-senha" className="text-xs font-medium text-primaria hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <CampoSenha
            id="senha"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {erro ? (
          <div role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">
            {erro}
          </div>
        ) : null}

        <Botao type="submit" variante="primario" disabled={enviando} className="w-full">
          <LogIn size={16} />
          {enviando ? 'Entrando' : 'Entrar'}
        </Botao>
      </form>
    </AuthShell>
  );
}
