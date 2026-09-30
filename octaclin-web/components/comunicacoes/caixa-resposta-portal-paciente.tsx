'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Clock3, RefreshCcw, Send } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { AreaTexto } from '@/components/ui/campo';
import { EstadoVazio } from '@/components/ui/feedback';
import {
  encerrarConversaPortalPaciente,
  listarConversasPortalPaciente,
  obterConversaPortalEquipe,
  responderConversaPortalPaciente,
  type ConversaPortalEquipeApi,
  type FiltroStatusConversaPortalEquipe
} from '@/lib/comunicacoes-api';

function dataHora(valor?: string) {
  if (!valor) return 'Sem prazo';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 'Sem prazo' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

export function CaixaRespostaPortalPaciente() {
  const [conversas, setConversas] = useState<ConversaPortalEquipeApi[]>([]);
  const [selecionada, setSelecionada] = useState<ConversaPortalEquipeApi | null>(null);
  const [texto, setTexto] = useState('');
  const [somenteAtrasadas, setSomenteAtrasadas] = useState(false);
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatusConversaPortalEquipe>('aguardando_clinica');
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async (paginaSolicitada = 0, acrescentar = false) => {
    setCarregando(true);
    setErro(null);
    try {
      const fila = await listarConversasPortalPaciente(paginaSolicitada, somenteAtrasadas, statusFiltro);
      setConversas((atuais) => acrescentar ? [...atuais, ...fila.itens] : fila.itens);
      setPagina(fila.pagina);
      setTemMais(fila.temMais);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Não foi possível carregar a fila do portal.');
    } finally {
      setCarregando(false);
    }
  }, [somenteAtrasadas, statusFiltro]);

  useEffect(() => {
    const cargaInicial = window.setTimeout(() => { void carregar(); }, 0);
    const intervalo = window.setInterval(() => { void carregar(); }, 60_000);
    return () => {
      window.clearTimeout(cargaInicial);
      window.clearInterval(intervalo);
    };
  }, [carregar]);

  const listaVisivel = conversas;

  async function abrirConversa(id: string) {
    setErro(null);
    try {
      setSelecionada(await obterConversaPortalEquipe(id));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Não foi possível abrir a conversa.');
    }
  }

  async function responder(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!selecionada || !texto.trim()) return;
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const atualizada = await responderConversaPortalPaciente(selecionada.id, texto);
      setSelecionada(atualizada);
      setTexto('');
      setSucesso('Resposta enviada pelo portal seguro.');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Não foi possível enviar a resposta.');
    } finally {
      setSalvando(false);
    }
  }

  async function encerrar() {
    if (!selecionada) return;
    setSalvando(true);
    setErro(null);
    try {
      await encerrarConversaPortalPaciente(selecionada.id);
      setSelecionada(null);
      setSucesso('Conversa encerrada.');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Não foi possível encerrar a conversa.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao aria-busy={carregando}>
      <CartaoCabecalho className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CartaoTitulo>Respostas do portal</CartaoTitulo>
          {statusFiltro === 'aguardando_clinica' ? (
            <p className="mt-1 text-xs text-texto-suave">{conversas.filter((item) => item.atrasada).length} atrasadas carregadas</p>
          ) : null}
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span>Situação</span>
            <select aria-label="Situação das respostas do portal" value={statusFiltro} onChange={(evento) => {
              setConversas([]);
              setPagina(0);
              setSomenteAtrasadas(false);
              setStatusFiltro(evento.target.value as FiltroStatusConversaPortalEquipe);
            }}>
              <option value="aguardando_clinica">Aguardando clínica</option>
              <option value="aguardando_paciente">Aguardando paciente</option>
              <option value="encerrada">Encerradas</option>
              <option value="todas">Todas</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={somenteAtrasadas} disabled={statusFiltro !== 'aguardando_clinica'} onChange={(evento) => {
              setConversas([]);
              setPagina(0);
              setSomenteAtrasadas(evento.target.checked);
            }} />
            Somente atrasadas
          </label>
          <Botao type="button" variante="secundario" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar fila de respostas do portal">
            <RefreshCcw size={16} />
          </Botao>
        </div>
      </CartaoCabecalho>
      <CartaoConteudo className="grid gap-4">
        {erro ? <p role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm text-perigo">{erro}</p> : null}
        {sucesso ? <p role="status" className="rounded-md border border-sucesso-borda bg-sucesso-suave p-3 text-sm text-sucesso-forte">{sucesso}</p> : null}
        {carregando && !conversas.length ? <p role="status" className="text-sm text-texto-suave">Carregando fila…</p> : null}
        <div className="grid gap-2 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
          <div className="grid max-h-[32rem] content-start gap-2 overflow-y-auto">
            {listaVisivel.map((conversa) => (
              <button
                key={conversa.id}
                type="button"
                onClick={() => void abrirConversa(conversa.id)}
                className={`grid gap-1 rounded-md border p-3 text-left ${conversa.atrasada ? 'border-alerta-borda bg-alerta-suave' : 'border-linha bg-white'} ${selecionada?.id === conversa.id ? 'ring-2 ring-primaria' : ''}`}
              >
                <span className="font-semibold">{conversa.pacienteNome ?? 'Paciente'}</span>
                <span className="flex items-center gap-1 text-xs text-texto-suave"><Clock3 size={13} />Prazo: {dataHora(conversa.prazoRespostaEm)}</span>
                {conversa.atrasada ? <span className="text-xs font-semibold text-alerta-forte">SLA vencido</span> : null}
              </button>
            ))}
            {temMais ? (
              <Botao type="button" variante="secundario" onClick={() => void carregar(pagina + 1, true)} disabled={carregando}>
                {carregando ? 'Carregando…' : 'Carregar mais respostas'}
              </Botao>
            ) : null}
            {!listaVisivel.length && !carregando ? <EstadoVazio titulo={somenteAtrasadas ? 'Nenhuma resposta atrasada.' : 'Nenhuma resposta aguardando a clínica.'} /> : null}
          </div>
          <div className="grid content-start gap-3">
            {selecionada ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{selecionada.pacienteNome ?? 'Paciente'}</h3>
                  <span className={selecionada.atrasada ? 'text-sm font-semibold text-alerta-forte' : 'text-sm text-texto-suave'}>Prazo: {dataHora(selecionada.prazoRespostaEm)}</span>
                </div>
                <div aria-label="Histórico da conversa" aria-live="polite" className="grid max-h-80 gap-2 overflow-y-auto rounded-md border border-linha bg-superficie p-3">
                  {selecionada.mensagens.map((mensagem) => (
                    <article key={mensagem.id} className={`max-w-[90%] rounded-md border border-linha bg-white p-3 ${mensagem.autor === 'equipe' ? 'ml-auto' : ''}`}>
                      <p className="text-xs font-semibold">{mensagem.autor === 'equipe' ? 'Equipe' : 'Paciente'}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{mensagem.texto}</p>
                      <time className="mt-2 block text-xs text-texto-suave" dateTime={mensagem.criadoEm}>{dataHora(mensagem.criadoEm)}</time>
                    </article>
                  ))}
                </div>
                <form onSubmit={responder} className="grid gap-2">
                  <label htmlFor="resposta-portal-paciente" className="text-sm font-semibold">Responder pelo portal</label>
                  <AreaTexto id="resposta-portal-paciente" value={texto} onChange={(evento) => setTexto(evento.target.value)} maxLength={5000} required rows={4} />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Botao type="button" variante="secundario" onClick={() => void encerrar()} disabled={salvando}>Encerrar conversa</Botao>
                    <Botao type="submit" disabled={salvando || !texto.trim()}><Send size={15} />Enviar resposta</Botao>
                  </div>
                </form>
              </>
            ) : <EstadoVazio titulo="Selecione uma resposta do portal para ler." />}
          </div>
        </div>
      </CartaoConteudo>
    </Cartao>
  );
}
