'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Botao, classesBotao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Esqueleto, EstadoFalha, EstadoVazio } from '@/components/ui/feedback';
import {
  ErroRestricoesPortal,
  listarPedidosRestricoesPortal,
  listarPessoasRestricoesPortal,
  obterResumoRestricoesPortal,
  restricoesDisponiveisNoPortal,
  type FalhaRestricoesPortal
} from '@/lib/restricoes-portal-api';
import type { ItemResumoPortal, PedidosPortalTela, PessoaSeletorPortal, ResumoPortalTela } from '@/lib/restricoes-portal';
import {
  ERROS_RESTRICOES,
  TEXTOS_PORTAL_RESTRICOES as T,
  textoPedidoPortal,
  textoSeloPortal,
  tituloGrupoPortal,
  type ContextoPessoaPortal,
  type GrupoRestricaoPortal
} from '@/lib/textos-restricoes';

const GRUPOS: GrupoRestricaoPortal[] = ['alergias', 'intolerancias', 'outras', 'escolhas'];
const ORDEM_SELO: Record<string, number> = {
  'restricoes.portal.registrada': 0,
  'restricoes.portal.anotada_pela_equipe': 1,
  'restricoes.portal.informada_por_voce': 2
};

function dataCurta(iso: string) {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(data);
}

function mensagemFalha(tipo: FalhaRestricoesPortal, contexto: 'resumo' | 'geral') {
  if (tipo === 'sessao') return ERROS_RESTRICOES.sessao;
  if (tipo === 'semAcesso') return ERROS_RESTRICOES.semAcesso;
  // No resumo, o 409 do backend é o teto de 200 registros.
  if (tipo === 'mudou') return contexto === 'resumo' ? T.excesso : ERROS_RESTRICOES.mudou;
  return ERROS_RESTRICOES.leitura;
}

const tipoDe = (falha: unknown): FalhaRestricoesPortal => (falha instanceof ErroRestricoesPortal ? falha.tipo : 'leitura');

type EstadoInicial =
  | { fase: 'carregando' }
  | { fase: 'indisponivel' }
  | { fase: 'falha'; tipo: FalhaRestricoesPortal }
  | { fase: 'pronto'; pessoas: PessoaSeletorPortal[]; noLimite: boolean };

/** Área "Restrições alimentares" do portal: própria conta ou representante de várias pessoas. Só leitura (P3-1). */
export function RestricoesPortal() {
  const [inicial, setInicial] = useState<EstadoInicial>({ fase: 'carregando' });
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const carregar = useCallback(async (signal: AbortSignal) => {
    setInicial({ fase: 'carregando' });
    try {
      if (!(await restricoesDisponiveisNoPortal(signal))) return setInicial({ fase: 'indisponivel' });
      const seletor = await listarPessoasRestricoesPortal(signal);
      if (signal.aborted) return;
      setInicial({ fase: 'pronto', pessoas: seletor.itens, noLimite: seletor.noLimite });
      setSelecionado(seletor.itens.length === 1 ? seletor.itens[0].pacienteId : null);
    } catch (falha) {
      if (signal.aborted) return;
      const tipo = tipoDe(falha);
      setInicial(tipo === 'indisponivel' ? { fase: 'indisponivel' } : { fase: 'falha', tipo });
    }
  }, []);

  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    const controle = new AbortController();
    const timer = window.setTimeout(() => void carregar(controle.signal), 0);
    return () => { window.clearTimeout(timer); controle.abort(); };
  }, [carregar, tentativa]);

  if (inicial.fase === 'carregando') {
    return <div role="status" aria-live="polite" className="grid gap-3 p-4"><span className="sr-only">Carregando restrições alimentares</span><Esqueleto className="h-6 w-1/2" /><Esqueleto className="h-24" /></div>;
  }
  if (inicial.fase === 'indisponivel') return <EstadoVazio titulo={T.titulo} descricao={T.indisponivel} />;
  if (inicial.fase === 'falha') {
    return <EstadoFalha titulo={T.titulo} descricao={mensagemFalha(inicial.tipo, 'geral')} aoTentarNovamente={inicial.tipo === 'leitura' ? () => setTentativa((n) => n + 1) : undefined} />;
  }
  if (inicial.pessoas.length === 0) return <EstadoFalha titulo={T.titulo} descricao={ERROS_RESTRICOES.semAcesso} />;

  const pessoa = inicial.pessoas.find((p) => p.pacienteId === selecionado) ?? null;
  return (
    <div className="grid gap-4">
      {inicial.pessoas.length > 1 ? (
        <SeletorPessoa pessoas={inicial.pessoas} noLimite={inicial.noLimite} selecionado={selecionado} aoSelecionar={setSelecionado} />
      ) : null}
      {pessoa ? <ResumoPessoa key={pessoa.pacienteId} pessoa={pessoa} /> : null}
    </div>
  );
}

