'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo } from '@/components/ui/campo';
import { ativarConvitePaciente, ConvitePacientePublicoApi, obterConvitePaciente } from '@/lib/convites-paciente-api';

interface PrimeiroAcessoFormProps {
  tokenInicial?: string;
}

function formatarData(valor?: string) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

export function PrimeiroAcessoForm({ tokenInicial }: PrimeiroAcessoFormProps) {
  const [token] = useState(tokenInicial ?? '');
  const [convite, setConvite] = useState<ConvitePacientePublicoApi | null>(null);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ativado, setAtivado] = useState(false);

  const senhaValida = useMemo(() => senha.length >= 8 && senha === confirmacao, [senha, confirmacao]);

  useEffect(() => {
    if (!token) {
      setErro('Link de primeiro acesso invalido.');
      setCarregando(false);
      return;
    }

    void obterConvitePaciente(token)
      .then((resposta) => setConvite(resposta))
      .catch((erroAtual) => setErro(erroAtual instanceof Error ? erroAtual.message : 'Convite invalido ou expirado.'))
      .finally(() => setCarregando(false));
  }, [token]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (!senhaValida) {
      setErro('A senha precisa ter ao menos 8 caracteres e bater com a confirmacao.');
      return;
    }
    if (!aceiteLgpd) {
      setErro('O aceite LGPD e obrigatorio para ativar o acesso.');
      return;
    }

    setSalvando(true);
    try {
      await ativarConvitePaciente({ token, senha, aceiteLgpd, versaoLgpd: '2026-07' });
      setAtivado(true);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao ativar acesso.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen bg-fundo px-6 py-10 text-tinta">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <header>
          <p className="text-xs font-semibold uppercase text-[#596273]">OctaClin</p>
          <h1 className="mt-1 text-3xl font-bold">Primeiro acesso</h1>
        </header>

        <section className="rounded-lg border border-linha bg-white p-5">
          {carregando ? (
            <div className="flex items-center gap-2 text-sm text-[#596273]">
              <Loader2 size={16} className="animate-spin text-primaria" />
              Validando convite
            </div>
          ) : null}

          {!carregando && ativado ? (
            <div className="grid gap-4">
              <div className="flex items-start gap-2 rounded-lg border border-[#b8dfc1] bg-[#eef7f0] px-4 py-3 text-sm text-[#245b33]">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                <span>Acesso ativado. Agora voce pode entrar no portal do paciente.</span>
              </div>
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-[#1d6684]"
              >
                Ir para login
              </Link>
            </div>
          ) : null}

          {!carregando && !ativado && convite ? (
            <form onSubmit={enviar} className="grid gap-4">
              <div className="rounded-md border border-linha bg-[#f8fafb] px-3 py-3 text-sm">
                <p className="font-medium">{convite.nomePaciente}</p>
                <p className="mt-1 text-[#596273]">{convite.email}</p>
                <p className="mt-1 text-xs text-[#596273]">Convite valido ate {formatarData(convite.expiraEm)}</p>
              </div>

              <label className="grid gap-1">
                <Rotulo>Senha</Rotulo>
                <Campo
                  type="password"
                  value={senha}
                  onChange={(evento) => setSenha(evento.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className="grid gap-1">
                <Rotulo>Confirmar senha</Rotulo>
                <Campo
                  type="password"
                  value={confirmacao}
                  onChange={(evento) => setConfirmacao(evento.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className="flex items-start gap-2 rounded-md border border-linha bg-[#f8fafb] px-3 py-2 text-sm text-[#596273]">
                <input
                  type="checkbox"
                  checked={aceiteLgpd}
                  onChange={(evento) => setAceiteLgpd(evento.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                Declaro que aceito o tratamento dos meus dados para uso do portal OctaClin e acompanhamento clinico.
              </label>

              {erro ? <div className="rounded-md border border-[#efb8ad] bg-[#fff4f1] px-3 py-2 text-sm text-perigo">{erro}</div> : null}

              <Botao type="submit" variante="primario" disabled={salvando}>
                <KeyRound size={16} />
                {salvando ? 'Ativando' : 'Ativar acesso'}
              </Botao>
            </form>
          ) : null}

          {!carregando && !ativado && !convite ? (
            <div className="rounded-md border border-[#efb8ad] bg-[#fff4f1] px-3 py-2 text-sm text-perigo">
              {erro ?? 'Convite nao encontrado.'}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
