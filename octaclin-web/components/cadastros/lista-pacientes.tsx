'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArchiveRestore, CheckCircle2, Download, Edit3, FileText, HeartPulse, KeyRound, Plus, RefreshCcw, Trash2, Upload } from 'lucide-react';
import { Botao, classesBotao } from '@/components/ui/botao';
import { ImportacaoPacientes } from '@/components/cadastros/importacao-pacientes';
import { FiltrosPacientes } from '@/components/cadastros/filtros-pacientes';
import { LixeiraPacientes } from '@/components/cadastros/lixeira-pacientes';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Aviso, AvisoRegiao, EsqueletoPagina, EstadoFalha, EstadoPermissaoNegada } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { Tabela, TabelaCabecalho, TabelaConteudo, TabelaLinha, TabelaLinhas, TabelaVazia } from '@/components/ui/tabela';
import { FaixaAcoes } from '@/components/ui/faixa-acoes';
import { obterSessao } from '@/lib/auth-api';
import { criarConvitePaciente } from '@/lib/convites-paciente-api';
import { classificarFalhaInterface, type FalhaInterface } from '@/lib/erros-interface';
import {
  type CriteriosFiltroSalvoPaciente,
  type PacienteResumo,
  type ProfissionalResumo,
  type RespostaPaginada,
  arquivarPaciente,
  listarPacientes,
  listarPacientesArquivados,
  listarProfissionais,
  restaurarPaciente
} from '@/lib/cadastros-api';

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(data);
}

function statusClasse(status: string) {
  if (status === 'risco') return 'border-perigo-borda bg-perigo-suave text-perigo';
  if (status === 'em_acompanhamento' || status === 'aderente') return 'border-sucesso-borda bg-sucesso-suave text-sucesso-forte';
  return 'bg-superficie-hover text-texto-suave';
}

function statusRotulo(status: string) {
  const rotulos: Record<string, string> = {
    novo: 'Novo',
    aderente: 'Aderente',
    em_acompanhamento: 'Em acompanhamento',
    risco: 'Requer atenção',
    inativo: 'Inativo'
  };
  return rotulos[status] ?? status;
}

function nivelRisco(paciente: PacienteResumo) {
  const score = Number(paciente.scoreRisco);
  if (paciente.statusAdesao === 'risco' || score >= 70) return 'alto';
  if (score >= 40) return 'medio';
  return 'baixo';
}

function proximaAcao(paciente: PacienteResumo) {
  if (nivelRisco(paciente) === 'alto') return 'Revisar risco';
  if (!paciente.proximaConsultaEm) return 'Agendar retorno';
  return `Consulta em ${formatarData(paciente.proximaConsultaEm)}`;
}

function nomeProfissional(profissionais: ProfissionalResumo[], id: string) {
  return profissionais.find((profissional) => profissional.id === id)?.nome ?? id;
}

