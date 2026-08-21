'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArchiveRestore, CheckCircle2, Download, Edit3, FileText, HeartPulse, KeyRound, Plus, RefreshCcw, Save, Search, Trash2, Upload } from 'lucide-react';
import { Botao, classesBotao } from '@/components/ui/botao';
import { ImportacaoPacientes } from '@/components/cadastros/importacao-pacientes';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Etiqueta } from '@/components/ui/etiqueta';
import { Aviso, AvisoRegiao, EsqueletoPagina, EstadoFalha, EstadoPermissaoNegada } from '@/components/ui/feedback';
import { Modal, ModalConfirmacao } from '@/components/ui/modal';
import { Tabela, TabelaCabecalho, TabelaConteudo, TabelaLinha, TabelaLinhas, TabelaVazia } from '@/components/ui/tabela';
import { FaixaAcoes } from '@/components/ui/faixa-acoes';
import { obterSessao } from '@/lib/auth-api';
import { criarConvitePaciente } from '@/lib/convites-paciente-api';
import { classificarFalhaInterface, type FalhaInterface } from '@/lib/erros-interface';
import {
  PacienteResumo,
  ProfissionalResumo,
  RespostaPaginada,
  SalvarPacienteEntrada,
  arquivarPaciente,
  atualizarPaciente,
  criarPaciente,
  listarPacientes,
  listarPacientesArquivados,
  listarProfissionais,
  restaurarPaciente
} from '@/lib/cadastros-api';

type StatusPaciente = 'novo' | 'aderente' | 'em_acompanhamento' | 'risco' | 'inativo';

interface FormularioPaciente {
  profissionalResponsavelId: string;
  nome: string;
  contato: string;
  dataNascimento: string;
  statusAdesao: StatusPaciente;
  scoreRisco: string;
}

const formularioInicial: FormularioPaciente = {
  profissionalResponsavelId: '',
  nome: '',
  contato: '',
  dataNascimento: '',
  statusAdesao: 'novo',
  scoreRisco: '0'
};

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(data);
}

function statusClasse(status: string) {
  if (status === 'risco') return 'bg-perigo-suave text-perigo';
  if (status === 'em_acompanhamento' || status === 'aderente') return 'bg-sucesso-suave text-sucesso';
  return 'bg-superficie-hover text-texto-suave';
}

function montarPayload(formulario: FormularioPaciente, editandoId: string | null): SalvarPacienteEntrada {
  const payload: SalvarPacienteEntrada = {
    profissionalResponsavelId: formulario.profissionalResponsavelId,
    nome: formulario.nome.trim(),
    contato: formulario.contato.trim() || undefined,
    dataNascimento: formulario.dataNascimento || undefined
  };

  if (editandoId) {
    payload.statusAdesao = formulario.statusAdesao;
    payload.scoreRisco = Number(formulario.scoreRisco || 0);
  }

  return payload;
}

