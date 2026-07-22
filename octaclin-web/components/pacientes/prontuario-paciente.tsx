'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ClipboardList, MessageSquareText, RefreshCcw, Stethoscope, UserRound } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { obterProntuarioPaciente, type EventoProntuarioPacienteApi, type ProntuarioPacienteApi } from '@/lib/prontuario-api';

function formatarDataHora(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(data);
}

function rotuloTipo(tipo: EventoProntuarioPacienteApi['tipo']) {
  const rotulos: Record<EventoProntuarioPacienteApi['tipo'], string> = {
    consulta: 'Consulta',
    formulario: 'Formulario',
    resposta_formulario: 'Resposta',
    mensagem: 'Mensagem'
  };
  return rotulos[tipo];
}

function classeStatus(status?: string) {
  if (status === 'falhou' || status === 'cancelada') return 'bg-[#f8e8e4] text-perigo';
  if (status === 'respondido' || status === 'finalizado' || status === 'agendada') return 'bg-[#e6f4ea] text-sucesso';
  return 'bg-[#eef3f6] text-[#596273]';
}

function iconeEvento(tipo: EventoProntuarioPacienteApi['tipo']) {
  if (tipo === 'consulta') return CalendarDays;
  if (tipo === 'mensagem') return MessageSquareText;
  return ClipboardList;
}

function CartaoResumo({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <article className="rounded-md border border-linha bg-white p-4">
      <p className="text-xs font-semibold uppercase text-[#596273]">{titulo}</p>
      <p className="mt-2 text-2xl font-semibold text-tinta">{valor}</p>
      <p className="mt-1 text-sm text-[#596273]">{detalhe}</p>
    </article>
  );
}

function LinhaDoTempo({ eventos }: { eventos: EventoProntuarioPacienteApi[] }) {
  if (!eventos.length) {
    return <EstadoVazio titulo="Sem eventos no prontuario" descricao="Agenda, formularios, respostas e mensagens aparecerao aqui." />;
  }

  return (
    <div className="grid gap-3">
      {eventos.map((evento) => {
        const Icone = iconeEvento(evento.tipo);
        return (
          <article key={`${evento.tipo}-${evento.id}`} className="grid gap-2 rounded-md border border-linha bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eaf3f7] text-primaria">
                  <Icone size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-[#596273]">{rotuloTipo(evento.tipo)}</p>
                  <h3 className="mt-1 break-words text-sm font-semibold text-tinta">{evento.titulo}</h3>
                  {evento.descricao ? <p className="mt-1 break-words text-sm text-[#596273]">{evento.descricao}</p> : null}
                </div>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs text-[#596273]">{formatarDataHora(evento.data)}</p>
                {evento.status ? (
                  <span className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${classeStatus(evento.status)}`}>
                    {evento.status}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ProntuarioPaciente({ pacienteId }: { pacienteId: string }) {
  const [dados, setDados] = useState<ProntuarioPacienteApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await obterProntuarioPaciente(pacienteId));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar prontuario.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, [pacienteId]);

  const eventos = useMemo(() => dados?.linhaDoTempo ?? [], [dados?.linhaDoTempo]);

  if (carregando) return <BarraCarregamento visivel rotulo="Carregando prontuario do paciente" />;

  if (erro) {
    return (
      <div className="grid gap-3">
        <AlertaOperacional mensagem={`Falha ao carregar prontuario: ${erro}`} />
        <Botao type="button" onClick={() => void carregar()}>
          <RefreshCcw size={16} />
          Tentar novamente
        </Botao>
      </div>
    );
  }

  if (!dados) return <EstadoVazio titulo="Prontuario indisponivel" descricao="Nao foi possivel carregar os dados do paciente." />;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-linha bg-white p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#eaf3f7] text-primaria">
            <UserRound size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-tinta">{dados.paciente.nome}</h2>
            <p className="mt-1 text-sm text-[#596273]">
              Risco {Number(dados.paciente.scoreRisco).toFixed(0)} pontos - {dados.paciente.statusAdesao}
            </p>
            <p className="mt-1 text-sm text-[#596273]">
              Contato {dados.paciente.contato ?? '-'} - Nascimento {formatarData(dados.paciente.dataNascimento)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/pacientes"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta transition-colors hover:bg-[#eef3f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          >
            <ArrowLeft size={16} />
            Voltar para pacientes
          </Link>
          <Botao type="button" onClick={() => void carregar()}>
            <RefreshCcw size={16} />
            Atualizar
          </Botao>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CartaoResumo titulo="Consultas" valor={String(dados.resumo.consultas)} detalhe="Eventos de agenda vinculados" />
        <CartaoResumo titulo="Formularios pendentes" valor={String(dados.resumo.formulariosPendentes)} detalhe="Envios aguardando resposta" />
        <CartaoResumo titulo="Respostas" valor={String(dados.resumo.respostas)} detalhe="Check-ins finalizados ou em andamento" />
        <CartaoResumo titulo="Mensagens" valor={String(dados.resumo.mensagens)} detalhe="Interacoes registradas" />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <article className="grid gap-3">
          <div className="rounded-md border border-linha bg-white p-4">
            <h2 className="text-base font-semibold text-tinta">Linha do tempo clinica</h2>
            <p className="mt-1 text-sm text-[#596273]">Consultas, formularios, respostas e mensagens em ordem cronologica.</p>
          </div>
          <LinhaDoTempo eventos={eventos} />
        </article>

        <aside className="grid h-fit gap-3 rounded-md border border-linha bg-white p-4">
          <div className="flex items-start gap-2">
            <Stethoscope size={18} className="mt-0.5 shrink-0 text-primaria" />
            <div>
              <h2 className="text-base font-semibold text-tinta">Atalhos do prontuario</h2>
              <p className="mt-1 text-sm text-[#596273]">Abra os modulos conectados para agir sobre o acompanhamento.</p>
            </div>
          </div>
          <Link className="text-sm font-medium text-primaria hover:underline" href="/agenda">
            Abrir agenda
          </Link>
          <Link className="text-sm font-medium text-primaria hover:underline" href="/questionarios">
            Abrir formularios
          </Link>
          <Link className="text-sm font-medium text-primaria hover:underline" href="/comunicacoes">
            Abrir comunicacoes
          </Link>
        </aside>
      </section>
    </div>
  );
}
