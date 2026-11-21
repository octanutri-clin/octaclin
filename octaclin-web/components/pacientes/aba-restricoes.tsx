'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Rotulo } from '@/components/ui/campo';
import { Esqueleto } from '@/components/ui/feedback';
import { Modal, ModalConfirmacao } from '@/components/ui/modal';
import {
  descricaoRestricao,
  separarRestricoesProntuario,
  type AvaliacaoProntuario,
  type RestricaoProntuario
} from '@/lib/restricoes-prontuario';
import {
  ErroRestricoesProntuario,
  confirmarRestricaoProntuario,
  consultarAvaliacaoProntuario,
  iniciarAvaliacaoProntuario,
  inativarRestricaoProntuario,
  listarRestricoesProntuario,
  reavaliarRestricaoProntuario,
  rejeitarRestricaoProntuario,
  type FalhaProntuario
} from '@/lib/restricoes-prontuario-api';
import {
  TEXTOS_RESTRICOES_PRONTUARIO as T,
  formatarDataProntuario,
  rotuloEstadoRestricao,
  rotuloGravidade,
  rotuloOrigem,
  rotuloTipoRestricao,
  textoSituacaoAvaliacao
} from '@/lib/textos-restricoes-prontuario';
import { DialogoCorrecao, InativacaoEmDoisPassos, aceitaAcaoProtegida, aceitaCorrecao } from './acoes-restricao-confirmada';
import { FormularioRegistro, mensagemFalhaProntuario } from './formulario-registro-restricao';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'falha'; tipo: FalhaProntuario }
  | { fase: 'pronto'; escopo: 'completo' | 'autoria'; itens: RestricaoProntuario[]; avaliacao: AvaliacaoProntuario | null | 'indisponivel' };


// NUX-01 (etapa B): com "Não sei dizer", o rótulo do tipo não é afirmado como fato em lugar nenhum.
const naoSabe = (i: RestricaoProntuario) => i.conteudo.classificacaoPeloPaciente === 'nao_sabe';
const tipoDe = (i: RestricaoProntuario) => (naoSabe(i) ? T.tipoNaoInformado : rotuloTipoRestricao(i.conteudo.natureza, i.conteudo.subtipoClinico));
/** Tipo dentro de uma frase ("Você está inativando {tipo} confirmada"). */
const tipoNaFrase = (i: RestricaoProntuario) => (naoSabe(i) ? T.descricaoNaoSabe : tipoDe(i).toLocaleLowerCase('pt-BR'));
const descricao = (i: RestricaoProntuario) => descricaoRestricao(i, naoSabe(i) ? T.descricaoNaoSabe : tipoDe(i));
/** NUX-02: o diálogo de confirmar repete o que importa para decidir. */
function detalhesConfirmacao(i: RestricaoProntuario): string {
  const partes: string[] = [T.confirmarTexto];
  if (naoSabe(i)) partes.push(T.confirmarNaoSabe);
  else if (i.conteudo.natureza === 'clinica') partes.push(`Gravidade: ${rotuloGravidade(i.conteudo.gravidade)}.`);
  partes.push(`${rotuloOrigem(i.origem)}.`);
  if (i.conteudo.observacao) partes.push(`${T.observacao}: ${i.conteudo.observacao}`);
  return partes.join(' ');
}

/**
 * Aba "Restrições" do prontuário (FOOD06 P3-3). O backend decide carteira, delegação e a concessão clínica; o `escopo`
 * da lista só orienta a tela: "completo" mostra tudo e as ações de conferência; "autoria" mostra só os próprios
 * registros (colaborador ou profissional sem a permissão clínica). Nada é guardado no navegador; o texto digitado
 * fica só no estado do componente. Registrar e confirmar são passos separados (Q-I).
 */
