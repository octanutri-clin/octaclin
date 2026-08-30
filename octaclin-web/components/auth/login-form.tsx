'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Copy, LogIn, ShieldCheck } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { CampoSenha } from '@/components/auth/campo-senha';
import { AuthShell } from '@/components/auth/auth-shell';
import {
  autenticar,
  concluirLoginMfa,
  obterConfiguracaoMfaLogin,
  type ConfiguracaoMfaPublica
} from '@/lib/auth-api';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [modoMfa, setModoMfa] = useState<'configurar' | 'verificar'>();
  const [configuracaoMfa, setConfiguracaoMfa] = useState<ConfiguracaoMfaPublica>();
  const [codigo, setCodigo] = useState('');
  const [codigosRecuperacao, setCodigosRecuperacao] = useState<string[]>([]);
  const [destinoAposMfa, setDestinoAposMfa] = useState<string>();

  function redirecionar(destinoInicial?: string) {
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    const destino = (
      redirect?.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/api')
        ? redirect
        : destinoInicial ?? '/operacoes'
    ) as Route;
    router.replace(destino);
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const sessao = await autenticar({ email, senha });
      if ('mfaObrigatorio' in sessao) {
        setModoMfa(sessao.modo);
        setSenha('');
        if (sessao.modo === 'configurar') setConfiguracaoMfa(await obterConfiguracaoMfaLogin());
        return;
      }
      redirecionar(sessao.destinoInicial);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao autenticar.');
    } finally {
      setEnviando(false);
    }
  }

  async function enviarMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const resultado = await concluirLoginMfa(codigo.trim().toUpperCase());
      if (resultado.codigosRecuperacao.length) {
        setDestinoAposMfa(resultado.destinoInicial);
        setCodigosRecuperacao(resultado.codigosRecuperacao);
        return;
      }
      redirecionar(resultado.destinoInicial);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao verificar o código.');
    } finally {
      setEnviando(false);
    }
  }

  if (codigosRecuperacao.length) {
    return (
      <AuthShell titulo="Códigos de recuperação" subtitulo="Guarde estes códigos em um local seguro. Cada código funciona uma única vez.">
        <div className="grid gap-4">
          <ul className="grid grid-cols-2 gap-2 rounded-md border border-linha bg-superficie p-3 font-mono text-sm" aria-label="Códigos de recuperação">
            {codigosRecuperacao.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <Botao type="button" variante="secundario" onClick={() => void navigator.clipboard.writeText(codigosRecuperacao.join('\n'))}>
            <Copy size={16} aria-hidden="true" /> Copiar códigos
          </Botao>
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
        <form onSubmit={enviarMfa} className="grid gap-4">
          {configuracaoMfa ? (
            <div className="grid gap-2 rounded-md border border-linha bg-superficie p-3">
              <p className="text-xs text-texto-suave">Chave de configuração manual</p>
              <code className="break-all text-sm font-semibold text-tinta">{configuracaoMfa.segredo}</code>
              <Botao type="button" tamanho="sm" variante="secundario" onClick={() => void navigator.clipboard.writeText(configuracaoMfa.segredo)}>
                <Copy size={14} aria-hidden="true" /> Copiar chave
              </Botao>
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
            />
          </div>
          {erro ? <div role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">{erro}</div> : null}
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
      <form onSubmit={enviar} className="grid gap-4">
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
