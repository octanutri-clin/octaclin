'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Edit3, Plus, RefreshCcw, Save, Stethoscope, Trash2, X } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { obterSessao } from '@/lib/auth-api';
import {
  ProfissionalResumo,
  RespostaPaginada,
  SalvarProfissionalEntrada,
  arquivarProfissional,
  atualizarProfissional,
  criarProfissional,
  listarProfissionais
} from '@/lib/cadastros-api';

interface FormularioProfissional {
  email: string;
  senhaInicial: string;
  nome: string;
  registroProfissional: string;
  especialidade: string;
}

const formularioInicial: FormularioProfissional = {
  email: '',
  senhaInicial: '',
  nome: '',
  registroProfissional: '',
  especialidade: ''
};

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(data);
}

function montarPayload(formulario: FormularioProfissional, editandoId: string | null): SalvarProfissionalEntrada {
  return {
    email: editandoId ? undefined : formulario.email.trim(),
    senhaInicial: editandoId ? undefined : formulario.senhaInicial,
    nome: formulario.nome.trim(),
    registroProfissional: formulario.registroProfissional.trim() || undefined,
    especialidade: formulario.especialidade.trim() || undefined
  };
}

export function ListaProfissionais() {
  const [dados, setDados] = useState<RespostaPaginada<ProfissionalResumo> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arquivandoId, setArquivandoId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioProfissional>(formularioInicial);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [podeGerenciar, setPodeGerenciar] = useState(false);

  useEffect(() => {
    void obterSessao().then((sessao) => setPodeGerenciar(Boolean(sessao?.permissoes?.includes('profissionais.gerenciar'))));
  }, []);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      setDados(await listarProfissionais());
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar profissionais.');
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
      const mensagem = editandoId ? 'Profissional atualizado.' : 'Profissional criado.';
      if (editandoId) {
        await atualizarProfissional(editandoId, payload);
      } else {
        await criarProfissional(payload);
      }
      setFormulario(formularioInicial);
      setEditandoId(null);
      await carregar();
      setSucesso(mensagem);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar profissional.');
    } finally {
      setSalvando(false);
    }
  }

  function editar(profissional: ProfissionalResumo) {
    setEditandoId(profissional.id);
    setFormulario({
      email: '',
      senhaInicial: '',
      nome: profissional.nome,
      registroProfissional: profissional.registroProfissional ?? '',
      especialidade: profissional.especialidade ?? ''
    });
  }

  async function arquivar(profissional: ProfissionalResumo) {
    const confirmado = window.confirm(`Arquivar o profissional ${profissional.nome}?`);
    if (!confirmado) return;

    setArquivandoId(profissional.id);
    setErro(null);
    setSucesso(null);

    try {
      await arquivarProfissional(profissional.id);
      if (editandoId === profissional.id) cancelarEdicao();
      await carregar();
      setSucesso('Profissional arquivado.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao arquivar profissional.');
    } finally {
      setArquivandoId(null);
    }
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setFormulario(formularioInicial);
  }

  useEffect(() => {
    void carregar();
  }, []);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-linha bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">Equipe clinica</h2>
          <p className="mt-1 text-sm text-[#596273]">
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
      </div>

      {erro ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#efb8ad] bg-[#fff4f1] px-4 py-3 text-sm text-perigo">
          <AlertTriangle size={16} />
          {erro}
        </div>
      ) : null}
      {sucesso ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#b8dfc1] bg-[#eef7f0] px-4 py-3 text-sm text-[#245b33]">
          <CheckCircle2 size={16} />
          {sucesso}
        </div>
      ) : null}

      {podeGerenciar ? (
      <form onSubmit={salvar} className="rounded-lg border border-linha bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          {editandoId ? <Edit3 size={18} className="text-primaria" /> : <Plus size={18} className="text-primaria" />}
          <h3 className="text-sm font-semibold">{editandoId ? 'Editar profissional' : 'Novo profissional'}</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {!editandoId ? (
            <>
              <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                Email
                <input
                  className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
                  type="email"
                  value={formulario.email}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, email: evento.target.value }))}
                  required
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-[#596273]">
                Senha inicial
                <input
                  className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
                  type="password"
                  minLength={8}
                  value={formulario.senhaInicial}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, senhaInicial: evento.target.value }))}
                  required
                />
              </label>
            </>
          ) : null}
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            Nome
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formulario.nome}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, nome: evento.target.value }))}
              required
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            Registro
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formulario.registroProfissional}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, registroProfissional: evento.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[#596273]">
            Especialidade
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formulario.especialidade}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, especialidade: evento.target.value }))}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Botao type="submit" variante="primario" disabled={salvando}>
            <Save size={16} />
            {salvando ? 'Salvando' : 'Salvar'}
          </Botao>
        </div>
      </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-linha bg-white">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-[1.2fr_0.9fr_1fr_0.7fr_96px] gap-3 border-b border-linha px-4 py-3 text-xs font-semibold uppercase text-[#596273]">
            <span>Profissional</span>
            <span>Registro</span>
            <span>Especialidade</span>
            <span>Criado em</span>
            <span>Acoes</span>
          </div>
          <div className="divide-y divide-linha">
            {dados?.itens.length ? (
              dados.itens.map((profissional) => (
                <div
                  key={profissional.id}
                  className="grid grid-cols-[1.2fr_0.9fr_1fr_0.7fr_96px] gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Stethoscope size={16} className="shrink-0 text-primaria" />
                      <strong className="truncate">{profissional.nome}</strong>
                    </div>
                    <p className="mt-1 break-all text-xs text-[#596273]">{profissional.id}</p>
                  </div>
                  <span>{profissional.registroProfissional ?? '-'}</span>
                  <span>{profissional.especialidade ?? '-'}</span>
                  <span>{formatarData(profissional.criadoEm)}</span>
                  <div className="flex justify-end gap-1">
                    {podeGerenciar ? (
                      <>
                        <Botao type="button" variante="fantasma" onClick={() => editar(profissional)} aria-label="Editar profissional">
                          <Edit3 size={16} />
                        </Botao>
                        <Botao
                          type="button"
                          variante="fantasma"
                          onClick={() => void arquivar(profissional)}
                          disabled={arquivandoId === profissional.id}
                          aria-label="Arquivar profissional"
                        >
                          <Trash2 size={16} />
                        </Botao>
                      </>
                    ) : (
                      <span className="text-xs text-[#94a0af]">-</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-sm text-[#596273]">Nenhum profissional carregado.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