function SeletorPessoa({ pessoas, noLimite, selecionado, aoSelecionar }: { pessoas: PessoaSeletorPortal[]; noLimite: boolean; selecionado: string | null; aoSelecionar: (id: string) => void }) {
  return (
    <Cartao>
      <CartaoConteudo className="pt-4">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-base font-semibold text-tinta">{T.seletorPergunta}</legend>
          {pessoas.map((p) => (
            <label key={p.pacienteId} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-linha px-3 py-2 focus-within:ring-2 focus-within:ring-primaria">
              <input type="radio" name="pessoa-restricoes" value={p.pacienteId} checked={selecionado === p.pacienteId} onChange={() => aoSelecionar(p.pacienteId)} className="h-5 w-5" />
              <span className="grid">
                <span className="font-medium text-tinta">{p.nome}</span>
                <span className="text-sm text-texto-suave">{p.via === 'propria' ? T.seletorVoce : T.seletorResponsavel}</span>
              </span>
            </label>
          ))}
          {noLimite ? <p className="text-sm text-texto-suave">{T.seletorNoLimite}</p> : null}
        </fieldset>
      </CartaoConteudo>
    </Cartao>
  );
}

type EstadoResumo =
  | { fase: 'carregando' }
  | { fase: 'falha'; tipo: FalhaRestricoesPortal }
  | { fase: 'pronto'; resumo: ResumoPortalTela; pedidos: PedidosPortalTela | null; falhaPedidos: FalhaRestricoesPortal | null };

function ResumoPessoa({ pessoa }: { pessoa: PessoaSeletorPortal }) {
  const ctx: ContextoPessoaPortal = useMemo(() => ({ representante: pessoa.via === 'representante', nome: pessoa.nome }), [pessoa]);
  const [estado, setEstado] = useState<EstadoResumo>({ fase: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controle = new AbortController();
    const timer = window.setTimeout(async () => {
      setEstado({ fase: 'carregando' });
      try {
        const resumo = await obterResumoRestricoesPortal(pessoa.pacienteId, controle.signal);
        let pedidos: PedidosPortalTela | null = null;
        let falhaPedidos: FalhaRestricoesPortal | null = null;
        try {
          pedidos = await listarPedidosRestricoesPortal(pessoa.pacienteId, controle.signal);
        } catch (falha) {
          if (controle.signal.aborted) return;
          falhaPedidos = tipoDe(falha);
        }
        if (controle.signal.aborted) return;
        setEstado({ fase: 'pronto', resumo, pedidos, falhaPedidos });
      } catch (falha) {
        if (!controle.signal.aborted) setEstado({ fase: 'falha', tipo: tipoDe(falha) });
      }
    }, 0);
    return () => { window.clearTimeout(timer); controle.abort(); };
  }, [pessoa.pacienteId, tentativa]);

  // Ao trocar de pessoa, o foco vai para o título com o nome dela (leitor de tela anuncia de quem é a tela).
  useEffect(() => { if (estado.fase !== 'carregando') titulo.current?.focus(); }, [pessoa.pacienteId, estado.fase]);

  const cabecalho = ctx.representante ? `Restrições alimentares de ${pessoa.nome}` : 'Suas restrições alimentares';

  return (
    <Cartao aria-labelledby="titulo-restricoes-pessoa">
      <CartaoCabecalho>
        <CartaoTitulo id="titulo-restricoes-pessoa" ref={titulo} tabIndex={-1} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primaria">{cabecalho}</CartaoTitulo>
      </CartaoCabecalho>
      <CartaoConteudo className="grid gap-5">
        {estado.fase === 'carregando' ? (
          <div role="status" aria-live="polite" className="grid gap-2"><span className="sr-only">Carregando</span><Esqueleto className="h-20" /></div>
        ) : estado.fase === 'falha' ? (
          <EstadoFalha titulo="Não foi possível mostrar" descricao={mensagemFalha(estado.tipo, 'resumo')} aoTentarNovamente={estado.tipo === 'leitura' ? () => setTentativa((n) => n + 1) : undefined} />
        ) : (
          <>
            <p className="text-tinta">{T.abertura(ctx)}</p>
            <ListaRestricoes itens={estado.resumo.itens} ctx={ctx} />
            {estado.resumo.ultimaConfirmacaoEm && dataCurta(estado.resumo.ultimaConfirmacaoEm) ? (
              <p className="text-sm text-texto-suave">{T.ultimaConfirmacao(ctx, dataCurta(estado.resumo.ultimaConfirmacaoEm))}</p>
            ) : null}
            <p className="rounded-md border border-linha bg-superficie-hover p-3 text-sm text-tinta">{T.conviteQuestionario}</p>
            <PedidosPessoa pedidos={estado.pedidos} falha={estado.falhaPedidos} ctx={ctx} aoTentarNovamente={() => setTentativa((n) => n + 1)} />
          </>
        )}
      </CartaoConteudo>
    </Cartao>
  );
}

