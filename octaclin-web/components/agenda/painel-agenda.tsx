'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock, Mail, MessageCircle, RefreshCcw, Save, Video, XCircle } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { PacienteResumo, ProfissionalResumo, RespostaPaginada } from '@/lib/cadastros-api';
import { ConsultaAgendaApi, cancelarConsultaAgenda, carregarBootstrapAgenda, criarConsultaAgenda, remarcarConsultaAgenda } from '@/lib/agenda-api';

interface FormularioAgenda {
  pacienteId: string;
  profissionalId: string;
  inicioEm: string;
  duracaoMinutos: number;
  local: string;
  emailContato: string;
  whatsappContato: string;
  observacoes: string;
  enviarNotificacoes: boolean;
}

const formularioInicial: FormularioAgenda = {
  pacienteId: '',
  profissionalId: '',
  inicioEm: '',
  duracaoMinutos: 50,
  local: '',
  emailContato: '',
  whatsappContato: '',
  observacoes: '',
  enviarNotificacoes: true
};

function valorDatetimeLocal(data: Date) {
  const deslocamento = data.getTimezoneOffset() * 60 * 1000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16);
}

function proximoHorarioPadrao() {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  data.setHours(9, 0, 0, 0);
  return valorDatetimeLocal(data);
}

function formatarDataHora(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data invalida';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(data);
}

function duracaoConsultaMinutos(consulta: ConsultaAgendaApi) {
  const inicio = new Date(consulta.inicioEm).getTime();
  const fim = new Date(consulta.fimEm).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim <= inicio) return 50;
  return Math.round((fim - inicio) / 60000);
}

function pacientePorId(pacientes: PacienteResumo[], id: string) {
  return pacientes.find((paciente) => paciente.id === id);
}

function profissionalPorId(profissionais: ProfissionalResumo[], id?: string) {
  return profissionais.find((profissional) => profissional.id === id);
}

function contatoEmail(contato?: string) {
  return contato?.includes('@') ? contato : '';
}

function contatoWhatsapp(contato?: string) {
  if (!contato || contato.includes('@')) return '';
  return contato.replace(/\D/g, '');
}

function statusNotificacao(notificacoes: Record<string, any>, canal: 'email' | 'whatsapp') {
  const status = notificacoes?.[canal]?.status;
  const motivo = notificacoes?.[canal]?.motivo ?? notificacoes?.[canal]?.erro;
  if (status === 'enviado') return 'Enviado';
  if (status === 'ignorado') return motivo ? `Ignorado: ${motivo}` : 'Ignorado';
  if (status === 'falhou') return motivo ? `Falhou: ${motivo}` : 'Falhou';
  return 'Pendente';
}

function statusGoogle(consulta: ConsultaAgendaApi) {
  if (consulta.googleEventId) return 'Sincronizado';
  const google = consulta.notificacoes?.googleCalendar;
  if (google?.motivo === 'configuracao_ausente') return 'Configurar Google';
  if (google?.motivo) return `Pendente: ${google.motivo}`;
  return 'Pendente';
}

function statusLembrete(notificacoes: Record<string, any>) {
  const lembrete = notificacoes?.lembrete24h;
  if (lembrete?.status === 'processado') return 'Lembrete 24h enviado';
  if (lembrete?.status === 'ignorado') return 'Lembrete ignorado';
  if (lembrete?.status === 'falhou') return 'Lembrete falhou';
  return 'Lembrete pendente';
}

function statusConfirmacao(notificacoes: Record<string, any>) {
  const confirmacao = notificacoes?.confirmacaoPaciente;
  if (confirmacao?.status === 'confirmada') return 'Paciente confirmou';
  return 'Aguardando confirmacao';
}

