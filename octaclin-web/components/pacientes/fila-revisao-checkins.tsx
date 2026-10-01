'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DetalheRevisaoCheckinApi, PaginaCheckinsPendentesApi, listarCheckinsPendentes, obterCheckinParaRevisao, revisarCheckin } from '@/lib/revisao-checkins-api';

function dataHora(valor?: string) {
  if (!valor) return 'Data indisponível';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 'Data indisponível' : data.toLocaleString('pt-BR');
}

const humor: Record<string, string> = { muito_bem: 'Muito bem', bem: 'Bem', neutro: 'Neutro', mal: 'Mal', muito_mal: 'Muito mal' };

export function FilaRevisaoCheckins() {
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState<PaginaCheckinsPendentesApi | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheRevisaoCheckinApi | null>(null);
  const [confirmou, setConfirmou] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregarLista = useCallback(async () => {
    try {
      setLista(await listarCheckinsPendentes(pagina));
      setErro('');
    } catch { setErro('Não foi possível carregar os registros pendentes.'); }
  }, [pagina]);

  useEffect(() => {
    let ativo = true;
    void listarCheckinsPendentes(pagina).then((dados) => {
      if (ativo) { setLista(dados); setErro(''); }
    }).catch(() => { if (ativo) setErro('Não foi possível carregar os registros pendentes.'); });
    return () => { ativo = false; };
  }, [pagina]);

  async function abrir(id: string) {
    setDetalhe(null);
    setConfirmou(false);
    setCarregando(true);
    setErro('');
    try { setDetalhe(await obterCheckinParaRevisao(id)); }
    catch { setErro('Não foi possível abrir o registro.'); }
    finally { setCarregando(false); }
  }

  async function concluir() {
    if (!confirmou || !detalhe?.comprovanteLeitura || salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const resultado = await revisarCheckin(detalhe.id, detalhe.comprovanteLeitura);
      setDetalhe({ ...detalhe, revisadoEm: resultado.revisadoEm, comprovanteLeitura: undefined });
      setConfirmou(false);
      await carregarLista();
    } catch { setErro('Não foi possível confirmar a revisão. Reabra o registro e tente novamente.'); }
    finally { setSalvando(false); }
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
    <section aria-label="Registros de hábitos aguardando revisão" className="rounded-xl border border-linha p-4">
      <h2 className="text-lg font-semibold">Pendentes ({lista?.total ?? '…'})</h2>
      {!lista && !erro ? <p role="status">Carregando fila…</p> : null}
      {lista?.itens.length === 0 ? <p>Nenhum registro pendente nesta página.</p> : null}
      <ul className="mt-3 divide-y divide-linha">
        {lista?.itens.map((item) => <li key={item.id} className="py-3">
          <button type="button" onClick={() => void abrir(item.id)} className="text-left underline focus-visible:outline-2 focus-visible:outline-offset-2">
            {item.pacienteNome} · {dataHora(item.registradoEm)}
          </button>
        </li>)}
      </ul>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={pagina <= 1} onClick={() => setPagina((atual) => atual - 1)}>Anterior</button>
        <span>Página {pagina}</span>
        <button type="button" disabled={!lista || pagina * lista.tamanho >= lista.total} onClick={() => setPagina((atual) => atual + 1)}>Próxima</button>
      </div>
    </section>
    <section aria-label="Registro de hábitos selecionado" className="rounded-xl border border-linha p-4">
      {erro ? <p role="alert" className="mb-3 text-red-700">{erro}</p> : null}
      {carregando ? <p role="status">Carregando registro…</p> : null}
      {!detalhe && !carregando ? <p>Selecione um registro para ler o conteúdo.</p> : null}
      {detalhe ? <>
        <h2 className="text-lg font-semibold">Registro de hábitos</h2>
        <p>{detalhe.pacienteNome} · Registrado em {dataHora(detalhe.registradoEm)}</p>
        <Link href={`/pacientes/${encodeURIComponent(detalhe.pacienteId)}`} className="text-sm underline">Abrir prontuário</Link>
        <dl className="mt-4 grid gap-3">
          <div><dt className="font-semibold">Humor informado</dt><dd>{detalhe.humor ? humor[detalhe.humor] ?? detalhe.humor : 'Não informado'}</dd></div>
          <div><dt className="font-semibold">Adesão declarada</dt><dd>{detalhe.adesaoPlano === undefined ? 'Não informada' : `${detalhe.adesaoPlano}%`}</dd></div>
          <div><dt className="font-semibold">Sintomas</dt><dd className="whitespace-pre-wrap break-words">{detalhe.sintomas || 'Não informados'}</dd></div>
          <div><dt className="font-semibold">Observações</dt><dd className="whitespace-pre-wrap break-words">{detalhe.observacoes || 'Não informadas'}</dd></div>
        </dl>
        <p className="mt-4 text-sm">A confirmação registra a leitura pela equipe. A avaliação clínica permanece a cargo do profissional.</p>
        {detalhe.revisadoEm ? <p className="mt-3" role="status">Visto pela equipe em {dataHora(detalhe.revisadoEm)}.</p> : <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2"><input type="checkbox" checked={confirmou} onChange={(evento) => setConfirmou(evento.target.checked)} />Li o registro e confirmo a revisão.</label>
          <button type="button" disabled={!confirmou || !detalhe.comprovanteLeitura || salvando} onClick={() => void concluir()} className="rounded-lg bg-tinta px-4 py-2 text-white disabled:opacity-50">
            {salvando ? 'Confirmando…' : 'Confirmar revisão'}
          </button>
        </div>}
      </> : null}
    </section>
  </div>;
}
