'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Plus, RefreshCw, RotateCcw, Trash2, Webhook } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho } from '@/components/ui/cartao';
import { Modal, ModalConfirmacao } from '@/components/ui/modal';
import {
  ChaveApi,
  EntregaWebhookApi,
  EscopoApi,
  EventoWebhook,
  WebhookApi,
  criarChaveApi,
  criarWebhookApi,
  desativarWebhookApi,
  listarChavesApi,
  listarEntregasWebhookApi,
  listarWebhooksApi,
  reprocessarEntregaWebhookApi,
  revogarChaveApi,
  rotacionarChaveApi,
  rotacionarWebhookApi
} from '@/lib/integracoes-api';

const escopos: Array<{ id: EscopoApi; rotulo: string }> = [
  { id: 'pacientes:ler', rotulo: 'Consultar pacientes' },
  { id: 'pacientes:escrever', rotulo: 'Cadastrar pacientes' },
  { id: 'agenda:ler', rotulo: 'Consultar agenda' },
  { id: 'agenda:escrever', rotulo: 'Criar e cancelar consultas' }
];

const eventos: Array<{ id: EventoWebhook; rotulo: string }> = [
  { id: 'paciente.criado', rotulo: 'Paciente criado' },
  { id: 'consulta.criada', rotulo: 'Consulta criada' },
  { id: 'consulta.cancelada', rotulo: 'Consulta cancelada' },
  { id: 'formulario.respondido', rotulo: 'Formulário respondido' }
];

type Confirmacao =
  | { tipo: 'revogar-chave'; id: string; nome: string }
  | { tipo: 'desativar-webhook'; id: string; nome: string }
  | null;

