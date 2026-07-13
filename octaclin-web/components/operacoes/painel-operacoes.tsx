'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, AlertTriangle, CheckCircle2, Download, History, RefreshCcw, Search, Smartphone, Undo2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { SessaoPublica, obterSessao, sair } from '@/lib/auth-api';
import {
  AuditoriaOperacional,
  DadosOperacionais,
  ErroApiOperacoes,
  FiltrosAuditoriaOperacional,
  FiltrosOutboxOperacional,
  OutboxFalha,
  carregarAuditoriaOperacionalPaginada,
  carregarFalhasOutboxPaginadas,
  carregarDadosOperacionais,
  reprocessarOutbox,
  urlExportacaoAuditoria,
  urlExportacaoFalhasOutbox
} from '@/lib/operacoes-api';

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data);
}

function resumirPayload(payload: OutboxFalha['payload']) {
  const mensagemId = payload?.mensagemId;
  return typeof mensagemId === 'string' ? `mensagem ${mensagemId}` : JSON.stringify(payload);
}

function resumirMetadados(metadados: AuditoriaOperacional['metadados']) {
  const pares = Object.entries(metadados ?? {});
  if (!pares.length) return '-';
  return pares.map(([chave, valor]) => `${chave}: ${String(valor)}`).join(' | ');
}

