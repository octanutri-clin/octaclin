'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  EyeOff,
  MessageSquareWarning,
  RefreshCcw,
  UserRoundPlus,
  XCircle
} from 'lucide-react';
import { obterSessao, type SessaoPublica } from '@/lib/auth-api';
import { registrarDesfechoConsulta } from '@/lib/agenda-api';
import { listarProfissionais, type ProfissionalResumo } from '@/lib/cadastros-api';
import {
  carregarResumoDashboardClinico,
  concluirTarefaDashboardClinico,
  ocultarAlertaDashboardClinico,
  type PeriodoDashboardClinico,
  type ResumoDashboardClinicoApi,
  type StatusConsultaClinica
} from '@/lib/dashboard-api';
import { revisarEnvioQuestionario } from '@/lib/questionarios-api';
import { Botao } from '@/components/ui/botao';
import { Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';

const periodos: { valor: PeriodoDashboardClinico; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'sete_dias', rotulo: '7 dias' },
  { valor: 'trinta_dias', rotulo: '30 dias' }
];

function formatarDataHora(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data indisponivel';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function nomeStatusConsulta(status: StatusConsultaClinica) {
  return { agendada: 'Agendada', reagendada: 'Reagendada', concluida: 'Concluida', falta: 'Falta', cancelada: 'Cancelada' }[status];
}

function nomeAlerta(tipo: string) {
  return {
    sem_retorno_risco_alto: 'Paciente de risco sem retorno',
    tarefa_vencida: 'Tarefa vencida',
    atendimento_proximo: 'Atendimento proximo',
    formulario_pendente: 'Formulario pendente',
    solicitacao_pendente: 'Solicitacao pendente',
    comunicacao_alerta: 'Comunicacao requer atencao'
  }[tipo] ?? 'Alerta clinico';
}

function podeAgir(sessao: SessaoPublica | null, permissao: string) {
  return Boolean(sessao?.permissoes.includes(permissao));
}

