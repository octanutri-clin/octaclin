'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Esqueleto } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import {
  LIMITE_REPRESENTANTES,
  montarBuscaRepresentante,
  textoIdentificacao,
  type IdentificacaoTela,
  type RepresentanteTela,
  type TipoVerificacao
} from '@/lib/restricoes-equipe';
import {
  ErroEquipe,
  buscarRepresentante,
  equipeRestricoesDisponivel,
  listarRepresentantes,
  registrarRepresentante,
  revogarRepresentante,
  type FalhaEquipe
} from '@/lib/restricoes-equipe-api';
import { obterSessao } from '@/lib/auth-api';
import { OPCOES_VERIFICACAO, TEXTOS_EQUIPE_RESTRICOES as T, rotuloVerificacao } from '@/lib/textos-equipe-restricoes';
import { formatarDataEquipe, mensagemFalhaEquipe } from './estado-equipe';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'indisponivel' }
  | { fase: 'falha'; tipo: FalhaEquipe }
  | { fase: 'pronto'; itens: RepresentanteTela[] };

type Busca =
  | { fase: 'livre' }
  | { fase: 'buscando' }
  | { fase: 'nao_encontrado' }
  | { fase: 'encontrado'; usuarioId: string; identificacao: IdentificacaoTela }
  | { fase: 'erro'; texto: string };

/**
 * Representantes do paciente no portal (FOOD06 P3-6), para a equipe: Professional responsável ou Collaborator com a
 * carteira delegada. O backend decide quem é da equipe e quem é elegível; a busca é por e-mail exato, com a mesma
 * resposta para "não existe" e "não pode", e cota por pessoa e por clínica. O e-mail digitado fica só no estado do
 * componente e é apagado depois de registrar.
 */
