'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BadgeDollarSign, CheckCircle2, ContactRound, KeyRound, Link2, Save, ShieldAlert, ShieldCheck, UserRoundX } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AlertaOperacional, BarraCarregamento } from '@/components/ui/feedback';
import { Modal, ModalConfirmacao } from '@/components/ui/modal';
import { useProtecaoAlteracoesNaoSalvas } from '@/lib/usar-protecao-alteracoes-nao-salvas';
import { obterSessao } from '@/lib/auth-api';
import { criarConvitePaciente, revogarConvitePaciente } from '@/lib/convites-paciente-api';
import { obterPaciente, desativarContaAcessoPaciente, solicitarEliminacaoLgpdPaciente, type ResultadoSolicitacaoEliminacaoLgpd } from '@/lib/cadastros-api';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  FiscalCadastroPacienteApi,
  PerfilCadastroPacienteApi,
  QualidadeEAcessoPacienteApi,
  atualizarDadosBasicosPaciente,
  obterFiscalCadastroPaciente,
  obterPerfilCadastroPaciente,
  obterQualidadeEAcessoPaciente,
  salvarSecaoCadastroPaciente
} from '@/lib/perfil-cadastro-paciente-api';

interface Props {
  pacienteId: string;
  nomeCompleto: string;
  dataNascimento?: string;
  aoAtualizarFicha: () => void;
}

const vazio: PerfilCadastroPacienteApi = { identificacao: {}, contato: {}, operacao: {} };

const rotulosStatusPortal: Record<QualidadeEAcessoPacienteApi['acessoPortal']['status'], string> = {
  nao_convidado: 'Ainda não convidado',
  convite_pendente: 'Convite pendente',
  convite_expirado: 'Convite expirado',
  convite_revogado: 'Convite revogado',
  acesso_ativo: 'Acesso ativo',
  acesso_desativado: 'Acesso desativado'
};

const rotulosAceite: Record<string, string> = {
  termos_uso: 'Termos de uso',
  politica_privacidade: 'Política de privacidade',
  consentimento_lgpd: 'Consentimento LGPD'
};

