'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArchiveRestore, CalendarDays, CheckCircle2, Edit3, Link2, Plus, RefreshCcw, Save, Stethoscope, Trash2, X } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { ModalConfirmacao } from '@/components/ui/modal';
import { Abas } from '@/components/ui/abas';
import { Tabela, TabelaCabecalho, TabelaConteudo, TabelaLinha, TabelaLinhas, TabelaVazia } from '@/components/ui/tabela';
import { obterSessao } from '@/lib/auth-api';
import { listarStatusGoogleProfissionais } from '@/lib/agenda-api';
import {
  ProfissionalResumo,
  RespostaPaginada,
  SalvarProfissionalEntrada,
  arquivarProfissional,
  atualizarProfissional,
  criarProfissional,
  listarProfissionais,
  listarProfissionaisArquivados,
  restaurarProfissional
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
  const [areaAtiva, setAreaAtiva] = useState<'diretorio' | 'disponibilidade' | 'integracoes' | 'lixeira'>('diretorio');
  const [dados, setDados] = useState<RespostaPaginada<ProfissionalResumo> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [arquivandoId, setArquivandoId] = useState<string | null>(null);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [arquivados, setArquivados] = useState<ProfissionalResumo[]>([]);
  const [carregandoLixeira, setCarregandoLixeira] = useState(false);
  const [ultimoArquivado, setUltimoArquivado] = useState<ProfissionalResumo | null>(null);
  const [formulario, setFormulario] = useState<FormularioProfissional>(formularioInicial);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [podeGerenciar, setPodeGerenciar] = useState(false);
  const [profissionalParaArquivar, setProfissionalParaArquivar] = useState<ProfissionalResumo | null>(null);
  const [googlePorProfissional, setGooglePorProfissional] = useState<Map<string, boolean>>(new Map());
  const [statusGoogleIndisponivel, setStatusGoogleIndisponivel] = useState(false);
  const [pagina, setPagina] = useState(1);
  const limite = 25;

  useEffect(() => {
    void obterSessao().then(async (sessao) => {
      setPodeGerenciar(
        sessao?.papel === 'SuperAdmin'
        && Boolean(sessao.permissoes?.includes('profissionais.gerenciar'))
      );
      if (sessao?.papel === 'SuperAdmin') {
        try {
          const status = await listarStatusGoogleProfissionais();
          setGooglePorProfissional(new Map(status.map((item) => [item.profissionalId, item.conectado])));
        } catch {
          setStatusGoogleIndisponivel(true);
        }
      }
    });
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      setDados(await listarProfissionais({ pagina, limite }));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar profissionais.');
    } finally {
      setCarregando(false);
    }
  }, [pagina]);

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
      setUltimoArquivado(profissional);
      setProfissionalParaArquivar(null);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao arquivar profissional.');
    } finally {
      setArquivandoId(null);
    }
  }

  async function carregarLixeira() {
    setCarregandoLixeira(true);
    setErro(null);
    try {
      setArquivados((await listarProfissionaisArquivados({ limite: 100 })).itens);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar a lixeira de profissionais.');
    } finally {
      setCarregandoLixeira(false);
    }
  }

  async function restaurar(profissional: ProfissionalResumo) {
    setRestaurandoId(profissional.id);
    setErro(null);
    try {
      await restaurarProfissional(profissional.id);
      setArquivados((atuais) => atuais.filter((item) => item.id !== profissional.id));
      setUltimoArquivado((atual) => atual?.id === profissional.id ? null : atual);
      await carregar();
      setSucesso(`${profissional.nome} foi restaurado e podera entrar novamente.`);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao restaurar profissional.');
    } finally {
      setRestaurandoId(null);
    }
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setFormulario(formularioInicial);
  }

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const totalPaginas = Math.max(1, Math.ceil((dados?.total ?? 0) / limite));

  return (
    <section className="grid gap-4">
      <Cartao>
        <CartaoConteudo className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Equipe clinica</h2>
            <p className="mt-1 text-sm text-texto-suave">
              {dados ? `${dados.total} registros encontrados` : 'Carregando registros'}
            </p>
            <p className="mt-1 text-xs text-texto-sutil">Somente quem possui permissao de gerenciar profissionais pode criar, editar ou arquivar acessos.</p>
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
          <CheckCircle2 size={16} />
          <span className="flex-1">{sucesso}</span>
          {ultimoArquivado ? (
            <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => void restaurar(ultimoArquivado)} carregando={restaurandoId === ultimoArquivado.id}>
              <ArchiveRestore size={14} /> Desfazer
            </Botao>
          ) : null}
        </div>
      ) : null}

      <Abas
        identificador="equipe-clinica"
        rotulo="Areas da equipe clinica"
        abas={[
          { id: 'diretorio', rotulo: 'Diretorio' },
          { id: 'disponibilidade', rotulo: 'Disponibilidade' },
          { id: 'integracoes', rotulo: 'Integracoes' },
          ...(podeGerenciar ? [{ id: 'lixeira', rotulo: 'Lixeira' }] : [])
        ]}
        ativaId={areaAtiva}
        aoMudar={(id) => {
          setAreaAtiva(id as typeof areaAtiva);
          if (id === 'lixeira') void carregarLixeira();
        }}
      />

      {areaAtiva === 'diretorio' ? (
      <div id="equipe-clinica-diretorio-painel" role="tabpanel" aria-labelledby="equipe-clinica-diretorio-aba" className="grid gap-4">
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
          <TabelaCabecalho className="grid-cols-[1.2fr_0.9fr_1fr_0.7fr_0.8fr_96px]">
            <span>Profissional</span>
            <span>Registro</span>
            <span>Especialidade</span>
            <span>Criado em</span>
            <span>Google Agenda</span>
            <span>Acoes</span>
          </TabelaCabecalho>
          <TabelaLinhas>
            {dados?.itens.length ? (
              dados.itens.map((profissional) => (
                <TabelaLinha key={profissional.id} className="grid-cols-[1.2fr_0.9fr_1fr_0.7fr_0.8fr_96px]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Stethoscope size={16} className="shrink-0 text-primaria" />
                      <strong className="truncate">{profissional.nome}</strong>
                    </div>
                    <p className="mt-1 text-xs text-texto-suave">Acesso clinico ativo</p>
                  </div>
                  <span>{profissional.registroProfissional ?? '-'}</span>
                  <span>{profissional.especialidade ?? '-'}</span>
                  <span>{formatarData(profissional.criadoEm)}</span>
                  <span className="text-sm text-texto-suave">{googlePorProfissional.has(profissional.id) ? (googlePorProfissional.get(profissional.id) ? 'Conectada' : 'Desconectada') : '-'}</span>
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
      <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Paginacao de profissionais">
        <p className="text-sm text-texto-suave">
          Pagina {pagina} de {totalPaginas} | {dados?.total ?? 0} profissionais
        </p>
        <div className="flex gap-2">
          <Botao type="button" variante="secundario" onClick={() => setPagina((atual) => Math.max(1, atual - 1))} disabled={pagina <= 1 || carregando}>
            Anterior
          </Botao>
          <Botao type="button" variante="secundario" onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))} disabled={pagina >= totalPaginas || carregando}>
            Proxima
          </Botao>
        </div>
      </nav>
      </div>
      ) : null}

      {areaAtiva === 'disponibilidade' ? (
        <section id="equipe-clinica-disponibilidade-painel" role="tabpanel" aria-labelledby="equipe-clinica-disponibilidade-aba" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dados?.itens.length ? dados.itens.map((profissional) => (
            <Cartao key={profissional.id}>
              <CartaoConteudo className="grid gap-3">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primaria" />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{profissional.nome}</h3>
                    <p className="mt-1 text-xs text-texto-suave">Agenda interna disponivel mesmo sem integracao externa.</p>
                  </div>
                </div>
                <a className="inline-flex min-h-11 items-center justify-center rounded-md border border-linha px-3 text-sm font-semibold text-primaria hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria" href={`/agenda?profissionalId=${profissional.id}`} aria-label={`Abrir agenda de ${profissional.nome}`}>
                  Abrir agenda
                </a>
              </CartaoConteudo>
            </Cartao>
          )) : <EstadoEquipeVazia />}
        </section>
      ) : null}

      {areaAtiva === 'lixeira' ? (
        <section id="equipe-clinica-lixeira-painel" role="tabpanel" aria-labelledby="equipe-clinica-lixeira-aba" className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-texto-suave">Restaurar reativa o login, mas mantem as sessoes antigas revogadas.</p>
            <Botao type="button" tamanho="sm" onClick={() => void carregarLixeira()} carregando={carregandoLixeira}>
              <RefreshCcw size={14} /> Atualizar
            </Botao>
          </div>
          {arquivados.length ? arquivados.map((profissional) => (
            <div key={profissional.id} className="flex flex-wrap items-center gap-3 rounded-md border border-linha bg-white p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{profissional.nome}</p>
                <p className="text-xs text-texto-suave">Arquivado em {formatarData(profissional.arquivadoEm ?? undefined)}</p>
              </div>
              <Botao type="button" tamanho="sm" onClick={() => void restaurar(profissional)} carregando={restaurandoId === profissional.id}>
                <ArchiveRestore size={14} /> Restaurar acesso
              </Botao>
            </div>
          )) : <EstadoEquipeVazia />}
        </section>
      ) : null}

      {areaAtiva === 'integracoes' ? (
        <section id="equipe-clinica-integracoes-painel" role="tabpanel" aria-labelledby="equipe-clinica-integracoes-aba" className="grid gap-4">
          <div className="flex items-start gap-3 rounded-md border border-linha bg-superficie px-4 py-3 text-sm">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primaria" />
            <div>
              <p className="font-semibold">Acesso e permissoes</p>
              <p className="mt-1 text-texto-suave">Convites e permissoes ficam na area Equipe da conta.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dados?.itens.length ? dados.itens.map((profissional) => {
              const conectado = googlePorProfissional.get(profissional.id);
              return (
                <Cartao key={profissional.id}>
                  <CartaoConteudo>
                    <h3 className="text-sm font-semibold">{profissional.nome}</h3>
                    <p className="mt-2 text-sm text-texto-suave">
                       {statusGoogleIndisponivel
                         ? 'Estado da Google Agenda indisponivel'
                         : conectado === true
                           ? 'Google Agenda conectada'
                           : conectado === false
                             ? 'Google Agenda desconectada'
                             : 'Google Agenda nao configurada'}
                    </p>
                    <p className="mt-1 text-xs text-texto-sutil">A agenda interna continua funcionando independentemente desta integracao.</p>
                  </CartaoConteudo>
                </Cartao>
              );
            }) : <EstadoEquipeVazia />}
          </div>
        </section>
      ) : null}

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

function EstadoEquipeVazia() {
  return <p className="rounded-md border border-linha bg-superficie p-4 text-sm text-texto-suave">Nenhum profissional carregado.</p>;
}
