'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  LinkIcon,
  MessageSquareText,
  RefreshCcw,
  Save,
  Send,
  Stethoscope,
  UserRound
} from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import {
  criarMaterial,
  enviarMaterialPaciente,
  listarMateriais,
  listarMateriaisPaciente,
  type EnvioMaterialPacienteApi,
  type MaterialEducativoApi,
  type TipoMaterialEducativoApi
} from '@/lib/materiais-api';
import {
  criarEvolucaoClinica,
  criarTarefaAcompanhamento,
  obterProntuarioPaciente,
  type CategoriaTarefaAcompanhamentoApi,
  type EventoProntuarioPacienteApi,
  type PrioridadeTarefaAcompanhamentoApi,
  type ProntuarioPacienteApi,
  type TipoEvolucaoClinicaApi
} from '@/lib/prontuario-api';

interface FormularioEvolucao {
  titulo: string;
  tipo: TipoEvolucaoClinicaApi;
  conteudo: string;
}

interface FormularioTarefa {
  titulo: string;
  categoria: CategoriaTarefaAcompanhamentoApi;
  prioridade: PrioridadeTarefaAcompanhamentoApi;
  vencimentoEm: string;
  descricao: string;
}

interface FormularioMaterial {
  titulo: string;
  tipo: TipoMaterialEducativoApi;
  categoria: string;
  url: string;
  resumo: string;
  conteudo: string;
}

interface FormularioEnvioMaterial {
  materialId: string;
  observacao: string;
}

const formularioEvolucaoInicial: FormularioEvolucao = {
  titulo: '',
  tipo: 'observacao',
  conteudo: ''
};

const formularioTarefaInicial: FormularioTarefa = {
  titulo: '',
  categoria: 'tarefa',
  prioridade: 'media',
  vencimentoEm: '',
  descricao: ''
};

const formularioMaterialInicial: FormularioMaterial = {
  titulo: '',
  tipo: 'link',
  categoria: '',
  url: '',
  resumo: '',
  conteudo: ''
};

