'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { LogIn, ShieldCheck } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { CampoSenha } from '@/components/auth/campo-senha';
import { AuthShell } from '@/components/auth/auth-shell';
import { CopiarConteudoMfa } from '@/components/auth/copiar-conteudo-mfa';
import {
  autenticar,
  concluirLoginMfa,
  obterConfiguracaoMfaLogin,
  ErroApiAutenticacao,
  type ConfiguracaoMfaPublica
} from '@/lib/auth-api';
import { sanitizarDestinoInterno } from '@/lib/destino-interno';

function mensagemPublica(erro: unknown, mfa: boolean) {
  if (erro instanceof ErroApiAutenticacao) {
    if (erro.status === 429) return 'Muitas tentativas. Aguarde antes de tentar novamente.';
    if (erro.status >= 500) return 'Não foi possível acessar o serviço agora. Tente novamente em instantes.';
    if ([400, 401, 403].includes(erro.status)) {
      return mfa
        ? 'Não foi possível verificar o código. Confira o código do aplicativo ou um código de recuperação e tente novamente.'
        : 'Não foi possível entrar. Confira os dados de acesso e tente novamente.';
    }
  }
  return 'Não foi possível concluir a solicitação. Tente novamente.';
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<{ mensagem: string } | null>(null);
  const erroId = useId();
  const avisoRef = useRef<HTMLDivElement>(null);
  const operacaoPendente = useRef(false);
  const montado = useRef(true);
  const [enviando, setEnviando] = useState(false);
  const [modoMfa, setModoMfa] = useState<'configurar' | 'verificar'>();
  const [configuracaoMfa, setConfiguracaoMfa] = useState<ConfiguracaoMfaPublica>();
  const [codigo, setCodigo] = useState('');
  const [codigosRecuperacao, setCodigosRecuperacao] = useState<string[]>([]);
  const [destinoAposMfa, setDestinoAposMfa] = useState<string>();

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  useEffect(() => {
    if (erro) avisoRef.current?.focus();
  }, [erro]);

  function redirecionar(destinoInicial?: string) {
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    const destinoPadrao = sanitizarDestinoInterno(destinoInicial, '/operacoes');
    const destino = sanitizarDestinoInterno(redirect ?? undefined, destinoPadrao) as Route;
    router.replace(destino);
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operacaoPendente.current) return;
    operacaoPendente.current = true;
    setErro(null);
    setEnviando(true);

    try {
      const sessao = await autenticar({ email, senha });
      if (!montado.current) return;
      if ('mfaObrigatorio' in sessao) {
        setSenha('');
        if (sessao.modo === 'configurar') {
          const configuracao = await obterConfiguracaoMfaLogin();
          if (!montado.current) return;
          setConfiguracaoMfa(configuracao);
        }
        setModoMfa(sessao.modo);
        return;
      }
      redirecionar(sessao.destinoInicial);
    } catch (erroAtual) {
      if (montado.current) setErro({ mensagem: mensagemPublica(erroAtual, false) });
    } finally {
      operacaoPendente.current = false;
      if (montado.current) setEnviando(false);
    }
  }

  async function enviarMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operacaoPendente.current) return;
    operacaoPendente.current = true;
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await concluirLoginMfa(codigo.trim().toUpperCase());
      if (!montado.current) return;
      if (resultado.codigosRecuperacao.length) {
        setDestinoAposMfa(resultado.destinoInicial);
        setCodigosRecuperacao(resultado.codigosRecuperacao);
        return;
      }
      redirecionar(resultado.destinoInicial);
    } catch (erroAtual) {
      if (montado.current) setErro({ mensagem: mensagemPublica(erroAtual, true) });
    } finally {
      operacaoPendente.current = false;
      if (montado.current) setEnviando(false);
    }
  }

  if (codigosRecuperacao.length) {
    return (
      <AuthShell titulo="Códigos de recuperação" subtitulo="Guarde estes códigos em um local seguro. Cada código funciona uma única vez.">
        <div className="grid gap-4">
          <ul className="grid grid-cols-2 gap-2 rounded-md border border-linha bg-superficie p-3 font-mono text-sm" aria-label="Códigos de recuperação">
            {codigosRecuperacao.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <CopiarConteudoMfa tipo="codigos" texto={codigosRecuperacao.join('\n')} />
          <Botao type="button" variante="primario" onClick={() => redirecionar(destinoAposMfa)}>
            Continuar
          </Botao>
        </div>
      </AuthShell>
    );
  }

  if (modoMfa) {
    return (
      <AuthShell
        titulo={modoMfa === 'configurar' ? 'Proteja sua conta' : 'Verificação em duas etapas'}
        subtitulo={modoMfa === 'configurar' ? 'Adicione a chave no seu aplicativo autenticador e informe o código gerado.' : 'Informe o código do aplicativo autenticador ou um código de recuperação.'}
      >
        <form onSubmit={enviarMfa} aria-busy={enviando} className="grid gap-4">
          {configuracaoMfa ? (
            <div className="grid gap-2 rounded-md border border-linha bg-superficie p-3">
              <p className="text-xs text-texto-suave">Chave de configuração manual</p>
              <code className="break-all text-sm font-semibold text-tinta">{configuracaoMfa.segredo}</code>
              <CopiarConteudoMfa tipo="chave" texto={configuracaoMfa.segredo} compacto />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Rotulo htmlFor="codigo-mfa">Código de verificação</Rotulo>
            <Campo
              id="codigo-mfa"
              value={codigo}
              onChange={(event) => setCodigo(event.target.value)}
              inputMode={modoMfa === 'configurar' ? 'numeric' : 'text'}
              autoComplete="one-time-code"
              placeholder={modoMfa === 'configurar' ? '000000' : '000000 ou XXXX-XXXX-XXXX'}
              required
              autoFocus
              aria-describedby={erro ? erroId : undefined}
            />
          </div>
          {erro ? <div id={erroId} ref={avisoRef} tabIndex={-1} role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">{erro.mensagem}</div> : null}
          <Botao type="submit" variante="primario" disabled={enviando} className="w-full">
            <ShieldCheck size={16} aria-hidden="true" /> {enviando ? 'Verificando' : 'Verificar e entrar'}
          </Botao>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Acesso OctaClin"
      subtitulo="Entre com as credenciais da sua conta."
      rodape={
        <p className="text-center text-xs text-texto-suave">
          Seu acesso é individual e protegido. Não compartilhe sua senha.
        </p>
      }
    >
      <form onSubmit={enviar} aria-busy={enviando} className="grid gap-4">
        <div className="grid gap-1.5">
          <Rotulo htmlFor="email">Email</Rotulo>
          <Campo
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder="você@exemplo.com"
            required
            aria-describedby={erro ? erroId : undefined}
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
            aria-describedby={erro ? erroId : undefined}
          />
        </div>

        {erro ? (
          <div id={erroId} ref={avisoRef} tabIndex={-1} role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">
            {erro.mensagem}
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
