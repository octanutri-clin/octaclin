'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ClipboardCopy, Search } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional } from '@/components/ui/feedback';
import { listarPacientes, type PacienteResumo } from '@/lib/cadastros-api';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  listarPlanosAlimentares,
  obterVersaoPlanoAlimentar,
  type PlanoAlimentarResumoApi,
  type VersaoPlanoAlimentarResumoApi
} from '@/lib/plano-alimentar-api';
import { copiarRefeicaoParaFormulario, type RefeicaoFormularioCopia } from '@/lib/copia-refeicoes-plano';

interface ReferenciaRefeicaoSalva {
  pacienteOrigemId: string;
  planoOrigemId: string;
  numeroVersao: number;
  refeicaoId: string;
  atualizadoEm: string;
  status: 'publicada' | 'rascunho';
}

interface RefeicaoOrigemResumo {
  id: string;
  nome: string;
  ordem: number;
  quantidadeItens: number;
}

interface DestinoCopia {
  tipo: 'nova' | 'acrescentar';
  chaveRefeicao?: string;
}

interface CopiarRefeicaoDePlanoProps {
  pacienteIdAtual: string;
  planoIdDestino: string;
  versaoRascunhoDestinoId: string;
  refeicoesDestino: RefeicaoFormularioCopia[];
  destinoChave: string;
  gerarChave: (prefixo: 'refeicao' | 'alimento') => string;
  aoAplicar: (refeicao: RefeicaoFormularioCopia, destino: DestinoCopia) => void;
  aoIniciarCopia: () => () => void;
  desabilitado?: boolean;
}

function versaoSelecionada(plano: PlanoAlimentarResumoApi, preferencia: 'publicada' | 'rascunho' | ''):
  VersaoPlanoAlimentarResumoApi | undefined {
  if (preferencia === 'rascunho') return plano.draft;
  if (preferencia === 'publicada') return plano.current;
  return plano.current ?? plano.draft;
}