export function IntegracoesApiCliente() {
  const [chaves, setChaves] = useState<ChaveApi[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookApi[]>([]);
  const [entregas, setEntregas] = useState<EntregaWebhookApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [segredo, setSegredo] = useState<{ titulo: string; valor: string } | null>(null);
  const [segredoCopiado, setSegredoCopiado] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [nomeChave, setNomeChave] = useState('Integracao principal');
  const [expiraChaveEm, setExpiraChaveEm] = useState('');
  const [escoposSelecionados, setEscoposSelecionados] = useState<EscopoApi[]>(['pacientes:ler']);
  const [nomeWebhook, setNomeWebhook] = useState('Automacao principal');
  const [urlWebhook, setUrlWebhook] = useState('');
  const [eventosSelecionados, setEventosSelecionados] = useState<EventoWebhook[]>(['paciente.criado']);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [chavesAtuais, webhooksAtuais, entregasAtuais] = await Promise.all([
        listarChavesApi(),
        listarWebhooksApi(),
        listarEntregasWebhookApi()
      ]);
      setChaves(chavesAtuais);
      setWebhooks(webhooksAtuais);
      setEntregas(entregasAtuais);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar integrações.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criarChave(evento: FormEvent) {
    evento.preventDefault();
    if (!escoposSelecionados.length) return;
    setProcessando('criar-chave');
    setErro(null);
    try {
      const criada = await criarChaveApi({
        nome: nomeChave.trim(),
        escopos: escoposSelecionados,
        ...(expiraChaveEm ? { expiraEm: new Date(expiraChaveEm).toISOString() } : {})
      });
      setSegredoCopiado(false);
      setSegredo({ titulo: 'Chave de API criada', valor: criada.valor });
      setExpiraChaveEm('');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar chave.');
    } finally {
      setProcessando(null);
    }
  }

  async function criarWebhook(evento: FormEvent) {
    evento.preventDefault();
    if (!eventosSelecionados.length) return;
    setProcessando('criar-webhook');
    setErro(null);
    try {
      const criado = await criarWebhookApi({ nome: nomeWebhook.trim(), url: urlWebhook.trim(), eventos: eventosSelecionados });
      setSegredoCopiado(false);
      setSegredo({ titulo: 'Segredo HMAC criado', valor: criado.segredo });
      setUrlWebhook('');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar webhook.');
    } finally {
      setProcessando(null);
    }
  }

  async function rotacionarChave(chave: ChaveApi) {
    setProcessando(chave.id);
    setErro(null);
    try {
      const criada = await rotacionarChaveApi(chave.id);
      setSegredoCopiado(false);
      setSegredo({ titulo: 'Nova chave de API', valor: criada.valor });
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao rotacionar chave.');
    } finally {
      setProcessando(null);
    }
  }

  async function rotacionarWebhook(webhook: WebhookApi) {
    setProcessando(webhook.id);
    setErro(null);
    try {
      const criado = await rotacionarWebhookApi(webhook.id);
      setSegredoCopiado(false);
      setSegredo({ titulo: 'Novo segredo HMAC', valor: criado.segredo });
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao rotacionar segredo.');
    } finally {
      setProcessando(null);
    }
  }

  async function confirmar() {
    if (!confirmacao) return;
    setProcessando(confirmacao.id);
    try {
      if (confirmacao.tipo === 'revogar-chave') await revogarChaveApi(confirmacao.id);
      else await desativarWebhookApi(confirmacao.id);
      setConfirmacao(null);
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao concluir ação.');
    } finally {
      setProcessando(null);
    }
  }

  async function reprocessar(entrega: EntregaWebhookApi) {
    setProcessando(entrega.id);
    try {
      await reprocessarEntregaWebhookApi(entrega.id);
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao reprocessar entrega.');
    } finally {
      setProcessando(null);
    }
  }

  async function copiarSegredo() {
    if (!segredo) return;
    try {
      await navigator.clipboard.writeText(segredo.valor);
      setSegredoCopiado(true);
    } catch {
      setErro('Não foi possível copiar automaticamente. Selecione a credencial e armazene-a no cofre da integração.');
    }
  }

  return (
    <div className="grid gap-4" aria-busy={carregando}>
      {erro ? <p className="rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm text-perigo" role="alert">{erro}</p> : null}

      <Cartao>
        <CartaoCabecalho>
          <KeyRound className="h-4 w-4 text-texto-suave" />
          <div><h2 className="text-sm font-semibold">Chaves de API</h2><p className="mt-1 text-sm text-texto-suave">Acesso externo limitado aos escopos escolhidos.</p></div>
        </CartaoCabecalho>
        <form onSubmit={criarChave} className="grid gap-3 border-b border-linha p-4">
          <div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-semibold text-texto-suave">Nome da chave<input className="h-11 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta" value={nomeChave} onChange={(e) => setNomeChave(e.target.value)} maxLength={120} required /></label><label className="grid gap-1 text-xs font-semibold text-texto-suave">Expiração opcional<input className="h-11 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta" type="datetime-local" value={expiraChaveEm} onChange={(e) => setExpiraChaveEm(e.target.value)} /></label></div>
          <fieldset><legend className="text-xs font-semibold text-texto-suave">Permissões</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{escopos.map((item) => <label key={item.id} className="flex min-h-11 items-center gap-2 rounded-md border border-linha px-3 text-sm"><input type="checkbox" checked={escoposSelecionados.includes(item.id)} onChange={(e) => setEscoposSelecionados((atuais) => e.target.checked ? [...atuais, item.id] : atuais.filter((id) => id !== item.id))} />{item.rotulo}</label>)}</div></fieldset>
          <div className="flex justify-end"><Botao type="submit" variante="primario" disabled={processando === 'criar-chave' || !escoposSelecionados.length}><Plus size={16} />Criar chave</Botao></div>
        </form>
        <div className="divide-y divide-linha">{chaves.length ? chaves.map((chave) => <div key={chave.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium text-texto-forte">{chave.nome}</p><p className="mt-1 font-mono text-xs text-texto-suave">{chave.prefixo}...</p><p className="mt-1 text-xs text-texto-suave">{chave.escopos.join(' · ')}{chave.expiraEm ? ` · Expira ${new Date(chave.expiraEm).toLocaleString('pt-BR')}` : ' · Sem expiração'}{chave.revogadaEm ? ' · Revogada' : chave.ultimoUsoEm ? ` · Ultimo uso ${new Date(chave.ultimoUsoEm).toLocaleString('pt-BR')}` : ' · Nunca utilizada'}</p></div>{!chave.revogadaEm ? <div className="flex gap-2"><Botao type="button" variante="secundario" onClick={() => void rotacionarChave(chave)} disabled={processando === chave.id} title="Rotacionar chave"><RotateCcw size={16} />Rotacionar</Botao><Botao type="button" variante="perigo" onClick={() => setConfirmacao({ tipo: 'revogar-chave', id: chave.id, nome: chave.nome })} disabled={processando === chave.id} title="Revogar chave"><Trash2 size={16} />Revogar</Botao></div> : null}</div>) : <p className="p-4 text-sm text-texto-suave">Nenhuma chave criada.</p>}</div>
      </Cartao>

      <Cartao>
        <CartaoCabecalho><Webhook className="h-4 w-4 text-texto-suave" /><div><h2 className="text-sm font-semibold">Webhooks de saida</h2><p className="mt-1 text-sm text-texto-suave">Eventos assinados, sem nomes, contatos ou respostas clínicas.</p></div></CartaoCabecalho>
        <form onSubmit={criarWebhook} className="grid gap-3 border-b border-linha p-4">
          <div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-semibold text-texto-suave">Nome<input className="h-11 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta" value={nomeWebhook} onChange={(e) => setNomeWebhook(e.target.value)} maxLength={120} required /></label><label className="grid gap-1 text-xs font-semibold text-texto-suave">URL HTTPS<input className="h-11 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta" type="url" value={urlWebhook} onChange={(e) => setUrlWebhook(e.target.value)} placeholder="https://automacao.exemplo.com/webhook" required /></label></div>
          <fieldset><legend className="text-xs font-semibold text-texto-suave">Eventos</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{eventos.map((item) => <label key={item.id} className="flex min-h-11 items-center gap-2 rounded-md border border-linha px-3 text-sm"><input type="checkbox" checked={eventosSelecionados.includes(item.id)} onChange={(e) => setEventosSelecionados((atuais) => e.target.checked ? [...atuais, item.id] : atuais.filter((id) => id !== item.id))} />{item.rotulo}</label>)}</div></fieldset>
          <div className="flex justify-end"><Botao type="submit" variante="primario" disabled={processando === 'criar-webhook' || !eventosSelecionados.length}><Plus size={16} />Criar webhook</Botao></div>
        </form>
        <div className="divide-y divide-linha">{webhooks.length ? webhooks.map((webhook) => <div key={webhook.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium text-texto-forte">{webhook.nome}</p><p className="mt-1 break-all text-xs text-texto-suave">{webhook.url}</p><p className="mt-1 text-xs text-texto-suave">{webhook.eventos.join(' · ')} · {webhook.ativo ? 'Ativo' : 'Desativado'}</p></div>{webhook.ativo ? <div className="flex gap-2"><Botao type="button" variante="secundario" onClick={() => void rotacionarWebhook(webhook)} disabled={processando === webhook.id}><RotateCcw size={16} />Segredo</Botao><Botao type="button" variante="perigo" onClick={() => setConfirmacao({ tipo: 'desativar-webhook', id: webhook.id, nome: webhook.nome })} disabled={processando === webhook.id}><Trash2 size={16} />Desativar</Botao></div> : null}</div>) : <p className="p-4 text-sm text-texto-suave">Nenhum webhook configurado.</p>}</div>
      </Cartao>

      <Cartao>
        <CartaoCabecalho><RefreshCw className="h-4 w-4 text-texto-suave" /><div><h2 className="text-sm font-semibold">Entregas recentes</h2><p className="mt-1 text-sm text-texto-suave">Tentativas, falhas e reprocessamento manual.</p></div></CartaoCabecalho>
        <div className="divide-y divide-linha">{entregas.length ? entregas.slice(0, 30).map((entrega) => <div key={entrega.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-texto-forte">{entrega.evento}</p><p className="mt-1 text-xs text-texto-suave">{entrega.status} · {entrega.tentativas} tentativa(s){entrega.ultimoStatusHttp ? ` · HTTP ${entrega.ultimoStatusHttp}` : ''}</p>{entrega.ultimoErro ? <p className="mt-1 text-xs text-perigo">{entrega.ultimoErro}</p> : null}</div>{entrega.status === 'falhou' ? <Botao type="button" variante="secundario" onClick={() => void reprocessar(entrega)} disabled={processando === entrega.id}><RefreshCw size={16} />Reprocessar</Botao> : null}</div>) : <p className="p-4 text-sm text-texto-suave">Nenhuma entrega registrada.</p>}</div>
      </Cartao>

      <Modal aberto={Boolean(segredo)} aoFechar={() => { setSegredo(null); setSegredoCopiado(false); }} titulo={segredo?.titulo ?? 'Credencial criada'} descricao="Esta credencial será exibida somente agora. Armazene-a no cofre da integração.">
        <div className="grid gap-3"><code className="max-h-40 overflow-auto break-all rounded-md border border-linha bg-superficie p-3 text-xs">{segredo?.valor}</code><div className="flex justify-end"><Botao type="button" variante="primario" onClick={() => void copiarSegredo()}>{segredoCopiado ? <Check size={16} /> : <Copy size={16} />}{segredoCopiado ? 'Copiado' : 'Copiar'}</Botao></div></div>
      </Modal>
      <ModalConfirmacao aberto={Boolean(confirmacao)} titulo={confirmacao?.tipo === 'revogar-chave' ? 'Revogar chave' : 'Desativar webhook'} mensagem={`Esta acao interrompe imediatamente ${confirmacao?.nome ?? 'a integracao'}.`} rotuloConfirmar="Confirmar" confirmando={Boolean(confirmacao && processando === confirmacao.id)} aoConfirmar={() => void confirmar()} aoCancelar={() => setConfirmacao(null)} />
    </div>
  );
}