export function RepresentantesPaciente({ pacienteId }: { pacienteId: string }) {
  // Só para mostrar o atalho da delegação; não é autorização (quem decide é o backend).
  const [titular, setTitular] = useState(false);
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [email, setEmail] = useState('');
  const [emailInvalido, setEmailInvalido] = useState(false);
  const [busca, setBusca] = useState<Busca>({ fase: 'livre' });
  const [verificacao, setVerificacao] = useState<TipoVerificacao | ''>('');
  const [enviando, setEnviando] = useState(false);
  const [revogando, setRevogando] = useState<RepresentanteTela | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const idEmail = useId();
  const idAjuda = useId();
  const idVerificacao = useId();
  const campoEmail = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  const carregar = useCallback(async (signal?: AbortSignal, inicial = false) => {
    // Na primeira carga o estado já nasce "carregando"; recarregas mostram o esqueleto de novo.
    if (!inicial) setEstado({ fase: 'carregando' });
    try {
      if (!(await equipeRestricoesDisponivel(signal))) return setEstado({ fase: 'indisponivel' });
      const lista = await listarRepresentantes(pacienteId, signal);
      if (signal?.aborted) return;
      setEstado({ fase: 'pronto', itens: lista.itens });
    } catch (falha) {
      if (signal?.aborted) return;
      setEstado({ fase: 'falha', tipo: falha instanceof ErroEquipe ? falha.tipo : 'leitura' });
    }
  }, [pacienteId]);

  useEffect(() => {
    const controle = new AbortController();
    const timer = window.setTimeout(() => void carregar(controle.signal, true), 0);
    return () => { window.clearTimeout(timer); controle.abort(); };
  }, [carregar]);

  useEffect(() => {
    let ativo = true;
    void obterSessao().then((s) => { if (ativo) setTitular(s?.papel === 'Professional'); }).catch(() => undefined);
    return () => { ativo = false; };
  }, []);

  const limparBusca = () => {
    setEmail('');
    setBusca({ fase: 'livre' });
    setVerificacao('');
  };

  async function buscar() {
    setAviso(null);
    if (!montarBuscaRepresentante({ email })) {
      setEmailInvalido(true);
      campoEmail.current?.focus();
      return;
    }
    setEmailInvalido(false);
    setBusca({ fase: 'buscando' });
    try {
      const r = await buscarRepresentante(pacienteId, email);
      setBusca(r.candidato ? { fase: 'encontrado', usuarioId: r.candidato.usuarioId, identificacao: r.candidato.identificacao } : { fase: 'nao_encontrado' });
    } catch (falha) {
      setBusca({ fase: 'erro', texto: mensagemFalhaEquipe(falha instanceof ErroEquipe ? falha.tipo : 'leitura') });
    }
  }

  async function registrar() {
    if (busca.fase !== 'encontrado' || !verificacao) return;
    const nome = textoIdentificacao(busca.identificacao);
    setEnviando(true);
    try {
      await registrarRepresentante(pacienteId, busca.usuarioId, verificacao);
      limparBusca();
      await carregar();
      setAviso({ tipo: 'ok', texto: T.registrado(nome) });
    } catch (falha) {
      limparBusca();
      await carregar();
      setAviso({ tipo: 'erro', texto: mensagemFalhaEquipe(falha instanceof ErroEquipe ? falha.tipo : 'incerto') });
    } finally {
      setEnviando(false);
    }
  }

  async function revogar() {
    if (!revogando) return;
    const alvo = revogando;
    setEnviando(true);
    try {
      await revogarRepresentante(pacienteId, alvo.id);
      setRevogando(null);
      await carregar();
      setAviso({ tipo: 'ok', texto: T.revogadoRepresentante(textoIdentificacao(alvo.identificacao)) });
      titulo.current?.focus();
    } catch (falha) {
      setRevogando(null);
      await carregar();
      setAviso({ tipo: 'erro', texto: mensagemFalhaEquipe(falha instanceof ErroEquipe ? falha.tipo : 'incerto') });
    } finally {
      setEnviando(false);
    }
  }

  const corpo = () => {
    if (estado.fase === 'carregando') return <div aria-busy="true" className="grid gap-2"><Esqueleto className="h-10" /><Esqueleto className="h-10" /></div>;
    if (estado.fase === 'indisponivel') return <p className="text-sm text-texto-suave">{T.indisponivel}</p>;
    if (estado.fase === 'falha') {
      return (
        <div className="grid gap-2">
          <p className="text-sm text-tinta">{mensagemFalhaEquipe(estado.tipo)}</p>
          {estado.tipo === 'leitura' ? <Botao type="button" variante="secundario" onClick={() => void carregar()}>{T.tentarNovamente}</Botao> : null}
        </div>
      );
    }
    const noLimite = estado.itens.length >= LIMITE_REPRESENTANTES;
    return (
      <div className="grid gap-6">
        <section aria-labelledby="representantes-lista" className="grid gap-2">
          <h3 id="representantes-lista" className="text-base font-semibold text-tinta">Acompanham agora</h3>
          {estado.itens.length === 0 ? (
            <p className="text-sm text-texto-suave">{T.vazioRepresentantes}</p>
          ) : (
            <ul className="grid gap-2">
              {estado.itens.map((r) => {
                const nome = textoIdentificacao(r.identificacao);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-linha px-3 py-2">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-medium text-tinta">{nome}</p>
                      <p className="text-xs text-texto-suave">
                        {rotuloVerificacao(r.tipoVerificacao)} em {formatarDataEquipe(r.verificadoEm)}
                      </p>
                    </div>
                    <Botao type="button" variante="secundario" tamanho="sm" aria-label={`${T.botaoRevogarRepresentante}: ${nome}`} onClick={() => setRevogando(r)}>
                      {T.botaoRevogarRepresentante}
                    </Botao>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section aria-labelledby="representantes-adicionar" className="grid gap-3 sm:max-w-md">
          <h3 id="representantes-adicionar" className="text-base font-semibold text-tinta">Adicionar quem acompanha</h3>
          {noLimite ? (
            <p className="text-sm text-tinta">{T.limiteRepresentantes}</p>
          ) : (
            <>
              <form
                className="grid gap-2"
                noValidate
                onSubmit={(evento) => {
                  evento.preventDefault();
                  void buscar();
                }}
              >
                <Rotulo htmlFor={idEmail}>{T.rotuloEmail}</Rotulo>
                <Campo
                  ref={campoEmail}
                  id={idEmail}
                  type="email"
                  autoComplete="off"
                  inputMode="email"
                  maxLength={254}
                  value={email}
                  aria-describedby={idAjuda}
                  aria-invalid={emailInvalido || undefined}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (busca.fase !== 'livre' && busca.fase !== 'buscando') setBusca({ fase: 'livre' });
                  }}
                />
                <p id={idAjuda} className="text-xs text-texto-suave">
                  {emailInvalido ? 'Digite um e-mail completo, como nome@exemplo.com. ' : ''}
                  {T.ajudaEmail}
                </p>
                <Botao type="submit" variante="secundario" disabled={busca.fase === 'buscando'}>
                  {busca.fase === 'buscando' ? 'Buscando' : T.botaoBuscar}
                </Botao>
              </form>
              <div role="status" aria-live="polite" className="text-sm text-tinta">
                {busca.fase === 'nao_encontrado' ? T.naoEncontrado : busca.fase === 'erro' ? busca.texto : busca.fase === 'encontrado' ? T.encontrado(textoIdentificacao(busca.identificacao)) : ''}
              </div>
              {busca.fase === 'encontrado' ? (
                <form
                  className="grid gap-2"
                  onSubmit={(evento) => {
                    evento.preventDefault();
                    void registrar();
                  }}
                >
                  <Rotulo htmlFor={idVerificacao}>{T.rotuloVerificacao}</Rotulo>
                  <Selecao id={idVerificacao} value={verificacao} required onChange={(e) => setVerificacao(e.target.value as TipoVerificacao | '')}>
                    <option value="">Escolha uma opção</option>
                    {OPCOES_VERIFICACAO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                  </Selecao>
                  <Botao type="submit" variante="primario" disabled={!verificacao || enviando}>
                    {enviando ? 'Registrando' : T.botaoRegistrar}
                  </Botao>
                </form>
              ) : null}
            </>
          )}
        </section>
        <p className="text-sm">
          <Link href={`/pacientes/${encodeURIComponent(pacienteId)}` as Route} className="font-medium text-primaria-forte underline underline-offset-2">Voltar ao prontuário</Link>
        </p>
        {titular ? (
          <p className="text-sm">
            <Link href={'/conta/delegacao' as Route} className="font-medium text-primaria-forte underline underline-offset-2">{T.linkDelegacao}</Link>
          </p>
        ) : null}
        <ModalConfirmacao
          aberto={revogando !== null}
          titulo={T.confirmarRevogarRepresentanteTitulo(revogando ? textoIdentificacao(revogando.identificacao) : '')}
          mensagem={T.confirmarRevogarRepresentanteTexto}
          rotuloConfirmar={T.botaoRevogarRepresentante}
          rotuloCancelar={T.manterRepresentante}
          confirmando={enviando}
          aoConfirmar={() => void revogar()}
          aoCancelar={() => setRevogando(null)}
        />
      </div>
    );
  };

  return (
    <section aria-label={T.tituloRepresentantes} className="grid gap-4">
      <div>
        <h2 ref={titulo} tabIndex={-1} className="text-lg font-semibold text-tinta">{T.tituloRepresentantes}</h2>
        <p className="mt-1 text-sm text-texto-suave">{T.avisoRepresentantes}</p>
      </div>
      <div role="status" aria-live="polite" className={aviso ? 'rounded-md border border-linha px-3 py-2 text-sm text-tinta' : 'sr-only'}>
        {aviso?.texto ?? ''}
      </div>
      {corpo()}
    </section>
  );
}
