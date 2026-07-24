'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo } from '@/components/ui/campo';
import {
  ativarConvitePaciente,
  ConvitePacientePublicoApi,
  ErroApiConvitePaciente,
  obterConvitePaciente
} from '@/lib/convites-paciente-api';

interface PrimeiroAcessoFormProps {
  tokenInicial?: string;
}

type EstadoFalha = 'sem_token' | 'expirado' | 'nao_encontrado' | 'indisponivel';

const conteudoFalha: Record<EstadoFalha, { titulo: string; mensagem: string; detalhe: string }> = {
  sem_token: {
    titulo: 'Link de primeiro acesso indisponivel',
    mensagem: 'Abra o link completo enviado pelo profissional ou solicite um novo acesso.',
    detalhe: 'O link precisa conter o codigo seguro do convite para ativar o portal.'
  },
  expirado: {
    titulo: 'Convite expirado',
    mensagem: 'Solicite um novo acesso para proteger seus dados e concluir a ativacao.',
    detalhe: 'Por seguranca, links antigos deixam de funcionar automaticamente.'
  },
  nao_encontrado: {
    titulo: 'Convite nao encontrado',
    mensagem: 'Confira se o link foi copiado inteiro ou peca um novo convite ao profissional.',
    detalhe: 'Nao encontramos um convite ativo com o codigo informado.'
  },
  indisponivel: {
    titulo: 'Nao foi possivel validar o convite',
    mensagem: 'Tente novamente em instantes ou fale com o profissional para receber um novo link.',
    detalhe: 'A validacao do convite nao retornou uma resposta esperada.'
  }
};

const versaoLegalPaciente = '2026-07';

function formatarData(valor?: string) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function classificarFalha(erroAtual: unknown): { tipo: EstadoFalha; mensagem?: string } {
  if (erroAtual instanceof ErroApiConvitePaciente) {
    if (erroAtual.status === 410) return { tipo: 'expirado', mensagem: erroAtual.message };
    if (erroAtual.status === 404) return { tipo: 'nao_encontrado', mensagem: erroAtual.message };
    return { tipo: 'indisponivel', mensagem: erroAtual.message };
  }

  return {
    tipo: 'indisponivel',
    mensagem: erroAtual instanceof Error ? erroAtual.message : 'Convite invalido ou expirado.'
  };
}

function EstadoFalhaConvite({ tipo, erro }: { tipo: EstadoFalha; erro?: string | null }) {
  const conteudo = conteudoFalha[tipo];

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 rounded-md border border-perigo-borda bg-perigo-suave px-3 py-3 text-sm text-perigo-forte">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-perigo" />
        <div className="grid gap-1">
          <h2 className="text-base font-semibold text-perigo-forte">{conteudo.titulo}</h2>
          <p>{conteudo.mensagem}</p>
          <p className="text-xs text-perigo-forte">{erro || conteudo.detalhe}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href="/recuperar-senha"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-primaria-forte"
        >
          Solicitar novo acesso
        </Link>
        <Link
          href="/login"
          className="inline-flex h-9 items-center justify-center rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta hover:bg-superficie"
        >
          Ir para login
        </Link>
      </div>
    </div>
  );
}

