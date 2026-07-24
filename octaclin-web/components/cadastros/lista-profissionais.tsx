'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Edit3, Plus, RefreshCcw, Save, Stethoscope, Trash2, X } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { ModalConfirmacao } from '@/components/ui/modal';
import { Tabela, TabelaCabecalho, TabelaConteudo, TabelaLinha, TabelaLinhas, TabelaVazia } from '@/components/ui/tabela';
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
  const [profissionalParaArquivar, setProfissionalParaArquivar] = useState<ProfissionalResumo | null>(null);

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

  async function confirmarArquivar() {
    if (!profissionalParaArquivar) return;
    const profissional = profissionalParaArquivar;

    setArquivandoId(profissional.id);
    setErro(null);
    setSucesso(null);

    try {
      await arquivarProfissional(profissional.id);
      if (editandoId === profissional.id) cancelarEdicao();
      await carregar();
      setSucesso('Profissional arquivado.');
      setProfissionalParaArquivar(null);
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
      <Cartao>
        <CartaoConteudo className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Equipe clinica</h2>
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

      {podeGerenciar ? (
      <Cartao>
        <form onSubmit={salvar}>
        <CartaoCabecalho>
          <CartaoTitulo icone={editandoId ? <Edit3 size={18} className="text-primaria" /> : <Plus size={18} className="text-primaria" />}>
            {editandoId ? 'Editar profissional' : 'Novo profissional'}
          </CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {!editandoId ? (
            <>
              <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                Email
                <input
                  className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
                  type="email"
                  value={formulario.email}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, email: evento.target.value }))}
                  required
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-texto-suave">
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
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Nome
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formulario.nome}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, nome: evento.target.value }))}
              required
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
            Registro
            <input
              className="h-10 rounded-md border border-linha px-3 text-sm font-normal text-tinta"
              value={formulario.registroProfissional}
              onChange={(evento) => setFormulario((atual) => ({ ...atual, registroProfissional: evento.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">
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
        </CartaoConteudo>
        </form>
      </Cartao>
      ) : null}

      <Tabela>
        <TabelaConteudo larguraMinima="820px">
          <TabelaCabecalho className="grid-cols-[1.2fr_0.9fr_1fr_0.7fr_96px]">
            <span>Profissional</span>
            <span>Registro</span>
            <span>Especialidade</span>
            <span>Criado em</span>
            <span>Acoes</span>
          </TabelaCabecalho>
          <TabelaLinhas>
            {dados?.itens.length ? (
              dados.itens.map((profissional) => (
                <TabelaLinha key={profissional.id} className="grid-cols-[1.2fr_0.9fr_1fr_0.7fr_96px]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Stethoscope size={16} className="shrink-0 text-primaria" />
                      <strong className="truncate">{profissional.nome}</strong>
                    </div>
                    <p className="mt-1 break-all text-xs text-texto-suave">{profissional.id}</p>
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
                          onClick={() => setProfissionalParaArquivar(profissional)}
                          disabled={arquivandoId === profissional.id}
                          aria-label="Arquivar profissional"
                        >
                          <Trash2 size={16} />
                        </Botao>
                      </>
                    ) : (
                      <span className="text-xs text-texto-sutil">-</span>
                    )}
                  </div>
                </TabelaLinha>
              ))
            ) : (
              <TabelaVazia mensagem="Nenhum profissional carregado." />
            )}
          </TabelaLinhas>
        </TabelaConteudo>
      </Tabela>

      <ModalConfirmacao
        aberto={profissionalParaArquivar !== null}
        titulo="Arquivar profissional"
        mensagem={profissionalParaArquivar ? `Arquivar o profissional ${profissionalParaArquivar.nome}?` : ''}
        rotuloConfirmar="Arquivar"
        confirmando={Boolean(arquivandoId)}
        aoConfirmar={() => void confirmarArquivar()}
        aoCancelar={() => setProfissionalParaArquivar(null)}
      />
    </section>
  );
}