export function CopiarRefeicaoDePlano({
  pacienteIdAtual,
  planoIdDestino,
  versaoRascunhoDestinoId,
  refeicoesDestino,
  destinoChave,
  gerarChave,
  aoAplicar,
  aoIniciarCopia,
  desabilitado = false
}: CopiarRefeicaoDePlanoProps) {
  const id = useId();
  const destinoAtualRef = useRef(destinoChave);
  const sequenciaRef = useRef(0);
  const controladorRef = useRef<AbortController | null>(null);
  const colandoRef = useRef(false);
  const aoAplicarAtualRef = useRef(aoAplicar);
  const liberarCopiaRef = useRef<(() => void) | null>(null);
  const destinoHabilitadoRef = useRef(!desabilitado && Boolean(versaoRascunhoDestinoId));
  const [termoPaciente, setTermoPaciente] = useState('');
  const [pacientesEncontrados, setPacientesEncontrados] = useState<PacienteResumo[]>([]);
  const [pacienteOrigemId, setPacienteOrigemId] = useState(pacienteIdAtual);
  const [planos, setPlanos] = useState<PlanoAlimentarResumoApi[]>([]);
  const [paginaPlanos, setPaginaPlanos] = useState(0);
  const [totalPlanos, setTotalPlanos] = useState(0);
  const [planoOrigemId, setPlanoOrigemId] = useState('');
  const [tipoVersao, setTipoVersao] = useState<'publicada' | 'rascunho' | ''>('');
  const [refeicoesOrigem, setRefeicoesOrigem] = useState<RefeicaoOrigemResumo[]>([]);
  const [refeicaoOrigemId, setRefeicaoOrigemId] = useState('');
  const [referencia, setReferencia] = useState<ReferenciaRefeicaoSalva | null>(null);
  const [destinoTipo, setDestinoTipo] = useState<'nova' | 'acrescentar'>('nova');
  const [destinoRefeicaoChave, setDestinoRefeicaoChave] = useState('');
  const [ocupado, setOcupado] = useState<'buscando-pacientes' | 'carregando-planos' | 'lendo-versao' | 'colando' | null>('carregando-planos');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useLayoutEffect(() => {
    destinoAtualRef.current = destinoChave;
    aoAplicarAtualRef.current = aoAplicar;
    destinoHabilitadoRef.current = !desabilitado && Boolean(versaoRascunhoDestinoId);
  }, [aoAplicar, destinoChave, desabilitado, versaoRascunhoDestinoId]);

  useEffect(() => () => {
    sequenciaRef.current += 1;
    controladorRef.current?.abort();
    controladorRef.current = null;
    liberarCopiaRef.current?.();
    liberarCopiaRef.current = null;
  }, []);

  const carregarPlanos = useCallback(async (pacienteId: string, pagina: number) => {
    const sequencia = ++sequenciaRef.current;
    controladorRef.current?.abort();
    const controlador = new AbortController();
    controladorRef.current = controlador;
    try {
      const resultado = await listarPlanosAlimentares(pacienteId, { pagina, limite: 25 }, controlador.signal);
      if (sequencia !== sequenciaRef.current || controlador.signal.aborted) return;
      setPlanos(resultado.itens);
      setPaginaPlanos(resultado.pagina);
      setTotalPlanos(resultado.total);
      setPlanoOrigemId('');
      setTipoVersao('');
      if (!resultado.itens.length && pagina === 1) setAviso('Esse paciente não tem plano alimentar disponível para copiar.');
    } catch (falha) {
      if (controlador.signal.aborted || sequencia !== sequenciaRef.current) return;
      setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar os planos autorizados.'));
    } finally {
      if (sequencia === sequenciaRef.current) setOcupado(null);
    }
  }, []);

  useEffect(() => {
    // Leitura inicial da lista autorizada; as alterações de estado ocorrem
    // depois da resposta HTTP, não como derivação síncrona de props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarPlanos(pacienteIdAtual, 1);
  }, [carregarPlanos, pacienteIdAtual]);

  function invalidarOrigem() {
    sequenciaRef.current += 1;
    controladorRef.current?.abort();
    controladorRef.current = null;
    setReferencia(null);
    setRefeicoesOrigem([]);
    setRefeicaoOrigemId('');
    setAviso(null);
    setErro(null);
  }

  async function buscarPacientes() {
    if (termoPaciente.trim().length < 2) return;
    invalidarOrigem();
    const sequencia = ++sequenciaRef.current;
    setOcupado('buscando-pacientes');
    try {
      const resultado = await listarPacientes({ busca: termoPaciente.trim(), pagina: 1, limite: 10 });
      if (sequencia !== sequenciaRef.current) return;
      setPacientesEncontrados(resultado.itens.filter((paciente) => paciente.id !== pacienteIdAtual));
      if (!resultado.itens.some((paciente) => paciente.id !== pacienteIdAtual)) {
        setAviso('Nenhum outro paciente autorizado foi encontrado com esse nome.');
      }
    } catch (falha) {
      if (sequencia !== sequenciaRef.current) return;
      setErro(mensagemFalhaInterface(falha, 'Não foi possível buscar pacientes autorizados.'));
    } finally {
      if (sequencia === sequenciaRef.current) setOcupado(null);
    }
  }

  async function selecionarPaciente(novoPacienteId: string) {
    invalidarOrigem();
    setPacienteOrigemId(novoPacienteId);
    setPlanos([]);
    setPaginaPlanos(0);
    setTotalPlanos(0);
    setPlanoOrigemId('');
    setTipoVersao('');
    if (!novoPacienteId) return;
    setOcupado('carregando-planos');
    await carregarPlanos(novoPacienteId, 1);
  }

  function selecionarPlano(novoPlanoId: string) {
    invalidarOrigem();
    setPlanoOrigemId(novoPlanoId);
    setTipoVersao('');
    const origem = planos.find((plano) => plano.id === novoPlanoId);
    if (origem?.current) setTipoVersao('publicada');
    else if (origem?.draft) setTipoVersao('rascunho');
  }

  async function carregarRefeicoesVersao() {
    const origem = planos.find((plano) => plano.id === planoOrigemId);
    const resumo = origem ? versaoSelecionada(origem, tipoVersao) : undefined;
    if (!pacienteOrigemId || !origem || !resumo || (tipoVersao !== 'publicada' && tipoVersao !== 'rascunho')) return;
    invalidarOrigem();
    const sequencia = ++sequenciaRef.current;
    const controlador = new AbortController();
    controladorRef.current = controlador;
    setOcupado('lendo-versao');
    try {
      const versao = await obterVersaoPlanoAlimentar(pacienteOrigemId, origem.id, resumo.numero, controlador.signal);
      if (sequencia !== sequenciaRef.current || controlador.signal.aborted) return;
      if (versao.status !== tipoVersao) throw new Error('A versão selecionada não está mais disponível para cópia. Selecione-a novamente.');
      const refeicoes = versao.refeicoes.map((refeicao) => ({
        id: refeicao.id,
        nome: refeicao.nome,
        ordem: refeicao.ordem,
        quantidadeItens: refeicao.itens.length
      }));
      setRefeicoesOrigem(refeicoes);
      setRefeicaoOrigemId('');
      setReferencia({
        pacienteOrigemId,
        planoOrigemId: origem.id,
        numeroVersao: versao.numero,
        refeicaoId: '',
        atualizadoEm: versao.atualizadoEm,
        status: versao.status
      });
      if (!refeicoes.length) setAviso('A versão selecionada não contém refeições.');
    } catch (falha) {
      if (controlador.signal.aborted || sequencia !== sequenciaRef.current) return;
      setErro(mensagemFalhaInterface(falha, 'Não foi possível ler a versão autorizada.'));
      setRefeicoesOrigem([]);
      setReferencia(null);
    } finally {
      if (sequencia === sequenciaRef.current) setOcupado(null);
    }
  }

  async function colar() {
    if (!referencia || !referencia.refeicaoId || colandoRef.current) return;
    const chaveDestinoCapturada = destinoChave;
    if (!versaoRascunhoDestinoId || desabilitado) return;
    colandoRef.current = true;
    const liberarCopia = aoIniciarCopia();
    liberarCopiaRef.current = liberarCopia;
    setOcupado('colando');
    setErro(null);
    setAviso(null);
    const controlador = new AbortController();
    controladorRef.current?.abort();
    controladorRef.current = controlador;
    const sequencia = ++sequenciaRef.current;
    try {
      const versao = await obterVersaoPlanoAlimentar(
        referencia.pacienteOrigemId,
        referencia.planoOrigemId,
        referencia.numeroVersao,
        controlador.signal
      );
      if (sequencia !== sequenciaRef.current || controlador.signal.aborted) return;
      if (!destinoHabilitadoRef.current) {
        setErro('O plano está em outra operação. Selecione a origem novamente antes de copiar.');
        return;
      }
      if (destinoAtualRef.current !== chaveDestinoCapturada) {
        setErro('O plano de destino mudou. Selecione a refeição de origem novamente.');
        return;
      }
      if (versao.status !== referencia.status || versao.atualizadoEm !== referencia.atualizadoEm) {
        setErro('A versão de origem foi alterada. Carregue-a novamente antes de copiar.');
        return;
      }
      const refeicao = versao.refeicoes.find((item) => item.id === referencia.refeicaoId);
      if (!refeicao) {
        setErro('A refeição de origem não está mais disponível. Carregue a versão novamente.');
        return;
      }
      const copia = copiarRefeicaoParaFormulario(refeicao, gerarChave);
      const destino = destinoTipo === 'acrescentar'
        ? { tipo: 'acrescentar' as const, chaveRefeicao: destinoRefeicaoChave }
        : { tipo: 'nova' as const };
      if (destino.tipo === 'acrescentar' && !refeicoesDestino.some((item) => item.chaveCliente === destino.chaveRefeicao)) {
        setErro('A refeição de destino não está mais disponível. Selecione-a novamente.');
        return;
      }
      aoAplicarAtualRef.current(copia, destino);
      setAviso(destino.tipo === 'nova'
        ? 'Refeição copiada para o rascunho. Revise e salve para recalcular com o catálogo disponível.'
        : 'Alimentos e substituições acrescentados ao rascunho. Revise e salve para recalcular com o catálogo disponível.');
      setReferencia(null);
      setRefeicoesOrigem([]);
      setRefeicaoOrigemId('');
    } catch (falha) {
      if (controlador.signal.aborted || sequencia !== sequenciaRef.current) return;
      setErro(mensagemFalhaInterface(falha, 'A origem pode ter deixado de estar autorizada. Busque e selecione-a novamente.'));
    } finally {
      if (sequencia === sequenciaRef.current) setOcupado(null);
      colandoRef.current = false;
      liberarCopia();
      if (liberarCopiaRef.current === liberarCopia) liberarCopiaRef.current = null;
    }
  }

  const planoSelecionado = planos.find((plano) => plano.id === planoOrigemId);
  const planosDisponiveis = planos.filter((plano) => !(pacienteOrigemId === pacienteIdAtual && plano.id === planoIdDestino));
  const resumoVersao = planoSelecionado ? versaoSelecionada(planoSelecionado, tipoVersao) : undefined;
  const paginasTotais = Math.max(1, Math.ceil(totalPlanos / 25));
  const habilitado = !desabilitado && !ocupado && Boolean(versaoRascunhoDestinoId);

  return (
    <section aria-labelledby={`${id}-titulo`} className="grid gap-3 rounded-md border border-linha bg-white p-4">
      <div className="flex items-center gap-2">
        <ClipboardCopy aria-hidden="true" size={17} className="text-primaria" />
        <h3 id={`${id}-titulo`} className="text-sm font-semibold text-tinta">Copiar uma refeição salva</h3>
      </div>
      <p className="text-xs text-texto-suave">
        Somente versões salvas são copiadas; salve alterações abertas no plano de origem antes. A publicada é selecionada primeiro, e a origem é verificada novamente ao copiar.
      </p>
      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {aviso ? <p role="status" className="rounded-md bg-superficie px-3 py-2 text-sm text-tinta">{aviso}</p> : null}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-busca-paciente`}>Buscar outro paciente autorizado (opcional)</Rotulo>
          <Campo
            id={`${id}-busca-paciente`}
            value={termoPaciente}
            onChange={(evento) => setTermoPaciente(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault();
                void buscarPacientes();
              }
            }}
            maxLength={120}
            placeholder="Buscar por nome"
            disabled={!habilitado}
          />
        </div>
        <Botao type="button" variante="secundario" className="min-h-11" onClick={() => void buscarPacientes()} carregando={ocupado === 'buscando-pacientes'} disabled={!habilitado || termoPaciente.trim().length < 2}>
          <Search aria-hidden="true" size={15} /> Buscar paciente
        </Botao>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-tinta">
          Paciente de origem
          <Selecao value={pacienteOrigemId} onChange={(evento) => void selecionarPaciente(evento.target.value)} disabled={!habilitado}>
            <option value="">Selecione um paciente</option>
            <option value={pacienteIdAtual}>Paciente deste prontuário</option>
            {pacientesEncontrados.map((paciente) => <option key={paciente.id} value={paciente.id}>{paciente.nome}</option>)}
          </Selecao>
        </label>
        <label className="grid gap-1 text-sm font-medium text-tinta">
          Plano de origem
          <Selecao value={planoOrigemId} onChange={(evento) => selecionarPlano(evento.target.value)} disabled={!habilitado || !planos.length}>
            <option value="">{planos.length ? 'Selecione um plano' : 'Carregando planos...'}</option>
            {planosDisponiveis.map((plano) => <option key={plano.id} value={plano.id}>
              {plano.titulo}{plano.id === planoIdDestino && pacienteOrigemId === pacienteIdAtual ? ' (destino atual)' : ''}
            </option>)}
          </Selecao>
        </label>
      </div>
      {pacienteOrigemId === pacienteIdAtual && paginaPlanos > 0 && planosDisponiveis.length === 0 ? (
        <p className="text-xs text-texto-suave">Escolha outro plano deste paciente. Para duplicar uma refeição ainda não salva neste plano, use a ação na própria refeição.</p>
      ) : null}

      {paginaPlanos > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Paginação dos planos de origem">
          <Botao type="button" variante="fantasma" className="min-h-11" disabled={!habilitado || paginaPlanos <= 1} onClick={() => { invalidarOrigem(); setOcupado('carregando-planos'); void carregarPlanos(pacienteOrigemId, paginaPlanos - 1); }}>Planos anteriores</Botao>
          <span aria-live="polite">Página {paginaPlanos} de {paginasTotais}</span>
          <Botao type="button" variante="fantasma" className="min-h-11" disabled={!habilitado || paginaPlanos >= paginasTotais} onClick={() => { invalidarOrigem(); setOcupado('carregando-planos'); void carregarPlanos(pacienteOrigemId, paginaPlanos + 1); }}>Mais planos</Botao>
        </div>
      ) : null}

      {planoSelecionado ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-medium text-tinta">
            Versão salva
            <Selecao value={tipoVersao} onChange={(evento) => {
              invalidarOrigem();
              setTipoVersao(evento.target.value as 'publicada' | 'rascunho' | '');
            }} disabled={!habilitado}>
              <option value="">Selecione uma versão</option>
              {planoSelecionado.current ? <option value="publicada">Publicada v{planoSelecionado.current.numero} (recomendada)</option> : null}
              {planoSelecionado.draft ? <option value="rascunho">Rascunho salvo v{planoSelecionado.draft.numero}</option> : null}
            </Selecao>
          </label>
          <Botao type="button" variante="secundario" className="min-h-11" onClick={() => void carregarRefeicoesVersao()} carregando={ocupado === 'lendo-versao'} disabled={!habilitado || !resumoVersao}>
            Carregar refeições
          </Botao>
        </div>
      ) : null}

      {refeicoesOrigem.length ? (
        <label className="grid gap-1 text-sm font-medium text-tinta">
          Refeição salva
          <Selecao value={refeicaoOrigemId} onChange={(evento) => {
            const refeicaoId = evento.target.value;
            setRefeicaoOrigemId(refeicaoId);
            setReferencia((atual) => atual ? { ...atual, refeicaoId } : null);
          }} disabled={!habilitado}>
            <option value="">Selecione uma refeição</option>
            {refeicoesOrigem.map((refeicao) => <option key={refeicao.id} value={refeicao.id}>
              {refeicao.nome || `Refeição ${refeicao.ordem + 1}`} ({refeicao.quantidadeItens} alimentos)
            </option>)}
          </Selecao>
        </label>
      ) : null}

      {referencia?.refeicaoId ? (
        <div className="grid gap-3 rounded-md bg-superficie p-3">
          <fieldset className="flex flex-wrap gap-4">
            <legend className="mb-1 text-sm font-medium text-tinta">Aplicar no rascunho atual</legend>
            <label className="flex min-h-11 items-center gap-2 text-sm text-tinta">
              <input type="radio" name={`${id}-destino`} checked={destinoTipo === 'nova'} onChange={() => setDestinoTipo('nova')} disabled={!habilitado} />
              Criar nova refeição
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-tinta">
              <input type="radio" name={`${id}-destino`} checked={destinoTipo === 'acrescentar'} onChange={() => setDestinoTipo('acrescentar')} disabled={!habilitado || !refeicoesDestino.length} />
              Acrescentar alimentos a uma refeição
            </label>
          </fieldset>
          {destinoTipo === 'acrescentar' ? (
            <label className="grid gap-1 text-sm font-medium text-tinta">
              Refeição de destino
              <Selecao value={destinoRefeicaoChave} onChange={(evento) => setDestinoRefeicaoChave(evento.target.value)} disabled={!habilitado}>
                <option value="">Selecione uma refeição</option>
                {refeicoesDestino.map((refeicao) => <option key={refeicao.chaveCliente} value={refeicao.chaveCliente}>{refeicao.nome || 'Refeição sem nome'}</option>)}
              </Selecao>
            </label>
          ) : null}
          <p className="text-xs text-texto-suave">A cópia não substitui itens existentes. Confira e salve o rascunho para recalcular.</p>
          <Botao type="button" variante="primario" className="min-h-11 justify-self-start" onClick={() => void colar()} carregando={ocupado === 'colando'} disabled={!habilitado || (destinoTipo === 'acrescentar' && !destinoRefeicaoChave)}>
            Copiar refeição
          </Botao>
        </div>
      ) : null}
    </section>
  );
}
