'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Botao, classesBotao } from '@/components/ui/botao';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Aviso, AvisoRegiao, EsqueletoPagina, EstadoFalha, EstadoPermissaoNegada } from '@/components/ui/feedback';
import { AvisoDuplicidadePaciente, type EstadoVerificacaoDuplicidade } from '@/components/cadastros/aviso-duplicidade-paciente';
import { obterSessao } from '@/lib/auth-api';
import {
  type CandidatoDuplicidadePaciente,
  type PacienteResumo,
  type ProfissionalResumo,
  type SalvarPacienteEntrada,
  atualizarPaciente,
  criarPaciente,
  listarProfissionais,
  obterPaciente,
  verificarDuplicidadePaciente
} from '@/lib/cadastros-api';
import { classificarFalhaInterface, type FalhaInterface } from '@/lib/erros-interface';

type StatusPaciente = 'novo' | 'aderente' | 'em_acompanhamento' | 'risco' | 'inativo';

interface FormularioPacienteEstado {
  profissionalResponsavelId: string;
  nome: string;
  contato: string;
  dataNascimento: string;
  statusAdesao: StatusPaciente;
  scoreRisco: string;
}

const formularioInicial: FormularioPacienteEstado = {
  profissionalResponsavelId: '',
  nome: '',
  contato: '',
  dataNascimento: '',
  statusAdesao: 'novo',
  scoreRisco: '0'
};

function estadoDoPaciente(paciente: PacienteResumo): FormularioPacienteEstado {
  return {
    profissionalResponsavelId: paciente.profissionalResponsavelId,
    nome: paciente.nome,
    contato: paciente.contato ?? '',
    dataNascimento: paciente.dataNascimento ?? '',
    statusAdesao: paciente.statusAdesao as StatusPaciente,
    scoreRisco: String(Number(paciente.scoreRisco).toFixed(1))
  };
}

function montarPayload(formulario: FormularioPacienteEstado, editando: boolean): SalvarPacienteEntrada {
  const payload: SalvarPacienteEntrada = {
    profissionalResponsavelId: formulario.profissionalResponsavelId,
    nome: formulario.nome.trim(),
    contato: formulario.contato.trim() || undefined,
    dataNascimento: formulario.dataNascimento || undefined
  };
  if (editando) {
    payload.statusAdesao = formulario.statusAdesao;
    payload.scoreRisco = Number(formulario.scoreRisco || 0);
  }
  return payload;
}

interface FormularioPacienteProps {
  pacienteId?: string;
}