export function PainelOperacoes() {
  const router = useRouter();
  const [sessao, setSessao] = useState<SessaoPublica | null>(null);
  const [dados, setDados] = useState<DadosOperacionais | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false);
  const [reprocessandoId, setReprocessandoId] = useState<string | null>(null);
  const [filtrosAuditoria, setFiltrosAuditoria] = useState<FiltrosAuditoriaOperacional>({
    acao: '',
    recursoTipo: '',
    recursoId: '',
    usuarioId: '',
    inicio: '',
    fim: '',
    pagina: 1,
    limite: 25
  });
  const [filtrosOutbox, setFiltrosOutbox] = useState<FiltrosOutboxOperacional>({
    tipo: '',
    inicio: '',
    fim: '',
    pagina: 1,
    limite: 25
  });

  function redirecionarParaLogin() {
    setSessao(null);
    setDados(null);
    router.replace('/login?redirect=/operacoes');
  }

  async function executarAutenticado<T>(operacao: () => Promise<T>): Promise<T | null> {
    try {
      return await operacao();
    } catch (erroAtual) {
      if (erroAtual instanceof ErroApiOperacoes && erroAtual.status === 401) {
        redirecionarParaLogin();
        return null;
      }

      throw erroAtual;
    }
  }

  async function carregar() {
    if (!sessao) {
      setErro('Sessao ausente. Faca login novamente.');
      setDados(null);
      return;
    }

    setCarregando(true);
    setErro(null);
    try {
      const resposta = await executarAutenticado(carregarDadosOperacionais);
      if (resposta) setDados(resposta);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar operacoes.');
    } finally {
      setCarregando(false);
    }
  }

  async function reprocessar(eventoId: string) {
    if (!sessao) return;
    setReprocessandoId(eventoId);
    setErro(null);
    try {
      await executarAutenticado(() => reprocessarOutbox(eventoId));
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao reprocessar outbox.');
    } finally {
      setReprocessandoId(null);
    }
  }

  async function filtrarAuditoria(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!sessao) return;

    setCarregandoAuditoria(true);
    setErro(null);
    try {
      const auditoria = await executarAutenticado(() => carregarAuditoriaOperacionalPaginada({ ...filtrosAuditoria, pagina: 1 }));
      if (auditoria) {
        setFiltrosAuditoria((atual) => ({ ...atual, pagina: auditoria.pagina }));
        setDados((dadosAtuais) =>
          dadosAtuais ? { ...dadosAtuais, auditoria: auditoria.itens, auditoriaPaginada: auditoria } : dadosAtuais
        );
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar auditoria.');
    } finally {
      setCarregandoAuditoria(false);
    }
  }

  async function filtrarOutbox(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!sessao) return;

    setCarregando(true);
    setErro(null);
    try {
      const falhasPaginadas = await executarAutenticado(() => carregarFalhasOutboxPaginadas({ ...filtrosOutbox, pagina: 1 }));
      if (falhasPaginadas) {
        setFiltrosOutbox((atual) => ({ ...atual, pagina: falhasPaginadas.pagina }));
        setDados((dadosAtuais) =>
          dadosAtuais ? { ...dadosAtuais, falhas: falhasPaginadas.itens, falhasPaginadas } : dadosAtuais
        );
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar outbox.');
    } finally {
      setCarregando(false);
    }
  }

  async function trocarPaginaAuditoria(proximaPagina: number) {
    if (!sessao || proximaPagina < 1) return;
    setCarregandoAuditoria(true);
    setErro(null);
    try {
      const auditoria = await executarAutenticado(() =>
        carregarAuditoriaOperacionalPaginada({ ...filtrosAuditoria, pagina: proximaPagina })
      );
      if (auditoria) {
        setFiltrosAuditoria((atual) => ({ ...atual, pagina: auditoria.pagina }));
        setDados((dadosAtuais) =>
          dadosAtuais ? { ...dadosAtuais, auditoria: auditoria.itens, auditoriaPaginada: auditoria } : dadosAtuais
        );
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao paginar auditoria.');
    } finally {
      setCarregandoAuditoria(false);
    }
  }

  async function trocarPaginaOutbox(proximaPagina: number) {
    if (!sessao || proximaPagina < 1) return;
    setCarregando(true);
    setErro(null);
    try {
      const falhasPaginadas = await executarAutenticado(() =>
        carregarFalhasOutboxPaginadas({ ...filtrosOutbox, pagina: proximaPagina })
      );
      if (falhasPaginadas) {
        setFiltrosOutbox((atual) => ({ ...atual, pagina: falhasPaginadas.pagina }));
        setDados((dadosAtuais) =>
          dadosAtuais ? { ...dadosAtuais, falhas: falhasPaginadas.itens, falhasPaginadas } : dadosAtuais
        );
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao paginar outbox.');
    } finally {
      setCarregando(false);
    }
  }

  function exportarAuditoria() {
    window.location.href = urlExportacaoAuditoria(filtrosAuditoria);
  }

  function exportarOutbox() {
    window.location.href = urlExportacaoFalhasOutbox(filtrosOutbox);
  }

  async function encerrarSessao() {
    await sair();
    router.replace('/login?redirect=/operacoes');
  }

  useEffect(() => {
    void obterSessao().then((sessaoAtual) => {
      if (!sessaoAtual) {
        redirecionarParaLogin();
        return;
      }

      setSessao(sessaoAtual);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (sessao) {
      void carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);

  const metricas = [
    { rotulo: 'Pendentes', valor: dados?.resumo.outbox.pendente ?? 0, icone: RefreshCcw, cor: 'text-primaria' },
    { rotulo: 'Processando', valor: dados?.resumo.outbox.processando ?? 0, icone: Activity, cor: 'text-alerta' },
    { rotulo: 'Processados', valor: dados?.resumo.outbox.processado ?? 0, icone: CheckCircle2, cor: 'text-sucesso' },
    { rotulo: 'Falharam', valor: dados?.resumo.outbox.falhou ?? 0, icone: AlertTriangle, cor: 'text-perigo' }
  ];
  const auditoriaPaginada = dados?.auditoriaPaginada;
  const falhasPaginadas = dados?.falhasPaginadas;
  const totalPaginasAuditoria = auditoriaPaginada ? Math.max(Math.ceil(auditoriaPaginada.total / auditoriaPaginada.limite), 1) : 1;
  const totalPaginasOutbox = falhasPaginadas ? Math.max(Math.ceil(falhasPaginadas.total / falhasPaginadas.limite), 1) : 1;

  return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-lg border border-linha bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">{sessao?.email ?? 'Carregando sessao'}</p>
            <p className="mt-1 text-xs text-[#596273]">
              {sessao ? `${sessao.tenantSlug} em ${sessao.apiUrl}` : 'Validando acesso operacional'}
            </p>
          </div>
          <Botao onClick={encerrarSessao} variante="fantasma">
            Sair
          </Botao>
          <Botao variante="primario" onClick={carregar} disabled={carregando}>
            <RefreshCcw size={16} />
            {carregando ? 'Atualizando' : 'Atualizar'}
          </Botao>
        </section>

        {erro ? <AlertaOperacional mensagem={erro} /> : null}
        <BarraCarregamento visivel={carregando || carregandoAuditoria} />

        <section className="grid gap-3 md:grid-cols-4">
          {metricas.map((item) => (
            <div key={item.rotulo} className="rounded-lg border border-linha bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#596273]">{item.rotulo}</span>
                <item.icone className={item.cor} size={20} />
              </div>
              <p className="mt-3 text-3xl font-bold">{item.valor}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-linha bg-white">
          <div className="flex flex-col gap-3 border-b border-linha px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <History size={19} className="text-primaria" />
              <h2 className="text-base font-semibold">Auditoria sensivel</h2>
              <span className="text-sm text-[#596273]">{dados?.auditoria.length ?? 0} eventos</span>
            </div>
            <form onSubmit={filtrarAuditoria} className="grid gap-2 md:grid-cols-3 lg:grid-cols-8">
              <select
                className="h-9 rounded-md border border-linha bg-white px-2 text-sm"
                value={filtrosAuditoria.acao}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, acao: evento.target.value }))}
                aria-label="Acao"
              >
                <option value="">Todas as acoes</option>
                <option value="pacientes.listar_dados_sensiveis">Pacientes - listar</option>
                <option value="pacientes.obter_dados_sensiveis">Pacientes - detalhe</option>
                <option value="profissionais.listar_dados_sensiveis">Profissionais - listar</option>
                <option value="profissionais.obter_dados_sensiveis">Profissionais - detalhe</option>
              </select>
              <input
                className="h-9 rounded-md border border-linha px-2 text-sm"
                placeholder="Recurso"
                value={filtrosAuditoria.recursoTipo}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, recursoTipo: evento.target.value }))}
              />
              <input
                className="h-9 rounded-md border border-linha px-2 text-sm"
                placeholder="ID recurso"
                value={filtrosAuditoria.recursoId}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, recursoId: evento.target.value }))}
              />
              <input
                className="h-9 rounded-md border border-linha px-2 text-sm"
                placeholder="ID usuario"
                value={filtrosAuditoria.usuarioId}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, usuarioId: evento.target.value }))}
              />
              <input
                type="datetime-local"
                className="h-9 rounded-md border border-linha px-2 text-sm"
                value={filtrosAuditoria.inicio}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, inicio: evento.target.value }))}
                aria-label="Inicio"
              />
              <input
                type="datetime-local"
                className="h-9 rounded-md border border-linha px-2 text-sm"
                value={filtrosAuditoria.fim}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, fim: evento.target.value }))}
                aria-label="Fim"
              />
              <Botao type="submit" disabled={carregandoAuditoria}>
                <Search size={16} />
                {carregandoAuditoria ? 'Filtrando' : 'Filtrar'}
              </Botao>
              <Botao type="button" onClick={exportarAuditoria} disabled={!dados?.auditoria.length}>
                <Download size={16} />
                CSV
              </Botao>
            </form>
          </div>
          <div className="divide-y divide-linha">
            {dados?.auditoria.length ? (
              dados.auditoria.map((evento) => (
                <div key={evento.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{evento.acao}</strong>
                      <span className="rounded-sm bg-[#e8eef8] px-2 py-1 text-xs font-semibold text-primaria">
                        {evento.recursoTipo ?? 'recurso'}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-xs text-[#596273]">{evento.recursoId ?? '-'}</p>
                    <p className="mt-1 text-xs text-[#596273]">{formatarData(evento.criadoEm)}</p>
                  </div>
                  <div className="text-xs text-[#596273]">
                    <p className="break-all">Usuario: {evento.usuarioId ?? '-'}</p>
                    <p className="mt-1 break-all">IP: {evento.ip ?? '-'}</p>
                    <p className="mt-1 break-all">Agent: {evento.userAgent ?? '-'}</p>
                  </div>
                  <p className="break-all text-xs text-[#596273]">{resumirMetadados(evento.metadados)}</p>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhum evento de auditoria carregado." />
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm text-[#596273]">
              Pagina {auditoriaPaginada?.pagina ?? 1} de {totalPaginasAuditoria} | {auditoriaPaginada?.total ?? 0} eventos
            </span>
            <div className="flex gap-2">
              <Botao
                type="button"
                onClick={() => void trocarPaginaAuditoria((auditoriaPaginada?.pagina ?? 1) - 1)}
                disabled={!auditoriaPaginada || auditoriaPaginada.pagina <= 1 || carregandoAuditoria}
              >
                Anterior
              </Botao>
              <Botao
                type="button"
                onClick={() => void trocarPaginaAuditoria((auditoriaPaginada?.pagina ?? 1) + 1)}
                disabled={!auditoriaPaginada || auditoriaPaginada.pagina >= totalPaginasAuditoria || carregandoAuditoria}
              >
                Proxima
              </Botao>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="rounded-lg border border-linha bg-white">
            <div className="flex items-center justify-between border-b border-linha px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">Outbox com falha</h2>
                <span className="text-sm text-[#596273]">{falhasPaginadas?.total ?? dados?.falhas.length ?? 0} eventos</span>
              </div>
              <Botao type="button" onClick={exportarOutbox} disabled={!dados?.falhas.length}>
                <Download size={16} />
                CSV
              </Botao>
            </div>
            <form onSubmit={filtrarOutbox} className="grid gap-2 border-b border-linha px-4 py-3 md:grid-cols-4">
              <input
                className="h-9 rounded-md border border-linha px-2 text-sm"
                placeholder="Tipo"
                value={filtrosOutbox.tipo}
                onChange={(evento) => setFiltrosOutbox((atual) => ({ ...atual, tipo: evento.target.value }))}
              />
              <input
                type="datetime-local"
                className="h-9 rounded-md border border-linha px-2 text-sm"
                value={filtrosOutbox.inicio}
                onChange={(evento) => setFiltrosOutbox((atual) => ({ ...atual, inicio: evento.target.value }))}
                aria-label="Inicio outbox"
              />
              <input
                type="datetime-local"
                className="h-9 rounded-md border border-linha px-2 text-sm"
                value={filtrosOutbox.fim}
                onChange={(evento) => setFiltrosOutbox((atual) => ({ ...atual, fim: evento.target.value }))}
                aria-label="Fim outbox"
              />
              <Botao type="submit" disabled={carregando}>
                <Search size={16} />
                Filtrar
              </Botao>
            </form>
            <div className="divide-y divide-linha">
              {dados?.falhas.length ? (
                dados.falhas.map((falha) => (
                  <div key={falha.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{falha.tipo}</strong>
                        <span className="rounded-sm bg-[#f8e8e4] px-2 py-1 text-xs font-semibold text-perigo">
                          {falha.tentativas} tentativas
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#596273]">{falha.erro ?? 'Erro nao informado'}</p>
                      <p className="mt-1 break-all text-xs text-[#596273]">{resumirPayload(falha.payload)}</p>
                      <p className="mt-1 text-xs text-[#596273]">{formatarData(falha.criadoEm)}</p>
                    </div>
                    <Botao onClick={() => reprocessar(falha.id)} disabled={reprocessandoId === falha.id}>
                      <Undo2 size={16} />
                      {reprocessandoId === falha.id ? 'Enviando' : 'Reprocessar'}
                    </Botao>
                  </div>
                ))
              ) : (
                <EstadoVazio titulo="Nenhuma falha carregada." />
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
              <span className="text-sm text-[#596273]">
                Pagina {falhasPaginadas?.pagina ?? 1} de {totalPaginasOutbox} | {falhasPaginadas?.total ?? 0} eventos
              </span>
              <div className="flex gap-2">
                <Botao
                  type="button"
                  onClick={() => void trocarPaginaOutbox((falhasPaginadas?.pagina ?? 1) - 1)}
                  disabled={!falhasPaginadas || falhasPaginadas.pagina <= 1 || carregando}
                >
                  Anterior
                </Botao>
                <Botao
                  type="button"
                  onClick={() => void trocarPaginaOutbox((falhasPaginadas?.pagina ?? 1) + 1)}
                  disabled={!falhasPaginadas || falhasPaginadas.pagina >= totalPaginasOutbox || carregando}
                >
                  Proxima
                </Botao>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-linha bg-white">
            <div className="flex items-center justify-between border-b border-linha px-4 py-3">
              <h2 className="text-base font-semibold">Sync mobile</h2>
              <Smartphone size={19} className="text-primaria" />
            </div>
            <div className="divide-y divide-linha">
              {dados?.sincronizacoes.length ? (
                dados.sincronizacoes.map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm">{item.tipo}</strong>
                      <span
                        className={
                          item.status === 'sincronizado'
                            ? 'rounded-sm bg-[#e6f4ea] px-2 py-1 text-xs font-semibold text-sucesso'
                            : 'rounded-sm bg-[#f8e8e4] px-2 py-1 text-xs font-semibold text-perigo'
                        }
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-xs text-[#596273]">{item.idLocal}</p>
                    <p className="mt-1 text-xs text-[#596273]">{item.recursoId ?? item.erro ?? '-'}</p>
                    <p className="mt-1 text-xs text-[#596273]">{formatarData(item.criadoEm)}</p>
                  </div>
                ))
              ) : (
                <EstadoVazio titulo="Nenhuma sincronizacao carregada." />
              )}
            </div>
          </div>
        </section>
      </div>
  );
}
