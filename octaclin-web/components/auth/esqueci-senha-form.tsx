'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Mail } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { solicitarRecuperacaoSenha } from '@/lib/recuperacao-senha-api';

const API_PADRAO = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function EsqueciSenhaForm() {
  const [apiUrl, setApiUrl] = useState(API_PADRAO);
  const [tenantSlug, setTenantSlug] = useState('clinica-carla');
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
      const resposta = await solicitarRecuperacaoSenha({ apiUrl, tenantSlug, email });
      setMensagem(resposta.mensagem);
      setLink(resposta.linkRecuperacao ?? null);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao solicitar redefinicao.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-fundo px-6 py-10 text-tinta">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <header>
          <p className="text-xs font-semibold uppercase text-texto-suave">OctaClin</p>
          <h1 className="mt-1 text-3xl font-bold">Recuperar senha</h1>
        </header>

        <form onSubmit={enviar} className="grid gap-4 rounded-lg border border-linha bg-white p-5">
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

          {erro ? <div className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">{erro}</div> : null}
          {mensagem ? (
            <div className="grid gap-2 rounded-md border border-sucesso-borda bg-sucesso-suave px-3 py-2 text-sm text-sucesso-forte">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={16} />
                {mensagem}
              </span>
              {link ? <span className="break-all text-xs text-texto-suave">{link}</span> : null}
            </div>
          ) : null}

          <Botao type="submit" variante="primario" disabled={enviando}>
            <Mail size={16} />
            {enviando ? 'Enviando' : 'Enviar link'}
          </Botao>

          <Link href="/login" className="text-center text-sm font-medium text-primaria hover:underline">
            Voltar para login
          </Link>
        </form>
      </div>
    </main>
  );
}
