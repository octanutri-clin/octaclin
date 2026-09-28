'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DetalheRevisaoFormularioApi, PaginaRevisoesFormularioApi,
  listarRevisoesFormulario, obterRevisaoFormulario, revisarEnvioQuestionario
} from '@/lib/questionarios-api';

function mostrarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return 'Sem resposta';
  if (Array.isArray(valor)) return valor.map(mostrarValor).join(', ');
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'number') return new Intl.NumberFormat('pt-BR').format(valor);
  return JSON.stringify(valor);
}

function mostrarData(valor?: string): string {
  if (!valor) return 'Data indisponível';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 'Data indisponível' : data.toLocaleString('pt-BR');
}

export function FilaRevisaoFormularios({ envioInicial }: { envioInicial?: string }) {
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<PaginaRevisoesFormularioApi | null>(null);
  const [selecionado, setSelecionado] = useState(envioInicial ?? '');
  const [abertura, setAbertura] = useState(0);
  const [detalhe, setDetalhe] = useState<DetalheRevisaoFormularioApi | null>(null);
  const [confirmou, setConfirmou] = useState(false);
  const [carregando, setCarregando] = useState(Boolean(envioInicial));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregarLista = useCallback(async () => {
    try {
      const resposta = await listarRevisoesFormulario(pagina);
      setLista(resposta);
      setErro('');
    } catch {
      setErro('Não foi possível carregar a fila de revisão.');
    }
  }, [pagina]);

  useEffect(() => {
    let ativo = true;
    void listarRevisoesFormulario(pagina).then((resposta) => {
      if (ativo) { setLista(resposta); setErro(''); }
    }).catch(() => { if (ativo) setErro('Não foi possível carregar a fila de revisão.'); });
    return () => { ativo = false; };
  }, [pagina]);
  useEffect(() => {
    if (!selecionado) return;
    let ativo = true;
    void obterRevisaoFormulario(selecionado).then((resposta) => {
      if (ativo) { setDetalhe(resposta); setErro(''); }
    }).catch(() => { if (ativo) setErro('Não foi possível abrir esta resposta.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [selecionado, abertura]);

  function abrirResposta(envioId: string) {
    setDetalhe(null);
    setErro('');
    setConfirmou(false);
    setCarregando(true);
    setSelecionado(envioId);
    setAbertura((atual) => atual + 1);
  }

  async function concluir() {
    if (!detalhe?.comprovanteLeitura || !confirmou || salvando) return;
    setSalvando(true);
    setErro('');
    try {
      await revisarEnvioQuestionario(detalhe.id, detalhe.comprovanteLeitura);
      setDetalhe({ ...detalhe, comprovanteLeitura: undefined, revisadoEm: new Date().toISOString() });
      setConfirmou(false);
      await carregarLista();
    } catch {
      setErro('Não foi possível concluir. Reabra a resposta e tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
    <section aria-label="Formulários aguardando revisão" className="rounded-xl border border-linha p-4">
      <h2 className="text-lg font-semibold">Pendentes ({lista?.total ?? '…'})</h2>
      {!lista && !erro ? <p role="status">Carregando fila…</p> : null}
      {lista?.itens.length === 0 ? <p>Nenhuma resposta pendente nesta página.</p> : null}
      <ul className="mt-3 divide-y divide-linha">
        {lista?.itens.map((item) => <li key={item.id} className="py-3">
          <button type="button" onClick={() => abrirResposta(item.id)} className="text-left underline focus-visible:outline-2 focus-visible:outline-offset-2">
            {item.pacienteNome} · {mostrarData(item.respondidoEm)}
          </button>
        </li>)}
      </ul>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={pagina <= 1} onClick={() => setPagina((atual) => atual - 1)}>Anterior</button>
        <span>Página {pagina}</span>
        <button type="button" disabled={!lista || pagina * lista.tamanho >= lista.total} onClick={() => setPagina((atual) => atual + 1)}>Próxima</button>
      </div>
    </section>
    <section aria-label="Resposta selecionada" className="rounded-xl border border-linha p-4">
      {erro ? <p role="alert" className="mb-3 text-red-700">{erro}</p> : null}
      {erro && selecionado ? <button type="button" className="mb-3 underline" onClick={() => abrirResposta(selecionado)}>Reabrir resposta</button> : null}
      {carregando ? <p role="status">Carregando resposta…</p> : null}
      {!detalhe && !carregando ? <p>Selecione um formulário para ler a resposta.</p> : null}
      {detalhe ? <>
        <h2 className="text-lg font-semibold">{detalhe.titulo}</h2>
        <p>{detalhe.pacienteNome} · Respondido em {mostrarData(detalhe.respondidoEm)}</p>
        {detalhe.proximaConsultaEm ? <p>Próxima consulta do paciente: {mostrarData(detalhe.proximaConsultaEm)}. <Link className="underline" href="/agenda">Abrir agenda</Link></p> : null}
        {!detalhe.versaoHistoricaDisponivel ? <p className="mt-2 text-sm">Os rótulos abaixo usam a versão atual do formulário; a versão original não está disponível.</p> : null}
        <p className="mt-3 text-sm">Síntese factual das respostas informadas. Avaliação clínica a cargo do profissional.</p>
        <ol className="mt-4 space-y-4">{detalhe.respostas.map((resposta) => <li key={resposta.perguntaId} className="border-t border-linha pt-3">
          <p className="font-semibold">{resposta.enunciado}</p>
          <p className="whitespace-pre-wrap break-words">{mostrarValor(resposta.valor)}</p>
        </li>)}</ol>
        {detalhe.respostas.length === 0 ? <p>Nenhuma resposta individual disponível.</p> : null}
        {detalhe.revisadoEm ? <p className="mt-5" role="status">Revisado em {mostrarData(detalhe.revisadoEm)}.</p> : <div className="mt-5 space-y-3">
          <label className="flex items-start gap-2"><input type="checkbox" checked={confirmou} onChange={(evento) => setConfirmou(evento.target.checked)} />Li as respostas e assumo a revisão profissional.</label>
          <button type="button" disabled={!confirmou || salvando || !detalhe.comprovanteLeitura} onClick={() => void concluir()} className="rounded-lg bg-tinta px-4 py-2 text-white disabled:opacity-50">
            {salvando ? 'Concluindo…' : 'Concluir revisão'}
          </button>
        </div>}
      </> : null}
    </section>
  </div>;
}
