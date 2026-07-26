'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Edit3, FileText, HeartPulse, KeyRound, Plus, RefreshCcw, Save, Trash2, X } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { ModalConfirmacao } from '@/components/ui/modal';
import { Tabela, TabelaCabecalho, TabelaConteudo, TabelaLinha, TabelaLinhas, TabelaVazia } from '@/components/ui/tabela';
import { criarConvitePaciente } from '@/lib/convites-paciente-api';
import {
  PacienteResumo,
  ProfissionalResumo,
  RespostaPaginada,
  SalvarPacienteEntrada,
  arquivarPaciente,
  atualizarPaciente,
  criarPaciente,
  listarPacientes,
  listarProfissionais
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

export function ListaPacientes() {
  const [dados, setDados] = useState<RespostaPaginada<PacienteResumo> | null>(null);
  const [profissionais, setProfissionais] = useState<ProfissionalResumo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arquivandoId, setArquivandoId] = useState<string | null>(null);
  const [convidandoId, setConvidandoId] = useState<string | null>(null);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioPaciente>(formularioInicial);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [pacienteParaArquivar, setPacienteParaArquivar] = useState<PacienteResumo | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const [pacientes, profissionaisResposta] = await Promise.all([listarPacientes(), listarProfissionais()]);
      setDados(pacientes);
      setProfissionais(profissionaisResposta.itens);
      setFormulario((atual) => ({
        ...atual,
        profissionalResponsavelId: atual.profissionalResponsavelId || profissionaisResposta.itens[0]?.id || ''
      }));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar pacientes.');
    } finally {
      setCarregando(false);
    }
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
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
      await carregar();
      setSucesso(mensagem);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar paciente.');
    } finally {
      setSalvando(false);
    }
  }

  function editar(paciente: PacienteResumo) {
    setEditandoId(paciente.id);
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
    setErro(null);
    setSucesso(null);

    try {
      await arquivarPaciente(paciente.id);
      if (editandoId === paciente.id) cancelarEdicao();
      await carregar();
      setSucesso('Paciente arquivado.');
      setPacienteParaArquivar(null);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao arquivar paciente.');
    } finally {
      setArquivandoId(null);
    }
  }

  async function convidar(paciente: PacienteResumo) {
    const emailPadrao = paciente.contato?.includes('@') ? paciente.contato : '';
    const email = window.prompt(`Email para convite de ${paciente.nome}`, emailPadrao);
    if (!email) return;

    setConvidandoId(paciente.id);
    setErro(null);
    setSucesso(null);
    setLinkConvite(null);

    try {
      const convite = await criarConvitePaciente(paciente.id, email);
      setLinkConvite(convite.linkAtivacao);
      try {
        await navigator.clipboard?.writeText(convite.linkAtivacao);
        setSucesso('Convite criado e link copiado para a area de transferencia.');
      } catch {
        setSucesso('Convite criado. Use o link exibido abaixo.');
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar convite.');
    } finally {
      setConvidandoId(null);
    }
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setFormulario({ ...formularioInicial, profissionalResponsavelId: profissionais[0]?.id ?? '' });
  }

  useEffect(() => {
    void carregar();
  }, []);

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
          <div className="flex gap-2">
            {editandoId ? (
              <Botao type="button" variante="fantasma" onClick={cancelarEdicao}>
                <X size={16} />
                Cancelar
              </Botao>
            ) : null}
            <Botao onClick={carregar} disabled={carregando}>
              <RefreshCcw size={16} />
              {carregando ? 'Atualizando' : 'Atualizar'}
            </Botao>
          </div>
        </CartaoConteudo>
      </Cartao>

      {erro ? (
        <div className="flex items-center gap-2 rounded-lg border border-perigo-borda bg-perigo-suave px-4 py-3 text-sm text-perigo">
          <AlertTriangle size={16} />
          {erro}
        </div>
      ) : null}
      {sucesso ? (
        <div className="flex items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
          <CheckCircle2 size={16} />
          {sucesso}
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

      <Cartao>
        <form onSubmit={salvar}>
        <CartaoCabecalho>
          <CartaoTitulo icone={editandoId ? <Edit3 size={18} className="text-primaria" /> : <Plus size={18} className="text-primaria" />}>
            {editandoId ? 'Editar paciente' : 'Novo paciente'}
          </CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <label className="grid gap-1 text-xs font-semibold text-texto-suave lg:col-span-2">
            Profissional
            <select
              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
              value={formulario.profissionalResponsavelId}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, profissionalResponsavelId: evento.target.value }))}
              required
            >
              <option value="" disabled>
                Selecione
              </option>
              {profissionais.map((profissional) => (
                <option key={profissional.id} value={profissional.id}>
                  {profissional.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave lg:col-span-2">
            Nome
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formulario.nome}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, nome: evento.target.value }))}
              required
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Contato
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formulario.contato}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, contato: evento.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Nascimento
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              type="date"
              value={formulario.dataNascimento}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, dataNascimento: evento.target.value }))}
            />
          </label>
          {editandoId ? (
            <>
              <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                Status
                <select
                  className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                  value={formulario.statusAdesao}
                  onChange={(evento) =>
                    setFormulario((atual) => ({ ...atual, statusAdesao: evento.target.value as StatusPaciente }))
                  }
                >
                  <option value="novo">novo</option>
                  <option value="aderente">aderente</option>
                  <option value="em_acompanhamento">em_acompanhamento</option>
                  <option value="risco">risco</option>
                  <option value="inativo">inativo</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                Risco
                <input
                  className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={formulario.scoreRisco}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, scoreRisco: evento.target.value }))}
                />
              </label>
            </>
          ) : null}
        </div>
        <div className="mt-3 flex justify-end">
          <Botao type="submit" variante="primario" disabled={salvando || !profissionais.length}>
            <Save size={16} />
            {salvando ? 'Salvando' : 'Salvar'}
          </Botao>
        </div>
        </CartaoConteudo>
        </form>
      </Cartao>

      <Tabela>
        <TabelaConteudo larguraMinima="840px">
          <TabelaCabecalho className="grid-cols-[1.2fr_1fr_0.8fr_0.7fr_172px]">
            <span>Paciente</span>
            <span>Responsavel</span>
            <span>Status</span>
            <span>Risco</span>
            <span>Acoes</span>
          </TabelaCabecalho>
          <TabelaLinhas>
            {dados?.itens.length ? (
              dados.itens.map((paciente) => (
                <TabelaLinha key={paciente.id} className="grid-cols-[1.2fr_1fr_0.8fr_0.7fr_172px]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <HeartPulse size={16} className="shrink-0 text-primaria" />
                      <strong className="truncate">{paciente.nome}</strong>
                    </div>
                    <p className="mt-1 text-xs text-texto-suave">{paciente.contato ?? paciente.id}</p>
                    <p className="mt-1 text-xs text-texto-suave">Nascimento: {formatarData(paciente.dataNascimento)}</p>
                  </div>
                  <span className="break-all text-xs text-texto-suave">
                    {nomeProfissional(profissionais, paciente.profissionalResponsavelId)}
                  </span>
                  <span className={`h-fit rounded-sm px-2 py-1 text-xs font-semibold ${statusClasse(paciente.statusAdesao)}`}>
                    {paciente.statusAdesao}
                  </span>
                  <span className="font-semibold">{Number(paciente.scoreRisco).toFixed(1)}</span>
                  <div className="flex justify-end gap-1">
                    <Link
                      href={`/pacientes/${paciente.id}` as Route}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-tinta transition-colors hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
                      aria-label="Abrir prontuario"
                      title="Abrir prontuario"
                    >
                      <FileText size={16} />
                    </Link>
                    <Botao
                      type="button"
                      variante="fantasma"
                      onClick={() => void convidar(paciente)}
                      disabled={Boolean(paciente.usuarioId) || convidandoId === paciente.id}
                      aria-label="Convidar paciente"
                      title={paciente.usuarioId ? 'Paciente ja possui acesso' : 'Convidar paciente'}
                    >
                      <KeyRound size={16} />
                    </Botao>
                    <Botao type="button" variante="fantasma" onClick={() => editar(paciente)} aria-label="Editar paciente">
                      <Edit3 size={16} />
                    </Botao>
                    <Botao
                      type="button"
                      variante="fantasma"
                      onClick={() => setPacienteParaArquivar(paciente)}
                      disabled={arquivandoId === paciente.id}
                      aria-label="Arquivar paciente"
                    >
                      <Trash2 size={16} />
                    </Botao>
                  </div>
                </TabelaLinha>
              ))
            ) : (
              <TabelaVazia mensagem="Nenhum paciente carregado." />
            )}
          </TabelaLinhas>
        </TabelaConteudo>
      </Tabela>

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