export function PrimeiroAcessoForm({ tokenInicial }: PrimeiroAcessoFormProps) {
  const router = useRouter();
  const [token] = useState(tokenInicial ?? '');
  const [convite, setConvite] = useState<ConvitePacientePublicoApi | null>(null);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [aceiteTermosUso, setAceiteTermosUso] = useState(false);
  const [aceitePoliticaPrivacidade, setAceitePoliticaPrivacidade] = useState(false);
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falhaConvite, setFalhaConvite] = useState<EstadoFalha | null>(null);
  const [ativado, setAtivado] = useState(false);

  const senhaValida = useMemo(() => senha.length >= 8 && senha === confirmacao, [senha, confirmacao]);

  useEffect(() => {
    if (!token) {
      setFalhaConvite('sem_token');
      setCarregando(false);
      return;
    }

    void obterConvitePaciente(token)
      .then((resposta) => {
        setFalhaConvite(null);
        setConvite(resposta);
      })
      .catch((erroAtual) => {
        const falha = classificarFalha(erroAtual);
        setFalhaConvite(falha.tipo);
        setErro(falha.mensagem ?? null);
      })
      .finally(() => setCarregando(false));
  }, [token]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (!senhaValida) {
      setErro('A senha precisa ter ao menos 8 caracteres e bater com a confirmacao.');
      return;
    }
    if (!aceiteTermosUso || !aceitePoliticaPrivacidade || !aceiteLgpd) {
      setErro('Os aceites legais obrigatorios precisam ser marcados para ativar o acesso.');
      return;
    }

    setSalvando(true);
    try {
      const ativacao = await ativarConvitePaciente({
        token,
        senha,
        aceiteTermosUso,
        aceitePoliticaPrivacidade,
        aceiteLgpd,
        versaoTermosUso: versaoLegalPaciente,
        versaoPoliticaPrivacidade: versaoLegalPaciente,
        versaoLgpd: versaoLegalPaciente
      });
      setAtivado(true);
      router.replace((ativacao.destinoInicial || '/portal') as any);
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
          <p className="text-xs font-semibold uppercase text-texto-suave">OctaClin</p>
          <h1 className="mt-1 text-3xl font-bold">Primeiro acesso</h1>
        </header>

        <section className="rounded-lg border border-linha bg-white p-5">
          {carregando ? (
            <div className="flex items-center gap-2 text-sm text-texto-suave">
              <Loader2 size={16} className="animate-spin text-primaria" />
              Validando convite
            </div>
          ) : null}

          {!carregando && ativado ? (
            <div className="grid gap-4">
              <div className="flex items-start gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
                <span>Acesso ativado. Agora voce pode entrar no portal do paciente.</span>
              </div>
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-primaria-forte"
              >
                Ir para login
              </Link>
            </div>
          ) : null}

          {!carregando && !ativado && convite ? (
            <form onSubmit={enviar} className="grid gap-4">
              <div className="rounded-md border border-linha bg-superficie px-3 py-3 text-sm">
                <p className="font-medium">{convite.nomePaciente}</p>
                <p className="mt-1 text-texto-suave">{convite.email}</p>
                <p className="mt-1 text-xs text-texto-suave">Convite valido ate {formatarData(convite.expiraEm)}</p>
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

              <label className="flex items-start gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-texto-suave">
                <input
                  type="checkbox"
                  checked={aceiteTermosUso}
                  onChange={(evento) => setAceiteTermosUso(evento.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                Aceito os Termos de uso do OctaClin, versao {versaoLegalPaciente}.
              </label>

              <label className="flex items-start gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-texto-suave">
                <input
                  type="checkbox"
                  checked={aceitePoliticaPrivacidade}
                  onChange={(evento) => setAceitePoliticaPrivacidade(evento.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                Aceito a Politica de privacidade, versao {versaoLegalPaciente}.
              </label>

              <label className="flex items-start gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-texto-suave">
                <input
                  type="checkbox"
                  checked={aceiteLgpd}
                  onChange={(evento) => setAceiteLgpd(evento.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                Autorizo o tratamento dos meus dados de saude para uso do portal OctaClin e acompanhamento clinico.
              </label>

              {erro ? <div className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">{erro}</div> : null}

              <Botao type="submit" variante="primario" disabled={salvando}>
                <KeyRound size={16} />
                {salvando ? 'Ativando' : 'Ativar acesso'}
              </Botao>
            </form>
          ) : null}

          {!carregando && !ativado && !convite ? (
            <EstadoFalhaConvite tipo={falhaConvite ?? 'nao_encontrado'} erro={erro} />
          ) : null}
        </section>
      </div>
    </main>
  );
}