function formatarDataHora(valor?: string) {
  if (!valor) return 'Não registrado';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 'Não registrado' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function mensagemErro(erro: unknown) {
  return mensagemFalhaInterface(erro, 'Não foi possível salvar esta seção.');
}

function removerCamposVazios<T extends object>(valor: T): T {
  const resultado = Object.entries(valor).sort(([a], [b]) => a.localeCompare(b)).reduce<Record<string, unknown>>((acumulado, [chave, campo]) => {
    if (typeof campo === 'string') {
      if (campo.trim()) acumulado[chave] = campo.trim();
      return acumulado;
    }
    if (Array.isArray(campo)) {
      if (campo.length) acumulado[chave] = campo;
      return acumulado;
    }
    if (campo && typeof campo === 'object') {
      const objeto = removerCamposVazios(campo as object);
      if (Object.keys(objeto).length) acumulado[chave] = objeto;
      return acumulado;
    }
    if (campo !== undefined && campo !== null) acumulado[chave] = campo;
    return acumulado;
  }, {});
  return resultado as T;
}

export function PerfilCadastroPaciente(props: Props) {
  return <EditorCadastroPaciente key={props.pacienteId} {...props} />;
}

type BasesCadastro = Record<'basicos' | 'identificacao' | 'contato' | 'operacao' | 'fiscal', string>;
const rotulosSecoes = { identificacao: 'Identificação', contato: 'Contato e endereço', operacao: 'Operação e responsável', fiscal: 'Dados fiscais opcionais' };
const retrato = (valor: object) => JSON.stringify(removerCamposVazios(valor));
function dadosFiscaisGravaveis(valor: FiscalCadastroPacienteApi) {
  return removerCamposVazios({
    cpf: valor.cpf, nomePagador: valor.nomePagador, documentoPagador: valor.documentoPagador,
    emailRecibo: valor.emailRecibo, enderecoCobranca: valor.enderecoCobranca
  });
}

function EditorCadastroPaciente({ pacienteId, nomeCompleto: nomeInicial, dataNascimento: nascimentoInicial, aoAtualizarFicha }: Props) {
  const [aberto, setAberto] = useState(false);
  const [podeGerenciar, setPodeGerenciar] = useState(false);
  const [podeVerFiscal, setPodeVerFiscal] = useState(false);
  const [perfil, setPerfil] = useState<PerfilCadastroPacienteApi>(vazio);
  const [fiscal, setFiscal] = useState<FiscalCadastroPacienteApi>({});
  const [qualidade, setQualidade] = useState<QualidadeEAcessoPacienteApi | null>(null);
  const [nomeCompleto, setNomeCompleto] = useState(nomeInicial);
  const [dataNascimento, setDataNascimento] = useState(nascimentoInicial ?? '');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [confirmarRevogacao, setConfirmarRevogacao] = useState(false);
  const [confirmarDesativacaoConta, setConfirmarDesativacaoConta] = useState(false);
  const [confirmarEliminacaoLgpd, setConfirmarEliminacaoLgpd] = useState(false);
  const [resultadoEliminacaoLgpd, setResultadoEliminacaoLgpd] = useState<ResultadoSolicitacaoEliminacaoLgpd | null>(null);
  const [bases, setBases] = useState<BasesCadastro | null>(null);
  const [saida, setSaida] = useState<{ destino?: string } | null>(null);
  const destinoConfirmadoRef = useRef<string | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const focoRef = useRef<{ indice: number; elemento: HTMLElement | null; rolagem: number; campo: string | null; secao: string | null }>({ indice: -1, elemento: null, rolagem: 0, campo: null, secao: null });
  const epocaRef = useRef(0);
  const abertoRef = useRef(false);
  const gravandoRef = useRef(false);
  const restaurarFocoRef = useRef(false);
  const basicos = { nome: nomeCompleto.trim(), dataNascimento: dataNascimento || undefined };
  const atuais: BasesCadastro = {
    basicos: retrato(basicos), identificacao: retrato(perfil.identificacao ?? {}),
    contato: retrato(perfil.contato ?? {}), operacao: retrato(perfil.operacao ?? {}),
    fiscal: retrato(dadosFiscaisGravaveis(fiscal))
  };
  const pendentes = bases ? (Object.keys(rotulosSecoes) as (keyof typeof rotulosSecoes)[]).filter((secao) =>
    atuais[secao] !== bases[secao] || (secao === 'identificacao' && atuais.basicos !== bases.basicos)) : [];
  const temPendencias = pendentes.length > 0;
  useProtecaoAlteracoesNaoSalvas(aberto && (temPendencias || salvando !== null));

  useEffect(() => () => { abertoRef.current = false; epocaRef.current += 1; }, []);

  function vigente(epoca: number) { return abertoRef.current && epocaRef.current === epoca; }
  function fechar() {
    abertoRef.current = false;
    epocaRef.current += 1;
    setAberto(false);
    setSaida(null);
    setBases(null);
    setPerfil(vazio);
    setFiscal({});
    setQualidade(null);
    setNomeCompleto('');
    setDataNascimento('');
    setLinkConvite(null);
    setErro(null);
    setSucesso(null);
  }
  function pedirSaida(destino?: string) {
    if (!temPendencias && !gravandoRef.current) {
      fechar();
      if (destino) destinoConfirmadoRef.current = destino;
      return;
    }
    const painel = painelRef.current;
    const elemento = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const secao = elemento?.closest('[data-secao-cadastro]');
    const escopo = secao ?? painel;
    focoRef.current = {
      elemento, indice: escopo ? Array.from(escopo.querySelectorAll('input, select, textarea, button, a')).indexOf(elemento as Element) : -1,
      rolagem: painel?.scrollTop ?? 0, campo: elemento?.closest('[data-campo-cadastro]')?.getAttribute('data-campo-cadastro') ?? null,
      secao: secao?.getAttribute('data-secao-cadastro') ?? null
    };
    setSaida({ destino });
  }
  function continuarEditando() {
    restaurarFocoRef.current = true;
    setSaida(null);
  }
  useEffect(() => {
    if (saida || !restaurarFocoRef.current) return;
    restaurarFocoRef.current = false;
    const painel = painelRef.current;
    if (painel) painel.scrollTop = focoRef.current.rolagem;
    const anterior = focoRef.current;
    const campo = Array.from(painel?.querySelectorAll<HTMLElement>('[data-campo-cadastro]') ?? []).find((item) => item.getAttribute('data-campo-cadastro') === anterior.campo);
    const secao = Array.from(painel?.querySelectorAll<HTMLElement>('[data-secao-cadastro]') ?? []).find((item) => item.getAttribute('data-secao-cadastro') === anterior.secao);
    const alvo = anterior.elemento?.isConnected ? anterior.elemento
      : campo?.querySelector<HTMLElement>('input, select, textarea') ?? (secao ?? painel)?.querySelectorAll<HTMLElement>('input, select, textarea, button, a')[anterior.indice];
    alvo?.focus({ preventScroll: true });
    alvo?.scrollIntoView({ block: 'nearest' });
  }, [saida]);
  useEffect(() => {
    if (aberto) return;
    // Consumir antes de navegar: cancelar outra proteção não repete o destino.
    const destino = destinoConfirmadoRef.current;
    destinoConfirmadoRef.current = null;
    if (destino) window.location.assign(destino);
  }, [aberto]);
  useEffect(() => {
    if (!aberto || (!temPendencias && salvando === null) || saida) return;
    function aoClicar(evento: MouseEvent) {
      if (evento.defaultPrevented || evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return;
      const link = evento.target instanceof Element ? evento.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const destino = new URL(link.href, window.location.href);
      if (destino.origin !== window.location.origin || !['http:', 'https:'].includes(destino.protocol)) return;
      if (destino.pathname === window.location.pathname && destino.search === window.location.search) return;
      evento.preventDefault();
      evento.stopPropagation();
      pedirSaida(destino.pathname + destino.search + destino.hash);
    }
    document.addEventListener('click', aoClicar, true);
    return () => document.removeEventListener('click', aoClicar, true);
  });


  useEffect(() => {
    void obterSessao().then((sessao) => {
      const permissoes = sessao?.permissoes ?? [];
      setPodeGerenciar(permissoes.includes('pacientes.gerenciar'));
      setPodeVerFiscal(permissoes.includes('agenda.financeiro.ler'));
    });
  }, []);

  async function abrir() {
    const epoca = ++epocaRef.current;
    abertoRef.current = true;
    setAberto(true);
    setBases(null);
    setSaida(null);
    setSucesso(null);
    setErro(null);
    setCarregando(true);
    setNomeCompleto('');
    setDataNascimento('');
    setLinkConvite(null);
    try {
      const [perfilAtual, qualidadeAtual, fiscalAtual, pacienteAtual] = await Promise.all([
        obterPerfilCadastroPaciente(pacienteId), obterQualidadeEAcessoPaciente(pacienteId),
        podeVerFiscal ? obterFiscalCadastroPaciente(pacienteId) : Promise.resolve({}),
        obterPaciente(pacienteId, { cache: 'no-store' })
      ]);
      if (!vigente(epoca)) return;
      if (pacienteAtual.id !== pacienteId || typeof pacienteAtual.nome !== 'string') {
        throw new Error('Não foi possível carregar o cadastro.');
      }
      const dadosIniciais = { nome: pacienteAtual.nome, dataNascimento: pacienteAtual.dataNascimento || undefined };
      setNomeCompleto(dadosIniciais.nome);
      setDataNascimento(dadosIniciais.dataNascimento ?? '');
      setPerfil({ identificacao: {}, contato: {}, operacao: {}, ...perfilAtual });
      setQualidade(qualidadeAtual);
      setFiscal(fiscalAtual);
      setBases({ basicos: retrato(dadosIniciais),
        identificacao: retrato(perfilAtual.identificacao ?? {}), contato: retrato(perfilAtual.contato ?? {}),
        operacao: retrato(perfilAtual.operacao ?? {}), fiscal: retrato(dadosFiscaisGravaveis(fiscalAtual)) });
    } catch (erroAtual) {
      if (vigente(epoca)) setErro(mensagemErro(erroAtual));
    } finally {
      if (vigente(epoca)) setCarregando(false);
    }
  }

  async function criarConvitePortal() {
    if (gravandoRef.current || salvando !== null) return;
    const email = perfil.contato?.email?.trim();
    if (!email) {
      setErro('Salve um e-mail de contato antes de criar o convite de acesso.');
      return;
    }

    gravandoRef.current = true;
    setSalvando('portal');
    setErro(null);
    setSucesso(null);
    setLinkConvite(null);
    try {
      const convite = await criarConvitePaciente(pacienteId, email);
      setLinkConvite(convite.linkAtivacao);
      try {
        await navigator.clipboard.writeText(convite.linkAtivacao);
        setSucesso('Convite criado e link copiado. A emissao anterior, se existia, foi revogada.');
      } catch {
        setSucesso('Convite criado. Copie o link temporario exibido abaixo.');
      }
      setQualidade(await obterQualidadeEAcessoPaciente(pacienteId));
    } catch (erroAtual) {
      setErro(mensagemErro(erroAtual));
    } finally {
      gravandoRef.current = false;
      setSalvando(null);
    }
  }

  async function revogarConvitePortal() {
    if (gravandoRef.current || salvando !== null) return;
    gravandoRef.current = true;
    setSalvando('revogar-portal');
    setErro(null);
    setSucesso(null);
    try {
      await revogarConvitePaciente(pacienteId);
      setLinkConvite(null);
      setConfirmarRevogacao(false);
      setQualidade(await obterQualidadeEAcessoPaciente(pacienteId));
      setSucesso('Convite pendente revogado. O link anterior não pode mais ser utilizado.');
    } catch (erroAtual) {
      setErro(mensagemErro(erroAtual));
    } finally {
      gravandoRef.current = false;
      setSalvando(null);
    }
  }

  async function desativarConta() {
    if (gravandoRef.current || salvando !== null) return;
    gravandoRef.current = true;
    setSalvando('desativar-conta');
    setErro(null);
    setSucesso(null);
    try {
      await desativarContaAcessoPaciente(pacienteId);
      setConfirmarDesativacaoConta(false);
      setQualidade(await obterQualidadeEAcessoPaciente(pacienteId));
      setSucesso('Conta de acesso desativada. O prontuário do paciente não foi alterado.');
    } catch (erroAtual) {
      setErro(mensagemErro(erroAtual));
    } finally {
      gravandoRef.current = false;
      setSalvando(null);
    }
  }

  async function solicitarEliminacaoLgpd() {
    if (gravandoRef.current || salvando !== null) return;
    gravandoRef.current = true;
    setSalvando('eliminacao-lgpd');
    setErro(null);
    setSucesso(null);
    try {
      const resultado = await solicitarEliminacaoLgpdPaciente(pacienteId);
      setResultadoEliminacaoLgpd(resultado);
      setConfirmarEliminacaoLgpd(false);
      if (resultado.status === 'DELETED') {
        setSucesso('Dados do paciente eliminados: não havia registro assistencial dentro do prazo legal de guarda.');
      } else {
        setSucesso('Solicitação registrada. O prontuário permanece retido pelo prazo legal de guarda; nada foi apagado.');
      }
    } catch (erroAtual) {
      setErro(mensagemErro(erroAtual));
    } finally {
      gravandoRef.current = false;
      setSalvando(null);
    }
  }

  async function atualizarQualidade(epoca: number) {
    try {
      const atual = await obterQualidadeEAcessoPaciente(pacienteId);
      if (vigente(epoca)) setQualidade(atual);
    } catch {
      if (vigente(epoca)) {
        setQualidade(null);
        setErro('Os dados foram salvos, mas não foi possível atualizar a qualidade do cadastro.');
      }
    }
  }

  async function salvarIdentificacao() {
    if (!bases || gravandoRef.current) return;
    if (JSON.parse(bases.basicos).dataNascimento && !dataNascimento) {
      setErro('A remoção da data de nascimento não está disponível neste cadastro. A alteração ainda não foi salva.');
      return;
    }
    const epoca = epocaRef.current;
    const enviados = { ...atuais };
    const dadosBasicos = { ...basicos };
    const identificacao = removerCamposVazios(perfil.identificacao ?? {});
    gravandoRef.current = true;
    setSalvando('identificacao');
    setErro(null);
    setSucesso(null);
    let basicosConfirmados = false;
    try {
      await atualizarDadosBasicosPaciente(pacienteId, dadosBasicos);
      if (!vigente(epoca)) return;
      basicosConfirmados = true;
      aoAtualizarFicha();
      setBases((atual) => atual ? { ...atual, basicos: enviados.basicos } : atual);
      await salvarSecaoCadastroPaciente(pacienteId, 'identificacao', identificacao);
      if (!vigente(epoca)) return;
      setBases((atual) => atual ? { ...atual, identificacao: enviados.identificacao } : atual);
      setSucesso('Identificação salva com segurança.');
      await atualizarQualidade(epoca);
    } catch (erroAtual) {
      if (vigente(epoca)) setErro(basicosConfirmados
        ? 'Nome e data de nascimento foram salvos. Os demais dados de identificação não foram confirmados; confira e tente salvar novamente.'
        : mensagemErro(erroAtual));
    } finally {
      gravandoRef.current = false;
      if (vigente(epoca)) setSalvando(null);
    }
  }

  async function salvar(secao: 'contato' | 'operacao' | 'fiscal') {
    if (!bases || gravandoRef.current || (secao === 'fiscal' && !podeVerFiscal)) return;
    const epoca = epocaRef.current;
    const enviado = atuais[secao];
    const dados = secao === 'fiscal' ? dadosFiscaisGravaveis(fiscal) : removerCamposVazios(perfil[secao] ?? {});
    gravandoRef.current = true;
    setSalvando(secao);
    setErro(null);
    setSucesso(null);
    try {
      await salvarSecaoCadastroPaciente(pacienteId, secao, dados);
      if (!vigente(epoca)) return;
      setBases((atual) => atual ? { ...atual, [secao]: enviado } : atual);
      setSucesso('Seção salva com segurança.');
      await atualizarQualidade(epoca);
    } catch (erroAtual) {
      if (vigente(epoca)) setErro(mensagemErro(erroAtual));
    } finally {
      gravandoRef.current = false;
      if (vigente(epoca)) setSalvando(null);
    }
  }

  if (!podeGerenciar) return null;

  return (
    <>
      <Botao type="button" variante="secundario" onClick={() => void abrir()} aria-label="Editar cadastro do paciente">
        <ContactRound size={16} /> Cadastro
      </Botao>
      <Modal aberto={aberto} aoFechar={() => {
        if (confirmarRevogacao || confirmarDesativacaoConta || confirmarEliminacaoLgpd) return;
        if (saida) continuarEditando(); else pedirSaida();
      }} titulo={saida ? 'Sair sem salvar cadastro' : 'Cadastro do paciente'} descricao={saida ? 'Confira as alterações pendentes antes de sair.' : 'Salve cada seção separadamente. Dados clínicos pertencem à avaliação e à anamnese.'}>
        {saida ? <div className="grid gap-4">
          <p>As alterações pendentes nas seções abaixo serão descartadas. O que já foi salvo será mantido.</p>
          <ul>{pendentes.map((secao) => <li key={secao}>{rotulosSecoes[secao]}</li>)}</ul>
          {salvando ? <p role="status">Aguarde a conclusão do salvamento antes de sair.</p> : null}
          <div className="flex flex-wrap gap-3">
            <Botao autoFocus type="button" onClick={continuarEditando}>Continuar editando</Botao>
            <Botao type="button" variante="secundario" disabled={salvando !== null} onClick={() => {
              if (gravandoRef.current || salvando !== null) return;
              const destino = saida.destino;
              fechar();
              if (destino) destinoConfirmadoRef.current = destino;
            }}>Sair sem salvar</Botao>
          </div>
        </div> : <>
        {temPendencias ? <p role="status" className="mb-4 text-sm">Alterações não salvas: {pendentes.map((secao) => rotulosSecoes[secao]).join(', ')}.</p> : null}
        {carregando ? <BarraCarregamento visivel rotulo="Carregando cadastro" /> : null}
        {erro ? <AlertaOperacional mensagem={erro} className="mb-4" /> : null}
        {sucesso ? <p role="status" className="mb-4 rounded-md border border-sucesso-borda bg-sucesso-suave px-3 py-2 text-sm text-sucesso-forte">{sucesso}</p> : null}
        {!carregando && bases ? (
          <div ref={painelRef} className="grid max-h-[65vh] gap-6 overflow-y-auto pr-1">
            {qualidade ? <section className="grid gap-4 rounded-md border border-linha bg-superficie-hover p-4" aria-labelledby="qualidade-cadastro-titulo">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="qualidade-cadastro-titulo" className="text-sm font-semibold text-tinta">Qualidade do cadastro</h3>
                  <p className="mt-1 text-xs text-texto-suave">Os itens abaixo orientam a revisão, mas não bloqueiam o atendimento de pacientes antigos.</p>
                </div>
                <span className="text-sm font-semibold text-tinta">{qualidade.percentualPreenchido}% preenchido</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-linha" role="progressbar" aria-label="Percentual do cadastro preenchido" aria-valuemin={0} aria-valuemax={100} aria-valuenow={qualidade.percentualPreenchido}>
                <div className="h-full bg-primaria" style={{ width: `${qualidade.percentualPreenchido}%` }} />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {qualidade.secoes.map((secao) => <div key={secao.secao} className="rounded-md border border-linha bg-superficie px-3 py-2">
                  <p className="text-xs font-semibold text-tinta">{secao.titulo}{secao.opcional ? ' (opcional)' : ''} - {secao.preenchidos}/{secao.total}</p>
                  <p className="mt-1 text-xs text-texto-suave">{secao.camposFaltantes.length ? `Revisar: ${secao.camposFaltantes.join(', ')}` : 'Dados recomendados preenchidos.'}</p>
                </div>)}
              </div>
                {qualidade.possiveisDuplicidades.length ? <div className="rounded-md border border-alerta-borda bg-alerta-suave p-3">
                 <p className="flex items-center gap-2 text-sm font-semibold text-alerta-forte"><AlertTriangle size={16} /> Possíveis cadastros duplicados</p>
                <p className="mt-1 text-xs text-alerta-forte">Revise manualmente. O OctaClin nunca mescla pacientes automaticamente.</p>
                <ul className="mt-2 grid gap-1 text-xs">
                  {qualidade.possiveisDuplicidades.map((item) => <li key={item.pacienteId}>
                    <Link className="font-semibold underline underline-offset-2" href={`/pacientes/${item.pacienteId}`}>{item.nome}</Link>
                    {' - '}{item.motivos.includes('contato') ? 'mesmo contato' : item.motivos.includes('nome') ? 'mesmo nome' : 'mesmo nome e nascimento'}
                  </li>)}
                </ul>
              </div> : null}
            </section> : null}

            <Secao titulo="Identificação" descricao="Dados de identificação do paciente. A condição biológica fica restrita ao contexto clínico autorizado.">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="Nome completo"><input className="campo" autoComplete="name" value={nomeCompleto} onChange={(evento) => setNomeCompleto(evento.target.value)} required /></Campo>
                <Campo rotulo="Apelido ou nome de uso"><input className="campo" value={perfil.identificacao?.nomeUso ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, identificacao: { ...atual.identificacao, nomeUso: evento.target.value } }))} /></Campo>
                <Campo rotulo="Data de nascimento"><input className="campo" type="date" value={dataNascimento} onChange={(evento) => setDataNascimento(evento.target.value)} /></Campo>
                <Campo rotulo="Sexo">
                  <select className="campo" value={perfil.identificacao?.sexo ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, identificacao: { ...atual.identificacao, sexo: evento.target.value as 'feminino' | 'masculino' | 'intersexo' | 'nao_informar' } }))}>
                    <option value="">Não informado</option><option value="feminino">Feminino</option><option value="masculino">Masculino</option><option value="intersexo">Intersexo</option><option value="nao_informar">Prefiro não informar</option>
                  </select>
                </Campo>
              </div>
              {perfil.identificacao?.sexo === 'feminino' ? <Campo rotulo="Condição biológica">
                <select className="campo" value={perfil.identificacao?.condicaoBiologica ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, identificacao: { ...atual.identificacao, condicaoBiologica: evento.target.value as 'nao_gestante' | 'gestante' | 'lactante' | 'menopausa' } }))}>
                  <option value="">Não informado</option><option value="nao_gestante">Não gestante</option><option value="gestante">Gestante</option><option value="lactante">Lactante</option><option value="menopausa">Menopausa</option>
                </select>
              </Campo> : null}
              <SalvarSecao carregando={salvando !== null} aoSalvar={() => void salvarIdentificacao()} />
            </Secao>

            <Secao titulo="Contato e endereço" descricao="Dados usados para comunicação e localização do paciente.">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="E-mail"><input className="campo" type="email" value={perfil.contato?.email ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, email: evento.target.value } }))} /></Campo>
                <Campo rotulo="Usuário do Instagram"><input className="campo" value={perfil.contato?.instagram ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, instagram: evento.target.value.replace(/^@/, '') } }))} /></Campo>
                <Campo rotulo="DDI"><input className="campo" inputMode="tel" placeholder="+55" value={perfil.contato?.ddi ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, ddi: evento.target.value } }))} /></Campo>
                <Campo rotulo="Celular com DDD"><input className="campo" inputMode="tel" placeholder="11999999999" value={perfil.contato?.celular ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, celular: evento.target.value.replace(/\D/g, '') } }))} /></Campo>
              </div>
              <Campo rotulo="Canal preferido">
                <select className="campo" value={perfil.contato?.canalPreferido ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, canalPreferido: evento.target.value as 'email' | 'whatsapp' | 'telefone' } }))}>
                  <option value="">Não definido</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option><option value="telefone">Telefone</option>
                </select>
              </Campo>
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="CEP"><input className="campo" value={perfil.contato?.endereco?.cep ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, cep: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Endereço"><input className="campo" value={perfil.contato?.endereco?.logradouro ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, logradouro: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Bairro"><input className="campo" value={perfil.contato?.endereco?.bairro ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, bairro: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Cidade"><input className="campo" value={perfil.contato?.endereco?.cidade ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, cidade: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Estado"><input className="campo" maxLength={2} value={perfil.contato?.endereco?.estado ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, contato: { ...atual.contato, endereco: { ...atual.contato?.endereco, estado: evento.target.value.toUpperCase() } } }))} /></Campo>
              </div>
              <SalvarSecao carregando={salvando !== null} aoSalvar={() => void salvar('contato')} />
            </Secao>

            <Secao titulo="Operação e responsável" descricao="Categoria, etiquetas internas e pessoa responsável quando aplicável.">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="Categoria do paciente"><input className="campo" value={perfil.operacao?.categoria ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, categoria: evento.target.value } }))} /></Campo>
                <Campo rotulo="Origem"><input className="campo" value={perfil.operacao?.origem ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, origem: evento.target.value } }))} /></Campo>
                <Campo rotulo="Próxima revisão"><input className="campo" type="date" value={perfil.operacao?.proximaRevisaoEm ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, proximaRevisaoEm: evento.target.value } }))} /><p className="mt-1 text-xs text-texto-suave">Ao salvar, uma tarefa de revisão aparecerá no acompanhamento com vencimento nesta data.</p></Campo>
              </div>
              <Campo rotulo="Etiquetas"><input className="campo" placeholder="Ex.: retorno, esportivo" value={(perfil.operacao?.tags ?? []).join(', ')} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, tags: evento.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) } }))} /></Campo>
              <div className="grid gap-3 md:grid-cols-3">
                <Campo rotulo="Responsável"><input className="campo" value={perfil.operacao?.responsavel?.nome ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, responsavel: { ...atual.operacao?.responsavel, nome: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Parentesco"><input className="campo" value={perfil.operacao?.responsavel?.parentesco ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, responsavel: { ...atual.operacao?.responsavel, parentesco: evento.target.value } } }))} /></Campo>
                <Campo rotulo="Contato do responsável"><input className="campo" value={perfil.operacao?.responsavel?.contato ?? ''} onChange={(evento) => setPerfil((atual) => ({ ...atual, operacao: { ...atual.operacao, responsavel: { ...atual.operacao?.responsavel, contato: evento.target.value } } }))} /></Campo>
              </div>
              <SalvarSecao carregando={salvando !== null} aoSalvar={() => void salvar('operacao')} />
            </Secao>

            <Secao titulo="Acesso ao portal" descricao="Acompanhe o ciclo de acesso sem reexibir tokens antigos. Uma nova emissao invalida o convite pendente anterior.">
              <div className="grid gap-2 rounded-md border border-linha bg-superficie-hover p-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-texto-suave">Situação</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-tinta">
                    {qualidade?.acessoPortal.status === 'acesso_ativo' ? <CheckCircle2 size={16} className="text-sucesso-forte" /> : <ShieldCheck size={16} />}
                    {qualidade ? rotulosStatusPortal[qualidade.acessoPortal.status] : 'Carregando'}
                  </p>
                </div>
                <div><p className="text-xs font-semibold text-texto-suave">E-mail de acesso</p><p className="mt-1 break-all text-sm text-tinta">{qualidade?.acessoPortal.email || perfil.contato?.email || 'Não informado'}</p></div>
                <div><p className="text-xs font-semibold text-texto-suave">Último acesso</p><p className="mt-1 text-sm text-tinta">{formatarDataHora(qualidade?.acessoPortal.ultimoAcessoEm)}</p></div>
                <div><p className="text-xs font-semibold text-texto-suave">Canal preferido</p><p className="mt-1 text-sm capitalize text-tinta">{qualidade?.acessoPortal.canalPreferido || 'Não definido'}</p></div>
              </div>
              {qualidade?.acessoPortal.preferencias ? <div className="rounded-md border border-linha px-3 py-2">
                <p className="text-xs font-semibold text-texto-suave">Preferências definidas no portal</p>
                <p className="mt-1 text-xs text-tinta">
                  E-mail: {qualidade.acessoPortal.preferencias.email === undefined ? 'não informado' : qualidade.acessoPortal.preferencias.email ? 'permitido' : 'desativado'}
                  {' - '}WhatsApp: {qualidade.acessoPortal.preferencias.whatsapp === undefined ? 'não informado' : qualidade.acessoPortal.preferencias.whatsapp ? 'permitido' : 'desativado'}
                  {qualidade.acessoPortal.preferencias.canalPreferido ? ` - Preferencia: ${qualidade.acessoPortal.preferencias.canalPreferido}` : ''}
                </p>
                {qualidade.acessoPortal.preferencias.horarioPermitido?.inicio && qualidade.acessoPortal.preferencias.horarioPermitido?.fim ? <p className="mt-1 text-xs text-texto-suave">Janela: {qualidade.acessoPortal.preferencias.horarioPermitido.inicio}-{qualidade.acessoPortal.preferencias.horarioPermitido.fim} - {qualidade.acessoPortal.preferencias.horarioPermitido.timezone || 'fuso não informado'}</p> : null}
              </div> : null}
              {qualidade?.acessoPortal.status === 'convite_pendente' ? <p className="text-xs text-texto-suave">Convite atual expira em {formatarDataHora(qualidade.acessoPortal.conviteExpiraEm)}.</p> : null}
              {qualidade?.acessoPortal.aceites.length ? <div>
                <p className="text-xs font-semibold text-texto-suave">Aceites legais registrados</p>
                <ul className="mt-2 grid gap-1 text-xs text-tinta">
                  {qualidade.acessoPortal.aceites.map((aceite) => <li key={aceite.tipo} className="flex flex-wrap items-center gap-1"><CheckCircle2 size={14} className="text-sucesso-forte" /> {rotulosAceite[aceite.tipo] ?? aceite.tipo} - versão {aceite.versao} - {formatarDataHora(aceite.aceitoEm)}</li>)}
                </ul>
              </div> : null}
              <div className="flex flex-wrap justify-end gap-2">
                {linkConvite ? <Botao type="button" variante="secundario" onClick={() => void navigator.clipboard.writeText(linkConvite)}><Link2 size={16} /> Copiar link</Botao> : null}
                {qualidade?.acessoPortal.status === 'convite_pendente' ? <Botao type="button" variante="perigo" onClick={() => setConfirmarRevogacao(true)} disabled={Boolean(salvando)}><UserRoundX size={16} /> Revogar convite</Botao> : null}
                {qualidade?.acessoPortal.status !== 'acesso_ativo' && qualidade?.acessoPortal.status !== 'acesso_desativado' ? <Botao type="button" variante="secundario" onClick={() => void criarConvitePortal()} disabled={salvando !== null}>
                  <KeyRound size={16} /> {salvando === 'portal' ? 'Criando convite' : qualidade?.acessoPortal.status === 'nao_convidado' ? 'Criar convite seguro' : 'Reenviar convite'}
                </Botao> : null}
              </div>
              {linkConvite ? <p className="break-all rounded-md border border-linha bg-superficie-hover px-3 py-2 text-xs text-texto-suave">{linkConvite}</p> : null}
            </Secao>

            <Secao titulo="Privacidade e LGPD" descricao="Três ações juridicamente distintas: desativar a conta não apaga nada; a eliminação de dados só apaga o que não tiver retenção legal pendente. Nenhuma delas 'exclui o paciente'.">
              <div className="flex flex-wrap justify-end gap-2">
                <Botao
                  type="button"
                  variante="perigo"
                  onClick={() => setConfirmarDesativacaoConta(true)}
                  disabled={Boolean(salvando) || qualidade?.acessoPortal.status !== 'acesso_ativo'}
                >
                  <UserRoundX size={16} /> Desativar conta de acesso
                </Botao>
                <Botao type="button" variante="perigo" onClick={() => setConfirmarEliminacaoLgpd(true)} disabled={Boolean(salvando)}>
                  <ShieldAlert size={16} /> Solicitar eliminação de dados (LGPD)
                </Botao>
              </div>
              {resultadoEliminacaoLgpd ? <div className="rounded-md border border-linha bg-superficie-hover px-3 py-2 text-xs text-tinta">
                {resultadoEliminacaoLgpd.status === 'DELETED' ? (
                  <p>Dados eliminados em {formatarDataHora(resultadoEliminacaoLgpd.deletedAt)}.</p>
                ) : (
                  <p>Retido até {formatarDataHora(resultadoEliminacaoLgpd.retentionUntil)} ({resultadoEliminacaoLgpd.retentionReason}). Nada foi apagado.</p>
                )}
              </div> : null}
            </Secao>

            {podeVerFiscal ? <Secao titulo="Dados fiscais opcionais" descricao="Visivel apenas para quem tem permissão financeira.">
              <div className="grid gap-3 md:grid-cols-2">
                <Campo rotulo="Nome do pagador"><input className="campo" value={fiscal.nomePagador ?? ''} onChange={(evento) => setFiscal((atual) => ({ ...atual, nomePagador: evento.target.value }))} /></Campo>
                <Campo rotulo="CPF do paciente"><input className="campo" inputMode="numeric" value={fiscal.cpf ?? ''} onChange={(evento) => setFiscal((atual) => ({ ...atual, cpf: evento.target.value.replace(/\D/g, '') }))} /></Campo>
              </div>
              <Campo rotulo="E-mail para recibo"><input className="campo" type="email" value={fiscal.emailRecibo ?? ''} onChange={(evento) => setFiscal((atual) => ({ ...atual, emailRecibo: evento.target.value }))} /></Campo>
              <SalvarSecao carregando={salvando !== null} aoSalvar={() => void salvar('fiscal')} rotulo="Salvar dados fiscais" icone={<BadgeDollarSign size={16} />} />
            </Secao> : null}
          </div>
        ) : null}
        </>}
      </Modal>
      <ModalConfirmacao
        aberto={confirmarRevogacao}
        titulo="Revogar convite pendente"
        mensagem="O link atual deixara de funcionar imediatamente. O acesso ativo de um paciente que já concluiu o primeiro acesso não será alterado."
        rotuloConfirmar="Revogar convite"
        confirmando={salvando === 'revogar-portal'}
        aoConfirmar={() => void revogarConvitePortal()}
        aoCancelar={() => setConfirmarRevogacao(false)}
      />
      <ModalConfirmacao
        aberto={confirmarDesativacaoConta}
        titulo="Desativar conta de acesso"
        mensagem="O paciente deixa de conseguir entrar no portal e as sessões ativas são encerradas. O prontuário, os documentos e o histórico do paciente não são alterados nem apagados. Esta ação é diferente de arquivar o paciente ou de solicitar eliminação de dados."
        rotuloConfirmar="Desativar conta"
        confirmando={salvando === 'desativar-conta'}
        aoConfirmar={() => void desativarConta()}
        aoCancelar={() => setConfirmarDesativacaoConta(false)}
      />
      <ModalConfirmacao
        aberto={confirmarEliminacaoLgpd}
        titulo="Solicitar eliminação de dados (LGPD)"
        mensagem="Se o prontuário ainda estiver dentro do prazo legal de guarda, o dado é retido e nada é apagado agora. Só quando não houver retenção legal pendente os dados de identificação são eliminados de verdade. Esta ação é diferente de arquivar o paciente ou de desativar a conta de acesso."
        rotuloConfirmar="Solicitar eliminação"
        confirmando={salvando === 'eliminacao-lgpd'}
        aoConfirmar={() => void solicitarEliminacaoLgpd()}
        aoCancelar={() => setConfirmarEliminacaoLgpd(false)}
      />
    </>
  );
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return <section data-secao-cadastro={titulo} className="grid gap-3 border-b border-linha pb-5 last:border-b-0"><div><h3 className="text-sm font-semibold text-tinta">{titulo}</h3><p className="mt-1 text-xs text-texto-suave">{descricao}</p></div>{children}</section>;
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <label data-campo-cadastro={rotulo} className="grid gap-1 text-xs font-semibold text-texto-suave">{rotulo}{children}</label>;
}

function SalvarSecao({ carregando, aoSalvar, rotulo = 'Salvar seção', icone = <Save size={16} /> }: { carregando: boolean; aoSalvar: () => void; rotulo?: string; icone?: React.ReactNode }) {
  return <div className="flex justify-end"><Botao type="button" variante="secundario" onClick={aoSalvar} disabled={carregando}>{icone}{carregando ? 'Salvando' : rotulo}</Botao></div>;
}
