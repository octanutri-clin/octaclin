'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo } from '@/components/ui/campo';
import { ModalConfirmacao } from '@/components/ui/modal';
import {
  ErroRestricoesPortal,
  cancelarPedidoRestricaoPortal,
  criarPedidoRestricaoPortal,
  declararRestricaoPortal,
  type FalhaRestricoesPortal
} from '@/lib/restricoes-portal-api';
import type { TipoDeclaracaoPortal } from '@/lib/restricoes-portal';
import {
  ERROS_RESTRICOES,
  TEXTOS_PORTAL_RESTRICOES as T,
  TIPOS_DECLARACAO_PORTAL,
  type ContextoPessoaPortal
} from '@/lib/textos-restricoes';

/**
 * Escrita do portal (FOOD06 P3-2): informar restrição, pedir correção ou remoção e cancelar o próprio pedido.
 * - A chave de criação nasce ao abrir o formulário e é reutilizada ao repetir depois de um resultado incerto
 *   (o backend é idempotente por chave); só um envio confirmado gera chave nova.
 * - O texto digitado fica só no estado do componente: nada vai para armazenamento do navegador.
 * - Erros com mensagem fixa; o texto do servidor nunca aparece.
 */

const novaChave = () => crypto.randomUUID();
const tipoDe = (falha: unknown): FalhaRestricoesPortal => (falha instanceof ErroRestricoesPortal ? falha.tipo : 'incerto');

function mensagemEscrita(tipo: FalhaRestricoesPortal) {
  if (tipo === 'incerto') return T.incertoEnvio;
  if (tipo === 'sessao') return ERROS_RESTRICOES.sessao;
  if (tipo === 'semAcesso') return `${ERROS_RESTRICOES.semAcesso} ${T.semAcessoCaminho}`;
  if (tipo === 'mudou') return ERROS_RESTRICOES.mudou;
  if (tipo === 'invalida') return ERROS_RESTRICOES.invalida;
  return ERROS_RESTRICOES.leitura;
}

// Cola com quebra de linha vira espaço, em vez de recusar (NUX-12).
const umaLinha = (valor: string) => valor.replace(/[\r\n\t]+/g, ' ');