function nomeProfissional(profissionais: ProfissionalResumo[], id: string) {
  return profissionais.find((profissional) => profissional.id === id)?.nome ?? id;
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
  const [salvando, setSalvando] = useState(false);
  const [arquivandoId, setArquivandoId] = useState<string | null>(null);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [arquivados, setArquivados] = useState<PacienteResumo[]>([]);
  const [lixeiraAberta, setLixeiraAberta] = useState(false);
  const [carregandoLixeira, setCarregandoLixeira] = useState(false);
  const [ultimoArquivado, setUltimoArquivado] = useState<PacienteResumo | null>(null);
  const [convidandoId, setConvidandoId] = useState<string | null>(null);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioPaciente>(formularioInicial);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modalPacienteAberto, setModalPacienteAberto] = useState(false);
  const [pacienteParaArquivar, setPacienteParaArquivar] = useState<PacienteResumo | null>(null);
  const [busca, setBusca] = useState(() => parametrosUrl.get('busca') ?? '');
  const [filtroRisco, setFiltroRisco] = useState<'todos' | 'alto' | 'medio' | 'baixo'>(
    () => (parametrosUrl.get('risco') as 'todos' | 'alto' | 'medio' | 'baixo') || 'todos'
  );
  const [filtroProfissional, setFiltroProfissional] = useState(() => parametrosUrl.get('profissional') ?? 'todos');
  const [filtroStatus, setFiltroStatus] = useState(() => parametrosUrl.get('status') ?? 'todos');
  const [apenasSemProximaConsulta, setApenasSemProximaConsulta] = useState(() => parametrosUrl.get('semRetorno') === '1');
  const [pagina, setPagina] = useState(() => Math.max(1, Number(parametrosUrl.get('pagina') ?? 1) || 1));
  const [modalImportacaoAberto, setModalImportacaoAberto] = useState(false);
  const [podeGerenciar, setPodeGerenciar] = useState(false);

  /** Mesmos filtros da listagem: o CSV sai do que esta na tela, nao da base inteira. */
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
  const limite = 25;

  useEffect(() => {
    void obterSessao().then((sessao) => {
      setPodeGerenciar(Boolean(sessao?.permissoes?.includes('pacientes.gerenciar')));
    }).catch(() => setPodeGerenciar(false));
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

  useEffect(() => {
    function abrirPeloAtalho() {
      if (podeGerenciar && window.location.hash === '#novo-paciente') setModalPacienteAberto(true);
    }
    abrirPeloAtalho();
    window.addEventListener('hashchange', abrirPeloAtalho);
    return () => window.removeEventListener('hashchange', abrirPeloAtalho);
  }, [podeGerenciar]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setFalhaCarregamento(null);
    setSucesso(null);
    try {
      const [pacientes, profissionaisResposta] = await Promise.all([
        listarPacientes({
          pagina,
          limite,
          busca: busca || undefined,
          risco: filtroRisco === 'todos' ? undefined : filtroRisco,
          profissionalId: filtroProfissional === 'todos' ? undefined : filtroProfissional,
          status: filtroStatus === 'todos' ? undefined : filtroStatus,
          semProximaConsulta: apenasSemProximaConsulta
        }),
        listarProfissionais({ limite: 100 })
      ]);
      setDados(pacientes);
      setProfissionais(profissionaisResposta.itens);
      setFormulario((atual) => ({
        ...atual,
        profissionalResponsavelId: atual.profissionalResponsavelId || profissionaisResposta.itens[0]?.id || ''
      }));
    } catch (erroAtual) {
      setFalhaCarregamento(classificarFalhaInterface(erroAtual, 'Não foi possível carregar os pacientes.'));
    } finally {
      setCarregando(false);
    }
  }, [apenasSemProximaConsulta, busca, filtroProfissional, filtroRisco, filtroStatus, pagina]);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setFalhaAcao(null);
    setSucesso(null);

    try {
      const payload = montarPayload(formulario, editandoId);
      const mensagem = editandoId ? 'Paciente atualizado.' : 'Paciente criado.';
      if (editandoId) {
        await atualizarPaciente(editandoId, payload);
      } else {
        await criarPaciente(payload);
      }
      setFormulario({ ...formularioInicial, profissionalResponsavelId: profissionais[0]?.id ?? '' });
      setEditandoId(null);
      setModalPacienteAberto(false);
      await carregar();
      setSucesso(mensagem);
    } catch (erroAtual) {
      setFalhaAcao(classificarFalhaInterface(erroAtual, 'Não foi possível salvar o paciente.'));
    } finally {
      setSalvando(false);
    }
  }

  function editar(paciente: PacienteResumo) {
    setEditandoId(paciente.id);
    setModalPacienteAberto(true);
    setFormulario({
      profissionalResponsavelId: paciente.profissionalResponsavelId,
      nome: paciente.nome,
      contato: paciente.contato ?? '',
      dataNascimento: paciente.dataNascimento ?? '',
      statusAdesao: paciente.statusAdesao as StatusPaciente,
      scoreRisco: String(Number(paciente.scoreRisco).toFixed(1))
    });
  }

  async function confirmarArquivar() {
    if (!pacienteParaArquivar) return;
    const paciente = pacienteParaArquivar;

    setArquivandoId(paciente.id);
    setFalhaAcao(null);
    setSucesso(null);

    try {
      await arquivarPaciente(paciente.id);
      if (editandoId === paciente.id) cancelarEdicao();
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
    setSucesso(null);
    setLinkConvite(null);

    try {
      const convite = await criarConvitePaciente(paciente.id, email);
      setLinkConvite(convite.linkAtivacao);
      try {
        await navigator.clipboard?.writeText(convite.linkAtivacao);
        setSucesso('Convite criado e link copiado para a área de transferencia.');
      } catch {
        setSucesso('Convite criado. Use o link exibido abaixo.');
      }
    } catch (erroAtual) {
      setFalhaAcao(classificarFalhaInterface(erroAtual, 'Não foi possível criar o convite.'));
    } finally {
      setConvidandoId(null);
    }
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setModalPacienteAberto(false);
    setFormulario({ ...formularioInicial, profissionalResponsavelId: profissionais[0]?.id ?? '' });
  }

  useEffect(() => {
    const atraso = window.setTimeout(() => void carregar(), 300);
    return () => window.clearTimeout(atraso);
  }, [carregar]);

  const pacientesFiltrados = dados?.itens ?? [];
  const totalPaginas = Math.max(1, Math.ceil((dados?.total ?? 0) / limite));

  if (!dados && !falhaCarregamento) return <EsqueletoPagina rotulo="Carregando pacientes" />;
  if (!dados && falhaCarregamento?.tipo === 'permissao') return <EstadoPermissaoNegada />;
  if (!dados && falhaCarregamento) {
    return (
      <EstadoFalha
        titulo="Não foi possível carregar os pacientes"
        descricao={falhaCarregamento.mensagem}
        aoTentarNovamente={falhaCarregamento.recuperavel ? () => void carregar() : undefined}
        tentando={carregando}
      />
    );
  }

  const falhaVisivel = falhaAcao ?? falhaCarregamento;

  return (
    <section className="grid gap-4">
      <Cartao>
        <CartaoConteudo className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Lista de pacientes</h2>
            <p className="mt-1 text-sm text-texto-suave">
              {dados ? `${dados.total} registros encontrados` : 'Carregando registros'}
            </p>
          </div>
          <FaixaAcoes rotulo="Ações da lista de pacientes">
            <Botao onClick={carregar} disabled={carregando}>
              <RefreshCcw size={16} />
              {carregando ? 'Atualizando' : 'Atualizar'}
            </Botao>
            {podeGerenciar ? (
              <Botao type="button" onClick={() => setModalImportacaoAberto(true)}>
                <Upload size={16} />
                Importar CSV
              </Botao>
            ) : null}
            <Botao type="button" onClick={() => void carregarLixeira()} disabled={carregandoLixeira}>
              <ArchiveRestore size={16} />
              {carregandoLixeira ? 'Carregando' : 'Lixeira'}
            </Botao>
            <a
              href={urlExportacao}
              className={classesBotao()}
            >
              <Download size={16} />
              Exportar CSV
            </a>
            {podeGerenciar ? (
              <Botao type="button" variante="primario" onClick={() => { setEditandoId(null); setFormulario({ ...formularioInicial, profissionalResponsavelId: profissionais[0]?.id ?? '' }); setModalPacienteAberto(true); }}>
                <Plus size={16} />
                Novo paciente
              </Botao>
            ) : null}
          </FaixaAcoes>
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoConteudo className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
          <label className="grid gap-1">
            <Rotulo htmlFor="busca-pacientes">Buscar pacientes</Rotulo>
            <span className="relative">
              <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave" />
              <Campo id="busca-pacientes" value={busca} onChange={(evento) => { setBusca(evento.target.value); setPagina(1); }} placeholder="Nome ou contato (minimo 3 caracteres)" className="pl-9" />
            </span>
          </label>
          <label className="grid gap-1">
            <Rotulo htmlFor="filtro-risco">Risco</Rotulo>
            <Selecao id="filtro-risco" value={filtroRisco} onChange={(evento) => { setFiltroRisco(evento.target.value as typeof filtroRisco); setApenasSemProximaConsulta(false); setPagina(1); }}>
              <option value="todos">Todos os riscos</option><option value="alto">Alto</option><option value="medio">Medio</option><option value="baixo">Baixo</option>
            </Selecao>
          </label>
          <label className="grid gap-1">
            <Rotulo htmlFor="filtro-profissional">Responsável</Rotulo>
            <Selecao id="filtro-profissional" value={filtroProfissional} onChange={(evento) => { setFiltroProfissional(evento.target.value); setApenasSemProximaConsulta(false); setPagina(1); }}>
              <option value="todos">Todos</option>{profissionais.map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}
            </Selecao>
          </label>
          <label className="grid gap-1">
            <Rotulo htmlFor="filtro-status">Situação</Rotulo>
            <Selecao id="filtro-status" value={filtroStatus} onChange={(evento) => { setFiltroStatus(evento.target.value); setApenasSemProximaConsulta(false); setPagina(1); }}>
              <option value="todos">Todas</option><option value="novo">Novo</option><option value="aderente">Aderente</option><option value="em_acompanhamento">Em acompanhamento</option><option value="risco">Risco</option>
            </Selecao>
          </label>
          <div className="flex flex-wrap gap-2 lg:col-span-4" aria-label="Filtros salvos">
            <Botao type="button" variante="fantasma" onClick={() => { setBusca(''); setFiltroRisco('todos'); setFiltroStatus('todos'); setFiltroProfissional('todos'); setApenasSemProximaConsulta(false); setPagina(1); }}>Todos</Botao>
            <Botao type="button" variante="fantasma" onClick={() => { setBusca(''); setFiltroRisco('alto'); setFiltroStatus('todos'); setFiltroProfissional('todos'); setApenasSemProximaConsulta(false); setPagina(1); }}>Alta prioridade</Botao>
            <Botao type="button" variante="fantasma" onClick={() => { setBusca(''); setFiltroRisco('todos'); setFiltroStatus('todos'); setFiltroProfissional('todos'); setApenasSemProximaConsulta(true); setPagina(1); }}>Sem consulta futura</Botao>
            <span className="self-center text-xs text-texto-suave">{dados?.total ?? 0} pacientes encontrados</span>
          </div>
        </CartaoConteudo>
      </Cartao>

      {falhaVisivel ? (
        <AvisoRegiao>
          <Aviso
            variante="erro"
            mensagem={falhaVisivel.mensagem}
            aoFechar={() => {
              setFalhaAcao(null);
              setFalhaCarregamento(null);
            }}
          />
        </AvisoRegiao>
      ) : null}
      {sucesso ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
          <CheckCircle2 size={16} />
          <span className="flex-1">{sucesso}</span>
          {ultimoArquivado && podeGerenciar ? (
            <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => void restaurar(ultimoArquivado)} carregando={restaurandoId === ultimoArquivado.id}>
              <ArchiveRestore size={14} /> Desfazer
            </Botao>
          ) : null}
        </div>
      ) : null}
      {linkConvite ? (
        <Cartao>
          <CartaoConteudo className="text-sm text-texto-suave">
            <p className="font-medium text-tinta">Link de primeiro acesso</p>
            <p className="mt-1 break-all">{linkConvite}</p>
          </CartaoConteudo>
        </Cartao>
      ) : null}

      <Modal
        aberto={modalPacienteAberto}
        aoFechar={cancelarEdicao}
        titulo={editandoId ? 'Editar paciente' : 'Novo paciente'}
      >
        <form onSubmit={salvar}>
          <div className="grid gap-5">
            <section aria-labelledby="paciente-identificacao" className="grid gap-3">
              <div>
                <h3 id="paciente-identificacao" className="text-sm font-semibold text-tinta">Identificação</h3>
                <p className="mt-1 text-xs text-texto-suave">Dados basicos para reconhecer o paciente no atendimento.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <Rotulo>Nome completo</Rotulo>
                  <Campo
                    autoComplete="name"
                    value={formulario.nome}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, nome: evento.target.value }))}
                    required
                  />
                </label>
                <label className="grid gap-1">
                  <Rotulo>Data de nascimento</Rotulo>
                  <Campo
                    type="date"
                    value={formulario.dataNascimento}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, dataNascimento: evento.target.value }))}
                  />
                </label>
              </div>
            </section>

            <section aria-labelledby="paciente-contato" className="grid gap-3 border-t border-linha pt-5">
              <div>
                <h3 id="paciente-contato" className="text-sm font-semibold text-tinta">Contato</h3>
                <p className="mt-1 text-xs text-texto-suave">Informe um e-mail ou telefone usado para comunicações e convite do portal.</p>
              </div>
              <label className="grid gap-1">
                <Rotulo>E-mail ou telefone</Rotulo>
                <Campo
                  placeholder="nome@exemplo.com ou +55 11 99999-9999"
                  value={formulario.contato}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, contato: evento.target.value }))}
                />
              </label>
            </section>

            <section aria-labelledby="paciente-operacao" className="grid gap-3 border-t border-linha pt-5">
              <div>
                <h3 id="paciente-operacao" className="text-sm font-semibold text-tinta">Responsável e acompanhamento</h3>
                <p className="mt-1 text-xs text-texto-suave">Defina quem acompanha o paciente. Situação e risco só aparecem na edição para evitar classificação prematura.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1">
                  <Rotulo>Profissional responsável</Rotulo>
                  <Selecao
                    value={formulario.profissionalResponsavelId}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, profissionalResponsavelId: evento.target.value }))}
                    required
                  >
                    <option value="" disabled>Selecione</option>
                    {profissionais.map((profissional) => (
                      <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>
                    ))}
                  </Selecao>
                </label>
                {editandoId ? (
                  <label className="grid gap-1">
                    <Rotulo>Situação do acompanhamento</Rotulo>
                    <Selecao
                      value={formulario.statusAdesao}
                      onChange={(evento) => setFormulario((atual) => ({ ...atual, statusAdesao: evento.target.value as StatusPaciente }))}
                    >
                      <option value="novo">Novo</option>
                      <option value="aderente">Aderente</option>
                      <option value="em_acompanhamento">Em acompanhamento</option>
                      <option value="risco">Requer atenção</option>
                      <option value="inativo">Inativo</option>
                    </Selecao>
                  </label>
                ) : null}
                {editandoId ? (
                  <label className="grid gap-1">
                    <Rotulo>Indicador de risco (0 a 100)</Rotulo>
                    <Campo
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={formulario.scoreRisco}
                      onChange={(evento) => setFormulario((atual) => ({ ...atual, scoreRisco: evento.target.value }))}
                    />
                  </label>
                ) : null}
              </div>
            </section>

            {!editandoId ? (
              <section aria-label="Acesso ao portal" className="rounded-md border border-primaria/20 bg-primaria-suave p-3 text-sm text-tinta">
                Salve o cadastro primeiro. Depois, use a ação de convite na lista para liberar o acesso seguro ao portal do paciente.
              </section>
            ) : null}
          </div>
          <div className="mt-5 flex justify-end">
          <Botao type="submit" variante="primario" disabled={salvando || !profissionais.length}>
            <Save size={16} />
            {salvando ? 'Salvando' : 'Salvar'}
          </Botao>
        </div>
        </form>
      </Modal>

      <Tabela className="hidden lg:block">
        <TabelaConteudo larguraMinima="840px">
          <TabelaCabecalho densidade="compacta" className="grid-cols-[1.2fr_0.9fr_0.7fr_0.65fr_0.85fr_0.95fr_196px]">
            <span>Paciente</span>
            <span>Responsável</span>
            <span>Situação</span>
            <span>Risco</span>
            <span>Última consulta</span>
            <span>Próxima ação</span>
            <span>Ações</span>
          </TabelaCabecalho>
          <TabelaLinhas>
            {pacientesFiltrados.length ? (
              pacientesFiltrados.map((paciente) => (
                <TabelaLinha data-testid="linha-paciente" densidade="compacta" key={paciente.id} className="grid-cols-[1.2fr_0.9fr_0.7fr_0.65fr_0.85fr_0.95fr_196px] items-center hover:bg-superficie-hover">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <HeartPulse size={16} className="shrink-0 text-primaria" />
                      <Link href={`/pacientes/${paciente.id}` as Route} className="truncate font-semibold hover:underline">{paciente.nome}</Link>
                    </div>
                    <p className="mt-1 truncate text-xs text-texto-suave">{paciente.contato ?? paciente.id} · Nasc. {formatarData(paciente.dataNascimento)}</p>
                  </div>
                  <span className="break-all text-xs text-texto-suave">
                    {nomeProfissional(profissionais, paciente.profissionalResponsavelId)}
                  </span>
                  <Etiqueta className={statusClasse(paciente.statusAdesao)}>{paciente.statusAdesao}</Etiqueta>
                  <Etiqueta variante={nivelRisco(paciente) === 'alto' ? 'perigo' : nivelRisco(paciente) === 'medio' ? 'alerta' : 'sucesso'}>{nivelRisco(paciente)} {Number(paciente.scoreRisco).toFixed(1)}</Etiqueta>
                  <span className="text-xs text-texto-suave">{formatarData(paciente.ultimaConsultaConcluidaEm)}</span>
                  <span className="text-xs font-medium text-tinta">{proximaAcao(paciente)}</span>
                  <div data-testid="acoes-paciente" className="flex justify-end gap-1">
                    <Link
                      href={`/pacientes/${paciente.id}` as Route}
                      className={classesBotao({ variante: 'fantasma', className: 'w-11 px-0' })}
                      aria-label="Abrir prontuário"
                      title="Abrir prontuário"
                    >
                      <FileText size={16} />
                    </Link>
                    {podeGerenciar ? (
                      <>
                        <Botao
                          type="button"
                          variante="fantasma"
                          className="w-11 px-0"
                          onClick={() => void convidar(paciente)}
                          disabled={Boolean(paciente.usuarioId) || convidandoId === paciente.id}
                          aria-label="Convidar paciente"
                          title={paciente.usuarioId ? 'Paciente já possui acesso' : 'Convidar paciente'}
                        >
                          <KeyRound size={16} />
                        </Botao>
                        <Botao type="button" variante="fantasma" className="w-11 px-0" onClick={() => editar(paciente)} aria-label="Editar paciente">
                          <Edit3 size={16} />
                        </Botao>
                        <Botao
                          type="button"
                          variante="fantasma"
                          className="w-11 px-0"
                          onClick={() => setPacienteParaArquivar(paciente)}
                          disabled={arquivandoId === paciente.id}
                          aria-label="Arquivar paciente"
                        >
                          <Trash2 size={16} />
                        </Botao>
                      </>
                    ) : null}
                  </div>
                </TabelaLinha>
              ))
            ) : (
              <TabelaVazia mensagem="Nenhum paciente encontrado com estes filtros." />
            )}
          </TabelaLinhas>
        </TabelaConteudo>
      </Tabela>

      <div className="grid gap-3 lg:hidden">
        {pacientesFiltrados.map((paciente) => (
          <Cartao key={paciente.id}>
            <CartaoConteudo className="grid gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><Link href={`/pacientes/${paciente.id}` as Route} className="font-semibold text-tinta hover:underline">{paciente.nome}</Link><p className="mt-1 truncate text-xs text-texto-suave">{paciente.contato ?? paciente.id}</p></div>
                <Etiqueta variante={nivelRisco(paciente) === 'alto' ? 'perigo' : nivelRisco(paciente) === 'medio' ? 'alerta' : 'sucesso'}>{nivelRisco(paciente)} {Number(paciente.scoreRisco).toFixed(1)}</Etiqueta>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-texto-suave"><span>Responsável<br /><strong className="text-tinta">{nomeProfissional(profissionais, paciente.profissionalResponsavelId)}</strong></span><span>Última consulta<br /><strong className="text-tinta">{formatarData(paciente.ultimaConsultaConcluidaEm)}</strong></span><span className="col-span-2">Próxima ação<br /><strong className="text-tinta">{proximaAcao(paciente)}</strong></span></div>
              <div className="flex flex-wrap gap-1">
                <Link href={`/pacientes/${paciente.id}` as Route} className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-tinta hover:bg-superficie-hover">Abrir prontuário</Link>
                {podeGerenciar ? (
                  <>
                    <Botao type="button" variante="fantasma" onClick={() => editar(paciente)} aria-label={`Editar ${paciente.nome}`}><Edit3 size={16} /></Botao>
                    <Botao type="button" variante="fantasma" onClick={() => setPacienteParaArquivar(paciente)} aria-label={`Arquivar ${paciente.nome}`}><Trash2 size={16} /></Botao>
                  </>
                ) : null}
              </div>
            </CartaoConteudo>
          </Cartao>
        ))}
        {!pacientesFiltrados.length ? <p className="px-1 py-6 text-sm text-texto-suave">Nenhum paciente encontrado com estes filtros.</p> : null}
      </div>

      <nav className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginacao de pacientes">
        <p className="text-sm text-texto-suave" aria-live="polite">
          Página {pagina} de {totalPaginas} | {dados?.total ?? 0} pacientes
        </p>
        <div className="flex gap-2">
          <Botao type="button" variante="secundario" onClick={() => setPagina((atual) => Math.max(1, atual - 1))} disabled={pagina <= 1 || carregando}>
            Anterior
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))} disabled={pagina >= totalPaginas || carregando}>
            Próxima
          </Botao>
        </div>
      </nav>

      <ImportacaoPacientes
        aberto={modalImportacaoAberto}
        profissionais={profissionais}
        aoFechar={() => setModalImportacaoAberto(false)}
        aoConcluir={() => {
          setModalImportacaoAberto(false);
          void carregar();
        }}
      />

      <Modal aberto={lixeiraAberta} aoFechar={() => setLixeiraAberta(false)} titulo="Lixeira de pacientes" descricao="Restaure cadastros arquivados sem perder prontuário, agenda ou vinculos.">
        {arquivados.length ? (
          <ul className="grid max-h-[60vh] gap-2 overflow-y-auto">
            {arquivados.map((paciente) => (
              <li key={paciente.id} className="flex flex-wrap items-center gap-3 rounded-md border border-linha p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-texto-forte">{paciente.nome}</p>
                  <p className="text-xs text-texto-suave">Arquivado em {formatarData(paciente.arquivadoEm ?? undefined)}</p>
                </div>
                {podeGerenciar ? (
                  <Botao type="button" tamanho="sm" onClick={() => void restaurar(paciente)} carregando={restaurandoId === paciente.id}>
                    <ArchiveRestore size={14} /> Restaurar
                  </Botao>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <p className="py-8 text-center text-sm text-texto-suave">Nenhum paciente arquivado.</p>}
      </Modal>

      <ModalConfirmacao
        aberto={pacienteParaArquivar !== null}
        titulo="Arquivar paciente"
        mensagem={pacienteParaArquivar ? `Arquivar o paciente ${pacienteParaArquivar.nome}?` : ''}
        rotuloConfirmar="Arquivar"
        confirmando={Boolean(arquivandoId)}
        aoConfirmar={() => void confirmarArquivar()}
        aoCancelar={() => setPacienteParaArquivar(null)}
      />
    </section>
  );
}