function LinkAcao({ href, children }: { href: Route; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium text-tinta hover:bg-superficie-hover">{children}</Link>;
}

function Indicador({ titulo, valor, detalhe, icone: Icone }: { titulo: string; valor: number; detalhe: string; icone: typeof CalendarDays }) {
  return <article className="min-w-0 rounded-md border border-linha bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase text-texto-suave">{titulo}</p><p className="mt-1 text-2xl font-semibold text-tinta">{valor}</p><p className="mt-1 text-xs text-texto-suave">{detalhe}</p></div><Icone size={18} className="shrink-0 text-primaria" /></div></article>;
}

function CabecalhoFila({ titulo, detalhe, children }: { titulo: string; detalhe: string; children?: React.ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-tinta">{titulo}</h2><p className="text-sm text-texto-suave">{detalhe}</p></div>{children}</div>;
}

export function PainelDashboard() {
  const parametros = useSearchParams();
  const [sessao, setSessao] = useState<SessaoPublica | null>(null);
  const [profissionais, setProfissionais] = useState<ProfissionalResumo[]>([]);
  const [periodo, setPeriodo] = useState<PeriodoDashboardClinico>('hoje');
  const [profissionalId, setProfissionalId] = useState('');
  const [dados, setDados] = useState<ResumoDashboardClinicoApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const superAdmin = sessao?.papel === 'SuperAdmin';
  const profissional = sessao?.papel === 'Professional';
  const podeContexto = superAdmin && podeAgir(sessao, 'profissionais.ler');

  useEffect(() => {
    let ativo = true;
    void obterSessao().then(async (sessaoAtual) => {
      if (!ativo) return;
      setSessao(sessaoAtual);
      if (sessaoAtual?.papel === 'SuperAdmin' && sessaoAtual.permissoes.includes('profissionais.ler')) {
        const resposta = await listarProfissionais();
        if (ativo) setProfissionais(resposta.itens);
      }
    }).catch(() => ativo && setSessao(null));
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (superAdmin) setProfissionalId(parametros.get('profissionalId') ?? '');
  }, [parametros, superAdmin]);

  const carregar = useCallback(async () => {
    if (sessao && !superAdmin && !profissional) {
      setCarregando(false);
      setErro('Seu perfil nao possui acesso ao painel clinico.');
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      setDados(await carregarResumoDashboardClinico({ periodo, profissionalId: superAdmin ? profissionalId || undefined : undefined }));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar o painel clinico.');
    } finally {
      setCarregando(false);
    }
  }, [periodo, profissional, profissionalId, sessao, superAdmin]);

  useEffect(() => { if (sessao !== null) void carregar(); }, [carregar, sessao]);

  const podeConcluirTarefa = podeAgir(sessao, 'pacientes.gerenciar');
  const podeRevisarFormulario = podeAgir(sessao, 'questionarios.gerenciar');
  const podeRegistrarDesfecho = podeAgir(sessao, 'agenda.consultas.criar');
  const retornoUrl = (pacienteId: string, responsavelId: string) => `/agenda?pacienteId=${encodeURIComponent(pacienteId)}&profissionalId=${encodeURIComponent(responsavelId)}` as Route;
  const contextoSelecionado = useMemo(() => profissionais.find((item) => item.id === profissionalId), [profissionais, profissionalId]);

  async function executar(chave: string, mensagem: string, acao: () => Promise<unknown>, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setProcessando(chave);
    setErro(null);
    setSucesso(null);
    try {
      await acao();
      setSucesso(mensagem);
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao executar a acao.');
    } finally {
      setProcessando(null);
    }
  }

  if (carregando && !dados) return <BarraCarregamento visivel rotulo="Carregando painel clinico" />;

  return <div className="grid gap-4">
    <section className="flex flex-col gap-3 border-b border-linha pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0"><h2 className="text-lg font-semibold text-tinta">Painel clinico</h2><p className="text-sm text-texto-suave">Prioridades diarias, pendencias e proximos atendimentos.</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex rounded-md border border-linha p-1" aria-label="Periodo do painel clinico">{periodos.map((item) => <button key={item.valor} type="button" onClick={() => setPeriodo(item.valor)} className={`h-8 rounded px-3 text-sm font-medium ${periodo === item.valor ? 'bg-primaria text-white' : 'text-tinta hover:bg-superficie-hover'}`}>{item.rotulo}</button>)}</div>
        {podeContexto ? <label className="grid min-w-52 gap-1 text-xs font-semibold text-texto-suave">Profissional em contexto<Selecao aria-label="Profissional em contexto" value={profissionalId} onChange={(evento) => setProfissionalId(evento.target.value)}><option value="">Selecionar profissional</option>{profissionais.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</Selecao></label> : null}
      </div>
    </section>

    {superAdmin ? <AlertaOperacional mensagem={profissionalId ? `Voce esta acompanhando o painel de ${contextoSelecionado?.nome ?? dados?.contexto.profissionalNome ?? 'outro profissional'}. Acoes serao registradas em auditoria.` : 'Selecione um profissional para acessar o contexto clinico. Apenas SuperAdmin pode trocar este contexto.'} /> : null}
    {erro ? <div className="grid gap-3"><AlertaOperacional mensagem={erro} /><Botao type="button" onClick={() => void carregar()}><RefreshCcw size={16} />Tentar novamente</Botao></div> : null}
    {sucesso ? <p role="status" className="rounded-md border border-sucesso bg-sucesso-suave px-3 py-2 text-sm font-medium text-sucesso-forte">{sucesso}</p> : null}
    {dados?.selecaoObrigatoria ? <EstadoVazio titulo="Selecione um profissional" descricao="O painel clinico requer um contexto profissional explicito." /> : null}
    {dados && !dados.selecaoObrigatoria ? <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Indicador titulo="Hoje" valor={dados.indicadores.consultasHoje} detalhe={`${dados.indicadores.proximas} proximas`} icone={CalendarDays} />
        <Indicador titulo="Sem retorno" valor={dados.indicadores.semRetorno30} detalhe={`${dados.indicadores.semRetorno60} em 60d, ${dados.indicadores.semRetorno90Mais} em 90+d`} icone={UserRoundPlus} />
        <Indicador titulo="Pendencias" valor={dados.indicadores.tarefasVencidas + dados.indicadores.formulariosPendentes} detalhe={`${dados.indicadores.tarefasVencidas} tarefas, ${dados.indicadores.formulariosPendentes} formularios`} icone={ClipboardList} />
        <Indicador titulo="Comunicacoes" valor={dados.indicadores.comunicacoesEmAlerta} detalhe={`${dados.indicadores.solicitacoesPendentes} solicitacoes pendentes`} icone={MessageSquareWarning} />
        <Indicador titulo="Risco alto" valor={dados.indicadores.pacientesRiscoAlto} detalhe="Priorizar retorno clinico" icone={AlertTriangle} />
      </section>
      <section className="border-y border-linha py-4"><CabecalhoFila titulo="Fila de prioridade" detalhe="Alertas operacionais ordenados por prioridade." />{dados.alertas.length ? <div className="grid gap-2">{dados.alertas.map((alerta) => <div key={alerta.id} className="flex min-w-0 items-center justify-between gap-3 border-l-4 border-alerta bg-alerta-suave px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-tinta">{nomeAlerta(alerta.tipo)}</p><p className="text-xs text-texto-suave">Registrado em {formatarDataHora(alerta.ocorridoEm)}</p></div>{alerta.ocultavel ? <button type="button" aria-label="Ocultar alerta" title="Ocultar alerta" disabled={processando === `alerta-${alerta.id}`} onClick={() => void executar(`alerta-${alerta.id}`, 'Alerta ocultado por 24 horas.', () => ocultarAlertaDashboardClinico(alerta.id), 'Ocultar este alerta por 24 horas?')} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-texto-suave hover:bg-white disabled:opacity-50"><EyeOff size={17} /></button> : null}</div>)}</div> : <EstadoVazio titulo="Nenhum alerta clinico" descricao="Nao ha alertas prioritarios neste contexto." />}</section>
      <section className="grid gap-5 xl:grid-cols-2">
        <div className="min-w-0"><CabecalhoFila titulo="Proximos atendimentos" detalhe="Registre o desfecho para liberar agenda e atualizar o acompanhamento." /><div className="divide-y divide-linha border-y border-linha">{dados.atendimentos.length ? dados.atendimentos.map((item) => <div key={item.id} className="grid gap-2 py-3"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-tinta">{item.pacienteNome}</p><p className="text-xs text-texto-suave">{formatarDataHora(item.inicioEm)} · {nomeStatusConsulta(item.status)}</p></div><LinkAcao href={retornoUrl(item.pacienteId, item.profissionalId)}>Abrir agenda</LinkAcao></div>{(item.status === 'agendada' || item.status === 'reagendada') && podeRegistrarDesfecho ? <div className="flex flex-wrap gap-2"><Botao type="button" disabled={processando === item.id} onClick={() => void executar(item.id, 'Consulta marcada como concluida.', () => registrarDesfechoConsulta(item.id, 'concluida'), 'Confirmar consulta concluida?')}><CheckCircle2 size={15} />Concluida</Botao><Botao type="button" disabled={processando === item.id} onClick={() => void executar(item.id, 'Consulta marcada como falta.', () => registrarDesfechoConsulta(item.id, 'falta'), 'Registrar falta do paciente?')}><XCircle size={15} />Falta</Botao><Botao type="button" variante="perigo" disabled={processando === item.id} onClick={() => void executar(item.id, 'Consulta cancelada e horario liberado.', () => registrarDesfechoConsulta(item.id, 'cancelada'), 'Cancelar a consulta e liberar o horario?')}><XCircle size={15} />Cancelar</Botao></div> : null}</div>) : <EstadoVazio titulo="Nenhum atendimento" descricao="Nao ha consultas no periodo selecionado." />}</div></div>
        <div className="min-w-0"><CabecalhoFila titulo="Pacientes sem retorno" detalhe="30 dias sem consulta concluida, priorizados por risco." /><div className="divide-y divide-linha border-y border-linha">{dados.semRetorno.length ? dados.semRetorno.map((item) => <div key={item.pacienteId} className="flex min-w-0 items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-tinta">{item.pacienteNome}</p><p className="text-xs text-texto-suave">{item.faixa} dias · Risco {item.nivelRisco} · Score {item.scoreRisco}</p></div><LinkAcao href={retornoUrl(item.pacienteId, item.profissionalId)}>Criar retorno</LinkAcao></div>) : <EstadoVazio titulo="Retornos em dia" descricao="Nenhum paciente ativo excedeu 30 dias sem consulta concluida." />}</div></div>
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <div className="min-w-0"><CabecalhoFila titulo="Tarefas vencidas" detalhe="Acoes clinicas que exigem tratamento." />{dados.tarefasVencidas.length ? <div className="divide-y divide-linha border-y border-linha">{dados.tarefasVencidas.map((item) => <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-tinta">{item.titulo}</p><p className="truncate text-xs text-texto-suave">{item.pacienteNome} · {item.prioridade} · Venceu em {formatarDataHora(item.vencimentoEm)}</p></div>{podeConcluirTarefa ? <Botao type="button" disabled={processando === `tarefa-${item.id}`} onClick={() => void executar(`tarefa-${item.id}`, 'Tarefa concluida.', () => concluirTarefaDashboardClinico(item.pacienteId, item.id), 'Concluir esta tarefa?')}><CheckCircle2 size={15} />Concluir tarefa</Botao> : null}</div>)}</div> : <EstadoVazio titulo="Nenhuma tarefa vencida" descricao="A rotina de acompanhamento esta em dia." />}</div>
        <div className="min-w-0"><CabecalhoFila titulo="Formularios pendentes" detalhe="Respostas que precisam de revisao clinica." />{dados.formulariosPendentes.length ? <div className="divide-y divide-linha border-y border-linha">{dados.formulariosPendentes.map((item) => <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-tinta">Formulario de {item.pacienteNome}</p><p className="text-xs text-texto-suave">Respondido em {item.respondidoEm ? formatarDataHora(item.respondidoEm) : 'data indisponivel'}</p></div>{podeRevisarFormulario ? <Botao type="button" disabled={processando === `formulario-${item.id}`} onClick={() => void executar(`formulario-${item.id}`, 'Formulario marcado como revisado.', () => revisarEnvioQuestionario(item.id), 'Marcar este formulario como revisado?')}><ClipboardCheck size={15} />Marcar revisado</Botao> : null}</div>)}</div> : <EstadoVazio titulo="Nenhum formulario pendente" descricao="Nao ha respostas aguardando revisao." />}</div>
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <div className="min-w-0"><CabecalhoFila titulo="Solicitacoes de agendamento" detalhe="Pedidos aguardando aprovacao manual."><LinkAcao href="/agenda">Abrir agenda</LinkAcao></CabecalhoFila>{dados.solicitacoesPendentes.length ? <div className="divide-y divide-linha border-y border-linha">{dados.solicitacoesPendentes.map((item) => <div key={item.id} className="py-3"><p className="text-sm font-semibold text-tinta">{item.solicitanteNome}</p><p className="text-xs text-texto-suave">{formatarDataHora(item.inicioEm)} · expira em {formatarDataHora(item.expiraEm)}</p></div>)}</div> : <EstadoVazio titulo="Nenhuma solicitacao pendente" descricao="Novos pedidos aparecerao aqui." />}</div>
        <div className="min-w-0"><CabecalhoFila titulo="Comunicacoes em alerta" detalhe="Somente o status operacional e exibido neste painel."><LinkAcao href="/comunicacoes">Abrir comunicacoes</LinkAcao></CabecalhoFila>{dados.comunicacoes.length ? <div className="divide-y divide-linha border-y border-linha">{dados.comunicacoes.map((item) => <div key={item.id} className="py-3"><p className="truncate text-sm font-semibold text-tinta">{item.pacienteNome}</p><p className="text-xs text-texto-suave">Status {item.status} · {formatarDataHora(item.criadoEm)}</p></div>)}</div> : <EstadoVazio titulo="Comunicacoes em dia" descricao="Nao ha comunicacoes que demandem atencao." />}</div>
      </section>
    </> : null}
  </div>;
}
