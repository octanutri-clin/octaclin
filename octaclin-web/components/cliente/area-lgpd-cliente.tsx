'use client';

import { useEffect, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import {
  assumirPedidoLgpdCliente,
  DetalhePedidoLgpdCliente,
  FiltrosPedidoLgpdCliente,
  listarPedidosLgpdCliente,
  obterPedidoLgpdCliente,
  PedidoLgpdCliente,
  prepararRascunhoLgpdCliente,
  StatusPedidoLgpdCliente,
  TipoPedidoLgpdCliente
} from '@/lib/cliente-api';

function rotuloStatus(status: StatusPedidoLgpdCliente) {
  if (status === 'em_tratamento') return 'Em tratamento';
  if (status === 'concluida') return 'Concluída';
  if (status === 'indeferida') return 'Indeferida';
  return 'Recebida';
}

function rotuloTipo(tipo: TipoPedidoLgpdCliente) {
  return tipo === 'retificacao' ? 'Retificação' : 'Exclusão';
}

function formatarDataHora(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }).format(data) + ' UTC';
}

export function AreaLgpdCliente() {
  const [filtros, setFiltros] = useState<FiltrosPedidoLgpdCliente>({ pagina: 1 });
  const [atualizacao, setAtualizacao] = useState(0);
  const [dados, setDados] = useState<{ itens: PedidoLgpdCliente[]; pagina: number; temMais: boolean } | null>(null);
  const [detalhe, setDetalhe] = useState<DetalhePedidoLgpdCliente | null>(null);
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();
    void listarPedidosLgpdCliente(filtros, controlador.signal)
      .then((resultado) => { if (!controlador.signal.aborted) { setDados(resultado); setErro(null); } })
      .catch(() => { if (!controlador.signal.aborted) setErro('Não foi possível carregar os pedidos LGPD. Tente novamente.'); })
      .finally(() => { if (!controlador.signal.aborted) setCarregando(false); });
    return () => controlador.abort();
  }, [filtros, atualizacao]);

  function aplicarFiltro(proximos: FiltrosPedidoLgpdCliente) {
    setDetalhe(null);
    setRascunho(null);
    setDados(null);
    setCarregando(true);
    setFiltros({ ...proximos, pagina: 1 });
  }

  async function abrir(protocolo: string) {
    setErro(null);
    setRascunho(null);
    setProcessando(true);
    try {
      setDetalhe(await obterPedidoLgpdCliente(protocolo));
    } catch {
      setErro('Não foi possível abrir o pedido. Tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  async function assumir() {
    if (!detalhe || processando) return;
    setProcessando(true);
    setErro(null);
    try {
      const atualizado = await assumirPedidoLgpdCliente(detalhe.protocolo);
      setDetalhe(atualizado);
      setRascunho(null);
      setAtualizacao((valor) => valor + 1);
    } catch {
      setErro('Não foi possível iniciar a tratativa. Atualize o pedido e tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  async function prepararRascunho() {
    if (!detalhe || processando) return;
    setProcessando(true);
    setErro(null);
    try {
      const resposta = await prepararRascunhoLgpdCliente(detalhe.protocolo);
      setRascunho(resposta.rascunho);
    } catch {
      setErro('Não foi possível preparar o rascunho. Atualize o pedido e tente novamente.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <section id="conta-cliente-lgpd-painel" role="tabpanel" aria-labelledby="conta-cliente-lgpd-aba" className="grid gap-5">
      <div className="rounded-lg border border-linha bg-white p-5">
        <h2 className="text-xl font-semibold text-texto-forte">Pedidos LGPD da clínica</h2>
        <p className="mt-2 text-sm text-texto-suave">Acompanhe os pedidos dos pacientes da sua clínica e inicie a tratativa. A decisão final, a eliminação de dados e a retenção são validadas pela equipe OctaClin.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <label className="grid gap-1 text-sm">Situação
            <select aria-label="Filtrar situação LGPD" value={filtros.status ?? ''} onChange={(evento) => aplicarFiltro({ ...filtros, status: evento.target.value ? evento.target.value as StatusPedidoLgpdCliente : undefined })} className="min-h-10 rounded-md border border-linha bg-white px-3">
              <option value="">Todas</option><option value="recebida">Recebida</option><option value="em_tratamento">Em tratamento</option><option value="concluida">Concluída</option><option value="indeferida">Indeferida</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">Tipo
            <select aria-label="Filtrar tipo LGPD" value={filtros.tipo ?? ''} onChange={(evento) => aplicarFiltro({ ...filtros, tipo: evento.target.value ? evento.target.value as TipoPedidoLgpdCliente : undefined })} className="min-h-10 rounded-md border border-linha bg-white px-3">
              <option value="">Todos</option><option value="retificacao">Retificação</option><option value="exclusao">Exclusão</option>
            </select>
          </label>
        </div>
      </div>
      {erro ? <p role="alert" className="rounded-md border border-perigo-borda bg-white p-4 text-sm text-perigo">{erro}</p> : null}
      {carregando ? <p role="status" className="text-sm text-texto-suave">Carregando pedidos…</p> : null}
      {dados ? <div className="rounded-lg border border-linha bg-white p-5">
        {!dados.itens.length ? <p role="status" className="text-sm text-texto-suave">Nenhum pedido encontrado.</p> : (
          <ul aria-label="Pedidos LGPD" className="divide-y divide-linha">
            {dados.itens.map((item) => <li key={item.protocolo} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0">
              <div><strong className="text-sm text-texto-forte">{item.protocolo}</strong>
                <p className="mt-1 text-xs text-texto-suave">{rotuloTipo(item.tipo)} · {rotuloStatus(item.status)} · {formatarDataHora(item.abertoEm)}</p>
              </div>
              <Botao type="button" onClick={() => void abrir(item.protocolo)} disabled={processando}>Ver pedido</Botao>
            </li>)}
          </ul>
        )}
        <nav aria-label="Paginação dos pedidos LGPD" className="flex items-center justify-between gap-3 border-t border-linha pt-4">
          <Botao type="button" disabled={dados.pagina <= 1 || carregando} onClick={() => { setDetalhe(null); setRascunho(null); setCarregando(true); setFiltros({ ...filtros, pagina: dados.pagina - 1 }); }}>Anterior</Botao>
          <span className="text-sm text-texto-suave">Página {dados.pagina}</span>
          <Botao type="button" disabled={!dados.temMais || carregando} onClick={() => { setDetalhe(null); setRascunho(null); setCarregando(true); setFiltros({ ...filtros, pagina: dados.pagina + 1 }); }}>Próxima</Botao>
        </nav>
      </div> : null}
      {detalhe ? <div className="rounded-lg border border-linha bg-white p-5">
        <h3 className="text-lg font-semibold text-texto-forte">Protocolo {detalhe.protocolo}</h3>
        <p className="mt-1 text-sm text-texto-suave">{rotuloTipo(detalhe.tipo)} · {rotuloStatus(detalhe.status)} · aberto em {formatarDataHora(detalhe.abertoEm)}</p>
        <p className="mt-4 text-sm font-semibold text-texto-forte">Descrição enviada pelo paciente</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-tinta">{detalhe.detalhes ?? 'Sem descrição adicional.'}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {detalhe.status === 'recebida' ? <Botao type="button" onClick={() => void assumir()} disabled={processando}>Iniciar tratativa</Botao> : null}
          {detalhe.status === 'recebida' || detalhe.status === 'em_tratamento' ? <Botao type="button" onClick={() => void prepararRascunho()} disabled={processando}>Preparar rascunho</Botao> : null}
        </div>
        <h4 className="mt-6 text-sm font-semibold text-texto-forte">Histórico de estados</h4>
        <ul className="mt-2 divide-y divide-linha">
          {detalhe.historico.map((evento, indice) => <li key={`${evento.criadoEm}-${indice}`} className="py-2 text-sm text-tinta">{rotuloStatus(evento.status)} · {formatarDataHora(evento.criadoEm)}{evento.tipo === 'rascunho' ? ' · rascunho preparado' : ''}</li>)}
        </ul>
        {rascunho ? <div className="mt-5 rounded-md border border-linha bg-superficie p-4">
          <label htmlFor="rascunho-lgpd-cliente" className="text-sm font-semibold text-texto-forte">Rascunho para revisão</label>
          <p className="mt-1 text-xs text-texto-suave">Esta mensagem não foi enviada ao paciente.</p>
          <textarea id="rascunho-lgpd-cliente" readOnly value={rascunho} rows={5} className="mt-3 w-full rounded-md border border-linha bg-white p-3 text-sm text-tinta" />
        </div> : null}
      </div> : null}
    </section>
  );
}