export function ListaPacientes() {
  const router = useRouter();
  const pathname = usePathname();
  const parametrosUrl = useSearchParams();
  const [dados, setDados] = useState<RespostaPaginada<PacienteResumo> | null>(null);
  const [profissionais, setProfissionais] = useState<ProfissionalResumo[]>([]);
  const [falhaCarregamento, setFalhaCarregamento] = useState<FalhaInterface | null>(null);
  const [falhaAcao, setFalhaAcao] = useState<FalhaInterface | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [arquivandoId, setArquivandoId] = useState<string | null>(null);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [arquivados, setArquivados] = useState<PacienteResumo[]>([]);
  const [lixeiraAberta, setLixeiraAberta] = useState(false);
  const [carregandoLixeira, setCarregandoLixeira] = useState(false);
  const [ultimoArquivado, setUltimoArquivado] = useState<PacienteResumo | null>(null);
  const [convidandoId, setConvidandoId] = useState<string | null>(null);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [pacienteParaArquivar, setPacienteParaArquivar] = useState<PacienteResumo | null>(null);
  const [busca, setBusca] = useState(() => parametrosUrl.get('busca') ?? '');
  const [filtroRisco, setFiltroRisco] = useState<'todos' | 'alto' | 'medio' | 'baixo'>(() => (parametrosUrl.get('risco') as 'todos' | 'alto' | 'medio' | 'baixo') || 'todos');
  const [filtroProfissional, setFiltroProfissional] = useState(() => parametrosUrl.get('profissional') ?? 'todos');
  const [filtroStatus, setFiltroStatus] = useState(() => parametrosUrl.get('status') ?? 'todos');
  const [apenasSemProximaConsulta, setApenasSemProximaConsulta] = useState(() => parametrosUrl.get('semRetorno') === '1');
  const [pagina, setPagina] = useState(() => Math.max(1, Number(parametrosUrl.get('pagina') ?? 1) || 1));
  const [modalImportacaoAberto, setModalImportacaoAberto] = useState(false);
  const [podeGerenciar, setPodeGerenciar] = useState(false);
  const limite = 25;

  const urlExportacao = useMemo(() => {
    const parametros = new URLSearchParams();
    if (busca) parametros.set('busca', busca);
    if (filtroRisco !== 'todos') parametros.set('risco', filtroRisco);
    if (filtroProfissional !== 'todos') parametros.set('profissionalId', filtroProfissional);
    if (filtroStatus !== 'todos') parametros.set('status', filtroStatus);
    if (apenasSemProximaConsulta) parametros.set('semProximaConsulta', 'true');
    const query = parametros.toString();
    return `/api/pacientes/exportar.csv${query ? `?${query}` : ''}`;
  }, [apenasSemProximaConsulta, busca, filtroProfissional, filtroRisco, filtroStatus]);

  useEffect(() => {
    void obterSessao().then((sessao) => setPodeGerenciar(Boolean(sessao?.permissoes?.includes('pacientes.gerenciar')))).catch(() => setPodeGerenciar(false));
  }, []);

  useEffect(() => {
    const parametros = new URLSearchParams();
    if (busca) parametros.set('busca', busca);
    if (filtroRisco !== 'todos') parametros.set('risco', filtroRisco);
    if (filtroProfissional !== 'todos') parametros.set('profissional', filtroProfissional);
    if (filtroStatus !== 'todos') parametros.set('status', filtroStatus);
    if (apenasSemProximaConsulta) parametros.set('semRetorno', '1');
    if (pagina > 1) parametros.set('pagina', String(pagina));
    const query = parametros.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
  }, [apenasSemProximaConsulta, busca, filtroProfissional, filtroRisco, filtroStatus, pagina, pathname, router]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setFalhaCarregamento(null);
    try {
      const [pacientes, profissionaisResposta] = await Promise.all([
        listarPacientes({ pagina, limite, busca: busca || undefined, risco: filtroRisco === 'todos' ? undefined : filtroRisco, profissionalId: filtroProfissional === 'todos' ? undefined : filtroProfissional, status: filtroStatus === 'todos' ? undefined : filtroStatus, semProximaConsulta: apenasSemProximaConsulta }),
        listarProfissionais({ limite: 100 })
      ]);
      setDados(pacientes);
      setProfissionais(profissionaisResposta.itens);
    } catch (erroAtual) {
      setFalhaCarregamento(classificarFalhaInterface(erroAtual, 'Não foi possível carregar os pacientes.'));
    } finally {
      setCarregando(false);
    }
  }, [apenasSemProximaConsulta, busca, filtroProfissional, filtroRisco, filtroStatus, pagina]);

  useEffect(() => {
    const atraso = window.setTimeout(() => void carregar(), 300);
    return () => window.clearTimeout(atraso);
  }, [carregar]);

  function aplicarVisao(visao: 'todos' | 'prioridade' | 'sem-retorno') {
    setBusca('');
    setFiltroRisco(visao === 'prioridade' ? 'alto' : 'todos');
    setFiltroStatus('todos');
    setFiltroProfissional('todos');
    setApenasSemProximaConsulta(visao === 'sem-retorno');
    setPagina(1);
  }

  function aplicarFiltrosSalvos(criterios: CriteriosFiltroSalvoPaciente) {
    setBusca('');
    setFiltroRisco(criterios.risco ?? 'todos');
    setFiltroProfissional(criterios.profissionalId ?? 'todos');
    setFiltroStatus(criterios.status ?? 'todos');
    setApenasSemProximaConsulta(Boolean(criterios.semProximaConsulta));
    setPagina(1);
  }

  async function confirmarArquivar() {
    if (!pacienteParaArquivar) return;
    const paciente = pacienteParaArquivar;
    setArquivandoId(paciente.id);
    setFalhaAcao(null);
    try {
      await arquivarPaciente(paciente.id);
      await carregar();
      setSucesso('Paciente arquivado.');
      setUltimoArquivado(paciente);
      setPacienteParaArquivar(null);
    } catch (erroAtual) {
      setFalhaAcao(classificarFalhaInterface(erroAtual, 'Não foi possível arquivar o paciente.'));
    } finally {
      setArquivandoId(null);
    }
  }

  async function carregarLixeira() {
    setCarregandoLixeira(true);
    setFalhaAcao(null);
    try {
      const resposta = await listarPacientesArquivados({ limite: 100 });
      setArquivados(resposta.itens);
      setLixeiraAberta(true);
    } catch (erroAtual) {
      setFalhaAcao(classificarFalhaInterface(erroAtual, 'Não foi possível carregar a lixeira de pacientes.'));
    } finally {
      setCarregandoLixeira(false);
    }
  }

  async function restaurar(paciente: PacienteResumo) {
    setRestaurandoId(paciente.id);
    setFalhaAcao(null);
    try {
      await restaurarPaciente(paciente.id);
      setArquivados((atuais) => atuais.filter((item) => item.id !== paciente.id));
      setUltimoArquivado((atual) => atual?.id === paciente.id ? null : atual);
      await carregar();
      setSucesso(`${paciente.nome} foi restaurado.`);
    } catch (erroAtual) {
      setFalhaAcao(classificarFalhaInterface(erroAtual, 'Não foi possível restaurar o paciente.'));
    } finally {
      setRestaurandoId(null);
    }
  }

  async function convidar(paciente: PacienteResumo) {
    const emailPadrao = paciente.contato?.includes('@') ? paciente.contato : '';
    const email = window.prompt(`Email para convite de ${paciente.nome}`, emailPadrao);
    if (!email) return;
    setConvidandoId(paciente.id);
    setFalhaAcao(null);
    setLinkConvite(null);
    try {
      const convite = await criarConvitePaciente(paciente.id, email);
      setLinkConvite(convite.linkAtivacao);
      try {
        await navigator.clipboard?.writeText(convite.linkAtivacao);
        setSucesso('Convite criado e link copiado para a área de transferência.');
      } catch {
        setSucesso('Convite criado. Use o link exibido abaixo.');
      }
    } catch (erroAtual) {
      setFalhaAcao(classificarFalhaInterface(erroAtual, 'Não foi possível criar o convite.'));
    } finally {
      setConvidandoId(null);
    }
  }

  if (!dados && !falhaCarregamento) return <EsqueletoPagina rotulo="Carregando pacientes" />;
  if (!dados && falhaCarregamento?.tipo === 'permissao') return <EstadoPermissaoNegada />;
  if (!dados && falhaCarregamento) return <EstadoFalha titulo="Não foi possível carregar os pacientes" descricao={falhaCarregamento.mensagem} aoTentarNovamente={falhaCarregamento.recuperavel ? () => void carregar() : undefined} tentando={carregando} />;

  const pacientes = dados?.itens ?? [];
  const totalPaginas = Math.max(1, Math.ceil((dados?.total ?? 0) / limite));
  const falhaVisivel = falhaAcao ?? falhaCarregamento;

  return (
    <section className="grid gap-4">
      <Cartao><CartaoConteudo className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h2 className="text-base font-semibold">Lista de pacientes</h2><p className="mt-1 text-sm text-texto-suave">{dados?.total ?? 0} registros encontrados</p></div>
        <FaixaAcoes rotulo="Ações da lista de pacientes">
          <Botao onClick={carregar} disabled={carregando}><RefreshCcw size={16} />{carregando ? 'Atualizando' : 'Atualizar'}</Botao>
          {podeGerenciar ? <Botao type="button" onClick={() => setModalImportacaoAberto(true)}><Upload size={16} />Importar CSV</Botao> : null}
          <Botao type="button" onClick={() => void carregarLixeira()} disabled={carregandoLixeira}><ArchiveRestore size={16} />{carregandoLixeira ? 'Carregando' : 'Lixeira'}</Botao>
          <a href={urlExportacao} className={classesBotao()}><Download size={16} />Exportar CSV</a>
          {podeGerenciar ? <Link href="/pacientes/novo" className={classesBotao({ variante: 'primario' })}><Plus size={16} />Novo paciente</Link> : null}
        </FaixaAcoes>
      </CartaoConteudo></Cartao>

      <FiltrosPacientes busca={busca} risco={filtroRisco} profissional={filtroProfissional} status={filtroStatus} semProximaConsulta={apenasSemProximaConsulta} profissionais={profissionais} total={dados?.total ?? 0} podeGerenciar={podeGerenciar} aoAlterarBusca={(valor) => { setBusca(valor); setPagina(1); }} aoAlterarRisco={(valor) => { setFiltroRisco(valor); setApenasSemProximaConsulta(false); setPagina(1); }} aoAlterarProfissional={(valor) => { setFiltroProfissional(valor); setApenasSemProximaConsulta(false); setPagina(1); }} aoAlterarStatus={(valor) => { setFiltroStatus(valor); setApenasSemProximaConsulta(false); setPagina(1); }} aoAplicarVisao={aplicarVisao} aoAplicarFiltrosSalvos={aplicarFiltrosSalvos} />

      {falhaVisivel ? <AvisoRegiao><Aviso variante="erro" mensagem={falhaVisivel.mensagem} aoFechar={() => { setFalhaAcao(null); setFalhaCarregamento(null); }} /></AvisoRegiao> : null}
      {sucesso ? <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte"><CheckCircle2 size={16} /><span className="flex-1">{sucesso}</span>{ultimoArquivado && podeGerenciar ? <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => void restaurar(ultimoArquivado)} carregando={restaurandoId === ultimoArquivado.id}><ArchiveRestore size={14} />Desfazer</Botao> : null}</div> : null}
      {linkConvite ? <Cartao><CartaoConteudo className="text-sm text-texto-suave"><p className="font-medium text-tinta">Link de primeiro acesso</p><p className="mt-1 break-all">{linkConvite}</p></CartaoConteudo></Cartao> : null}

      <Tabela className="hidden lg:block"><TabelaConteudo larguraMinima="840px"><TabelaCabecalho densidade="compacta" className="grid-cols-[1.2fr_0.9fr_0.7fr_0.65fr_0.85fr_0.95fr_196px]"><span>Paciente</span><span>Responsável</span><span>Situação</span><span>Risco</span><span>Última consulta</span><span>Próxima ação</span><span>Ações</span></TabelaCabecalho><TabelaLinhas>
        {pacientes.length ? pacientes.map((paciente) => (
          <TabelaLinha data-testid="linha-paciente" densidade="compacta" key={paciente.id} className="grid-cols-[1.2fr_0.9fr_0.7fr_0.65fr_0.85fr_0.95fr_196px] items-center hover:bg-superficie-hover">
            <div className="min-w-0"><div className="flex items-center gap-2"><HeartPulse size={16} className="shrink-0 text-primaria" /><Link href={`/pacientes/${paciente.id}` as Route} className="truncate font-semibold hover:underline">{paciente.nome}</Link></div><p className="mt-1 truncate text-xs text-texto-suave">{paciente.contato ?? paciente.id} · Nasc. {formatarData(paciente.dataNascimento)}</p></div>
            <span className="break-all text-xs text-texto-suave">{nomeProfissional(profissionais, paciente.profissionalResponsavelId)}</span>
            <Etiqueta className={statusClasse(paciente.statusAdesao)}>{statusRotulo(paciente.statusAdesao)}</Etiqueta>
            <Etiqueta variante={nivelRisco(paciente) === 'alto' ? 'perigo' : nivelRisco(paciente) === 'medio' ? 'alerta' : 'sucesso'}>{nivelRisco(paciente)} {Number(paciente.scoreRisco).toFixed(1)}</Etiqueta>
            <span className="text-xs text-texto-suave">{formatarData(paciente.ultimaConsultaConcluidaEm)}</span><span className="text-xs font-medium text-tinta">{proximaAcao(paciente)}</span>
            <div data-testid="acoes-paciente" className="flex justify-end gap-1">
              <Link href={`/pacientes/${paciente.id}` as Route} className={classesBotao({ variante: 'fantasma', className: 'w-11 px-0' })} aria-label="Abrir prontuário" title="Abrir prontuário"><FileText size={16} /></Link>
              {podeGerenciar ? <><Botao type="button" variante="fantasma" className="w-11 px-0" onClick={() => void convidar(paciente)} disabled={Boolean(paciente.usuarioId) || convidandoId === paciente.id} aria-label="Convidar paciente" title={paciente.usuarioId ? 'Paciente já possui acesso' : 'Convidar paciente'}><KeyRound size={16} /></Botao><Link href={`/pacientes/${paciente.id}/editar` as Route} className={classesBotao({ variante: 'fantasma', className: 'w-11 px-0' })} aria-label={`Editar ${paciente.nome}`}><Edit3 size={16} /></Link><Botao type="button" variante="fantasma" className="w-11 px-0" onClick={() => setPacienteParaArquivar(paciente)} disabled={arquivandoId === paciente.id} aria-label={`Arquivar ${paciente.nome}`}><Trash2 size={16} /></Botao></> : null}
            </div>
          </TabelaLinha>
        )) : <TabelaVazia mensagem="Nenhum paciente encontrado com estes filtros." />}
      </TabelaLinhas></TabelaConteudo></Tabela>

      <div className="grid gap-3 lg:hidden">{pacientes.map((paciente) => <Cartao key={paciente.id}><CartaoConteudo className="grid gap-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/pacientes/${paciente.id}` as Route} className="font-semibold text-tinta hover:underline">{paciente.nome}</Link><p className="mt-1 truncate text-xs text-texto-suave">{paciente.contato ?? paciente.id}</p></div><Etiqueta variante={nivelRisco(paciente) === 'alto' ? 'perigo' : nivelRisco(paciente) === 'medio' ? 'alerta' : 'sucesso'}>{nivelRisco(paciente)} {Number(paciente.scoreRisco).toFixed(1)}</Etiqueta></div><div className="grid grid-cols-2 gap-2 text-xs text-texto-suave"><span>Responsável<br /><strong className="text-tinta">{nomeProfissional(profissionais, paciente.profissionalResponsavelId)}</strong></span><span>Última consulta<br /><strong className="text-tinta">{formatarData(paciente.ultimaConsultaConcluidaEm)}</strong></span><span className="col-span-2">Próxima ação<br /><strong className="text-tinta">{proximaAcao(paciente)}</strong></span></div><div className="flex flex-wrap gap-1"><Link href={`/pacientes/${paciente.id}` as Route} className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-tinta hover:bg-superficie-hover">Abrir prontuário</Link>{podeGerenciar ? <><Link href={`/pacientes/${paciente.id}/editar` as Route} className={classesBotao({ variante: 'fantasma' })} aria-label={`Editar ${paciente.nome}`}><Edit3 size={16} /></Link><Botao type="button" variante="fantasma" onClick={() => setPacienteParaArquivar(paciente)} aria-label={`Arquivar ${paciente.nome}`}><Trash2 size={16} /></Botao></> : null}</div></CartaoConteudo></Cartao>)}{!pacientes.length ? <p className="px-1 py-6 text-sm text-texto-suave">Nenhum paciente encontrado com estes filtros.</p> : null}</div>

      <nav className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de pacientes"><p className="text-sm text-texto-suave" aria-live="polite">Página {pagina} de {totalPaginas} | {dados?.total ?? 0} pacientes</p><div className="flex gap-2"><Botao type="button" variante="secundario" onClick={() => setPagina((atual) => Math.max(1, atual - 1))} disabled={pagina <= 1 || carregando}>Anterior</Botao><Botao type="button" variante="secundario" onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))} disabled={pagina >= totalPaginas || carregando}>Próxima</Botao></div></nav>

      <ImportacaoPacientes aberto={modalImportacaoAberto} profissionais={profissionais} aoFechar={() => setModalImportacaoAberto(false)} aoConcluir={() => { setModalImportacaoAberto(false); void carregar(); }} />
      <LixeiraPacientes aberta={lixeiraAberta} pacientes={arquivados} podeGerenciar={podeGerenciar} restaurandoId={restaurandoId} aoFechar={() => setLixeiraAberta(false)} aoRestaurar={(paciente) => void restaurar(paciente)} />
      <ModalConfirmacao aberto={pacienteParaArquivar !== null} titulo="Arquivar paciente" mensagem={pacienteParaArquivar ? `Arquivar o paciente ${pacienteParaArquivar.nome}?` : ''} rotuloConfirmar="Arquivar" confirmando={Boolean(arquivandoId)} aoConfirmar={() => void confirmarArquivar()} aoCancelar={() => setPacienteParaArquivar(null)} />
    </section>
  );
}