const formularioEnvioMaterialInicial: FormularioEnvioMaterial = {
  materialId: '',
  observacao: ''
};

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
    mensagem: 'Mensagem',
    evolucao_clinica: 'Evolucao',
    tarefa_acompanhamento: 'Tarefa'
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
  if (tipo === 'evolucao_clinica') return Stethoscope;
  if (tipo === 'tarefa_acompanhamento') return CheckSquare;
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
  const [materiais, setMateriais] = useState<MaterialEducativoApi[]>([]);
  const [materiaisPaciente, setMateriaisPaciente] = useState<EnvioMaterialPacienteApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoEvolucao, setSalvandoEvolucao] = useState(false);
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);
  const [salvandoMaterial, setSalvandoMaterial] = useState(false);
  const [enviandoMaterial, setEnviandoMaterial] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [formularioEvolucao, setFormularioEvolucao] = useState<FormularioEvolucao>(formularioEvolucaoInicial);
  const [formularioTarefa, setFormularioTarefa] = useState<FormularioTarefa>(formularioTarefaInicial);
  const [formularioMaterial, setFormularioMaterial] = useState<FormularioMaterial>(formularioMaterialInicial);
  const [formularioEnvioMaterial, setFormularioEnvioMaterial] = useState<FormularioEnvioMaterial>(formularioEnvioMaterialInicial);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const [prontuario, biblioteca, enviados] = await Promise.all([
        obterProntuarioPaciente(pacienteId),
        listarMateriais(),
        listarMateriaisPaciente(pacienteId)
      ]);
      setDados(prontuario);
      setMateriais(biblioteca);
      setMateriaisPaciente(enviados);
      setFormularioEnvioMaterial((atual) => ({
        ...atual,
        materialId: atual.materialId || biblioteca[0]?.id || ''
      }));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar prontuario.');
    } finally {
      setCarregando(false);
    }
  }

  async function registrarEvolucao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoEvolucao(true);
    setErro(null);
    setSucesso(null);
    try {
      await criarEvolucaoClinica(pacienteId, {
        titulo: formularioEvolucao.titulo.trim(),
        conteudo: formularioEvolucao.conteudo.trim(),
        tipo: formularioEvolucao.tipo,
        visibilidade: 'privada'
      });
      setFormularioEvolucao(formularioEvolucaoInicial);
      setSucesso('Evolucao clinica registrada.');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar evolucao clinica.');
    } finally {
      setSalvandoEvolucao(false);
    }
  }

  async function registrarTarefa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoTarefa(true);
    setErro(null);
    setSucesso(null);
    try {
      await criarTarefaAcompanhamento(pacienteId, {
        titulo: formularioTarefa.titulo.trim(),
        descricao: formularioTarefa.descricao.trim() || undefined,
        categoria: formularioTarefa.categoria,
        prioridade: formularioTarefa.prioridade,
        vencimentoEm: formularioTarefa.vencimentoEm ? new Date(formularioTarefa.vencimentoEm).toISOString() : undefined
      });
      setFormularioTarefa(formularioTarefaInicial);
      setSucesso('Tarefa de acompanhamento prescrita.');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao prescrever tarefa de acompanhamento.');
    } finally {
      setSalvandoTarefa(false);
    }
  }

  async function registrarMaterial(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvandoMaterial(true);
    setErro(null);
    setSucesso(null);
    try {
      const material = await criarMaterial({
        titulo: formularioMaterial.titulo.trim(),
        tipo: formularioMaterial.tipo,
        categoria: formularioMaterial.categoria.trim() || undefined,
        url: formularioMaterial.url.trim() || undefined,
        resumo: formularioMaterial.resumo.trim() || undefined,
        conteudo: formularioMaterial.conteudo.trim() || undefined
      });
      setFormularioMaterial(formularioMaterialInicial);
      setFormularioEnvioMaterial((atual) => ({ ...atual, materialId: material.id }));
      setSucesso('Material salvo na biblioteca.');
      setMateriais(await listarMateriais());
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar material.');
    } finally {
      setSalvandoMaterial(false);
    }
  }

  async function enviarMaterial(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!formularioEnvioMaterial.materialId) return;
    setEnviandoMaterial(true);
    setErro(null);
    setSucesso(null);
    try {
      await enviarMaterialPaciente(pacienteId, {
        materialId: formularioEnvioMaterial.materialId,
        observacao: formularioEnvioMaterial.observacao.trim() || undefined
      });
      setFormularioEnvioMaterial((atual) => ({ ...formularioEnvioMaterialInicial, materialId: atual.materialId }));
      setSucesso('Material enviado ao paciente.');
      setMateriaisPaciente(await listarMateriaisPaciente(pacienteId));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao enviar material ao paciente.');
    } finally {
      setEnviandoMaterial(false);
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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <CartaoResumo titulo="Consultas" valor={String(dados.resumo.consultas)} detalhe="Eventos de agenda vinculados" />
        <CartaoResumo titulo="Formularios pendentes" valor={String(dados.resumo.formulariosPendentes)} detalhe="Envios aguardando resposta" />
        <CartaoResumo titulo="Respostas" valor={String(dados.resumo.respostas)} detalhe="Check-ins finalizados ou em andamento" />
        <CartaoResumo titulo="Evolucoes" valor={String(dados.resumo.evolucoes ?? 0)} detalhe={`${dados.resumo.mensagens} mensagens registradas`} />
        <CartaoResumo titulo="Tarefas" valor={String(dados.resumo.tarefasPendentes ?? 0)} detalhe={`${dados.resumo.tarefasPendentes ?? 0} tarefas pendentes`} />
      </section>

      {sucesso ? (
        <div className="rounded-md border border-[#b8dfc1] bg-[#eef7f0] px-4 py-3 text-sm text-[#245b33]">{sucesso}</div>
      ) : null}

      <form onSubmit={registrarEvolucao} className="grid gap-3 rounded-md border border-linha bg-white p-4">
        <div>
          <h2 className="text-base font-semibold text-tinta">Nova evolucao clinica</h2>
          <p className="mt-1 text-sm text-[#596273]">Registro privado do profissional, salvo no historico do paciente.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            Titulo da evolucao
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formularioEvolucao.titulo}
              onChange={(evento) => setFormularioEvolucao((atual) => ({ ...atual, titulo: evento.target.value }))}
              required
              maxLength={180}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            Tipo da evolucao
            <select
              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
              value={formularioEvolucao.tipo}
              onChange={(evento) => setFormularioEvolucao((atual) => ({ ...atual, tipo: evento.target.value as TipoEvolucaoClinicaApi }))}
            >
              <option value="observacao">Observacao</option>
              <option value="consulta">Consulta</option>
              <option value="retorno">Retorno</option>
              <option value="ajuste_plano">Ajuste de plano</option>
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-[#596273]">
          Conteudo da evolucao
          <textarea
            className="min-h-[112px] rounded-md border border-linha px-3 py-2 text-sm font-normal text-tinta"
            value={formularioEvolucao.conteudo}
            onChange={(evento) => setFormularioEvolucao((atual) => ({ ...atual, conteudo: evento.target.value }))}
            required
            minLength={3}
            maxLength={6000}
          />
        </label>
        <div className="flex justify-end">
          <Botao type="submit" variante="primario" disabled={salvandoEvolucao}>
            <Save size={16} />
            {salvandoEvolucao ? 'Registrando' : 'Registrar evolucao'}
          </Botao>
        </div>
      </form>

      <form onSubmit={registrarTarefa} className="grid gap-3 rounded-md border border-linha bg-white p-4">
        <div>
          <h2 className="text-base font-semibold text-tinta">Plano de acompanhamento</h2>
          <p className="mt-1 text-sm text-[#596273]">Prescreva metas, tarefas e check-ins para o paciente cumprir entre consultas.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_210px]">
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            Titulo da tarefa
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formularioTarefa.titulo}
              onChange={(evento) => setFormularioTarefa((atual) => ({ ...atual, titulo: evento.target.value }))}
              required
              maxLength={180}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            Categoria da tarefa
            <select
              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
              value={formularioTarefa.categoria}
              onChange={(evento) =>
                setFormularioTarefa((atual) => ({ ...atual, categoria: evento.target.value as CategoriaTarefaAcompanhamentoApi }))
              }
            >
              <option value="tarefa">Tarefa</option>
              <option value="meta">Meta</option>
              <option value="checkin">Check-in</option>
              <option value="orientacao">Orientacao</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            Prioridade da tarefa
            <select
              className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
              value={formularioTarefa.prioridade}
              onChange={(evento) =>
                setFormularioTarefa((atual) => ({ ...atual, prioridade: evento.target.value as PrioridadeTarefaAcompanhamentoApi }))
              }
            >
              <option value="baixa">Baixa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            Vencimento da tarefa
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              type="datetime-local"
              value={formularioTarefa.vencimentoEm}
              onChange={(evento) => setFormularioTarefa((atual) => ({ ...atual, vencimentoEm: evento.target.value }))}
            />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-[#596273]">
          Descricao da tarefa
          <textarea
            className="min-h-[96px] rounded-md border border-linha px-3 py-2 text-sm font-normal text-tinta"
            value={formularioTarefa.descricao}
            onChange={(evento) => setFormularioTarefa((atual) => ({ ...atual, descricao: evento.target.value }))}
            maxLength={2000}
          />
        </label>
        <div className="flex justify-end">
          <Botao type="submit" variante="primario" disabled={salvandoTarefa}>
            <CheckSquare size={16} />
            {salvandoTarefa ? 'Prescrevendo' : 'Prescrever tarefa'}
          </Botao>
        </div>
      </form>

      <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-tinta">Biblioteca de materiais</h2>
            <p className="mt-1 text-sm text-[#596273]">Salve links, PDFs por URL e orientacoes reutilizaveis para enviar ao paciente.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#596273]">
            <FileText size={16} className="text-primaria" />
            {materiais.length} materiais
          </div>
        </div>

        <form onSubmit={registrarMaterial} className="grid gap-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_180px]">
            <label className="grid gap-1 text-xs font-semibold text-[#596273]">
              Titulo do material
              <input
                className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
                value={formularioMaterial.titulo}
                onChange={(evento) => setFormularioMaterial((atual) => ({ ...atual, titulo: evento.target.value }))}
                required
                maxLength={180}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#596273]">
              Tipo do material
              <select
                className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                value={formularioMaterial.tipo}
                onChange={(evento) => setFormularioMaterial((atual) => ({ ...atual, tipo: evento.target.value as TipoMaterialEducativoApi }))}
              >
                <option value="link">Link</option>
                <option value="pdf_url">PDF por URL</option>
                <option value="orientacao">Orientacao</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#596273]">
              Categoria do material
              <input
                className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
                value={formularioMaterial.categoria}
                onChange={(evento) => setFormularioMaterial((atual) => ({ ...atual, categoria: evento.target.value }))}
                maxLength={80}
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            URL do material
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formularioMaterial.url}
              onChange={(evento) => setFormularioMaterial((atual) => ({ ...atual, url: evento.target.value }))}
              maxLength={1000}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            Resumo do material
            <textarea
              className="min-h-[78px] rounded-md border border-linha px-3 py-2 text-sm font-normal text-tinta"
              value={formularioMaterial.resumo}
              onChange={(evento) => setFormularioMaterial((atual) => ({ ...atual, resumo: evento.target.value }))}
              maxLength={500}
            />
          </label>
          <div className="flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvandoMaterial}>
              <Save size={16} />
              {salvandoMaterial ? 'Salvando' : 'Salvar material'}
            </Botao>
          </div>
        </form>

        <form onSubmit={enviarMaterial} className="grid gap-3 border-t border-linha pt-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className="grid gap-1 text-xs font-semibold text-[#596273]">
              Material para enviar
              <select
                className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                value={formularioEnvioMaterial.materialId}
                onChange={(evento) => setFormularioEnvioMaterial((atual) => ({ ...atual, materialId: evento.target.value }))}
                disabled={!materiais.length}
                required
              >
                {materiais.length ? null : <option value="">Nenhum material salvo</option>}
                {materiais.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.titulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[#596273]">
              Observacao do envio
              <input
                className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
                value={formularioEnvioMaterial.observacao}
                onChange={(evento) => setFormularioEnvioMaterial((atual) => ({ ...atual, observacao: evento.target.value }))}
                maxLength={1000}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <Botao type="submit" variante="primario" disabled={enviandoMaterial || !materiais.length}>
              <Send size={16} />
              {enviandoMaterial ? 'Enviando' : 'Enviar material'}
            </Botao>
          </div>
        </form>

        <div className="grid gap-2 border-t border-linha pt-3">
          <h3 className="text-sm font-semibold text-tinta">Materiais enviados</h3>
          {materiaisPaciente.length ? (
            materiaisPaciente.map((material) => (
              <article key={material.id} className="grid gap-1 rounded-md border border-linha p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="break-words text-sm font-semibold text-tinta">{material.titulo}</p>
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${classeStatus(material.status)}`}>{material.status}</span>
                </div>
                {material.resumo ? <p className="break-words text-sm text-[#596273]">{material.resumo}</p> : null}
                {material.observacao ? <p className="break-words text-sm text-[#596273]">{material.observacao}</p> : null}
                {material.url ? (
                  <a className="inline-flex items-center gap-1 break-all text-sm font-medium text-primaria hover:underline" href={material.url}>
                    <LinkIcon size={14} />
                    {material.url}
                  </a>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-[#596273]">Nenhum material enviado ao paciente.</p>
          )}
        </div>
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