export function FormularioPaciente({ pacienteId }: FormularioPacienteProps) {
  const router = useRouter();
  const editando = Boolean(pacienteId);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [profissionais, setProfissionais] = useState<ProfissionalResumo[]>([]);
  const [chaveRascunho, setChaveRascunho] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const botaoSalvarRef = useRef<HTMLButtonElement>(null);
  const restaurarFocoSalvarRef = useRef(false);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false);
  const [falha, setFalha] = useState<FalhaInterface | null>(null);
  const [estadoDuplicidade, setEstadoDuplicidade] = useState<EstadoVerificacaoDuplicidade>('ocioso');
  const [candidatosDuplicidade, setCandidatosDuplicidade] = useState<CandidatoDuplicidadePaciente[]>([]);
  const [pessoaDiferenteConfirmada, setPessoaDiferenteConfirmada] = useState(false);

  const titulo = editando ? 'Editar paciente' : 'Novo paciente';
  const voltarPara = (editando && pacienteId ? `/pacientes/${pacienteId}` : '/pacientes') as Route;

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setFalha(null);
      try {
        const [sessao, respostaProfissionais, paciente] = await Promise.all([
          obterSessao(),
          listarProfissionais({ limite: 100 }),
          pacienteId ? obterPaciente(pacienteId) : Promise.resolve(null)
        ]);
        if (!ativo) return;
        const profissionaisAtivos = respostaProfissionais.itens;
        const base = paciente
          ? estadoDoPaciente(paciente)
          : { ...formularioInicial, profissionalResponsavelId: profissionaisAtivos[0]?.id ?? '' };
        const chave = `octaclin:rascunho-paciente:${sessao?.tenantSlug ?? 'sem-tenant'}:${pacienteId ?? 'novo'}`;
        const rascunho = window.sessionStorage.getItem(chave);
        if (rascunho) {
          try {
            setFormulario({ ...base, ...(JSON.parse(rascunho) as Partial<FormularioPacienteEstado>) });
            setRascunhoRestaurado(true);
          } catch {
            window.sessionStorage.removeItem(chave);
            setFormulario(base);
          }
        } else {
          setFormulario(base);
        }
        setProfissionais(profissionaisAtivos);
        setChaveRascunho(chave);
        setPronto(true);
      } catch (erroAtual) {
        if (ativo) setFalha(classificarFalhaInterface(erroAtual, 'Não foi possível carregar o cadastro do paciente.'));
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, [pacienteId]);

  useEffect(() => {
    if (!pronto || !chaveRascunho) return;
    window.sessionStorage.setItem(chaveRascunho, JSON.stringify(formulario));
  }, [chaveRascunho, formulario, pronto]);

  useEffect(() => {
    if (editando || !pronto) return;
    const nome = formulario.nome.trim();
    const controlador = new AbortController();
    const atraso = window.setTimeout(() => {
      if (nome.length < 3) {
        setEstadoDuplicidade('ocioso');
        setCandidatosDuplicidade([]);
        return;
      }
      setEstadoDuplicidade('verificando');
      void verificarDuplicidadePaciente({
        nome,
        contato: formulario.contato.trim() || undefined,
        dataNascimento: formulario.dataNascimento || undefined
      }, controlador.signal).then((resposta) => {
        setCandidatosDuplicidade(resposta.candidatos);
        setEstadoDuplicidade(resposta.candidatos.length ? 'candidatos' : 'sem_candidatos');
      }).catch((erroAtual) => {
        if ((erroAtual as Error).name === 'AbortError') return;
        setCandidatosDuplicidade([]);
        setEstadoDuplicidade('indisponivel');
      });
    }, nome.length < 3 ? 0 : 600);
    return () => {
      window.clearTimeout(atraso);
      controlador.abort();
    };
  }, [editando, formulario.contato, formulario.dataNascimento, formulario.nome, pronto]);

  const formularioValido = useMemo(
    () => formulario.nome.trim().length >= 2 && Boolean(formulario.profissionalResponsavelId),
    [formulario.nome, formulario.profissionalResponsavelId]
  );
  const decisaoDuplicidadePendente = estadoDuplicidade === 'candidatos' && !pessoaDiferenteConfirmada;
  const verificandoDuplicidade = estadoDuplicidade === 'verificando';

  function alterarCampoDuplicidade(campo: 'nome' | 'contato' | 'dataNascimento', valor: string) {
    const proximo = { ...formulario, [campo]: valor };
    setPessoaDiferenteConfirmada(false);
    setCandidatosDuplicidade([]);
    setEstadoDuplicidade(proximo.nome.trim().length >= 3 ? 'verificando' : 'ocioso');
    setFormulario(proximo);
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!formularioValido) return;
    restaurarFocoSalvarRef.current = document.activeElement === (evento.nativeEvent as SubmitEvent).submitter;
    setSalvando(true);
    setFalha(null);
    try {
      const paciente = pacienteId
        ? await atualizarPaciente(pacienteId, montarPayload(formulario, true))
        : await criarPaciente({
            ...montarPayload(formulario, false),
            ...(pessoaDiferenteConfirmada ? { candidatosDuplicidadeDispensados: candidatosDuplicidade.map((candidato) => candidato.pacienteId) } : {})
          });
      if (chaveRascunho) window.sessionStorage.removeItem(chaveRascunho);
      router.push(`/pacientes/${paciente.id}` as Route);
    } catch (erroAtual) {
      setFalha(classificarFalhaInterface(erroAtual, 'Não foi possível salvar o paciente. O rascunho foi preservado nesta aba.'));
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    if (salvando || !restaurarFocoSalvarRef.current) return;
    restaurarFocoSalvarRef.current = false;
    botaoSalvarRef.current?.focus();
  }, [salvando]);

  if (!pronto && !falha) return <EsqueletoPagina rotulo={`Carregando ${titulo.toLocaleLowerCase('pt-BR')}`} />;
  if (!pronto && falha?.tipo === 'permissao') return <EstadoPermissaoNegada />;
  if (!pronto && falha) {
    return <EstadoFalha titulo="Não foi possível abrir o cadastro" descricao={falha.mensagem} />;
  }

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-4">
      {rascunhoRestaurado ? (
        <AvisoRegiao><Aviso variante="info" mensagem="Rascunho desta aba restaurado." aoFechar={() => setRascunhoRestaurado(false)} /></AvisoRegiao>
      ) : null}
      {falha ? <AvisoRegiao><Aviso variante="erro" mensagem={falha.mensagem} aoFechar={() => setFalha(null)} /></AvisoRegiao> : null}
      <Cartao>
        <CartaoConteudo>
          <form onSubmit={salvar} className="grid gap-6" noValidate>
            <section aria-labelledby="paciente-identificacao" className="grid gap-3">
              <div>
                <h2 id="paciente-identificacao" className="text-base font-semibold text-tinta">Identificação</h2>
                <p className="mt-1 text-sm text-texto-suave">Dados básicos para reconhecer o paciente no atendimento.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <Rotulo htmlFor="paciente-nome">Nome completo</Rotulo>
                  <Campo id="paciente-nome" autoComplete="name" value={formulario.nome} onChange={(evento) => alterarCampoDuplicidade('nome', evento.target.value)} required aria-required="true" />
                </div>
                <div className="grid gap-1">
                  <Rotulo htmlFor="paciente-nascimento">Data de nascimento</Rotulo>
                  <Campo id="paciente-nascimento" type="date" value={formulario.dataNascimento} onChange={(evento) => alterarCampoDuplicidade('dataNascimento', evento.target.value)} />
                </div>
              </div>
            </section>

            <section aria-labelledby="paciente-contato" className="grid gap-3 border-t border-linha pt-5">
              <div>
                <h2 id="paciente-contato" className="text-base font-semibold text-tinta">Contato</h2>
                <p className="mt-1 text-sm text-texto-suave">Informe um e-mail ou telefone usado para comunicações e convite do portal.</p>
              </div>
              <div className="grid gap-1">
                <Rotulo htmlFor="paciente-contato-campo">E-mail ou telefone</Rotulo>
                <Campo id="paciente-contato-campo" autoComplete="email" placeholder="nome@exemplo.com ou +55 11 99999-9999" value={formulario.contato} onChange={(evento) => alterarCampoDuplicidade('contato', evento.target.value)} />
              </div>
            </section>

            <section aria-labelledby="paciente-operacao" className="grid gap-3 border-t border-linha pt-5">
              <div>
                <h2 id="paciente-operacao" className="text-base font-semibold text-tinta">Responsável e acompanhamento</h2>
                <p className="mt-1 text-sm text-texto-suave">Defina quem acompanha o paciente. Situação e risco ficam disponíveis na edição.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <Rotulo htmlFor="paciente-profissional">Profissional responsável</Rotulo>
                  <Selecao id="paciente-profissional" value={formulario.profissionalResponsavelId} onChange={(evento) => setFormulario((atual) => ({ ...atual, profissionalResponsavelId: evento.target.value }))} required aria-required="true">
                    <option value="" disabled>Selecione</option>
                    {profissionais.map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}
                  </Selecao>
                </div>
                {editando ? (
                  <div className="grid gap-1">
                    <Rotulo htmlFor="paciente-situacao">Situação do acompanhamento</Rotulo>
                    <Selecao id="paciente-situacao" value={formulario.statusAdesao} onChange={(evento) => setFormulario((atual) => ({ ...atual, statusAdesao: evento.target.value as StatusPaciente }))}>
                      <option value="novo">Novo</option><option value="aderente">Aderente</option><option value="em_acompanhamento">Em acompanhamento</option><option value="risco">Requer atenção</option><option value="inativo">Inativo</option>
                    </Selecao>
                  </div>
                ) : null}
                {editando ? (
                  <div className="grid gap-1">
                    <Rotulo htmlFor="paciente-risco">Indicador de risco (0 a 100)</Rotulo>
                    <Campo id="paciente-risco" type="number" min={0} max={100} step={0.1} value={formulario.scoreRisco} onChange={(evento) => setFormulario((atual) => ({ ...atual, scoreRisco: evento.target.value }))} />
                  </div>
                ) : null}
              </div>
            </section>

            {!editando ? (
              <section aria-labelledby="verificacao-cadastro-paciente" className="grid gap-2 border-t border-linha pt-5">
                <div><h2 id="verificacao-cadastro-paciente" className="text-base font-semibold text-tinta">Verificação do cadastro</h2><p className="mt-1 text-sm text-texto-suave">Evite criar dois prontuários para a mesma pessoa.</p></div>
                <AvisoDuplicidadePaciente estado={estadoDuplicidade} candidatos={candidatosDuplicidade} pessoaDiferenteConfirmada={pessoaDiferenteConfirmada} aoConfirmarPessoaDiferente={() => setPessoaDiferenteConfirmada(true)} />
              </section>
            ) : null}

            {!editando ? <p className="rounded-md border border-primaria/20 bg-primaria-suave p-3 text-sm text-tinta">Depois de salvar, use a ação de convite na lista para liberar o acesso seguro ao portal.</p> : null}
            <div className="flex flex-col-reverse gap-2 border-t border-linha pt-5 sm:flex-row sm:justify-end">
              <Link href={voltarPara} className={classesBotao({ variante: 'secundario' })}>Cancelar</Link>
              <Botao ref={botaoSalvarRef} type="submit" variante="primario" disabled={salvando || !formularioValido || decisaoDuplicidadePendente || verificandoDuplicidade || (!editando && formulario.nome.trim().length >= 3 && estadoDuplicidade === 'ocioso')} carregando={salvando}>
                <Save size={16} /> {editando ? 'Salvar alterações' : 'Cadastrar paciente'}
              </Botao>
            </div>
          </form>
        </CartaoConteudo>
      </Cartao>
    </section>
  );
}
