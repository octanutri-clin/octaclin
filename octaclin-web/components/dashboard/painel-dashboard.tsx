'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ClipboardList, MessageSquareText, RefreshCcw, UserRoundCheck, UsersRound } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { type ConsultaAgendaApi } from '@/lib/agenda-api';
import { type PacienteResumo } from '@/lib/cadastros-api';
import { type MensagemNotificacaoApi } from '@/lib/comunicacoes-api';
import { carregarDashboardProfissional, type DashboardProfissionalApi } from '@/lib/dashboard-api';
import { type QuestionarioApi } from '@/lib/questionarios-api';

function formatarDataHora(valor?: string) {
  if (!valor) return 'Sem data';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data invalida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function mesmaDataLocal(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function numeroSeguro(valor: string | number | undefined) {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function textoMensagem(mensagem: MensagemNotificacaoApi) {
  const payload = mensagem.payload ?? {};
  const candidatos = [payload.texto, payload.mensagem, payload.body, payload.conteudo];
  const texto = candidatos.find((valor) => typeof valor === 'string' && valor.trim().length > 0);
  return typeof texto === 'string' ? texto : mensagem.erro ?? 'Mensagem sem texto registrado.';
}

function ordenarPorDataDesc<T>(itens: T[], obterData: (item: T) => string | undefined) {
  return [...itens].sort((a, b) => new Date(obterData(b) ?? 0).getTime() - new Date(obterData(a) ?? 0).getTime());
}

function ordenarConsultas(consultas: ConsultaAgendaApi[]) {
  return [...consultas]
    .filter((consulta) => consulta.status === 'agendada')
    .sort((a, b) => new Date(a.inicioEm).getTime() - new Date(b.inicioEm).getTime());
}

function LinkAcao({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href as any}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta transition-colors hover:bg-[#eef3f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
    >
      {children}
    </Link>
  );
}

function CartaoIndicador({
  titulo,
  valor,
  detalhe,
  icone: Icone
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  icone: typeof CalendarDays;
}) {
  return (
    <article className="rounded-md border border-linha bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-[#596273]">{titulo}</p>
          <p className="mt-2 text-2xl font-semibold text-tinta">{valor}</p>
          <p className="mt-1 text-sm text-[#596273]">{detalhe}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#eaf3f7] text-primaria">
          <Icone size={20} />
        </div>
      </div>
    </article>
  );
}

function ListaConsultas({ consultas }: { consultas: ConsultaAgendaApi[] }) {
  if (!consultas.length) return <EstadoVazio titulo="Nenhuma consulta hoje" descricao="A agenda do dia esta livre." />;

  return (
    <div className="divide-y divide-linha">
      {consultas.slice(0, 4).map((consulta) => (
        <div key={consulta.id} className="grid gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-tinta">{consulta.pacienteNome ?? consulta.titulo}</p>
            <span className="shrink-0 text-xs font-medium text-[#596273]">{formatarDataHora(consulta.inicioEm)}</span>
          </div>
          <p className="truncate text-sm text-[#596273]">{consulta.titulo}</p>
          {consulta.local ? <p className="truncate text-xs text-[#596273]">{consulta.local}</p> : null}
        </div>
      ))}
    </div>
  );
}

function ListaPacientesRecentes({ pacientes }: { pacientes: PacienteResumo[] }) {
  if (!pacientes.length) return <EstadoVazio titulo="Nenhum paciente recente" descricao="Cadastre ou importe pacientes para iniciar." />;

  return (
    <div className="divide-y divide-linha">
      {pacientes.slice(0, 4).map((paciente) => (
        <div key={paciente.id} className="grid gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-tinta">{paciente.nome}</p>
            <span className="shrink-0 rounded-md bg-[#eef3f6] px-2 py-1 text-xs text-[#596273]">{paciente.statusAdesao}</span>
          </div>
          <p className="text-sm text-[#596273]">Risco {numeroSeguro(paciente.scoreRisco)} pontos</p>
          <p className="text-xs text-[#596273]">Criado em {formatarDataHora(paciente.criadoEm)}</p>
        </div>
      ))}
    </div>
  );
}

function ListaQuestionarios({ questionarios }: { questionarios: QuestionarioApi[] }) {
  if (!questionarios.length) return <EstadoVazio titulo="Nenhum formulario pendente" descricao="Os formularios ativos estao em dia." />;

  return (
    <div className="divide-y divide-linha">
      {questionarios.slice(0, 4).map((questionario) => (
        <div key={questionario.id} className="grid gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-tinta">{questionario.titulo}</p>
            <span className="shrink-0 rounded-md bg-[#fff7e6] px-2 py-1 text-xs text-[#8a5a00]">{questionario.status}</span>
          </div>
          <p className="text-sm text-[#596273]">Versao {questionario.versao}</p>
          <p className="text-xs text-[#596273]">Atualizado em {formatarDataHora(questionario.atualizadoEm)}</p>
        </div>
      ))}
    </div>
  );
}

function ListaMensagens({ mensagens }: { mensagens: MensagemNotificacaoApi[] }) {
  if (!mensagens.length) return <EstadoVazio titulo="Nenhuma mensagem para revisar" descricao="A caixa operacional esta sem pendencias." />;

  return (
    <div className="divide-y divide-linha">
      {mensagens.slice(0, 4).map((mensagem) => (
        <div key={mensagem.id} className="grid gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-tinta">{textoMensagem(mensagem)}</p>
            <span className="shrink-0 rounded-md bg-[#eef3f6] px-2 py-1 text-xs text-[#596273]">{mensagem.status}</span>
          </div>
          <p className="text-xs text-[#596273]">{formatarDataHora(mensagem.criadoEm)}</p>
        </div>
      ))}
    </div>
  );
}

export function PainelDashboard() {
  const [dados, setDados] = useState<DashboardProfissionalApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await carregarDashboardProfissional());
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar dashboard.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const hoje = useMemo(() => new Date(), []);
  const consultasOrdenadas = useMemo(() => ordenarConsultas(dados?.consultas ?? []), [dados?.consultas]);
  const consultasHoje = useMemo(
    () => consultasOrdenadas.filter((consulta) => mesmaDataLocal(new Date(consulta.inicioEm), hoje)),
    [consultasOrdenadas, hoje]
  );
  const pacientesRecentes = useMemo(() => ordenarPorDataDesc(dados?.pacientes.itens ?? [], (paciente) => paciente.criadoEm), [dados?.pacientes.itens]);
  const pacientesRisco = useMemo(
    () => (dados?.pacientes.itens ?? []).filter((paciente) => paciente.statusAdesao === 'risco' || numeroSeguro(paciente.scoreRisco) >= 70),
    [dados?.pacientes.itens]
  );
  const questionariosPendentes = useMemo(
    () => (dados?.questionarios.itens ?? []).filter((questionario) => questionario.status === 'rascunho'),
    [dados?.questionarios.itens]
  );
  const mensagensRevisar = useMemo(
    () =>
      ordenarPorDataDesc(
        (dados?.mensagens ?? []).filter((mensagem) => ['recebido', 'falhou', 'pendente'].includes(mensagem.status)),
        (mensagem) => mensagem.criadoEm
      ),
    [dados?.mensagens]
  );

  if (carregando) return <BarraCarregamento visivel rotulo="Carregando dashboard profissional" />;

  if (erro) {
    return (
      <div className="grid gap-3">
        <AlertaOperacional mensagem={`Falha ao carregar dashboard: ${erro}`} />
        <Botao type="button" onClick={() => void carregar()}>
          <RefreshCcw size={16} />
          Tentar novamente
        </Botao>
      </div>
    );
  }

  const resumoQuestionarios =
    questionariosPendentes.length === 1 ? '1 rascunho para publicar' : `${questionariosPendentes.length} rascunhos para publicar`;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CartaoIndicador
          titulo="Consultas de hoje"
          valor={String(consultasHoje.length)}
          detalhe={`${consultasOrdenadas.length} consultas futuras na agenda`}
          icone={CalendarDays}
        />
        <CartaoIndicador
          titulo="Pacientes em risco"
          valor={String(pacientesRisco.length)}
          detalhe={`${dados?.pacientes.total ?? 0} pacientes ativos no console`}
          icone={AlertTriangle}
        />
        <CartaoIndicador titulo="Formularios pendentes" valor={String(questionariosPendentes.length)} detalhe={resumoQuestionarios} icone={ClipboardList} />
        <CartaoIndicador
          titulo="Mensagens para revisar"
          valor={String(mensagensRevisar.length)}
          detalhe="Recebidas, pendentes ou com falha"
          icone={MessageSquareText}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article className="rounded-md border border-linha bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-tinta">Consultas de hoje</h2>
              <p className="text-sm text-[#596273]">Agenda imediata para conduzir o atendimento diario.</p>
            </div>
            <LinkAcao href="/agenda">Abrir agenda</LinkAcao>
          </div>
          <ListaConsultas consultas={consultasHoje} />
        </article>

        <article className="rounded-md border border-linha bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-tinta">Pacientes recentes</h2>
              <p className="text-sm text-[#596273]">Novos cadastros e pessoas que exigem acompanhamento inicial.</p>
            </div>
            <LinkAcao href="/pacientes">Abrir pacientes</LinkAcao>
          </div>
          <ListaPacientesRecentes pacientes={pacientesRecentes} />
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-md border border-linha bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-tinta">Formularios pendentes</h2>
              <p className="text-sm text-[#596273]">Rascunhos que ainda precisam ser publicados ou revisados.</p>
            </div>
            <LinkAcao href="/questionarios">Abrir formularios</LinkAcao>
          </div>
          <ListaQuestionarios questionarios={questionariosPendentes} />
        </article>

        <article className="rounded-md border border-linha bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-tinta">Mensagens para revisar</h2>
              <p className="text-sm text-[#596273]">Entradas recentes que podem exigir resposta ou reprocessamento.</p>
            </div>
            <LinkAcao href="/comunicacoes">Abrir comunicacoes</LinkAcao>
          </div>
          <ListaMensagens mensagens={mensagensRevisar} />
        </article>
      </section>

      <section className="grid gap-3 rounded-md border border-linha bg-white p-4 md:grid-cols-3">
        <div className="flex min-w-0 items-start gap-3">
          <UsersRound size={18} className="mt-0.5 shrink-0 text-primaria" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tinta">Fila clinica</p>
            <p className="text-sm text-[#596273]">Priorize pacientes com risco alto e mensagens recebidas.</p>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-3">
          <UserRoundCheck size={18} className="mt-0.5 shrink-0 text-primaria" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tinta">Rotina diaria</p>
            <p className="text-sm text-[#596273]">Abra a agenda antes de iniciar atendimentos do dia.</p>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-3">
          <ClipboardList size={18} className="mt-0.5 shrink-0 text-primaria" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tinta">Formularios</p>
            <p className="text-sm text-[#596273]">Publique rascunhos importantes antes das proximas consultas.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
