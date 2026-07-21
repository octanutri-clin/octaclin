'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, HeartPulse, MessageCircle, RefreshCcw, UserRound } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import {
  DetalheFormularioRespondidoApi,
  obterFormularioRespondidoPaciente,
  obterPortalPaciente,
  PortalPacienteApi
} from '@/lib/portal-api';

function formatarDataHora(valor?: string) {
  if (!valor) return 'Sem data';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function formatarData(valor?: string) {
  if (!valor) return 'Nao informado';
  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return 'Nao informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(data);
}

function rotuloStatus(status: string) {
  const mapa: Record<string, string> = {
    agendada: 'Agendada',
    pendente: 'Pendente',
    enviado: 'Disponivel',
    respondido: 'Respondido',
    enviado_meta: 'Enviado'
  };
  return mapa[status] ?? status;
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'Sem resposta';
  if (Array.isArray(valor)) return valor.length ? valor.map(formatarValor).join(', ') : 'Sem resposta';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Nao';
  if (typeof valor === 'number') return new Intl.NumberFormat('pt-BR').format(valor);
  if (typeof valor === 'string') return valor;
  return JSON.stringify(valor);
}

export function PortalPaciente() {
  const [portal, setPortal] = useState<PortalPacienteApi | null>(null);
  const [detalheFormulario, setDetalheFormulario] = useState<DetalheFormularioRespondidoApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoDetalheId, setCarregandoDetalheId] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setPortal(await obterPortalPaciente());
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar portal.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function abrirFormularioRespondido(respostaId: string) {
    setCarregandoDetalheId(respostaId);
    setErro(null);
    try {
      setDetalheFormulario(await obterFormularioRespondidoPaciente(respostaId));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar formulario respondido.');
    } finally {
      setCarregandoDetalheId(null);
    }
  }

  return (
    <main className="min-h-screen bg-fundo text-tinta">
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primaria text-white">
              <HeartPulse size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#596273]">OctaClin</p>
              <h1 className="text-xl font-semibold">Portal do paciente</h1>
            </div>
          </div>
          <Botao type="button" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCcw className="h-4 w-4" />
            {carregando ? 'Atualizando' : 'Atualizar'}
          </Botao>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5">
        {erro ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#efb8ad] bg-[#fff4f1] px-4 py-3 text-sm text-perigo">
            <AlertTriangle size={16} />
            {erro}
          </div>
        ) : null}

        {portal ? (
          <>
            <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_repeat(4,140px)]">
              <div>
                <p className="text-sm text-[#596273]">Ola,</p>
                <h2 className="text-2xl font-semibold text-tinta">{portal.paciente.nome}</h2>
                <p className="mt-1 text-sm text-[#596273]">
                  Status {rotuloStatus(portal.paciente.statusAdesao)} - risco {portal.paciente.scoreRisco}
                </p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Consultas</p>
                <p className="text-2xl font-semibold">{portal.resumo.consultasProximas}</p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Formularios</p>
                <p className="text-2xl font-semibold">{portal.resumo.formulariosPendentes}</p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Respondidos</p>
                <p className="text-2xl font-semibold">{portal.resumo.formulariosRespondidos}</p>
              </div>
              <div className="rounded-lg border border-linha bg-white p-3">
                <p className="text-xs text-[#596273]">Mensagens</p>
                <p className="text-2xl font-semibold">{portal.resumo.mensagensRecentes}</p>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="grid gap-4">
                <section className="rounded-lg border border-linha bg-white">
                  <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                    <UserRound className="h-4 w-4 text-[#596273]" />
                    <h2 className="text-sm font-semibold">Meu perfil</h2>
                  </div>
                  <dl className="grid gap-3 p-4 sm:grid-cols-2">
                    <div className="rounded-md border border-linha bg-[#f8fafb] p-3">
                      <dt className="text-xs text-[#596273]">Contato</dt>
                      <dd className="mt-1 break-words text-sm font-semibold">{portal.perfil.contato ?? 'Nao informado'}</dd>
                    </div>
                    <div className="rounded-md border border-linha bg-[#f8fafb] p-3">
                      <dt className="text-xs text-[#596273]">Nascimento</dt>
                      <dd className="mt-1 text-sm font-semibold">{formatarData(portal.perfil.dataNascimento)}</dd>
                    </div>
                    <div className="rounded-md border border-linha bg-[#f8fafb] p-3">
                      <dt className="text-xs text-[#596273]">Ultimo check-in</dt>
                      <dd className="mt-1 text-sm font-semibold">{formatarDataHora(portal.perfil.ultimoCheckinEm)}</dd>
                    </div>
                    <div className="rounded-md border border-linha bg-[#f8fafb] p-3">
                      <dt className="text-xs text-[#596273]">Status</dt>
                      <dd className="mt-1 text-sm font-semibold">{rotuloStatus(portal.paciente.statusAdesao)}</dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-lg border border-linha bg-white">
                  <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                    <ClipboardList className="h-4 w-4 text-[#596273]" />
                    <h2 className="text-sm font-semibold">Formularios pendentes</h2>
                  </div>
                  <div className="grid gap-3 p-4">
                    {portal.formulariosPendentes.length ? (
                      portal.formulariosPendentes.map((formulario) => (
                        <article key={formulario.envioId} className="flex flex-col gap-3 rounded-md border border-linha bg-[#f8fafb] p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">{formulario.titulo}</p>
                            <p className="text-xs text-[#596273]">
                              {rotuloStatus(formulario.status)} - expira em {formatarDataHora(formulario.expiraEm)}
                            </p>
                          </div>
                          <a
                            href={formulario.linkFormulario}
                            className="inline-flex h-9 items-center justify-center rounded-md bg-primaria px-3 text-sm font-medium text-white hover:bg-[#1d6684]"
                          >
                            Responder
                          </a>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[#596273]">Nenhum formulario pendente.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-linha bg-white">
                  <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-[#596273]" />
                    <h2 className="text-sm font-semibold">Historico de formularios</h2>
                  </div>
                  <div className="grid gap-3 p-4">
                    {portal.formulariosRespondidos.length ? (
                      portal.formulariosRespondidos.map((formulario) => (
                        <article key={formulario.respostaId} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">{formulario.titulo}</p>
                              <p className="text-xs text-[#596273]">
                                Respondido em {formatarDataHora(formulario.finalizadoEm ?? formulario.respondidoEm)}
                              </p>
                            </div>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                              {formulario.scoreFinal ? `Score ${formulario.scoreFinal}` : rotuloStatus(formulario.status)}
                            </span>
                          </div>
                          <Botao
                            type="button"
                            className="mt-3"
                            onClick={() => void abrirFormularioRespondido(formulario.respostaId)}
                            disabled={carregandoDetalheId === formulario.respostaId}
                          >
                            {carregandoDetalheId === formulario.respostaId ? 'Abrindo' : 'Ver respostas'}
                          </Botao>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[#596273]">Nenhum formulario respondido ainda.</p>
                    )}
                  </div>
                </section>

                {detalheFormulario ? (
                  <section className="rounded-lg border border-linha bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-linha px-4 py-3">
                      <div>
                        <h2 className="text-sm font-semibold">{detalheFormulario.titulo}</h2>
                        <p className="mt-1 text-xs text-[#596273]">
                          Finalizado em {formatarDataHora(detalheFormulario.finalizadoEm)}
                          {detalheFormulario.scoreFinal ? ` - score ${detalheFormulario.scoreFinal}` : ''}
                        </p>
                      </div>
                      <Botao type="button" variante="fantasma" onClick={() => setDetalheFormulario(null)}>
                        Fechar
                      </Botao>
                    </div>
                    <div className="grid gap-3 p-4">
                      {detalheFormulario.descricao ? <p className="text-sm text-[#596273]">{detalheFormulario.descricao}</p> : null}
                      <dl className="grid gap-3">
                        {detalheFormulario.respostas.map((resposta) => (
                          <div key={resposta.perguntaId} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                            <dt className="flex flex-wrap items-start justify-between gap-2 text-sm font-semibold">
                              <span>{resposta.enunciado}</span>
                              <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-medium text-[#596273]">
                                {resposta.obrigatoria ? 'Obrigatoria' : 'Opcional'}
                              </span>
                            </dt>
                            <dd className="mt-2 break-words text-sm text-[#596273]">{formatarValor(resposta.valor)}</dd>
                            {resposta.scorePonderado ? (
                              <p className="mt-2 text-xs font-semibold text-[#596273]">Score {resposta.scorePonderado}</p>
                            ) : null}
                          </div>
                        ))}
                      </dl>
                    </div>
                  </section>
                ) : null}

                <section className="rounded-lg border border-linha bg-white">
                  <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                    <CalendarDays className="h-4 w-4 text-[#596273]" />
                    <h2 className="text-sm font-semibold">Proximas consultas</h2>
                  </div>
                  <div className="grid gap-3 p-4">
                    {portal.consultasProximas.length ? (
                      portal.consultasProximas.map((consulta) => (
                        <article key={consulta.id} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">{consulta.titulo}</p>
                              <p className="text-xs text-[#596273]">{formatarDataHora(consulta.inicioEm)}</p>
                            </div>
                            <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                              {rotuloStatus(consulta.status)}
                            </span>
                          </div>
                          {consulta.local ? <p className="mt-2 text-sm text-[#596273]">{consulta.local}</p> : null}
                          {consulta.googleEventHtmlLink ? (
                            <a className="mt-3 inline-flex text-sm font-semibold text-primaria" href={consulta.googleEventHtmlLink}>
                              Abrir no Google Agenda
                            </a>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-[#596273]">Nenhuma consulta futura agendada.</p>
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-lg border border-linha bg-white">
                <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
                  <MessageCircle className="h-4 w-4 text-[#596273]" />
                  <h2 className="text-sm font-semibold">Mensagens recentes</h2>
                </div>
                <div className="grid gap-3 p-4">
                  {portal.mensagensRecentes.length ? (
                    portal.mensagensRecentes.map((mensagem) => (
                      <article key={mensagem.id} className="rounded-md border border-linha bg-[#f8fafb] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{mensagem.titulo}</p>
                          <span className="rounded-full border border-linha bg-white px-2 py-1 text-xs font-semibold text-[#596273]">
                            {rotuloStatus(mensagem.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#596273]">{mensagem.texto || 'Mensagem registrada no acompanhamento.'}</p>
                        <p className="mt-3 text-xs text-[#596273]">{formatarDataHora(mensagem.enviadoEm ?? mensagem.criadoEm)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-[#596273]">Nenhuma mensagem recente.</p>
                  )}
                </div>
              </section>
            </section>
          </>
        ) : (
          <section className="rounded-lg border border-linha bg-white p-6 text-sm text-[#596273]">
            {carregando ? 'Carregando portal.' : 'Portal indisponivel.'}
          </section>
        )}
      </div>
    </main>
  );
}