export function PainelAgenda() {
  const [consultas, setConsultas] = useState<ConsultaAgendaApi[]>([]);
  const [pacientes, setPacientes] = useState<RespostaPaginada<PacienteResumo> | null>(null);
  const [profissionais, setProfissionais] = useState<RespostaPaginada<ProfissionalResumo> | null>(null);
  const [formulario, setFormulario] = useState<FormularioAgenda>({ ...formularioInicial, inicioEm: proximoHorarioPadrao() });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [processandoConsultaId, setProcessandoConsultaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const pacientesLista = pacientes?.itens ?? [];
  const profissionaisLista = profissionais?.itens ?? [];
  const proximasConsultas = useMemo(
    () => [...consultas].sort((a, b) => new Date(a.inicioEm).getTime() - new Date(b.inicioEm).getTime()),
    [consultas]
  );

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const bootstrap = await carregarBootstrapAgenda();
      setConsultas(bootstrap.consultas);
      setPacientes(bootstrap.pacientes);
      setProfissionais(bootstrap.profissionais);
      setFormulario((atual) => {
        const paciente = pacientePorId(bootstrap.pacientes.itens, atual.pacienteId) ?? bootstrap.pacientes.itens[0];
        const profissionalId = atual.profissionalId || paciente?.profissionalResponsavelId || bootstrap.profissionais.itens[0]?.id || '';
        return {
          ...atual,
          pacienteId: atual.pacienteId || paciente?.id || '',
          profissionalId,
          emailContato: atual.emailContato || contatoEmail(paciente?.contato),
          whatsappContato: atual.whatsappContato || contatoWhatsapp(paciente?.contato)
        };
      });
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar agenda.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function selecionarPaciente(pacienteId: string) {
    const paciente = pacientePorId(pacientesLista, pacienteId);
    setFormulario((atual) => ({
      ...atual,
      pacienteId,
      profissionalId: paciente?.profissionalResponsavelId || atual.profissionalId,
      emailContato: contatoEmail(paciente?.contato),
      whatsappContato: contatoWhatsapp(paciente?.contato)
    }));
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!formulario.pacienteId) {
      setErro('Selecione um paciente antes de agendar.');
      return;
    }
    if (!formulario.inicioEm) {
      setErro('Informe data e hora da consulta.');
      return;
    }

    setSalvando(true);
    try {
      const criada = await criarConsultaAgenda({
        pacienteId: formulario.pacienteId,
        profissionalId: formulario.profissionalId || undefined,
        inicioEm: new Date(formulario.inicioEm).toISOString(),
        duracaoMinutos: formulario.duracaoMinutos,
        local: formulario.local || undefined,
        emailContato: formulario.emailContato || undefined,
        whatsappContato: formulario.whatsappContato || undefined,
        observacoes: formulario.observacoes || undefined,
        enviarNotificacoes: formulario.enviarNotificacoes
      });
      setConsultas((atuais) => [criada, ...atuais]);
      setFormulario((atual) => ({
        ...atual,
        inicioEm: proximoHorarioPadrao(),
        local: '',
        observacoes: ''
      }));
      setSucesso('Consulta agendada. Google Calendar e notificacoes foram processados conforme configuracao.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao agendar consulta.');
    } finally {
      setSalvando(false);
    }
  }

  function atualizarConsulta(consulta: ConsultaAgendaApi) {
    setConsultas((atuais) => atuais.map((item) => (item.id === consulta.id ? consulta : item)));
  }

  async function remarcar(evento: FormEvent<HTMLFormElement>, consulta: ConsultaAgendaApi) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const inicioLocal = String(dados.get('inicioEm') ?? '');
    const duracaoMinutos = Number(dados.get('duracaoMinutos') ?? duracaoConsultaMinutos(consulta));
    const local = String(dados.get('local') ?? '').trim();

    if (!inicioLocal) {
      setErro('Informe a nova data e hora da consulta.');
      return;
    }

    setErro(null);
    setSucesso(null);
    setProcessandoConsultaId(consulta.id);
    try {
      const atualizada = await remarcarConsultaAgenda(consulta.id, {
        inicioEm: new Date(inicioLocal).toISOString(),
        duracaoMinutos,
        local: local || undefined,
        observacoes: consulta.observacoes || undefined
      });
      atualizarConsulta(atualizada);
      setSucesso('Consulta remarcada. Google Calendar foi atualizado conforme configuracao.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao remarcar consulta.');
    } finally {
      setProcessandoConsultaId(null);
    }
  }

  async function cancelar(evento: FormEvent<HTMLFormElement>, consulta: ConsultaAgendaApi) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const motivo = String(dados.get('motivo') ?? '').trim();

    setErro(null);
    setSucesso(null);
    setProcessandoConsultaId(consulta.id);
    try {
      const cancelada = await cancelarConsultaAgenda(consulta.id, { motivo: motivo || undefined });
      atualizarConsulta(cancelada);
      setSucesso('Consulta cancelada. Google Calendar foi atualizado conforme configuracao.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao cancelar consulta.');
    } finally {
      setProcessandoConsultaId(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={salvar} className="min-w-0 rounded-lg border border-linha bg-white p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Novo agendamento</h2>
            <p className="mt-1 text-sm text-texto-suave">Cria a consulta interna, sincroniza com Google Calendar e envia os avisos.</p>
          </div>
          <CalendarCheck size={20} className="text-primaria" />
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <Rotulo>Paciente</Rotulo>
            <Selecao value={formulario.pacienteId} onChange={(evento) => selecionarPaciente(evento.target.value)}>
              {pacientesLista.map((paciente) => (
                <option key={paciente.id} value={paciente.id}>
                  {paciente.nome}
                </option>
              ))}
            </Selecao>
          </label>

          <label className="grid gap-1">
            <Rotulo>Profissional</Rotulo>
            <Selecao
              value={formulario.profissionalId}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, profissionalId: evento.target.value }))}
            >
              {profissionaisLista.map((profissional) => (
                <option key={profissional.id} value={profissional.id}>
                  {profissional.nome}
                </option>
              ))}
            </Selecao>
          </label>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <label className="grid gap-1">
              <Rotulo>Data e hora</Rotulo>
              <Campo
                type="datetime-local"
                value={formulario.inicioEm}
                onChange={(evento) => setFormulario((atual) => ({ ...atual, inicioEm: evento.target.value }))}
              />
            </label>
            <label className="grid gap-1">
              <Rotulo>Duracao</Rotulo>
              <Campo
                type="number"
                min={15}
                max={480}
                step={5}
                value={formulario.duracaoMinutos}
                onChange={(evento) =>
                  setFormulario((atual) => ({ ...atual, duracaoMinutos: Number(evento.target.value) || 50 }))
                }
              />
            </label>
          </div>

          <label className="grid gap-1">
            <Rotulo>Local</Rotulo>
            <Campo
              value={formulario.local}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, local: evento.target.value }))}
              placeholder="Consultorio, videochamada ou endereco"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <Rotulo>Email</Rotulo>
              <Campo
                type="email"
                value={formulario.emailContato}
                onChange={(evento) => setFormulario((atual) => ({ ...atual, emailContato: evento.target.value }))}
                placeholder="paciente@email.com"
              />
            </label>
            <label className="grid gap-1">
              <Rotulo>WhatsApp</Rotulo>
              <Campo
                value={formulario.whatsappContato}
                onChange={(evento) => setFormulario((atual) => ({ ...atual, whatsappContato: evento.target.value }))}
                placeholder="5511999999999"
              />
            </label>
          </div>

          <label className="grid gap-1">
            <Rotulo>Observacoes</Rotulo>
            <AreaTexto
              value={formulario.observacoes}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, observacoes: evento.target.value }))}
              placeholder="Informacoes internas para o evento."
            />
          </label>

          <label className="flex items-center gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-texto-suave">
            <input
              type="checkbox"
              checked={formulario.enviarNotificacoes}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, enviarNotificacoes: evento.target.checked }))}
              className="h-4 w-4"
            />
            Enviar e-mail e mensagem ao salvar
          </label>

          {erro ? <AlertaOperacional mensagem={erro} /> : null}
          {sucesso ? (
            <div className="flex items-start gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              <span>{sucesso}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Botao type="button" onClick={carregar} disabled={carregando || salvando}>
              <RefreshCcw size={16} />
              Atualizar
            </Botao>
            <Botao type="submit" variante="primario" disabled={salvando || !pacientesLista.length}>
              <Save size={16} />
              Agendar
            </Botao>
          </div>
        </div>
      </form>

      <section className="min-w-0 rounded-lg border border-linha bg-white p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Consultas agendadas</h2>
            <p className="mt-1 text-sm text-texto-suave">{proximasConsultas.length} consultas no periodo carregado</p>
          </div>
          <BarraCarregamento visivel={carregando} rotulo="Carregando agenda" />
        </div>

        {proximasConsultas.length ? (
          <div className="grid gap-3">
            {proximasConsultas.map((consulta) => {
              const paciente = pacientePorId(pacientesLista, consulta.pacienteId);
              const profissional = profissionalPorId(profissionaisLista, consulta.profissionalId);
              return (
                <article key={consulta.id} className="rounded-lg border border-linha bg-superficie p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-tinta">
                          {consulta.pacienteNome ?? paciente?.nome ?? consulta.titulo}
                        </h3>
                        <span className="rounded-md border border-primaria-suave bg-superficie-hover px-2 py-1 text-xs font-medium text-primaria-forte">
                          {consulta.status}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-texto-suave sm:grid-cols-2">
                        <p className="flex min-w-0 items-center gap-2">
                          <Clock size={15} className="shrink-0" />
                          <span>{formatarDataHora(consulta.inicioEm)}</span>
                        </p>
                        <p className="flex min-w-0 items-center gap-2">
                          <Video size={15} className="shrink-0" />
                          <span className="truncate">{consulta.local || 'Local nao informado'}</span>
                        </p>
                        <p className="truncate">Profissional: {consulta.profissionalNome ?? profissional?.nome ?? 'Nao informado'}</p>
                        <p className="truncate">Google Calendar: {statusGoogle(consulta)}</p>
                      </div>
                    </div>

                    <div className="grid shrink-0 gap-2 text-xs text-texto-suave sm:grid-cols-2 lg:w-[360px]">
                      <span className="inline-flex items-center gap-2 rounded-md border border-linha bg-white px-2 py-2">
                        <Mail size={14} />
                        {statusNotificacao(consulta.notificacoes, 'email')}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-md border border-linha bg-white px-2 py-2">
                        <MessageCircle size={14} />
                        {statusNotificacao(consulta.notificacoes, 'whatsapp')}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-md border border-linha bg-white px-2 py-2">
                        <Clock size={14} />
                        {statusLembrete(consulta.notificacoes)}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-md border border-linha bg-white px-2 py-2">
                        <CheckCircle2 size={14} />
                        {statusConfirmacao(consulta.notificacoes)}
                      </span>
                    </div>
                  </div>

                  {consulta.observacoes ? <p className="mt-3 text-sm text-texto-suave">{consulta.observacoes}</p> : null}
                  {consulta.googleEventHtmlLink ? (
                    <a
                      href={consulta.googleEventHtmlLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-sm font-medium text-primaria hover:underline"
                    >
                      Abrir no Google Calendar
                    </a>
                  ) : null}

                  {consulta.status === 'agendada' ? (
                    <div className="mt-3 grid gap-3 border-t border-linha pt-3 xl:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
                      <form onSubmit={(evento) => remarcar(evento, consulta)} className="grid gap-2">
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_minmax(140px,1fr)]">
                          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                            Nova data e hora
                            <input
                              name="inicioEm"
                              type="datetime-local"
                              defaultValue={valorDatetimeLocal(new Date(consulta.inicioEm))}
                              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                            Nova duracao
                            <input
                              name="duracaoMinutos"
                              type="number"
                              min={15}
                              max={480}
                              step={5}
                              defaultValue={duracaoConsultaMinutos(consulta)}
                              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                            Novo local
                            <input
                              name="local"
                              defaultValue={consulta.local ?? ''}
                              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                            />
                          </label>
                        </div>
                        <div className="flex justify-end">
                          <Botao type="submit" disabled={processandoConsultaId === consulta.id}>
                            <RefreshCcw size={15} />
                            Remarcar
                          </Botao>
                        </div>
                      </form>

                      <form onSubmit={(evento) => cancelar(evento, consulta)} className="grid gap-2">
                        <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                          Motivo do cancelamento
                          <input
                            name="motivo"
                            className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                            placeholder="Opcional"
                          />
                        </label>
                        <div className="flex justify-end">
                          <Botao type="submit" disabled={processandoConsultaId === consulta.id}>
                            <XCircle size={15} />
                            Cancelar consulta
                          </Botao>
                        </div>
                      </form>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EstadoVazio titulo="Nenhuma consulta agendada" descricao="Use o formulario ao lado para criar o primeiro agendamento." />
        )}
      </section>
    </div>
  );
}