export function AbaRestricoes({ pacienteId, papel, podeGerenciar }: { pacienteId: string; papel?: string; podeGerenciar: boolean }) {
  const colaborador = papel === 'Collaborator';
  const podeRegistrar = colaborador || (papel === 'Professional' && podeGerenciar);
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [aviso, setAviso] = useState('');
  const [confirmando, setConfirmando] = useState<RestricaoProntuario | null>(null);
  const [rejeitando, setRejeitando] = useState<RestricaoProntuario | null>(null);
  const [justificativa, setJustificativa] = useState('');
  const [erroJustificativa, setErroJustificativa] = useState(false);
  const [erroDialogo, setErroDialogo] = useState('');
  const [reavaliando, setReavaliando] = useState<{ alvo: RestricaoProntuario; destino: 'ativa' | 'em_reavaliacao' } | null>(null);
  const [inativando, setInativando] = useState<RestricaoProntuario | null>(null);
  const [erroInativar, setErroInativar] = useState('');
  const [corrigindo, setCorrigindo] = useState<RestricaoProntuario | null>(null);
  const idTipoRegistro = useId();
  const [enviando, setEnviando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const idJustificativa = useId();
  const idAjudaJustificativa = useId();

  // R4 (BAIXA): só a recarga mais recente pinta a tela; uma resposta tardia não volta a lista para uma versão velha.
  const sequencia = useRef(0);
  const carregar = useCallback(async (signal?: AbortSignal, inicial = false): Promise<RestricaoProntuario[] | null> => {
    const minha = ++sequencia.current;
    const atual = () => minha === sequencia.current;
    if (!inicial) setEstado({ fase: 'carregando' });
    try {
      const lista = await listarRestricoesProntuario(pacienteId, colaborador, signal);
      let avaliacao: AvaliacaoProntuario | null | 'indisponivel' = 'indisponivel';
      if (lista.escopo === 'completo') {
        try {
          avaliacao = (await consultarAvaliacaoProntuario(pacienteId, signal)).avaliacao;
        } catch (falha) {
          if (signal?.aborted) return null;
          if (!(falha instanceof ErroRestricoesProntuario)) throw falha;
          avaliacao = 'indisponivel';
        }
      }
      if (signal?.aborted) return null;
      if (atual()) setEstado({ fase: 'pronto', escopo: lista.escopo, itens: lista.itens, avaliacao });
      return lista.itens;
    } catch (falha) {
      if (signal?.aborted) return null;
      if (atual()) setEstado({ fase: 'falha', tipo: falha instanceof ErroRestricoesProntuario ? falha.tipo : 'leitura' });
      return null;
    }
  }, [pacienteId, colaborador]);

  useEffect(() => {
    const controle = new AbortController();
    const timer = window.setTimeout(() => void carregar(controle.signal, true), 0);
    return () => { window.clearTimeout(timer); controle.abort(); };
  }, [carregar]);

  /** Depois de qualquer escrita: recarrega a lista e anuncia o resultado. 409 e incerto também recarregam. */
  async function depoisDaEscrita(texto: string) {
    await carregar();
    setAviso(texto);
  }
  const falhaDeEscrita = (falha: unknown) => mensagemFalhaProntuario(falha instanceof ErroRestricoesProntuario ? falha.tipo : 'incerto');

  async function confirmar() {
    if (!confirmando) return;
    const alvo = confirmando;
    setEnviando(true);
    try {
      await confirmarRestricaoProntuario(pacienteId, alvo.id, alvo.revisao);
      setConfirmando(null);
      await depoisDaEscrita(T.confirmado(descricao(alvo)));
    } catch (falha) {
      setConfirmando(null);
      await depoisDaEscrita(falhaDeEscrita(falha));
    } finally {
      setEnviando(false);
      titulo.current?.focus();
    }
  }

  async function rejeitar() {
    if (!rejeitando) return;
    if (!justificativa.trim()) {
      setErroJustificativa(true);
      return;
    }
    const alvo = rejeitando;
    setEnviando(true);
    setErroDialogo('');
    try {
      await rejeitarRestricaoProntuario(pacienteId, alvo.id, alvo.revisao, justificativa);
      setRejeitando(null);
      setJustificativa('');
      await depoisDaEscrita(T.rejeitado(descricao(alvo)));
    } catch (falha) {
      // NUX-07 (etapa B): em 409 ou incerto, recarrega e, se o item ainda estiver para conferir, mantém o diálogo aberto
      // com a versão atual e o texto digitado (só em memória). Se mudou de situação, fecha e anuncia.
      const texto = falhaDeEscrita(falha);
      const itens = await carregar();
      const atual = itens?.find((x) => x.id === alvo.id && x.estado === 'ativa' && x.confirmacao === 'pendente');
      if (atual) {
        setRejeitando(atual);
        setErroDialogo(texto);
      } else {
        setRejeitando(null);
        setJustificativa('');
        setAviso(texto);
      }
    } finally {
      setEnviando(false);
      titulo.current?.focus();
    }
  }

  async function iniciarAvaliacao() {
    setEnviando(true);
    try {
      await iniciarAvaliacaoProntuario(pacienteId);
      await depoisDaEscrita(T.avaliacaoIniciada);
    } catch (falha) {
      await depoisDaEscrita(falhaDeEscrita(falha));
    } finally {
      setEnviando(false);
    }
  }

  async function reavaliar() {
    if (!reavaliando) return;
    const { alvo, destino } = reavaliando;
    setEnviando(true);
    try {
      await reavaliarRestricaoProntuario(pacienteId, alvo.id, alvo.revisao, destino);
      setReavaliando(null);
      await depoisDaEscrita(destino === 'em_reavaliacao' ? T.reavaliado(descricao(alvo)) : T.mantida(descricao(alvo)));
    } catch (falha) {
      setReavaliando(null);
      await depoisDaEscrita(falhaDeEscrita(falha));
    } finally {
      setEnviando(false);
      titulo.current?.focus();
    }
  }

  /** Segundo passo da inativação. Em 409 ou incerto, recarrega; se ainda couber, o diálogo volta ao passo 1 com o texto. */
  async function inativar(motivo: string, justificativaInativacao: string): Promise<boolean> {
    if (!inativando) return true;
    const alvo = inativando;
    setEnviando(true);
    setErroInativar('');
    try {
      await inativarRestricaoProntuario(pacienteId, alvo.id, alvo.revisao, motivo, justificativaInativacao);
      setInativando(null);
      await depoisDaEscrita(T.inativado(descricao(alvo)));
      titulo.current?.focus();
      return true;
    } catch (falha) {
      const texto = falhaDeEscrita(falha);
      const itens = await carregar();
      const atual = itens?.find((x) => x.id === alvo.id);
      if (atual && aceitaAcaoProtegida(atual)) {
        setInativando(atual);
        setErroInativar(texto);
        return false;
      }
      setInativando(null);
      setAviso(atual?.estado === 'inativa' ? T.inativado(descricao(alvo)) : texto);
      titulo.current?.focus();
      return true;
    } finally {
      setEnviando(false);
    }
  }

  const item = (i: RestricaoProntuario, comAcoes: boolean, protegidas = false) => (
    <li key={i.id} className="grid gap-2 rounded-md border border-linha bg-white p-3">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-tinta">
          {i.conteudo.alvoDeclarado ?? T.semNomeCatalogo}
        </p>
        <p className="text-sm text-tinta">
          {tipoDe(i)}
          {i.conteudo.natureza === 'clinica' && !naoSabe(i) ? ` · Gravidade: ${rotuloGravidade(i.conteudo.gravidade)}` : ''}
        </p>
        <p className="text-xs text-texto-suave">
          {rotuloEstadoRestricao(i.estado, i.confirmacao)} · {rotuloOrigem(i.origem)} · {T.registradaEm(formatarDataProntuario(i.criadoEm))}
        </p>
        {i.conteudo.observacao ? (
          <p className="mt-1 break-words text-sm text-texto-suave"><span className="font-medium text-tinta">{T.observacao}:</span> {i.conteudo.observacao}</p>
        ) : null}
      </div>
      {comAcoes ? (
        <div className="flex flex-wrap gap-2">
          <Botao type="button" tamanho="sm" variante="primario" aria-label={`${T.botaoConfirmar}: ${descricao(i)}`} onClick={() => setConfirmando(i)}>
            {T.botaoConfirmar}
          </Botao>
          <Botao type="button" tamanho="sm" variante="secundario" aria-label={`${T.botaoRejeitar}: ${descricao(i)}`}
            onClick={() => { setJustificativa(''); setErroJustificativa(false); setErroDialogo(''); setRejeitando(i); }}>
            {T.botaoRejeitar}
          </Botao>
        </div>
      ) : null}
      {protegidas && aceitaAcaoProtegida(i) ? (
        <div className="flex flex-wrap gap-2">
          {i.estado === 'ativa' ? (
            <Botao type="button" tamanho="sm" variante="secundario" aria-label={`${T.botaoReavaliar}: ${descricao(i)}`} onClick={() => setReavaliando({ alvo: i, destino: 'em_reavaliacao' })}>
              {T.botaoReavaliar}
            </Botao>
          ) : (
            <Botao type="button" tamanho="sm" variante="secundario" aria-label={`${T.botaoManterConfirmada}: ${descricao(i)}`} onClick={() => setReavaliando({ alvo: i, destino: 'ativa' })}>
              {T.botaoManterConfirmada}
            </Botao>
          )}
          {aceitaCorrecao(i) ? (
            <Botao type="button" tamanho="sm" variante="secundario" aria-label={`${T.botaoCorrigir}: ${descricao(i)}`} onClick={() => setCorrigindo(i)}>
              {T.botaoCorrigir}
            </Botao>
          ) : null}
          <Botao type="button" tamanho="sm" variante="secundario" aria-label={`${T.botaoInativar}: ${descricao(i)}`} onClick={() => { setErroInativar(''); setInativando(i); }}>
            {T.botaoInativar}
          </Botao>
        </div>
      ) : null}
    </li>
  );

  const grupo = (id: string, rotulo: string, itens: RestricaoProntuario[], comAcoes: boolean, protegidas = false) => itens.length ? (
    <section aria-labelledby={id} className="grid gap-2">
      <h4 id={id} className="text-sm font-semibold text-tinta">{rotulo} ({itens.length})</h4>
      <ul className="grid gap-2">{itens.map((i) => item(i, comAcoes, protegidas))}</ul>
    </section>
  ) : null;

  const corpo = () => {
    if (estado.fase === 'carregando') return <div aria-busy="true" className="grid gap-2"><Esqueleto className="h-16" /><Esqueleto className="h-16" /></div>;
    if (estado.fase === 'falha') {
      return (
        <div className="grid gap-2">
          <p className="text-sm text-tinta">{mensagemFalhaProntuario(estado.tipo)}</p>
          {estado.tipo === 'leitura' ? <Botao type="button" variante="secundario" onClick={() => void carregar()}>{T.tentarNovamente}</Botao> : null}
        </div>
      );
    }
    const completo = estado.escopo === 'completo';
    const decide = completo && papel === 'Professional' && podeGerenciar;
    const s = separarRestricoesProntuario(estado.itens);
    return (
      <div className="grid gap-5">
        {podeRegistrar ? (
          <p className="text-sm">
            <a href={`#${idTipoRegistro}`} className="font-medium text-primaria-forte underline underline-offset-2"
              onClick={(e) => { e.preventDefault(); const alvo = document.getElementById(idTipoRegistro); alvo?.scrollIntoView({ block: 'center' }); alvo?.focus(); }}>
              {T.linkRegistrar}
            </a>
          </p>
        ) : null}
        {completo ? <BlocoAvaliacao avaliacao={estado.avaliacao} pendentes={s.pendentes.length} podeIniciar={decide} enviando={enviando} aoIniciar={() => void iniciarAvaliacao()} /> : (
          <p className="text-sm text-texto-suave">{colaborador ? T.vazioAutoria : T.avisoAutoria}</p>
        )}
        {s.pendentes.length + s.confirmadas.length + s.emReavaliacao.length + s.recolhidas.length === 0 ? (
          <p className="text-sm text-tinta">{completo ? T.vazioCompleto : T.vazioAutoria}</p>
        ) : (
          <div className="grid gap-4">
            {grupo('restricoes-pendentes', T.grupoPendentes, s.pendentes, decide)}
            {grupo('restricoes-confirmadas', T.grupoConfirmadas, s.confirmadas, false, decide)}
            {grupo('restricoes-reavaliacao', T.grupoReavaliacao, s.emReavaliacao, false, decide)}
            {s.recolhidas.length ? (
              <details className="rounded-md border border-linha bg-white p-3">
                <summary className="cursor-pointer text-sm font-semibold text-tinta">{T.grupoRecolhidas} ({s.recolhidas.length})</summary>
                <ul className="mt-2 grid gap-2">{s.recolhidas.map((i) => item(i, false))}</ul>
              </details>
            ) : null}
          </div>
        )}
        {podeRegistrar ? <FormularioRegistro idTipo={idTipoRegistro} pacienteId={pacienteId} colaborador={colaborador} aoConcluir={(texto) => void depoisDaEscrita(texto)} /> : null}
      </div>
    );
  };

  const conferenciaEmDia = estado.fase === 'pronto' && estado.avaliacao !== 'indisponivel' && estado.avaliacao?.situacao === 'restricoes_registradas';

  return (
    <section aria-label={T.titulo} className="grid gap-4 rounded-md border border-linha bg-white p-4">
      <div>
        <h2 ref={titulo} tabIndex={-1} className="text-base font-semibold text-tinta">{T.titulo}</h2>
        <p role="note" className="mt-1 rounded-md border border-linha bg-superficie-hover px-3 py-2 text-sm text-tinta">{T.avisoSemAlerta}</p>
      </div>
      <div role="status" aria-live="polite" className={aviso ? 'rounded-md border border-linha px-3 py-2 text-sm text-tinta' : 'sr-only'}>{aviso}</div>
      {corpo()}
      <ModalConfirmacao
        aberto={confirmando !== null}
        titulo={confirmando ? T.confirmarTitulo(descricao(confirmando)) : ''}
        mensagem={confirmando ? detalhesConfirmacao(confirmando) : T.confirmarTexto}
        rotuloConfirmar={T.botaoConfirmar}
        rotuloCancelar={T.manter}
        confirmando={enviando}
        aoConfirmar={() => void confirmar()}
        aoCancelar={() => setConfirmando(null)}
      />
      <Modal aberto={rejeitando !== null} aoFechar={() => { if (!enviando) { setRejeitando(null); setJustificativa(''); } }}
        titulo={rejeitando ? T.rejeitarTitulo(descricao(rejeitando)) : ''}>
        <form className="grid gap-2" noValidate onSubmit={(e) => { e.preventDefault(); void rejeitar(); }}>
          <p className="text-sm text-texto-suave">{T.avisoRejeicaoPaciente}</p>
          {erroDialogo ? <p role="alert" className="rounded-md border border-linha px-3 py-2 text-sm text-tinta">{erroDialogo}</p> : null}
          <Rotulo htmlFor={idJustificativa}>{T.rotuloJustificativa}</Rotulo>
          <AreaTexto id={idJustificativa} value={justificativa} maxLength={4000} rows={4} aria-describedby={idAjudaJustificativa}
            aria-invalid={erroJustificativa || undefined}
            onChange={(e) => { setJustificativa(e.target.value); if (e.target.value.trim()) setErroJustificativa(false); }} />
          <p id={idAjudaJustificativa} className="text-xs text-texto-suave">{erroJustificativa ? `${T.erroJustificativa} ` : ''}{T.ajudaJustificativa}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Botao type="button" variante="secundario" disabled={enviando} onClick={() => { setRejeitando(null); setJustificativa(''); }}>{T.manter}</Botao>
            <Botao type="submit" variante="perigo" disabled={enviando}>{enviando ? 'Processando' : T.botaoConfirmarRejeicao}</Botao>
          </div>
        </form>
      </Modal>
      <ModalConfirmacao
        aberto={reavaliando !== null}
        titulo={reavaliando ? (reavaliando.destino === 'em_reavaliacao' ? T.reavaliarTitulo(descricao(reavaliando.alvo)) : T.manterTitulo(descricao(reavaliando.alvo))) : ''}
        mensagem={reavaliando?.destino === 'ativa' ? T.ajudaManterConfirmada : T.ajudaReavaliar}
        rotuloConfirmar={reavaliando?.destino === 'ativa' ? T.botaoManterConfirmada : T.botaoReavaliar}
        rotuloCancelar={T.manter}
        confirmando={enviando}
        aoConfirmar={() => void reavaliar()}
        aoCancelar={() => setReavaliando(null)}
      />
      <Modal aberto={inativando !== null} aoFechar={() => { if (!enviando) setInativando(null); }} titulo={inativando ? T.inativarTitulo(descricao(inativando)) : ''}>
        {inativando ? (
          <InativacaoEmDoisPassos key={inativando.id} tipo={tipoNaFrase(inativando)} alimento={inativando.conteudo.alvoDeclarado ?? T.semNomeCatalogo}
            erro={erroInativar} enviando={enviando} aoInativar={inativar} aoCancelar={() => setInativando(null)} invalidaConferencia={conferenciaEmDia} />
        ) : null}
      </Modal>
      {corrigindo ? (
        <DialogoCorrecao key={corrigindo.id} pacienteId={pacienteId} antiga={corrigindo} tipoAntiga={tipoNaFrase(corrigindo)}
          descricaoAntiga={descricao(corrigindo)} recarregar={() => carregar()} invalidaConferencia={conferenciaEmDia}
          aoFechar={(texto) => { setCorrigindo(null); setAviso(texto); titulo.current?.focus(); }} />
      ) : null}
    </section>
  );
}

function BlocoAvaliacao({ avaliacao, pendentes, podeIniciar, enviando, aoIniciar }: {
  avaliacao: AvaliacaoProntuario | null | 'indisponivel'; pendentes: number; podeIniciar: boolean; enviando: boolean; aoIniciar: () => void;
}) {
  if (avaliacao === 'indisponivel') return null;
  return (
    <section aria-labelledby="restricoes-avaliacao" className="grid gap-2 rounded-md border border-linha p-3">
      <h3 id="restricoes-avaliacao" className="text-sm font-semibold text-tinta">{T.tituloAvaliacao}</h3>
      {/* NUX-03 (etapa B): "conferidas" nunca aparece sozinho quando há registros esperando conferência. */}
      {pendentes > 0 ? <p className="text-sm font-medium text-tinta">{T.pendentesNaConferencia(pendentes)}</p> : null}
      {avaliacao ? <p className="text-sm text-tinta">{textoSituacaoAvaliacao(avaliacao)}</p> : (
        <>
          <p className="text-sm text-tinta">{T.avaliacaoAusente}</p>
          {podeIniciar ? (
            <div className="grid gap-1">
              <p className="text-xs text-texto-suave">{T.ajudaIniciarAvaliacao}</p>
              <Botao type="button" variante="secundario" disabled={enviando} onClick={aoIniciar}>{T.botaoIniciarAvaliacao}</Botao>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