function ListaRestricoes({ itens, ctx }: { itens: ItemResumoPortal[]; ctx: ContextoPessoaPortal }) {
  if (itens.length === 0) return <EstadoVazio titulo="Nenhuma restrição registrada" descricao={T.vazio(ctx)} />;
  return (
    <div className="grid gap-4">
      {GRUPOS.map((grupo) => {
        const doGrupo = itens.filter((i) => i.grupo === grupo).sort((a, b) => (ORDEM_SELO[a.chaveSelo] ?? 9) - (ORDEM_SELO[b.chaveSelo] ?? 9));
        if (doGrupo.length === 0) return null;
        const idTitulo = `grupo-restricoes-${grupo}`;
        return (
          <section key={grupo} aria-labelledby={idTitulo}>
            <h3 id={idTitulo} className="mb-2 text-base font-semibold text-tinta">{tituloGrupoPortal(grupo, ctx)}</h3>
            <ul className="grid gap-2">
              {doGrupo.map((item) => (
                <li key={item.id} className="rounded-md border border-linha p-3">
                  <p className="font-medium text-tinta">{item.alimento || T.alimentoSemTexto}</p>
                  <p className="text-sm text-texto-suave">{textoSeloPortal(item.chaveSelo, ctx)}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PedidosPessoa({ pedidos, falha, ctx, aoTentarNovamente }: { pedidos: PedidosPortalTela | null; falha: FalhaRestricoesPortal | null; ctx: ContextoPessoaPortal; aoTentarNovamente: () => void }) {
  return (
    <section aria-labelledby="titulo-pedidos-restricoes" className="grid gap-2">
      <h3 id="titulo-pedidos-restricoes" className="text-base font-semibold text-tinta">{T.pedidosTitulo(ctx)}</h3>
      {falha ? (
        <div className="grid gap-2">
          <p role="alert" className="text-sm text-tinta">{mensagemFalha(falha, 'geral')}</p>
          {falha === 'leitura' ? <Botao variante="secundario" onClick={aoTentarNovamente}>Tentar novamente</Botao> : null}
        </div>
      ) : !pedidos || pedidos.itens.length === 0 ? (
        <p className="text-sm text-texto-suave">{T.pedidosVazio}</p>
      ) : (
        <>
          <ul className="grid gap-2">
            {pedidos.itens.map((pedido) => {
              const texto = textoPedidoPortal(pedido, ctx);
              return (
                <li key={pedido.id} className="rounded-md border border-linha p-3">
                  <p className="font-medium text-tinta">{texto.titulo}</p>
                  <p className="text-sm text-texto-suave">Enviado em {dataCurta(pedido.criadoEm)}{pedido.decididoEm ? ` · analisado em ${dataCurta(pedido.decididoEm)}` : ''}</p>
                  {texto.apoio ? <p className="text-sm text-texto-suave">{texto.apoio}</p> : null}
                  {pedido.explicacao ? (
                    <p className="mt-2 text-sm text-tinta"><span className="font-medium">{T.respostaEquipe}:</span> {pedido.explicacao}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {pedidos.maisAntigos ? <p className="text-sm text-texto-suave">{T.pedidosMaisAntigos}</p> : null}
        </>
      )}
    </section>
  );
}

/** Entrada em "Mais": só aparece quando a área está habilitada nesta instalação da web. */
export function LinkRestricoesPortal() {
  const [habilitada, setHabilitada] = useState(false);
  useEffect(() => {
    const controle = new AbortController();
    restricoesDisponiveisNoPortal(controle.signal).then(setHabilitada, () => setHabilitada(false));
    return () => controle.abort();
  }, []);
  if (!habilitada) return null;
  return <Link href="/portal/restricoes" className={classesBotao({ className: 'justify-between' })}>{T.titulo}</Link>;
}
