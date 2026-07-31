'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, List, MapPin, X } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { ModalConfirmacao } from '@/components/ui/modal';
import {
  ConsultaAgendaApi,
  criarBloqueioManualAgenda,
  ItemFeedAgendaApi,
  listarFeedAgenda,
  removerBloqueioManualAgenda
} from '@/lib/agenda-api';
import { ProfissionalResumo } from '@/lib/cadastros-api';
import { cn } from '@/lib/utils';

const ALTURA_HORA = 64;
const HORA_INICIAL_PADRAO = 7;
const HORA_FINAL_PADRAO = 20;

interface AgendaSemanalProps {
  consultas: ConsultaAgendaApi[];
  profissionais: ProfissionalResumo[];
  googleConectado?: boolean;
  onConectarGoogle: () => void;
  onDesconectarGoogle: () => void;
  onAbrirConsulta: (consultaId: string) => void;
}

function consultaAtiva(consulta: ConsultaAgendaApi) {
  return consulta.status === 'agendada' || consulta.status === 'reagendada';
}

function inicioDaSemana(data: Date) {
  const inicio = new Date(data);
  const deslocamento = (inicio.getDay() + 6) % 7;
  inicio.setDate(inicio.getDate() - deslocamento);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

function inicioDaGradeMes(data: Date) {
  return inicioDaSemana(new Date(data.getFullYear(), data.getMonth(), 1));
}

function somarDias(data: Date, quantidade: number) {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + quantidade);
  return resultado;
}

function mesmoDia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatarHora(data: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(data);
}

function formatarDia(data: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit'
  })
    .format(data)
    .replace('.', '');
}

function formatarPeriodo(inicio: Date, fim: Date) {
  const mesmoMes = inicio.getMonth() === fim.getMonth() && inicio.getFullYear() === fim.getFullYear();
  const formato = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!mesmoMes) return `${formato.format(inicio)} - ${formato.format(fim)}`;
  return `${String(inicio.getDate()).padStart(2, '0')} - ${formato.format(fim)}`;
}

function consultaMaisProxima(consultas: ConsultaAgendaApi[]) {
  const agora = Date.now();
  return [...consultas].sort(
    (a, b) => Math.abs(new Date(a.inicioEm).getTime() - agora) - Math.abs(new Date(b.inicioEm).getTime() - agora)
  )[0];
}

function classeConsulta(consulta: ConsultaAgendaApi) {
  return consulta.status === 'reagendada'
    ? 'border-alerta-borda bg-alerta-suave text-alerta-forte'
    : 'border-primaria bg-primaria-suave text-primaria-forte';
}

function valorDatetimeLocal(data: Date) {
  const deslocamento = data.getTimezoneOffset() * 60_000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16);
}

