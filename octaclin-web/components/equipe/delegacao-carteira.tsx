'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Rotulo, Selecao } from '@/components/ui/campo';
import { Esqueleto } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { LIMITE_DELEGACOES, type CandidatoDelegacaoTela, type DelegacaoTela } from '@/lib/restricoes-equipe';
import {
  ErroEquipe,
  concederDelegacao,
  equipeRestricoesDisponivel,
  listarCandidatosDelegacao,
  listarDelegacoes,
  revogarDelegacao,
  type FalhaEquipe
} from '@/lib/restricoes-equipe-api';
import { TEXTOS_EQUIPE_RESTRICOES as T } from '@/lib/textos-equipe-restricoes';
import { formatarDataEquipe, mensagemFalhaEquipe } from './estado-equipe';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'indisponivel' }
  | { fase: 'falha'; tipo: FalhaEquipe }
  | { fase: 'pronto'; delegacoes: DelegacaoTela[]; candidatos: CandidatoDelegacaoTela[]; noLimite: boolean };

/**
 * Delegação da carteira (FOOD06 P3-6), só para o titular Professional. O backend decide quem é titular e quem é
 * Collaborator ativo; esta tela só mostra o que ele devolve e pede confirmação antes de dar ou tirar acesso.
 * Nenhum dado é guardado no navegador.
 */
