'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Rotulo } from '@/components/ui/campo';
import { CampoSenha } from '@/components/auth/campo-senha';
import { AuthShell } from '@/components/auth/auth-shell';
import { EstadoFalhaToken } from '@/components/auth/estado-falha-token';
import { classificarFalhaToken, type EstadoFalhaToken as TipoFalhaToken } from '@/lib/classificar-falha-token';
import { redefinirSenha, TokenRecuperacaoSenhaApi, validarTokenRecuperacaoSenha } from '@/lib/recuperacao-senha-api';

interface RecuperarSenhaFormProps {
  tokenInicial?: string;
}

const conteudoFalha: Record<TipoFalhaToken, { titulo: string; mensagem: string; detalhe: string }> = {
  sem_token: {
    titulo: 'Link de redefinicao indisponível',
    mensagem: 'Abra o link completo enviado por email ou solicite um novo.',
    detalhe: 'O link precisa conter o código seguro de redefinicao.'
  },
  expirado: {
    titulo: 'Link expirado',
    mensagem: 'Solicite um novo link para redefinir sua senha com segurança.',
    detalhe: 'Por segurança, links antigos deixam de funcionar automaticamente.'
  },
  nao_encontrado: {
    titulo: 'Link não encontrado',
    mensagem: 'Confira se o link foi copiado inteiro ou solicite um novo.',
    detalhe: 'Não encontramos uma solicitação de redefinicao ativa com esse código.'
  },
  indisponivel: {
    titulo: 'Não foi possível validar o link',
    mensagem: 'Tente novamente em instantes ou solicite um novo link.',
    detalhe: 'A validação do link não retornou uma resposta esperada.'
  }
};

const acoesFalha = [
  { label: 'Solicitar novo link', href: '/esqueci-senha' },
  { label: 'Ir para login', href: '/login' }
];

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
  const [falhaToken, setFalhaToken] = useState<TipoFalhaToken | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const senhaValida = useMemo(() => senha.length >= 8 && senha === confirmacao, [senha, confirmacao]);

  useEffect(() => {
    if (!token) {
      setFalhaToken('sem_token');
      setCarregando(false);
      return;
    }

    void validarTokenRecuperacaoSenha(token)
      .then((resposta) => {
        setFalhaToken(null);
        setDadosToken(resposta);
      })
      .catch((erroAtual) => {
        const falha = classificarFalhaToken(erroAtual, 'Token invalido ou expirado.');
        setFalhaToken(falha.tipo);
        setErro(falha.mensagem ?? null);
      })
      .finally(() => setCarregando(false));
  }, [token]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (!senhaValida) {
      setErro('A senha precisa ter ao menos 8 caracteres e bater com a confirmação.');
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
    <AuthShell titulo="Nova senha">
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
            <p className="mt-1 text-xs text-texto-suave">Link válido até {formatarData(dadosToken.expiraEm)}</p>
          </div>

          <div className="grid gap-1">
            <Rotulo htmlFor="nova-senha">Nova senha</Rotulo>
            <CampoSenha
              id="nova-senha"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="grid gap-1">
            <Rotulo htmlFor="confirmar-senha">Confirmar senha</Rotulo>
            <CampoSenha
              id="confirmar-senha"
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {erro ? (
            <div role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave px-3 py-2 text-sm text-perigo">
              {erro}
            </div>
          ) : null}

          <Botao type="submit" variante="primario" disabled={salvando}>
            <KeyRound size={16} />
            {salvando ? 'Salvando' : 'Redefinir senha'}
          </Botao>
        </form>
      ) : null}

      {!carregando && !sucesso && !dadosToken ? (
        <EstadoFalhaToken tipo={falhaToken ?? 'indisponivel'} conteudo={conteudoFalha} erro={erro} acoes={acoesFalha} />
      ) : null}
    </AuthShell>
  );
}
