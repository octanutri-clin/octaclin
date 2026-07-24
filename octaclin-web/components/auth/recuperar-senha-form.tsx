'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { redefinirSenha, TokenRecuperacaoSenhaApi, validarTokenRecuperacaoSenha } from '@/lib/recuperacao-senha-api';

interface RecuperarSenhaFormProps {
  tokenInicial?: string;
}

function formatarData(valor?: string) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

export function RecuperarSenhaForm({ tokenInicial }: RecuperarSenhaFormProps) {
  const [token] = useState(tokenInicial ?? '');
  const [dadosToken, setDadosToken] = useState<TokenRecuperacaoSenhaApi | null>(null);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const senhaValida = useMemo(() => senha.length >= 8 && senha === confirmacao, [senha, confirmacao]);

  useEffect(() => {
    if (!token) {
      setErro('Link de redefinicao invalido.');
      setCarregando(false);
      return;
    }

    void validarTokenRecuperacaoSenha(token)
      .then((resposta) => setDadosToken(resposta))
      .catch((erroAtual) => setErro(erroAtual instanceof Error ? erroAtual.message : 'Token invalido ou expirado.'))
      .finally(() => setCarregando(false));
  }, [token]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (!senhaValida) {
      setErro('A senha precisa ter ao menos 8 caracteres e bater com a confirmacao.');
      return;
    }

    setSalvando(true);
    try {
      await redefinirSenha(token, senha);
      setSucesso(true);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao redefinir senha.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen bg-fundo px-6 py-10 text-tinta">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <header>
          <p className="text-xs font-semibold uppercase text-texto-suave">OctaClin</p>
          <h1 className="mt-1 text-3xl font-bold">Nova senha</h1>
        </header>

        <Cartao>
          <CartaoConteudo>
          {carregando ? (
            <div className="flex items-center gap-2 text-sm text-texto-suave">
              <Loader2 size={16} className="animate-spin text-primaria" />
              Validando link
            </div>
          ) : null}

          {!carregando && sucesso ? (
            <div className="grid gap-4">
              <div className="flex items-start gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                <span>Senha redefinida. Entre novamente com a nova senha.</span>
              </div>
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-primaria-forte"
              >
                Ir para login
              </Link>
            </div>
          ) : null}

          {!carregando && !sucesso && dadosToken ? (
            <form onSubmit={enviar} className="grid gap-4">
              <div className="rounded-md border border-linha bg-superficie px-3 py-3 text-sm">
                <p className="font-medium">{dadosToken.email}</p>
                <p className="mt-1 text-xs text-texto-suave">Link valido ate {formatarData(dadosToken.expiraEm)}</p>
              </div>

              <label className="grid gap-1">
                <Rotulo>Nova senha</Rotulo>
                <Campo type="password" value={senha} onChange={(event) => setSenha(event.target.value)} autoComplete="new-password" required />
              </label>

              <label className="grid gap-1">
                <Rotulo>Confirmar senha</Rotulo>
                <Campo
                  type="password"
                  value={confirmacao}
                  onChange={(event) => setConfirmacao(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              {erro ? <div className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">{erro}</div> : null}

              <Botao type="submit" variante="primario" disabled={salvando}>
                <KeyRound size={16} />
                {salvando ? 'Salvando' : 'Redefinir senha'}
              </Botao>
            </form>
          ) : null}

          {!carregando && !sucesso && !dadosToken ? (
            <div className="grid gap-3">
              <div className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">
                {erro ?? 'Link invalido ou expirado.'}
              </div>
              <Link href={'/esqueci-senha' as any} className="text-sm font-medium text-primaria hover:underline">
                Solicitar novo link
              </Link>
            </div>
          ) : null}
          </CartaoConteudo>
        </Cartao>
      </div>
    </main>
  );
}