export function DelegacaoCarteira() {
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [escolhido, setEscolhido] = useState('');
  const [confirmarConceder, setConfirmarConceder] = useState(false);
  const [revogando, setRevogando] = useState<DelegacaoTela | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const idSelecao = useId();
  const titulo = useRef<HTMLHeadingElement>(null);

  const carregar = useCallback(async (signal?: AbortSignal, inicial = false) => {
    // Na primeira carga o estado já nasce "carregando"; recarregas mostram o esqueleto de novo.
    if (!inicial) setEstado({ fase: 'carregando' });
    try {
      if (!(await equipeRestricoesDisponivel(signal))) return setEstado({ fase: 'indisponivel' });
      const [lista, candidatos] = await Promise.all([listarDelegacoes(signal), listarCandidatosDelegacao(signal)]);
      if (signal?.aborted) return;
      setEstado({ fase: 'pronto', delegacoes: lista.itens, candidatos: candidatos.itens, noLimite: candidatos.noLimite });
    } catch (falha) {
      if (signal?.aborted) return;
      setEstado({ fase: 'falha', tipo: falha instanceof ErroEquipe ? falha.tipo : 'leitura' });
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    const timer = window.setTimeout(() => void carregar(controle.signal, true), 0);
    return () => { window.clearTimeout(timer); controle.abort(); };
  }, [carregar]);

  const recarregar = async (mensagem?: { tipo: 'ok' | 'erro'; texto: string }) => {
    setEscolhido('');
    await carregar();
    setAviso(mensagem ?? null);
  };

  const falhar = (falha: unknown) => {
    const tipo = falha instanceof ErroEquipe ? falha.tipo : 'incerto';
    void recarregar({ tipo: 'erro', texto: mensagemFalhaEquipe(tipo) });
  };

  async function conceder() {
    if (estado.fase !== 'pronto') return;
    const candidato = estado.candidatos.find((c) => c.usuarioId === escolhido);
    if (!candidato) return;
    setEnviando(true);
    try {
      await concederDelegacao(candidato.usuarioId);
      setConfirmarConceder(false);
      await recarregar({ tipo: 'ok', texto: T.concedido(candidato.email) });
    } catch (falha) {
      setConfirmarConceder(false);
      falhar(falha);
    } finally {
      setEnviando(false);
    }
  }

  async function revogar() {
    if (!revogando) return;
    const alvo = revogando;
    setEnviando(true);
    try {
      await revogarDelegacao(alvo.id);
      setRevogando(null);
      await recarregar({ tipo: 'ok', texto: T.revogadoDelegacao(alvo.email) });
      titulo.current?.focus();
    } catch (falha) {
      setRevogando(null);
      falhar(falha);
    } finally {
      setEnviando(false);
    }
  }

  const corpo = () => {
    if (estado.fase === 'carregando') return <div aria-busy="true" className="grid gap-2"><Esqueleto className="h-10" /><Esqueleto className="h-10" /></div>;
    if (estado.fase === 'indisponivel') return <p className="text-sm text-texto-suave">{T.indisponivel}</p>;
    if (estado.fase === 'falha') {
      const texto = estado.tipo === 'semAcesso' ? T.somenteTitular : mensagemFalhaEquipe(estado.tipo);
      return (
        <div className="grid gap-2">
          <p className="text-sm text-tinta">{texto}</p>
          {estado.tipo === 'leitura' ? <Botao type="button" variante="secundario" onClick={() => void carregar()}>{T.tentarNovamente}</Botao> : null}
        </div>
      );
    }
    const delegados = new Set(estado.delegacoes.map((d) => d.colaboradorUsuarioId));
    const disponiveis = estado.candidatos.filter((c) => !delegados.has(c.usuarioId));
    const noLimite = estado.delegacoes.length >= LIMITE_DELEGACOES;
    const escolhidoEmail = disponiveis.find((c) => c.usuarioId === escolhido)?.email ?? '';
    return (
      <div className="grid gap-6">
        <section aria-labelledby="delegacoes-lista" className="grid gap-2">
          <h2 id="delegacoes-lista" className="text-base font-semibold text-tinta">Com acesso agora</h2>
          {estado.delegacoes.length === 0 ? (
            <p className="text-sm text-texto-suave">{T.vazioDelegacao}</p>
          ) : (
            <ul className="grid gap-2">
              {estado.delegacoes.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-linha px-3 py-2">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium text-tinta">{d.email}</p>
                    <p className="text-xs text-texto-suave">{T.desdeData(formatarDataEquipe(d.concedidaEm))}</p>
                  </div>
                  <Botao type="button" variante="secundario" tamanho="sm" aria-label={`${T.botaoRevogarDelegacao}: ${d.email}`} onClick={() => setRevogando(d)}>
                    {T.botaoRevogarDelegacao}
                  </Botao>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="delegacoes-adicionar" className="grid gap-2">
          <h2 id="delegacoes-adicionar" className="text-base font-semibold text-tinta">Adicionar colaborador</h2>
          {noLimite ? (
            <p className="text-sm text-tinta">{T.limiteDelegacoes}</p>
          ) : disponiveis.length === 0 ? (
            <p className="text-sm text-texto-suave">{T.semCandidatos}</p>
          ) : (
            <form
              className="grid gap-2 sm:max-w-md"
              onSubmit={(evento) => {
                evento.preventDefault();
                if (escolhido) setConfirmarConceder(true);
              }}
            >
              <Rotulo htmlFor={idSelecao}>{T.rotuloCandidato}</Rotulo>
              <Selecao id={idSelecao} value={escolhido} onChange={(e) => setEscolhido(e.target.value)} required>
                <option value="">{T.escolherCandidato}</option>
                {disponiveis.map((c) => <option key={c.usuarioId} value={c.usuarioId}>{c.email}</option>)}
              </Selecao>
              <Botao type="submit" variante="primario" disabled={!escolhido}>{T.botaoConceder}</Botao>
            </form>
          )}
          {estado.noLimite ? <p className="text-xs text-texto-suave">{T.candidatosNoLimite}</p> : null}
        </section>
        <ModalConfirmacao
          aberto={confirmarConceder}
          titulo={T.confirmarConcederTitulo(escolhidoEmail)}
          mensagem={T.confirmarConcederTexto(escolhidoEmail)}
          rotuloConfirmar={T.confirmarConcederBotao}
          confirmando={enviando}
          aoConfirmar={() => void conceder()}
          aoCancelar={() => setConfirmarConceder(false)}
        />
        <ModalConfirmacao
          aberto={revogando !== null}
          titulo={T.confirmarRevogarDelegacaoTitulo(revogando?.email ?? '')}
          mensagem={T.confirmarRevogarDelegacaoTexto}
          rotuloConfirmar={T.botaoRevogarDelegacao}
          rotuloCancelar={T.manterAcesso}
          confirmando={enviando}
          aoConfirmar={() => void revogar()}
          aoCancelar={() => setRevogando(null)}
        />
      </div>
    );
  };

  return (
    <section aria-label={T.tituloDelegacao} className="grid gap-4">
      <div>
        <h1 ref={titulo} tabIndex={-1} className="text-lg font-semibold text-tinta">{T.tituloDelegacao}</h1>
        <p className="mt-1 text-sm text-texto-suave">{T.avisoDelegacao}</p>
      </div>
      <div role="status" aria-live="polite" className={aviso ? `rounded-md border px-3 py-2 text-sm border-linha text-tinta` : 'sr-only'}>
        {aviso?.texto ?? ''}
      </div>
      {corpo()}
    </section>
  );
}