export function AgendaSemanal({
  consultas,
  profissionais,
  googleConectado,
  onConectarGoogle,
  onDesconectarGoogle,
  onAbrirConsulta
}: AgendaSemanalProps) {
  const consultasAtivas = useMemo(() => consultas.filter(consultaAtiva), [consultas]);
  const [semanaInicio, setSemanaInicio] = useState(() => inicioDaSemana(new Date()));
  const [semanaInicializada, setSemanaInicializada] = useState(false);
  const [visao, setVisao] = useState<'dia' | 'semana' | 'mes' | 'lista'>('semana');
  const [profissionalId, setProfissionalId] = useState('');
  const [itensFeed, setItensFeed] = useState<ItemFeedAgendaApi[] | null>(null);
  const [erroFeed, setErroFeed] = useState<string | null>(null);
  const [carregandoFeed, setCarregandoFeed] = useState(false);
  const [bloqueio, setBloqueio] = useState(() => ({
    tipo: 'intervalo' as const,
    inicioEm: valorDatetimeLocal(new Date()),
    fimEm: valorDatetimeLocal(new Date(Date.now() + 60 * 60_000))
  }));
  const [bloqueioParaLiberar, setBloqueioParaLiberar] = useState<string | null>(null);
  const [liberandoBloqueio, setLiberandoBloqueio] = useState(false);

  useEffect(() => {
    if (profissionalId || !profissionais.length) return;
    setProfissionalId(consultasAtivas[0]?.profissionalId ?? profissionais[0].id);
  }, [consultasAtivas, profissionalId, profissionais]);

  useEffect(() => {
    if (semanaInicializada || !consultasAtivas.length) return;
    const referencia = consultaMaisProxima(consultasAtivas);
    setSemanaInicio(inicioDaSemana(new Date(referencia.inicioEm)));
    setSemanaInicializada(true);
  }, [consultasAtivas, semanaInicializada]);

  const periodo = useMemo(() => {
    if (visao === 'dia') {
      const inicio = new Date(semanaInicio);
      inicio.setHours(0, 0, 0, 0);
      return { inicio, fim: somarDias(inicio, 1), dias: [inicio] };
    }
    if (visao === 'mes') {
      const inicio = inicioDaGradeMes(semanaInicio);
      const ultimoDia = new Date(semanaInicio.getFullYear(), semanaInicio.getMonth() + 1, 0);
      const fim = somarDias(inicioDaSemana(ultimoDia), 7);
      return {
        inicio,
        fim,
        dias: Array.from({ length: Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) }, (_, indice) => somarDias(inicio, indice))
      };
    }
    const inicio = inicioDaSemana(semanaInicio);
    return { inicio, fim: somarDias(inicio, 7), dias: Array.from({ length: 7 }, (_, indice) => somarDias(inicio, indice)) };
  }, [semanaInicio, visao]);

  useEffect(() => {
    let cancelado = false;
    setCarregandoFeed(true);
    setErroFeed(null);
    void listarFeedAgenda({ inicioEm: periodo.inicio.toISOString(), fimEm: periodo.fim.toISOString(), profissionalId: profissionalId || undefined })
      .then((resultado) => {
        if (!cancelado) setItensFeed(resultado);
      })
      .catch((erro: unknown) => {
        if (!cancelado) setErroFeed(erro instanceof Error ? erro.message : 'Falha ao carregar disponibilidade.');
      })
      .finally(() => {
        if (!cancelado) setCarregandoFeed(false);
      });
    return () => {
      cancelado = true;
    };
  }, [consultas, periodo.fim, periodo.inicio, profissionalId]);

  const dias = periodo.dias;
  const semanaFim = dias[dias.length - 1];
  const itensDoProfissional = useMemo(
    () =>
      (itensFeed ?? consultasAtivas.map((consulta) => ({ ...consulta, tipo: 'consulta' as const }))).filter(
        (item) => !profissionalId || item.profissionalId === profissionalId
      ),
    [consultasAtivas, itensFeed, profissionalId]
  );
  const itensDaSemana = useMemo(() => {
    const limite = periodo.fim.getTime();
    return itensDoProfissional.filter((item) => {
      const inicio = new Date(item.inicioEm).getTime();
      return inicio >= periodo.inicio.getTime() && inicio < limite;
    });
  }, [itensDoProfissional, periodo.fim, periodo.inicio]);

  const { horaInicial, horaFinal } = useMemo(() => {
    if (!itensDaSemana.length) {
      return { horaInicial: HORA_INICIAL_PADRAO, horaFinal: HORA_FINAL_PADRAO };
    }

    const menorHora = Math.min(...itensDaSemana.map((item) => new Date(item.inicioEm).getHours()));
    const maiorHora = Math.max(
      ...itensDaSemana.map((item) => {
        const fim = new Date(item.fimEm);
        return fim.getHours() + (fim.getMinutes() ? 1 : 0);
      })
    );
    return {
      horaInicial: Math.max(0, Math.min(HORA_INICIAL_PADRAO, menorHora)),
      horaFinal: Math.min(24, Math.max(HORA_FINAL_PADRAO, maiorHora))
    };
  }, [itensDaSemana]);

  const horas = useMemo(
    () => Array.from({ length: horaFinal - horaInicial }, (_, indice) => horaInicial + indice),
    [horaFinal, horaInicial]
  );
  const alturaGrade = horas.length * ALTURA_HORA;
  const hoje = new Date();

  function mudarSemana(diasParaSomar: number) {
    setSemanaInicio((atual) => {
      if (visao !== 'mes') return somarDias(atual, diasParaSomar);
      return new Date(atual.getFullYear(), atual.getMonth() + Math.sign(diasParaSomar), 1);
    });
    setSemanaInicializada(true);
  }

  async function criarBloqueio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    try {
      const criado = await criarBloqueioManualAgenda({
        profissionalId: profissionalId || undefined,
        tipo: bloqueio.tipo,
        inicioEm: new Date(bloqueio.inicioEm).toISOString(),
        fimEm: new Date(bloqueio.fimEm).toISOString()
      });
      if (criado.tipo !== 'bloqueio_manual') return;
      setItensFeed((atuais) => (atuais ? [...atuais, criado].sort((a, b) => a.inicioEm.localeCompare(b.inicioEm)) : atuais));
      setErroFeed(null);
    } catch (erro) {
      setErroFeed(erro instanceof Error ? erro.message : 'Falha ao bloquear horario.');
    }
  }

  async function removerBloqueio(bloqueioId: string) {
    try {
      await removerBloqueioManualAgenda(bloqueioId);
      setItensFeed((atuais) => atuais?.filter((item) => item.id !== bloqueioId) ?? atuais);
      setErroFeed(null);
    } catch (erro) {
      setErroFeed(erro instanceof Error ? erro.message : 'Falha ao liberar horario.');
    }
  }

  return (
    <section
      role="region"
      aria-label="Agenda interna semanal"
      className="min-w-0 overflow-hidden rounded-lg border border-linha bg-white"
    >
      <header className="flex flex-col gap-4 border-b border-linha px-4 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={19} className="shrink-0 text-primaria" />
            <h2 className="text-base font-semibold text-tinta">Agenda interna</h2>
          </div>
          <p className="mt-1 text-sm text-texto-suave">
            Consultas ocupam o horario no OctaClin independentemente da integracao com o Google.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {profissionais.length > 1 ? (
            <label className="grid min-w-[220px] gap-1">
              <Rotulo>Agenda de</Rotulo>
              <Selecao value={profissionalId} onChange={(evento) => setProfissionalId(evento.target.value)}>
                {profissionais.map((profissional) => (
                  <option key={profissional.id} value={profissional.id}>
                    {profissional.nome}
                  </option>
                ))}
              </Selecao>
            </label>
          ) : null}

          <div className="flex h-10 items-center rounded-md border border-linha bg-white p-0.5" role="group" aria-label="Visualizacao da agenda">
            {(['dia', 'semana', 'mes', 'lista'] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => setVisao(opcao)}
                className={cn(
                  'h-full rounded px-2 text-xs font-semibold capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
                  visao === opcao ? 'bg-primaria text-white' : 'text-texto-suave hover:bg-superficie-hover'
                )}
              >
                {opcao === 'lista' ? <><List size={14} aria-hidden="true" />Lista</> : opcao}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1" role="group" aria-label="Navegar entre periodos">
            <Botao
              type="button"
              className="w-11 px-0"
              aria-label={visao === 'semana' ? 'Semana anterior' : 'Periodo anterior'}
              title={visao === 'semana' ? 'Semana anterior' : 'Periodo anterior'}
              onClick={() => mudarSemana(visao === 'dia' ? -1 : -7)}
            >
              <ChevronLeft size={18} />
            </Botao>
            <Botao type="button" onClick={() => {
              setSemanaInicio(visao === 'semana' ? inicioDaSemana(new Date()) : new Date());
              setSemanaInicializada(true);
            }}>
              Hoje
            </Botao>
            <Botao
              type="button"
              className="w-11 px-0"
              aria-label={visao === 'semana' ? 'Proxima semana' : 'Proximo periodo'}
              title={visao === 'semana' ? 'Proxima semana' : 'Proximo periodo'}
              onClick={() => mudarSemana(visao === 'dia' ? 1 : 7)}
            >
              <ChevronRight size={18} />
            </Botao>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 border-b border-linha bg-superficie px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-tinta">Google Agenda opcional</p>
          <p className="text-xs text-texto-suave">
            {googleConectado
              ? 'Sincronizacao conectada; a agenda interna continua sendo a fonte principal.'
              : 'Nao conectado; a agenda interna permanece ativa e bloqueando horarios.'}
          </p>
        </div>
        <Botao
          type="button"
          variante="fantasma"
          onClick={googleConectado ? onDesconectarGoogle : onConectarGoogle}
        >
          {googleConectado ? 'Desconectar Google' : 'Conectar Google'}
        </Botao>
      </div>

      <form onSubmit={(evento) => void criarBloqueio(evento)} className="grid gap-2 border-b border-linha px-4 py-3 md:grid-cols-[minmax(130px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto] md:items-end">
        <label className="grid gap-1">
          <Rotulo>Reservar como</Rotulo>
          <Selecao
            value={bloqueio.tipo}
            onChange={(evento) => setBloqueio((atual) => ({ ...atual, tipo: evento.target.value as typeof atual.tipo }))}
          >
            <option value="intervalo">Intervalo</option>
            <option value="reuniao">Reuniao</option>
            <option value="ferias">Ferias</option>
          </Selecao>
        </label>
        <label className="grid gap-1">
          <Rotulo>Inicio</Rotulo>
          <Campo
            type="datetime-local"
            required
            value={bloqueio.inicioEm}
            onChange={(evento) => setBloqueio((atual) => ({ ...atual, inicioEm: evento.target.value }))}
          />
        </label>
        <label className="grid gap-1">
          <Rotulo>Fim</Rotulo>
          <Campo
            type="datetime-local"
            required
            value={bloqueio.fimEm}
            onChange={(evento) => setBloqueio((atual) => ({ ...atual, fimEm: evento.target.value }))}
          />
        </label>
        <Botao type="submit">Bloquear horario</Botao>
      </form>

      {erroFeed ? <p role="alert" className="border-b border-alerta-borda bg-alerta-suave px-4 py-3 text-sm text-alerta-forte">{erroFeed}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="text-sm font-semibold text-tinta">{formatarPeriodo(semanaInicio, semanaFim)}</p>
        <p className="text-xs text-texto-suave">
          {itensDaSemana.length} {itensDaSemana.length === 1 ? 'horario ocupado' : 'horarios ocupados'}
          {carregandoFeed ? ' (atualizando)' : ''}
        </p>
      </div>

      {visao === 'lista' ? (
        <div className="divide-y divide-linha border-t border-linha" aria-label="Lista de horarios do periodo">
          {itensDaSemana.length ? itensDaSemana.map((item) => {
            const inicio = new Date(item.inicioEm);
            const fim = new Date(item.fimEm);
            const nome = item.tipo === 'consulta' ? item.pacienteNome ?? item.titulo : item.rotulo;
            const consulta = item.tipo === 'consulta';
            return (
              <div key={item.id} className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-tinta">{nome}</p>
                  <p className="text-xs text-texto-suave">{formatarDia(inicio)} · {formatarHora(inicio)} - {formatarHora(fim)} · {consulta ? 'Consulta' : item.tipo === 'bloqueio_manual' ? 'Horario reservado' : 'Indisponivel'}</p>
                </div>
                {consulta ? <Botao type="button" onClick={() => onAbrirConsulta(item.id)} aria-label={`Abrir detalhes de ${nome}`}>Abrir detalhes</Botao> : null}
              </div>
            );
          }) : <p className="px-4 py-8 text-sm text-texto-suave">Nenhum horario ocupado neste periodo.</p>}
        </div>
      ) : visao === 'mes' ? (
        <div className="grid grid-cols-7 border-t border-linha">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((dia) => (
            <div key={dia} className="border-b border-r border-linha bg-superficie px-2 py-2 text-center text-xs font-semibold text-texto-suave last:border-r-0">
              {dia}
            </div>
          ))}
          {dias.map((dia) => {
            const itensDoDia = itensDaSemana.filter((item) => mesmoDia(new Date(item.inicioEm), dia));
            const foraDoMes = dia.getMonth() !== semanaInicio.getMonth();
            return (
              <div key={dia.toISOString()} className={cn('min-h-28 border-b border-r border-linha p-2 last:border-r-0', foraDoMes && 'bg-superficie text-texto-sutil')}>
                <p className={cn('mb-2 text-xs font-semibold', mesmoDia(dia, hoje) && 'text-primaria-forte')}>{dia.getDate()}</p>
                <div className="grid gap-1">
                  {itensDoDia.slice(0, 3).map((item) => {
                    const nome = item.tipo === 'consulta' ? item.pacienteNome ?? item.titulo : item.rotulo;
                    return (
                      <div key={item.id} className={cn('truncate rounded border px-1.5 py-1 text-xs', item.tipo === 'consulta' ? classeConsulta(item) : 'border-linha bg-white text-texto-suave')} title={`${formatarHora(new Date(item.inicioEm))} ${nome}`}>
                        {formatarHora(new Date(item.inicioEm))} {nome}
                      </div>
                    );
                  })}
                  {itensDoDia.length > 3 ? <p className="text-xs text-texto-suave">+{itensDoDia.length - 3} horarios</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="max-w-full overflow-x-auto border-t border-linha">
        <div
          className="grid min-w-[980px]"
          style={{ gridTemplateColumns: `72px repeat(${dias.length}, minmax(128px, 1fr))` }}
        >
          <div className="border-b border-r border-linha bg-superficie" />
          {dias.map((dia) => (
            <div
              key={dia.toISOString()}
              className={cn(
                'border-b border-r border-linha px-2 py-3 text-center text-xs font-semibold uppercase text-texto-suave last:border-r-0',
                mesmoDia(dia, hoje) && 'bg-primaria-suave text-primaria-forte'
              )}
            >
              {formatarDia(dia)}
            </div>
          ))}

          <div className="relative border-r border-linha bg-superficie" style={{ height: alturaGrade }}>
            {horas.map((hora, indice) => (
              <span
                key={hora}
                className="absolute inset-x-0 -translate-y-1/2 pr-2 text-right text-xs text-texto-sutil"
                style={{ top: indice * ALTURA_HORA }}
              >
                {String(hora).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {dias.map((dia) => {
            const itensDoDia = itensDaSemana.filter((item) => mesmoDia(new Date(item.inicioEm), dia));
            return (
              <div
                key={`grade-${dia.toISOString()}`}
                className={cn('relative border-r border-linha last:border-r-0', mesmoDia(dia, hoje) && 'bg-primaria-suave/20')}
                style={{ height: alturaGrade }}
              >
                {horas.map((hora, indice) => (
                  <span
                    key={hora}
                    aria-hidden="true"
                    className="absolute inset-x-0 border-t border-linha"
                    style={{ top: indice * ALTURA_HORA }}
                  />
                ))}

                {itensDoDia.map((item) => {
                  const inicio = new Date(item.inicioEm);
                  const fim = new Date(item.fimEm);
                  const inicioDecimal = inicio.getHours() + inicio.getMinutes() / 60;
                  const fimDecimal = fim.getHours() + fim.getMinutes() / 60;
                  const topo = Math.max(0, (inicioDecimal - horaInicial) * ALTURA_HORA);
                  const altura = Math.max(44, (fimDecimal - inicioDecimal) * ALTURA_HORA);
                  const nome = item.tipo === 'consulta' ? item.pacienteNome ?? item.titulo : item.rotulo;
                  const bloqueioManual = item.tipo === 'bloqueio_manual';
                  return (
                    <div
                      key={item.id}
                      aria-label={`${bloqueioManual ? 'Horario reservado' : 'Horario ocupado'}: ${nome}, ${formatarHora(inicio)} a ${formatarHora(fim)}`}
                      className={cn(
                        'absolute inset-x-1 z-10 overflow-hidden rounded-md border px-2 py-1.5 text-xs shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
                        item.tipo === 'consulta'
                          ? classeConsulta(item)
                          : bloqueioManual
                            ? 'border-alerta-borda bg-alerta-suave text-alerta-forte'
                            : 'border-linha bg-superficie text-texto-suave'
                      )}
                      style={{ top: topo, height: altura }}
                    >
                      {bloqueioManual ? (
                        <button
                          type="button"
                          aria-label="Liberar horario reservado"
                          title="Liberar horario"
                          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded text-alerta-forte hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
                          onClick={() => setBloqueioParaLiberar(item.id)}
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                      {item.tipo === 'consulta' ? (
                        <button
                          type="button"
                          aria-label={`Horario ocupado: ${nome}, ${formatarHora(inicio)} a ${formatarHora(fim)}`}
                          className="block max-w-full truncate text-left underline-offset-2 hover:underline"
                          onClick={() => onAbrirConsulta(item.id)}
                        >
                          <strong>{nome}</strong>
                        </button>
                      ) : (
                        <strong className="block truncate">{nome}</strong>
                      )}
                      <span className="mt-0.5 flex items-center gap-1">
                        <Clock3 size={12} className="shrink-0" />
                        {formatarHora(inicio)} - {formatarHora(fim)}
                      </span>
                      {item.tipo === 'consulta' && item.local && altura >= 62 ? (
                        <span className="mt-0.5 flex items-center gap-1 truncate">
                          <MapPin size={12} className="shrink-0" />
                          <span className="truncate">{item.local}</span>
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      )}

      <ModalConfirmacao
        aberto={Boolean(bloqueioParaLiberar)}
        titulo="Liberar horario reservado"
        mensagem="O horario volta a ficar disponivel na agenda interna imediatamente."
        rotuloConfirmar="Liberar horario"
        confirmando={liberandoBloqueio}
        aoCancelar={() => setBloqueioParaLiberar(null)}
        aoConfirmar={() => {
          if (!bloqueioParaLiberar) return;
          setLiberandoBloqueio(true);
          void removerBloqueio(bloqueioParaLiberar).then(() => {
            setLiberandoBloqueio(false);
            setBloqueioParaLiberar(null);
          });
        }}
      />
    </section>
  );
}
