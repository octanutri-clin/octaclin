'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Mail } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { AuthShell } from '@/components/auth/auth-shell';
import { ErroApiRecuperacaoSenha, solicitarRecuperacaoSenha } from '@/lib/recuperacao-senha-api';

type AvisoRecuperacao =
  | { tipo: 'sucesso'; mensagem: string; link?: string }
  | { tipo: 'erro'; mensagem: string };

function mensagemPublica(erro: unknown) {
  if (erro instanceof ErroApiRecuperacaoSenha) {
    if (erro.status === 429) return 'Muitas solicitações. Aguarde antes de tentar novamente.';
    if (erro.status === 400) return 'Não foi possível concluir a solicitação. Confira o email informado e tente novamente.';
  }
  return 'Não foi possível solicitar a recuperação agora. Tente novamente em instantes.';
}

export function EsqueciSenhaForm() {
  const [email, setEmail] = useState('');
  const [aviso, setAviso] = useState<AvisoRecuperacao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const operacaoPendente = useRef(false);
  const revisaoEmail = useRef(0);
  const montado = useRef(true);
  const campoEmail = useRef<HTMLInputElement>(null);
  const painelAviso = useRef<HTMLDivElement>(null);
  const idMensagem = useId();

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  useEffect(() => {
    if (aviso) painelAviso.current?.focus();
  }, [aviso]);

  function corrigirEmail() {
    revisaoEmail.current++;
    setAviso(null);
    campoEmail.current?.focus();
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (operacaoPendente.current) return;
    operacaoPendente.current = true;
    const revisaoSolicitada = revisaoEmail.current;
    setAviso(null);
    setEnviando(true);

    try {
      const resposta = await solicitarRecuperacaoSenha({ email });
      if (!montado.current || revisaoEmail.current !== revisaoSolicitada) return;
      if (!resposta || typeof resposta.mensagem !== 'string') throw new Error('Resposta inválida');
      setAviso({
        tipo: 'sucesso',
        mensagem: 'Se os dados estiverem corretos, enviaremos um link de redefinição de senha.',
        link: typeof resposta.linkRecuperacao === 'string' ? resposta.linkRecuperacao : undefined
      });
    } catch (erroAtual) {
      if (montado.current && revisaoEmail.current === revisaoSolicitada) {
        setAviso({ tipo: 'erro', mensagem: mensagemPublica(erroAtual) });
      }
    } finally {
      operacaoPendente.current = false;
      if (montado.current) setEnviando(false);
    }
  }

  return (
    <AuthShell titulo="Recuperar senha" subtitulo="Informe o email usado no seu acesso.">
      <form onSubmit={enviar} aria-busy={enviando} className="grid gap-4">
        <div className="grid gap-1.5">
          <Rotulo htmlFor="email">Email</Rotulo>
          <Campo
            id="email"
            ref={campoEmail}
            value={email}
            onChange={(event) => {
              revisaoEmail.current++;
              setEmail(event.target.value);
              setAviso(null);
            }}
            type="email"
            autoComplete="email"
            placeholder="você@exemplo.com"
            required
            aria-describedby={aviso ? idMensagem : undefined}
          />
        </div>

        {enviando ? <p role="status" className="text-sm text-texto-suave">Solicitando recuperação…</p> : aviso ? (
          <div
            ref={painelAviso}
            tabIndex={-1}
            role={aviso.tipo === 'erro' ? 'alert' : 'status'}
            className={aviso.tipo === 'erro'
              ? 'rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo'
              : 'grid gap-2 rounded-md border border-sucesso-borda bg-sucesso-suave px-3 py-2 text-sm text-sucesso-forte'}
          >
            <span className="inline-flex items-center gap-2">
              {aviso.tipo === 'sucesso' ? <CheckCircle2 size={16} aria-hidden="true" className="shrink-0" /> : null}
              <span id={idMensagem}>{aviso.mensagem}</span>
            </span>
            {aviso.tipo === 'sucesso' ? (
              <>
                <p>Confira o endereço informado e a pasta de spam ou lixo eletrônico.</p>
                {aviso.link ? <span className="break-all text-xs text-texto-suave">{aviso.link}</span> : null}
              </>
            ) : null}
          </div>
        ) : null}

        <Botao type="submit" variante="primario" disabled={enviando} className="w-full">
          <Mail size={16} aria-hidden="true" />
          {enviando ? 'Enviando' : aviso?.tipo === 'sucesso' ? 'Solicitar novamente' : aviso?.tipo === 'erro' ? 'Tentar novamente' : 'Enviar link'}
        </Botao>

        {!enviando && aviso?.tipo === 'sucesso' ? (
          <Botao type="button" variante="secundario" onClick={corrigirEmail}>Corrigir email</Botao>
        ) : null}

        <Link href="/login" className="text-center text-sm font-medium text-primaria hover:underline">
          Voltar para login
        </Link>
      </form>
    </AuthShell>
  );
}