export function FormularioInformarRestricao({ pacienteId, ctx, noLimite, aoEnviar }: {
  pacienteId: string;
  ctx: ContextoPessoaPortal;
  noLimite: boolean;
  aoEnviar: (mensagem: string) => void;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoDeclaracaoPortal | ''>('');
  const [alimento, setAlimento] = useState('');
  const [chave, setChave] = useState(novaChave);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<FalhaRestricoesPortal | null>(null);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeiroTipo = useRef<HTMLInputElement>(null);
  const campoAlimento = useRef<HTMLInputElement>(null);

  useEffect(() => { if (aberto) titulo.current?.focus(); }, [aberto]);

  // PUX-18: no limite, a pessoa ainda tem um caminho para avisar algo novo.
  if (noLimite) {
    return (
      <p className="rounded-md border border-linha p-3 text-sm text-tinta">
        {T.limiteDeclaracoes}{' '}
        <Link href="/portal/mensagens" className="font-medium text-primaria-forte underline underline-offset-2">{T.linkMensagens}</Link>
      </p>
    );
  }
  if (!aberto) return <Botao variante="secundario" onClick={() => setAberto(true)}>{T.informarAbrir(ctx)}</Botao>;

  const alimentoLimpo = alimento.trim();
  const faltaTipo = tentouEnviar && !tipo;
  const faltaAlimento = tentouEnviar && !alimentoLimpo;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    setTentouEnviar(true);
    // PUX-21: o foco vai para o primeiro campo com erro.
    if (!tipo) { primeiroTipo.current?.focus(); return; }
    if (!alimentoLimpo) { campoAlimento.current?.focus(); return; }
    if (enviando) return;
    setEnviando(true);
    setFalha(null);
    try {
      await declararRestricaoPortal(pacienteId, { chaveCriacao: chave, tipo, alimento: alimentoLimpo });
      setChave(novaChave());
      setAberto(false);
      setTipo('');
      setAlimento('');
      setTentouEnviar(false);
      // NUX-27: depois de informar algo clínico, repete o aviso de urgência na confirmação.
      aoEnviar(tipo === 'escolha' ? T.informarSucesso(ctx) : `${T.informarSucesso(ctx)} ${T.urgencia(ctx)}`);
    } catch (erro) {
      setFalha(tipoDe(erro));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form noValidate onSubmit={enviar} aria-labelledby={`${id}-titulo`} className="grid gap-3 rounded-md border border-linha p-3">
      <h3 id={`${id}-titulo`} ref={titulo} tabIndex={-1} className="text-base font-semibold text-tinta focus:outline-none">{T.informarAbrir(ctx)}</h3>
      <p role="note" className="rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm text-tinta">{T.urgencia(ctx)}</p>
      <fieldset className="grid gap-2" aria-describedby={faltaTipo ? `${id}-erro-tipo` : undefined}>
        <legend className="mb-1 text-sm font-medium text-tinta">{T.informarTipoPergunta}</legend>
        {TIPOS_DECLARACAO_PORTAL.map((t, indice) => (
          <label key={t.valor} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-linha px-3 py-2 focus-within:ring-2 focus-within:ring-primaria">
            <input ref={indice === 0 ? primeiroTipo : undefined} type="radio" name={`${id}-tipo`} value={t.valor} checked={tipo === t.valor} onChange={() => setTipo(t.valor)} className="mt-1 h-5 w-5" aria-describedby={`${id}-ajuda-${t.valor}${faltaTipo ? ` ${id}-erro-tipo` : ''}`} />
            <span className="grid">
              <span className="font-medium text-tinta">{t.rotulo}</span>
              <span id={`${id}-ajuda-${t.valor}`} className="text-sm text-texto-suave">{t.ajuda}</span>
            </span>
          </label>
        ))}
        {faltaTipo ? <p id={`${id}-erro-tipo`} className="text-sm text-perigo-forte">{T.faltaTipo}</p> : null}
      </fieldset>
      <div className="grid gap-1">
        <Rotulo htmlFor={`${id}-alimento`}>{T.informarAlimento}</Rotulo>
        <Campo
          ref={campoAlimento}
          id={`${id}-alimento`}
          value={alimento}
          maxLength={200}
          required
          aria-required="true"
          aria-invalid={faltaAlimento || undefined}
          aria-describedby={`${id}-alimento-ajuda${faltaAlimento ? ` ${id}-erro-alimento` : ''}`}
          onChange={(e) => setAlimento(umaLinha(e.target.value))}
        />
        <p id={`${id}-alimento-ajuda`} className="text-sm text-texto-suave">{T.informarAlimentoAjuda}</p>
        {faltaAlimento ? <p id={`${id}-erro-alimento`} className="text-sm text-perigo-forte">{T.faltaAlimento}</p> : null}
      </div>
      {falha ? <p role="alert" className="text-sm text-tinta">{mensagemEscrita(falha)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" variante="primario" carregando={enviando} disabled={enviando}>{falha === 'incerto' ? T.tentarDeNovo : T.informarEnviar}</Botao>
        <Botao type="button" variante="secundario" onClick={() => { setAberto(false); setFalha(null); setTentouEnviar(false); }} disabled={enviando}>{T.fecharFormulario}</Botao>
      </div>
    </form>
  );
}

export function FormularioPedido({ pacienteId, restricaoId, alimento, ctx, noLimite, aoEnviar }: {
  pacienteId: string;
  restricaoId: string;
  alimento: string;
  ctx: ContextoPessoaPortal;
  noLimite: boolean;
  aoEnviar: (mensagem: string) => void;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<'correcao' | 'remocao'>('correcao');
  const [texto, setTexto] = useState('');
  const [chave, setChave] = useState(novaChave);
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<FalhaRestricoesPortal | null>(null);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (aberto) campo.current?.focus(); }, [aberto]);

  if (!aberto) {
    return (
      // Com o limite de pedidos abertos atingido, o botão some e a lista mostra o motivo uma vez (texto visível).
      noLimite ? null : (
        <Botao variante="secundario" tamanho="sm" className="mt-2" aria-label={T.pedirAbrirDe(ctx, alimento)} onClick={() => setAberto(true)}>
          {T.pedirAbrir}
        </Botao>
      )
    );
  }

  const textoLimpo = texto.trim();
  const faltaTexto = tentouEnviar && !textoLimpo;

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    setTentouEnviar(true);
    if (!textoLimpo || enviando) return;
    setEnviando(true);
    setFalha(null);
    try {
      await criarPedidoRestricaoPortal(pacienteId, { chaveCriacao: chave, tipo, restricaoId, texto: textoLimpo });
      setChave(novaChave());
      setAberto(false);
      setTexto('');
      setTentouEnviar(false);
      aoEnviar(T.pedirSucesso);
    } catch (erro) {
      setFalha(tipoDe(erro));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form noValidate onSubmit={enviar} aria-label={T.pedirAbrirDe(ctx, alimento)} className="mt-2 grid gap-3 rounded-md border border-linha p-3">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-tinta">{T.pedirTipoPergunta}</legend>
        {([['correcao', T.pedirCorrecao], ['remocao', T.pedirRemocao]] as const).map(([valor, rotulo]) => (
          <label key={valor} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-linha px-3 py-2 focus-within:ring-2 focus-within:ring-primaria">
            <input type="radio" name={`${id}-tipo`} value={valor} checked={tipo === valor} onChange={() => setTipo(valor)} className="h-5 w-5" />
            <span className="text-tinta">{rotulo}</span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-1">
        <Rotulo htmlFor={`${id}-texto`}>{tipo === 'remocao' ? T.pedirTextoRemocao : T.pedirTexto}</Rotulo>
        <AreaTexto
          id={`${id}-texto`}
          ref={campo}
          value={texto}
          maxLength={1000}
          rows={3}
          required
          aria-required="true"
          aria-invalid={faltaTexto || undefined}
          aria-describedby={faltaTexto ? `${id}-erro` : undefined}
          onChange={(e) => setTexto(e.target.value)}
        />
        {faltaTexto ? <p id={`${id}-erro`} className="text-sm text-perigo-forte">{T.faltaTexto}</p> : null}
      </div>
      {falha ? <p role="alert" className="text-sm text-tinta">{mensagemEscrita(falha)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" variante="primario" carregando={enviando} disabled={enviando}>{falha === 'incerto' ? T.tentarDeNovo : T.pedirEnviar}</Botao>
        <Botao type="button" variante="secundario" onClick={() => { setAberto(false); setFalha(null); setTentouEnviar(false); }} disabled={enviando}>{T.fecharFormulario}</Botao>
      </div>
    </form>
  );
}

export function BotaoCancelarPedido({ pacienteId, solicitacaoId, aoCancelar }: {
  pacienteId: string;
  solicitacaoId: string;
  aoCancelar: (mensagem: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [falha, setFalha] = useState<FalhaRestricoesPortal | null>(null);

  async function confirmar() {
    setCancelando(true);
    setFalha(null);
    try {
      await cancelarPedidoRestricaoPortal(pacienteId, solicitacaoId);
      setAberto(false);
      aoCancelar(T.cancelarSucesso);
    } catch (erro) {
      setAberto(false);
      setFalha(tipoDe(erro));
    } finally {
      setCancelando(false);
    }
  }

  return (
    <>
      <Botao variante="secundario" tamanho="sm" className="mt-2" onClick={() => setAberto(true)}>{T.cancelarAbrir}</Botao>
      {falha ? <p role="alert" className="mt-1 text-sm text-tinta">{mensagemEscrita(falha)}</p> : null}
      <ModalConfirmacao
        aberto={aberto}
        titulo={T.cancelarTitulo}
        mensagem={T.cancelarMensagem}
        rotuloCancelar={T.cancelarNao}
        rotuloConfirmar={T.cancelarSim}
        confirmando={cancelando}
        aoConfirmar={() => void confirmar()}
        aoCancelar={() => setAberto(false)}
      />
    </>
  );
}
