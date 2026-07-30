'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Mail } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { solicitarRecuperacaoSenha } from '@/lib/recuperacao-senha-api';

export function EsqueciSenhaForm() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setMensagem(null);
    setLink(null);
    setEnviando(true);

    try {
      const resposta = await solicitarRecuperacaoSenha({ email });
      setMensagem(resposta.mensagem);
      setLink(resposta.linkRecuperacao ?? null);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao solicitar redefinicao.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center bg-fundo px-5 py-8 text-tinta sm:px-8">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <header className="text-center">
          <p className="text-sm font-semibold text-primaria">OctaClin</p>
          <h1 className="mt-1 text-3xl font-bold">Recuperar senha</h1>
          <p className="mt-2 text-sm text-texto-suave">
            Informe o email usado no seu acesso.
          </p>
        </header>

        <Cartao className="shadow-sm">
          <CartaoConteudo className="p-6">
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

              {erro ? (
                <div role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">{erro}</div>
              ) : null}
              {mensagem ? (
                <div role="status" className="grid gap-2 rounded-md border border-sucesso-borda bg-sucesso-suave px-3 py-2 text-sm text-sucesso-forte">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    {mensagem}
                  </span>
                  {link ? <span className="break-all text-xs text-texto-suave">{link}</span> : null}
                </div>
              ) : null}

              <Botao type="submit" variante="primario" disabled={enviando} className="w-full">
                <Mail size={16} />
                {enviando ? 'Enviando' : 'Enviar link'}
              </Botao>

              <Link href="/login" className="text-center text-sm font-medium text-primaria hover:underline">
                Voltar para login
              </Link>
            </form>
          </CartaoConteudo>
        </Cartao>
      </div>
    </main>
  );
}
