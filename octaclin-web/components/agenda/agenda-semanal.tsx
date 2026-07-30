'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Rotulo, Selecao } from '@/components/ui/campo';
import { ConsultaAgendaApi } from '@/lib/agenda-api';
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

export function AgendaSemanal({
  consultas,
  profissionais,
  googleConectado,
  onConectarGoogle,
  onDesconectarGoogle
}: AgendaSemanalProps) {
  const consultasAtivas = useMemo(() => consultas.filter(consultaAtiva), [consultas]);
  const [semanaInicio, setSemanaInicio] = useState(() => inicioDaSemana(new Date()));
  const [semanaInicializada, setSemanaInicializada] = useState(false);
  const [profissionalId, setProfissionalId] = useState('');

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

  const dias = useMemo(() => Array.from({ length: 7 }, (_, indice) => somarDias(semanaInicio, indice)), [semanaInicio]);
  const semanaFim = dias[6];
  const consultasDoProfissional = useMemo(
    () => consultasAtivas.filter((consulta) => !profissionalId || consulta.profissionalId === profissionalId),
    [consultasAtivas, profissionalId]
  );
  const consultasDaSemana = useMemo(() => {
    const limite = somarDias(semanaInicio, 7).getTime();
    return consultasDoProfissional.filter((consulta) => {
      const inicio = new Date(consulta.inicioEm).getTime();
      return inicio >= semanaInicio.getTime() && inicio < limite;
    });
  }, [consultasDoProfissional, semanaInicio]);

  const { horaInicial, horaFinal } = useMemo(() => {
    if (!consultasDaSemana.length) {
      return { horaInicial: HORA_INICIAL_PADRAO, horaFinal: HORA_FINAL_PADRAO };
    }

    const menorHora = Math.min(...consultasDaSemana.map((consulta) => new Date(consulta.inicioEm).getHours()));
    const maiorHora = Math.max(
      ...consultasDaSemana.map((consulta) => {
        const fim = new Date(consulta.fimEm);
        return fim.getHours() + (fim.getMinutes() ? 1 : 0);
      })
    );
    return {
      horaInicial: Math.max(0, Math.min(HORA_INICIAL_PADRAO, menorHora)),
      horaFinal: Math.min(24, Math.max(HORA_FINAL_PADRAO, maiorHora))
    };
  }, [consultasDaSemana]);

  const horas = useMemo(
    () => Array.from({ length: horaFinal - horaInicial }, (_, indice) => horaInicial + indice),
    [horaFinal, horaInicial]
  );
  const alturaGrade = horas.length * ALTURA_HORA;
  const hoje = new Date();

  function mudarSemana(diasParaSomar: number) {
    setSemanaInicio((atual) => somarDias(atual, diasParaSomar));
    setSemanaInicializada(true);
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

          <div className="flex items-center gap-1" role="group" aria-label="Navegar entre semanas">
            <Botao
              type="button"
              className="w-11 px-0"
              aria-label="Semana anterior"
              title="Semana anterior"
              onClick={() => mudarSemana(-7)}
            >
              <ChevronLeft size={18} />
            </Botao>
            <Botao type="button" onClick={() => {
              setSemanaInicio(inicioDaSemana(new Date()));
              setSemanaInicializada(true);
            }}>
              Hoje
            </Botao>
            <Botao
              type="button"
              className="w-11 px-0"
              aria-label="Proxima semana"
              title="Proxima semana"
              onClick={() => mudarSemana(7)}
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

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="text-sm font-semibold text-tinta">{formatarPeriodo(semanaInicio, semanaFim)}</p>
        <p className="text-xs text-texto-suave">
          {consultasDaSemana.length} {consultasDaSemana.length === 1 ? 'horario ocupado' : 'horarios ocupados'}
        </p>
      </div>

      <div className="max-w-full overflow-x-auto border-t border-linha">
        <div
          className="grid min-w-[980px]"
          style={{ gridTemplateColumns: '72px repeat(7, minmax(128px, 1fr))' }}
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
            const consultasDoDia = consultasDaSemana.filter((consulta) => mesmoDia(new Date(consulta.inicioEm), dia));
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

                {consultasDoDia.map((consulta) => {
                  const inicio = new Date(consulta.inicioEm);
                  const fim = new Date(consulta.fimEm);
                  const inicioDecimal = inicio.getHours() + inicio.getMinutes() / 60;
                  const fimDecimal = fim.getHours() + fim.getMinutes() / 60;
                  const topo = Math.max(0, (inicioDecimal - horaInicial) * ALTURA_HORA);
                  const altura = Math.max(44, (fimDecimal - inicioDecimal) * ALTURA_HORA);
                  const nome = consulta.pacienteNome ?? consulta.titulo;
                  return (
                    <a
                      key={consulta.id}
                      href={`#consulta-${consulta.id}`}
                      aria-label={`Horario ocupado: ${nome}, ${formatarHora(inicio)} a ${formatarHora(fim)}`}
                      className={cn(
                        'absolute inset-x-1 z-10 overflow-hidden rounded-md border px-2 py-1.5 text-xs shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
                        classeConsulta(consulta)
                      )}
                      style={{ top: topo, height: altura }}
                    >
                      <strong className="block truncate">{nome}</strong>
                      <span className="mt-0.5 flex items-center gap-1">
                        <Clock3 size={12} className="shrink-0" />
                        {formatarHora(inicio)} - {formatarHora(fim)}
                      </span>
                      {consulta.local && altura >= 62 ? (
                        <span className="mt-0.5 flex items-center gap-1 truncate">
                          <MapPin size={12} className="shrink-0" />
                          <span className="truncate">{consulta.local}</span>
                        </span>
                      ) : null}
                    </a>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
