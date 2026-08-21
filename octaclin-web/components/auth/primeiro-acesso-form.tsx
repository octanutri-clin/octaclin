'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Rotulo } from '@/components/ui/campo';
import { CampoSenha } from '@/components/auth/campo-senha';
import { AuthShell } from '@/components/auth/auth-shell';
import { EstadoFalhaToken } from '@/components/auth/estado-falha-token';
import { classificarFalhaToken, type EstadoFalhaToken as TipoFalhaToken } from '@/lib/classificar-falha-token';
import { ativarConvitePaciente, ConvitePacientePublicoApi, obterConvitePaciente } from '@/lib/convites-paciente-api';

interface PrimeiroAcessoFormProps {
  tokenInicial?: string;
}

type Etapa = 'senha' | 'aceites';

const conteudoFalha: Record<TipoFalhaToken, { titulo: string; mensagem: string; detalhe: string }> = {
  sem_token: {
    titulo: 'Link de primeiro acesso indisponível',
    mensagem: 'Abra o link completo enviado pelo profissional ou solicite um novo acesso.',
    detalhe: 'O link precisa conter o código seguro do convite para ativar o portal.'
  },
  expirado: {
    titulo: 'Convite expirado',
    mensagem: 'Solicite um novo acesso para proteger seus dados e concluir a ativação.',
    detalhe: 'Por segurança, links antigos deixam de funcionar automaticamente.'
  },
  nao_encontrado: {
    titulo: 'Convite não encontrado',
    mensagem: 'Confira se o link foi copiado inteiro ou peca um novo convite ao profissional.',
    detalhe: 'Não encontramos um convite ativo com o código informado.'
  },
  indisponivel: {
    titulo: 'Não foi possível validar o convite',
    mensagem: 'Tente novamente em instantes ou fale com o profissional para receber um novo link.',
    detalhe: 'A validação do convite não retornou uma resposta esperada.'
  }
};

const acoesFalha = [
  { label: 'Solicitar novo acesso', href: '/recuperar-senha' },
  { label: 'Ir para login', href: '/login' }
];

const versaoLegalPaciente = '2026-07';

function formatarData(valor?: string) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

export function PrimeiroAcessoForm({ tokenInicial }: PrimeiroAcessoFormProps) {
  const router = useRouter();
  const [token] = useState(tokenInicial ?? '');
  const [convite, setConvite] = useState<ConvitePacientePublicoApi | null>(null);
  const [etapa, setEtapa] = useState<Etapa>('senha');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [aceiteTermosUso, setAceiteTermosUso] = useState(false);
  const [aceitePoliticaPrivacidade, setAceitePoliticaPrivacidade] = useState(false);
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falhaConvite, setFalhaConvite] = useState<TipoFalhaToken | null>(null);
  const [ativado, setAtivado] = useState(false);
  const tituloEtapaRef = useRef<HTMLHeadingElement>(null);

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
        const falha = classificarFalhaToken(erroAtual, 'Convite invalido ou expirado.');
        setFalhaConvite(falha.tipo);
        setErro(falha.mensagem ?? null);
      })
      .finally(() => setCarregando(false));
  }, [token]);

  useEffect(() => {
    tituloEtapaRef.current?.focus();
  }, [etapa]);

  function avancarParaAceites() {
    setErro(null);
    if (!senhaValida) {
      setErro('A senha precisa ter ao menos 8 caracteres e bater com a confirmação.');
      return;
    }
    setEtapa('aceites');
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

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
      router.replace((ativacao.destinoInicial || '/portal') as Route);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao ativar acesso.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AuthShell titulo="Primeiro acesso">
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
            <span>Acesso ativado. Agora você pode entrar no portal do paciente.</span>
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
        <div className="grid gap-4">
          <div className="rounded-md border border-linha bg-superficie px-3 py-3 text-sm">
            <p className="font-medium">{convite.nomePaciente}</p>
            <p className="mt-1 text-texto-suave">{convite.email}</p>
            <p className="mt-1 text-xs text-texto-suave">Convite válido até {formatarData(convite.expiraEm)}</p>
          </div>

          <h2
            ref={tituloEtapaRef}
            tabIndex={-1}
            className="text-xs font-semibold uppercase text-texto-suave outline-none"
          >
            {etapa === 'senha' ? 'Etapa 1 de 2 - Defina sua senha' : 'Etapa 2 de 2 - Aceites legais'}
          </h2>

          {etapa === 'senha' ? (
            <div className="grid gap-4">
              <div className="grid gap-1">
                <Rotulo htmlFor="primeiro-acesso-senha">Senha</Rotulo>
                <CampoSenha
                  id="primeiro-acesso-senha"
                  value={senha}
                  onChange={(evento) => setSenha(evento.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="grid gap-1">
                <Rotulo htmlFor="primeiro-acesso-confirmacao">Confirmar senha</Rotulo>
                <CampoSenha
                  id="primeiro-acesso-confirmacao"
                  value={confirmacao}
                  onChange={(evento) => setConfirmacao(evento.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              {erro ? (
                <div role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">
                  {erro}
                </div>
              ) : null}

              <Botao type="button" variante="primario" onClick={avancarParaAceites}>
                Continuar
              </Botao>
            </div>
          ) : (
            <form onSubmit={enviar} className="grid gap-4">
              <label className="flex items-start gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-texto-suave">
                <input
                  type="checkbox"
                  checked={aceiteTermosUso}
                  onChange={(evento) => setAceiteTermosUso(evento.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                Aceito os Termos de uso do OctaClin, versão {versaoLegalPaciente}.
              </label>

              <label className="flex items-start gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-texto-suave">
                <input
                  type="checkbox"
                  checked={aceitePoliticaPrivacidade}
                  onChange={(evento) => setAceitePoliticaPrivacidade(evento.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                Aceito a Política de privacidade, versão {versaoLegalPaciente}.
              </label>

              <label className="flex items-start gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-texto-suave">
                <input
                  type="checkbox"
                  checked={aceiteLgpd}
                  onChange={(evento) => setAceiteLgpd(evento.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                Autorizo o tratamento dos meus dados de saude para uso do portal OctaClin e acompanhamento clínico.
              </label>

              {erro ? (
                <div role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">
                  {erro}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Botao type="button" variante="secundario" onClick={() => setEtapa('senha')}>
                  Voltar
                </Botao>
                <Botao type="submit" variante="primario" disabled={salvando}>
                  <KeyRound size={16} />
                  {salvando ? 'Ativando' : 'Ativar acesso'}
                </Botao>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {!carregando && !ativado && !convite ? (
        <EstadoFalhaToken tipo={falhaConvite ?? 'nao_encontrado'} conteudo={conteudoFalha} erro={erro} acoes={acoesFalha} />
      ) : null}
    </AuthShell>
  );
}
