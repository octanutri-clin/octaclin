'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  History,
  Plus,
  Printer,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  Utensils
} from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoSubtitulo, CartaoTitulo } from '@/components/ui/cartao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import {
  arquivarPlanoAlimentar,
  atualizarRascunhoPlanoAlimentar,
  buscarAlimentosPlanoAlimentar,
  criarNovaVersaoPlanoAlimentar,
  criarPlanoAlimentar,
  listarPlanosAlimentares,
  obterPlanoAlimentar,
  publicarPlanoAlimentar,
  revisarPlanoAlimentar,
  type AlimentoComposicaoApi,
  type AtualizarRascunhoPlanoAlimentarEntrada,
  type FormulaEnergeticaApi,
  type NutrientesPor100gApi,
  type PlanoAlimentarApi,
  type PlanoAlimentarResumoApi,
  type RefeicaoPlanoAlimentarEntrada,
  type SubstituicaoPlanoAlimentarEntrada,
  type VersaoPlanoAlimentarApi
} from '@/lib/plano-alimentar-api';
import {
  listarAvaliacoesAntropometricas,
  type AvaliacaoAntropometricaApi
} from '@/lib/prontuario-api';

const nutrientesVazios: NutrientesPor100gApi = {
  energiaKcal: 0,
  proteinasG: 0,
  carboidratosG: 0,
  gordurasG: 0
};

interface AlimentoFormulario extends SubstituicaoPlanoAlimentarEntrada {
  chaveCliente: string;
  descricao: string;
  nutrientesPor100g: NutrientesPor100gApi;
  fonteRotulo?: string;
}

interface ItemFormulario extends AlimentoFormulario {
  substituicoes: AlimentoFormulario[];
}

interface RefeicaoFormulario extends Omit<RefeicaoPlanoAlimentarEntrada, 'itens'> {
  chaveCliente: string;
  itens: ItemFormulario[];
}

interface FormularioPlano {
  avaliacaoAntropometricaId: string;
  formula: FormulaEnergeticaApi;
  fatorAtividade: number;
  ajusteEnergeticoKcal: number;
  carboidratosBasisPoints: number;
  proteinasBasisPoints: number;
  gordurasBasisPoints: number;
  possuiCondicaoEspecial: boolean;
  aplicabilidadeFormulaConfirmada: boolean;
  justificativaCondicaoEspecial: string;
  justificativaDivergenciaClinica: string;
  objetivos: string;
  observacoes: string;
  refeicoes: RefeicaoFormulario[];
}

function novaChaveCliente(prefixo: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefixo}-${uuid}` : `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function novoAlimento(): AlimentoFormulario {
  return {
    chaveCliente: novaChaveCliente('alimento'),
    descricao: '',
    quantidade: 1,
    unidade: 'porcao',
    porcaoGramas: 100,
    nutrientesPor100g: { ...nutrientesVazios }
  };
}

function novoItem(): ItemFormulario {
  return { ...novoAlimento(), substituicoes: [] };
}

function novaRefeicao(): RefeicaoFormulario {
  return {
    chaveCliente: novaChaveCliente('refeicao'),
    nome: '',
    horarioLocal: '',
    orientacoes: '',
    itens: [novoItem()]
  };
}

function formularioInicial(avaliacaoId = ''): FormularioPlano {
  return {
    avaliacaoAntropometricaId: avaliacaoId,
    formula: 'mifflin_st_jeor_1990',
    fatorAtividade: 1.4,
    ajusteEnergeticoKcal: 0,
    carboidratosBasisPoints: 5000,
    proteinasBasisPoints: 2000,
    gordurasBasisPoints: 3000,
    possuiCondicaoEspecial: false,
    aplicabilidadeFormulaConfirmada: false,
    justificativaCondicaoEspecial: '',
    justificativaDivergenciaClinica: '',
    objetivos: '',
    observacoes: '',
    refeicoes: [novaRefeicao()]
  };
}

function alimentoDaVersao(
  alimento: VersaoPlanoAlimentarApi['refeicoes'][number]['itens'][number]
): ItemFormulario;
function alimentoDaVersao(
  alimento: VersaoPlanoAlimentarApi['refeicoes'][number]['itens'][number]['substituicoes'][number]
): AlimentoFormulario;
function alimentoDaVersao(
  alimento:
    | VersaoPlanoAlimentarApi['refeicoes'][number]['itens'][number]
    | VersaoPlanoAlimentarApi['refeicoes'][number]['itens'][number]['substituicoes'][number]
): AlimentoFormulario | ItemFormulario {
  const base: AlimentoFormulario = {
    chaveCliente: alimento.id,
    alimentoComposicaoId: alimento.alimentoComposicaoId,
    descricao: alimento.descricao,
    quantidade: alimento.quantidade,
    unidade: alimento.unidade,
    porcaoGramas: alimento.porcaoGramas,
    nutrientesPor100g: { ...alimento.composicaoSnapshot.nutrientesPor100g },
    fonteRotulo: alimento.composicaoSnapshot.fonte
      ? `${alimento.composicaoSnapshot.fonte.nome} - ${alimento.composicaoSnapshot.fonte.versao}`
      : undefined
  };
  if ('substituicoes' in alimento) {
    return { ...base, substituicoes: alimento.substituicoes.map((item) => alimentoDaVersao(item)) };
  }
  return base;
}

function formularioDaVersao(versao: VersaoPlanoAlimentarApi, avaliacaoPadrao = ''): FormularioPlano {
  const calculo = versao.calculo;
  return {
    avaliacaoAntropometricaId: versao.avaliacaoAntropometricaId ?? avaliacaoPadrao,
    formula: versao.formulaCodigo ?? 'mifflin_st_jeor_1990',
    fatorAtividade: calculo?.fatorAtividade ?? 1.4,
    ajusteEnergeticoKcal: calculo?.ajusteEnergeticoKcal ?? 0,
    carboidratosBasisPoints: calculo?.distribuicaoMacros.carboidratosBasisPoints ?? 5000,
    proteinasBasisPoints: calculo?.distribuicaoMacros.proteinasBasisPoints ?? 2000,
    gordurasBasisPoints: calculo?.distribuicaoMacros.gordurasBasisPoints ?? 3000,
    possuiCondicaoEspecial: calculo?.possuiCondicaoEspecial ?? false,
    aplicabilidadeFormulaConfirmada: calculo?.aplicabilidadeFormulaConfirmada ?? false,
    justificativaCondicaoEspecial: calculo?.justificativaCondicaoEspecial ?? '',
    justificativaDivergenciaClinica: calculo?.justificativaDivergenciaClinica ?? '',
    objetivos: versao.objetivos ?? '',
    observacoes: versao.observacoes ?? '',
    refeicoes: versao.refeicoes.length
      ? versao.refeicoes.map((refeicao) => ({
          chaveCliente: refeicao.id,
          nome: refeicao.nome,
          horarioLocal: refeicao.horarioLocal?.slice(0, 5) ?? '',
          orientacoes: refeicao.orientacoes ?? '',
          itens: refeicao.itens.map((item) => alimentoDaVersao(item))
        }))
      : [novaRefeicao()]
  };
}

function entradaAlimento(alimento: AlimentoFormulario): SubstituicaoPlanoAlimentarEntrada {
  const base = {
    quantidade: alimento.quantidade,
    unidade: alimento.unidade.trim(),
    porcaoGramas: alimento.porcaoGramas
  };
  return alimento.alimentoComposicaoId
    ? { ...base, alimentoComposicaoId: alimento.alimentoComposicaoId }
    : {
        ...base,
        descricao: alimento.descricao.trim(),
        nutrientesPor100g: alimento.nutrientesPor100g
      };
}

function montarEntrada(formulario: FormularioPlano): AtualizarRascunhoPlanoAlimentarEntrada {
  return {
    avaliacaoAntropometricaId: formulario.avaliacaoAntropometricaId,
    formula: formulario.formula,
    fatorAtividade: formulario.fatorAtividade,
    ajusteEnergeticoKcal: formulario.ajusteEnergeticoKcal,
    distribuicaoMacros: {
      carboidratosBasisPoints: formulario.carboidratosBasisPoints,
      proteinasBasisPoints: formulario.proteinasBasisPoints,
      gordurasBasisPoints: formulario.gordurasBasisPoints
    },
    possuiCondicaoEspecial: formulario.possuiCondicaoEspecial,
    aplicabilidadeFormulaConfirmada: formulario.aplicabilidadeFormulaConfirmada,
    justificativaCondicaoEspecial: formulario.possuiCondicaoEspecial
      ? formulario.justificativaCondicaoEspecial.trim()
      : undefined,
    justificativaDivergenciaClinica: formulario.justificativaDivergenciaClinica.trim() || undefined,
    objetivos: formulario.objetivos.trim(),
    observacoes: formulario.observacoes.trim() || undefined,
    refeicoes: formulario.refeicoes.map((refeicao) => ({
      nome: refeicao.nome.trim(),
      horarioLocal: refeicao.horarioLocal || undefined,
      orientacoes: refeicao.orientacoes?.trim() || undefined,
      itens: refeicao.itens.map((item) => ({
        ...entradaAlimento(item),
        substituicoes: item.substituicoes.map(entradaAlimento)
      }))
    }))
  };
}

function mover<T>(itens: T[], origem: number, destino: number): T[] {
  if (destino < 0 || destino >= itens.length) return itens;
  const copia = [...itens];
  const [item] = copia.splice(origem, 1);
  copia.splice(destino, 0, item);
  return copia;
}

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function formatarNumero(valor?: number, casas = 0) {
  if (valor === undefined) return '-';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function validarFormulario(formulario: FormularioPlano): string[] {
  const erros: string[] = [];
  if (!formulario.avaliacaoAntropometricaId) erros.push('Selecione a avaliacao antropometrica usada no calculo.');
  if (!formulario.objetivos.trim()) erros.push('Informe o objetivo clinico do plano.');
  if (!formulario.aplicabilidadeFormulaConfirmada) erros.push('Confirme a aplicabilidade da formula selecionada.');
  if (formulario.fatorAtividade < 1.4 || formulario.fatorAtividade > 2.4) {
    erros.push('O fator de atividade deve estar entre 1,40 e 2,40.');
  }
  if (
    formulario.carboidratosBasisPoints +
      formulario.proteinasBasisPoints +
      formulario.gordurasBasisPoints !==
    10000
  ) {
    erros.push('A distribuicao de macronutrientes deve totalizar 100%.');
  }
  if (formulario.possuiCondicaoEspecial && !formulario.justificativaCondicaoEspecial.trim()) {
    erros.push('Descreva a condicao especial informada.');
  }
  if (formulario.possuiCondicaoEspecial) {
    erros.push('O calculo automatico nao esta disponivel para condicoes especiais neste MVP.');
  }
  formulario.refeicoes.forEach((refeicao, indiceRefeicao) => {
    if (!refeicao.nome.trim()) erros.push(`Informe o nome da refeicao ${indiceRefeicao + 1}.`);
    if (!refeicao.itens.length) erros.push(`Inclua ao menos um alimento na refeicao ${indiceRefeicao + 1}.`);
    refeicao.itens.forEach((item, indiceItem) => {
      if (!item.descricao.trim()) erros.push(`Informe o alimento ${indiceItem + 1} da refeicao ${indiceRefeicao + 1}.`);
      if (!item.unidade.trim() || item.quantidade <= 0 || item.porcaoGramas <= 0) {
        erros.push(`Revise quantidade, unidade e porcao do alimento ${indiceItem + 1} da refeicao ${indiceRefeicao + 1}.`);
      }
      item.substituicoes.forEach((substituicao, indice) => {
        if (!substituicao.descricao.trim()) {
          erros.push(`Informe a substituicao ${indice + 1} do alimento ${indiceItem + 1}.`);
        }
      });
    });
  });
  return erros;
}

interface EditorAlimentoProps {
  pacienteId: string;
  rotulo: string;
  valor: AlimentoFormulario;
  aoAlterar: (valor: AlimentoFormulario) => void;
  aoRemover?: () => void;
}

function EditorAlimento({ pacienteId, rotulo, valor, aoAlterar, aoRemover }: EditorAlimentoProps) {
  const id = useId();
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<AlimentoComposicaoApi[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  useEffect(() => {
    if (busca.trim().length < 2) {
      setResultados([]);
      setErroBusca(null);
      return;
    }
    const controle = new AbortController();
    const temporizador = window.setTimeout(async () => {
      setBuscando(true);
      setErroBusca(null);
      try {
        setResultados(await buscarAlimentosPlanoAlimentar(pacienteId, busca.trim(), controle.signal));
      } catch (erro) {
        if (!controle.signal.aborted) {
          setErroBusca(erro instanceof Error ? erro.message : 'Falha ao buscar alimentos.');
        }
      } finally {
        if (!controle.signal.aborted) setBuscando(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(temporizador);
      controle.abort();
    };
  }, [busca, pacienteId]);

  function selecionar(alimento: AlimentoComposicaoApi) {
    if (!alimento.nutrientesPor100g || !alimento.disponivelParaCalculo) return;
    aoAlterar({
      ...valor,
      alimentoComposicaoId: alimento.id,
      descricao: alimento.preparacao ? `${alimento.nome}, ${alimento.preparacao}` : alimento.nome,
      nutrientesPor100g: { ...alimento.nutrientesPor100g },
      fonteRotulo: alimento.fonte ? `${alimento.fonte.nome} - ${alimento.fonte.versao}` : 'Catalogo TACO'
    });
    setBusca('');
    setResultados([]);
  }

  function alterarNutriente(campo: keyof NutrientesPor100gApi, numero: number | undefined) {
    aoAlterar({ ...valor, nutrientesPor100g: { ...valor.nutrientesPor100g, [campo]: numero } });
  }

  return (
    <fieldset className="grid min-w-0 gap-3 border-t border-linha pt-3 first:border-t-0 first:pt-0">
      <legend className="sr-only">{rotulo}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-tinta">{rotulo}</p>
          <p className="text-xs text-texto-suave">
            {valor.alimentoComposicaoId ? valor.fonteRotulo ?? 'Catalogo nutricional' : 'Composicao informada manualmente'}
          </p>
        </div>
        {aoRemover ? (
          <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11" onClick={aoRemover} aria-label={`Remover ${rotulo}`}>
            <Trash2 size={15} />
            Remover
          </Botao>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Rotulo htmlFor={`${id}-busca`}>Buscar na TACO</Rotulo>
        <div className="relative">
          <Search aria-hidden="true" size={16} className="absolute left-3 top-3.5 text-texto-suave" />
          <Campo
            id={`${id}-busca`}
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            className="pl-9"
            placeholder="Digite pelo menos 2 caracteres"
            autoComplete="off"
          />
        </div>
        {buscando ? <p role="status" className="text-xs text-texto-suave">Buscando no catalogo...</p> : null}
        {erroBusca ? <p role="alert" className="text-xs text-perigo">{erroBusca}</p> : null}
        {resultados.length ? (
          <ul className="max-h-52 overflow-y-auto rounded-md border border-linha bg-white" aria-label="Resultados da busca de alimentos">
            {resultados.map((alimento) => (
              <li key={alimento.id} className="border-b border-linha last:border-b-0">
                <button
                  type="button"
                  disabled={!alimento.disponivelParaCalculo}
                  onClick={() => selecionar(alimento)}
                  className="min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-superficie-hover disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primaria"
                >
                  <span className="block font-medium text-tinta">{alimento.nome}</span>
                  <span className="block text-xs text-texto-suave">
                    {alimento.preparacao ?? alimento.fonte?.versao ?? 'TACO'}
                    {!alimento.disponivelParaCalculo ? ' - composicao incompleta' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_120px_150px_150px]">
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-descricao`}>Alimento</Rotulo>
          <Campo
            id={`${id}-descricao`}
            value={valor.descricao}
            onChange={(evento) => aoAlterar({ ...valor, descricao: evento.target.value })}
            disabled={Boolean(valor.alimentoComposicaoId)}
            maxLength={240}
            required
          />
        </div>
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-quantidade`}>Quantidade</Rotulo>
          <Campo
            id={`${id}-quantidade`}
            type="number"
            min="0.001"
            max="10000"
            step="0.001"
            value={valor.quantidade}
            onChange={(evento) => aoAlterar({ ...valor, quantidade: Number(evento.target.value) })}
            required
          />
        </div>
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-unidade`}>Unidade</Rotulo>
          <Campo
            id={`${id}-unidade`}
            value={valor.unidade}
            onChange={(evento) => aoAlterar({ ...valor, unidade: evento.target.value })}
            maxLength={40}
            required
          />
        </div>
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-gramas`}>Porcao (g)</Rotulo>
          <Campo
            id={`${id}-gramas`}
            type="number"
            min="0.001"
            max="10000"
            step="0.001"
            value={valor.porcaoGramas}
            onChange={(evento) => aoAlterar({ ...valor, porcaoGramas: Number(evento.target.value) })}
            required
          />
        </div>
      </div>

      {valor.alimentoComposicaoId ? (
        <button
          type="button"
          onClick={() => aoAlterar({ ...valor, alimentoComposicaoId: undefined, fonteRotulo: undefined })}
          className="w-fit text-xs font-semibold text-primaria underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
        >
          Transformar em item manual
        </button>
      ) : (
        <fieldset className="grid gap-2 rounded-md bg-superficie p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-texto-suave">Nutrientes por 100 g</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {([
              ['energiaKcal', 'Energia (kcal)'],
              ['proteinasG', 'Proteinas (g)'],
              ['carboidratosG', 'Carboidratos (g)'],
              ['gordurasG', 'Gorduras (g)'],
              ['fibrasG', 'Fibras (g)'],
              ['sodioMg', 'Sodio (mg)']
            ] as const).map(([campo, rotuloNutriente]) => (
              <label key={campo} className="grid gap-1 text-xs font-semibold text-texto-suave">
                {rotuloNutriente}
                <Campo
                  type="number"
                  min="0"
                  step="0.0001"
                  value={valor.nutrientesPor100g[campo] ?? ''}
                  onChange={(evento) =>
                    alterarNutriente(campo, evento.target.value === '' ? undefined : Number(evento.target.value))
                  }
                  required={campo !== 'fibrasG' && campo !== 'sodioMg'}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </fieldset>
  );
}

interface EditorItemProps {
  pacienteId: string;
  item: ItemFormulario;
  indice: number;
  total: number;
  aoAlterar: (item: ItemFormulario) => void;
  aoRemover: () => void;
  aoMover: (destino: number) => void;
}

function EditorItem({ pacienteId, item, indice, total, aoAlterar, aoRemover, aoMover }: EditorItemProps) {
  return (
    <div className="grid gap-3 border-t border-linha py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap justify-end gap-1">
        <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11 min-w-11" onClick={() => aoMover(indice - 1)} disabled={indice === 0} aria-label="Mover alimento para cima">
          <ArrowUp size={15} />
        </Botao>
        <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11 min-w-11" onClick={() => aoMover(indice + 1)} disabled={indice === total - 1} aria-label="Mover alimento para baixo">
          <ArrowDown size={15} />
        </Botao>
      </div>
      <EditorAlimento pacienteId={pacienteId} rotulo={`Alimento ${indice + 1}`} valor={item} aoAlterar={(valor) => aoAlterar({ ...item, ...valor })} aoRemover={aoRemover} />
      <div className="ml-0 grid gap-3 border-l-2 border-primaria-suave pl-3 sm:ml-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-texto-suave">Substituicoes</p>
          <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => aoAlterar({ ...item, substituicoes: [...item.substituicoes, novoAlimento()] })}>
            <Plus size={15} />
            Adicionar substituicao
          </Botao>
        </div>
        {item.substituicoes.length ? item.substituicoes.map((substituicao, indiceSubstituicao) => (
          <div key={substituicao.chaveCliente} className="grid gap-2">
            <div className="flex justify-end gap-1">
              <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11 min-w-11" onClick={() => aoAlterar({ ...item, substituicoes: mover(item.substituicoes, indiceSubstituicao, indiceSubstituicao - 1) })} disabled={indiceSubstituicao === 0} aria-label="Mover substituicao para cima"><ArrowUp size={15} /></Botao>
              <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11 min-w-11" onClick={() => aoAlterar({ ...item, substituicoes: mover(item.substituicoes, indiceSubstituicao, indiceSubstituicao + 1) })} disabled={indiceSubstituicao === item.substituicoes.length - 1} aria-label="Mover substituicao para baixo"><ArrowDown size={15} /></Botao>
            </div>
            <EditorAlimento
              pacienteId={pacienteId}
              rotulo={`Substituicao ${indiceSubstituicao + 1}`}
              valor={substituicao}
              aoAlterar={(valor) => aoAlterar({ ...item, substituicoes: item.substituicoes.map((atual, posicao) => posicao === indiceSubstituicao ? valor : atual) })}
              aoRemover={() => aoAlterar({ ...item, substituicoes: item.substituicoes.filter((_, posicao) => posicao !== indiceSubstituicao) })}
            />
          </div>
        )) : <p className="text-sm text-texto-suave">Nenhuma substituicao cadastrada.</p>}
      </div>
    </div>
  );
}

function ResumoVersao({ plano, versao }: { plano: PlanoAlimentarApi; versao: VersaoPlanoAlimentarApi }) {
  return (
    <article className="folha-documento grid gap-5 rounded-md border border-linha bg-white p-5">
      <header className="border-b border-linha pb-4">
        <p className="text-xs font-semibold uppercase text-primaria">Plano alimentar</p>
        <h2 className="mt-1 text-xl font-semibold text-tinta">{plano.titulo}</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Versao {versao.numero} - {versao.status === 'publicada' ? `publicada em ${formatarData(versao.publicadaEm)}` : versao.status === 'descartada' ? `descartada em ${formatarData(versao.descartadaEm)}` : 'rascunho em consulta'}
        </p>
      </header>
      <section>
        <h3 className="text-sm font-semibold text-tinta">Objetivo</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-texto-suave">{versao.objetivos}</p>
      </section>
      {versao.calculo ? (
        <section className="grid gap-3 rounded-md bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-texto-suave">Meta energetica</p><p className="text-lg font-semibold text-tinta">{formatarNumero(versao.calculo.metaEnergeticaKcal)} kcal</p></div>
          <div><p className="text-xs text-texto-suave">Carboidratos</p><p className="text-lg font-semibold text-tinta">{formatarNumero(versao.calculo.metasMacronutrientes.carboidratosG, 1)} g</p></div>
          <div><p className="text-xs text-texto-suave">Proteinas</p><p className="text-lg font-semibold text-tinta">{formatarNumero(versao.calculo.metasMacronutrientes.proteinasG, 1)} g</p></div>
          <div><p className="text-xs text-texto-suave">Gorduras</p><p className="text-lg font-semibold text-tinta">{formatarNumero(versao.calculo.metasMacronutrientes.gordurasG, 1)} g</p></div>
        </section>
      ) : null}
      <div className="grid gap-4">
        {versao.refeicoes.map((refeicao) => (
          <section key={refeicao.id} className="break-inside-avoid border-t border-linha pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-tinta">{refeicao.nome}</h3>
              {refeicao.horarioLocal ? <p className="text-sm text-texto-suave">{refeicao.horarioLocal.slice(0, 5)}</p> : null}
            </div>
            {refeicao.orientacoes ? <p className="mt-1 whitespace-pre-wrap text-sm text-texto-suave">{refeicao.orientacoes}</p> : null}
            <ul className="mt-3 grid gap-2">
              {refeicao.itens.map((item) => (
                <li key={item.id} className="text-sm text-tinta">
                  <span className="font-medium">{item.descricao}</span> - {formatarNumero(item.quantidade, 1)} {item.unidade} ({formatarNumero(item.porcaoGramas, 1)} g)
                  {item.substituicoes.length ? <p className="mt-1 pl-3 text-xs text-texto-suave">Substituir por: {item.substituicoes.map((substituicao) => `${substituicao.descricao} (${formatarNumero(substituicao.quantidade, 1)} ${substituicao.unidade})`).join(' ou ')}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {versao.observacoes ? <section className="border-t border-linha pt-4"><h3 className="text-sm font-semibold text-tinta">Observacoes</h3><p className="mt-1 whitespace-pre-wrap text-sm text-texto-suave">{versao.observacoes}</p></section> : null}
    </article>
  );
}

interface PlanoAlimentarProfissionalProps {
  pacienteId: string;
  podeGerenciar: boolean;
  aoAlterarRascunho?: (alterado: boolean) => void;
}

export function PlanoAlimentarProfissional({ pacienteId, podeGerenciar, aoAlterarRascunho }: PlanoAlimentarProfissionalProps) {
  const [planos, setPlanos] = useState<PlanoAlimentarResumoApi[]>([]);
  const [plano, setPlano] = useState<PlanoAlimentarApi | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoAntropometricaApi[]>([]);
  const [planoId, setPlanoId] = useState('');
  const [formulario, setFormulario] = useState<FormularioPlano>(() => formularioInicial());
  const [tituloNovo, setTituloNovo] = useState('Plano alimentar');
  const [carregando, setCarregando] = useState(true);
  const [operacao, setOperacao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [errosFormulario, setErrosFormulario] = useState<string[]>([]);
  const [alterado, setAlterado] = useState(false);
  const [confirmarArquivo, setConfirmarArquivo] = useState(false);
  const [confirmarCriacao, setConfirmarCriacao] = useState(false);
  const sequenciaCarregamento = useRef(0);

  const somaMacros = formulario.carboidratosBasisPoints + formulario.proteinasBasisPoints + formulario.gordurasBasisPoints;

  const aplicarPlano = useCallback((detalhe: PlanoAlimentarApi | null, avaliacoesAtuais: AvaliacaoAntropometricaApi[] = []) => {
    setPlano(detalhe);
    setPlanoId(detalhe?.id ?? '');
    const avaliacaoPadrao = avaliacoesAtuais[0]?.id ?? '';
    setFormulario(detalhe?.draft ? formularioDaVersao(detalhe.draft, avaliacaoPadrao) : formularioInicial(avaliacaoPadrao));
    setAlterado(false);
    setErrosFormulario([]);
  }, []);

  const carregar = useCallback(async (preferido?: string) => {
    const sequencia = ++sequenciaCarregamento.current;
    setCarregando(true);
    setErro(null);
    try {
      const lista = await listarPlanosAlimentares(pacienteId);
      if (sequencia !== sequenciaCarregamento.current) return;
      setPlanos(lista);
      const selecionado = lista.find((item) => item.id === preferido) ?? lista[0];
      const [detalhe, serie] = await Promise.all([
        selecionado ? obterPlanoAlimentar(pacienteId, selecionado.id) : Promise.resolve(null),
        podeGerenciar ? listarAvaliacoesAntropometricas(pacienteId) : Promise.resolve({ avaliacoes: [] })
      ]);
      if (sequencia !== sequenciaCarregamento.current) return;
      setAvaliacoes(serie.avaliacoes);
      aplicarPlano(detalhe, serie.avaliacoes);
    } catch (erroAtual) {
      if (sequencia !== sequenciaCarregamento.current) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar planos alimentares.');
    } finally {
      if (sequencia === sequenciaCarregamento.current) setCarregando(false);
    }
  }, [aplicarPlano, pacienteId, podeGerenciar]);

  useEffect(() => {
    void carregar();
    return () => {
      sequenciaCarregamento.current += 1;
    };
  }, [carregar]);

  useEffect(() => {
    aoAlterarRascunho?.(alterado);
    return () => aoAlterarRascunho?.(false);
  }, [alterado, aoAlterarRascunho]);

  useEffect(() => {
    function impedirSaida(evento: BeforeUnloadEvent) {
      if (!alterado) return;
      evento.preventDefault();
      evento.returnValue = '';
    }
    window.addEventListener('beforeunload', impedirSaida);
    return () => window.removeEventListener('beforeunload', impedirSaida);
  }, [alterado]);

  function atualizar(mutacao: (atual: FormularioPlano) => FormularioPlano) {
    if (!podeGerenciar) return;
    setFormulario(mutacao);
    setAlterado(true);
    setSucesso(null);
    setErrosFormulario([]);
  }

  async function executar(rotulo: string, tarefa: () => Promise<unknown>, mensagem: string, preferido = planoId) {
    if (!podeGerenciar) return;
    setOperacao(rotulo);
    setErro(null);
    setSucesso(null);
    try {
      await tarefa();
      setSucesso(mensagem);
      await carregar(preferido);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Nao foi possivel concluir a operacao.');
    } finally {
      setOperacao(null);
    }
  }

  async function criar() {
    if (!podeGerenciar) return;
    const titulo = tituloNovo.trim();
    if (!titulo) return;
    setOperacao('criando');
    setErro(null);
    try {
      const criado = await criarPlanoAlimentar(pacienteId, titulo);
      setSucesso('Plano criado. Complete o rascunho antes da revisao.');
      await carregar(criado.id);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar plano alimentar.');
    } finally {
      setOperacao(null);
    }
  }

  function solicitarCriacao() {
    if (alterado) {
      setConfirmarCriacao(true);
      return;
    }
    void criar();
  }

  async function salvar() {
    if (!podeGerenciar || !plano?.draft) return;
    const erros = validarFormulario(formulario);
    setErrosFormulario(erros);
    if (erros.length) return;
    await executar(
      'salvando',
      () => atualizarRascunhoPlanoAlimentar(pacienteId, plano.id, montarEntrada(formulario)),
      'Rascunho salvo. Revise os resultados antes de continuar.'
    );
  }

  function selecionarPlano(destino: PlanoAlimentarResumoApi) {
    if (alterado) return;
    void carregar(destino.id);
  }

  function atualizarRefeicao(indice: number, refeicao: RefeicaoFormulario) {
    atualizar((atual) => ({ ...atual, refeicoes: atual.refeicoes.map((item, posicao) => posicao === indice ? refeicao : item) }));
  }

  if (carregando) return <BarraCarregamento visivel rotulo="Carregando planos alimentares" />;

  return (
    <div className="grid gap-4">
      <div className="nao-imprimir grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="grid content-start gap-3">
          <Cartao className="border border-linha shadow-none">
            <CartaoCabecalho>
              <div>
                <CartaoTitulo icone={<Utensils size={17} />}>Planos alimentares</CartaoTitulo>
                <CartaoSubtitulo>{planos.length} plano(s) ativo(s)</CartaoSubtitulo>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo className="grid gap-2">
              {planos.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={alterado && item.id !== planoId}
                  onClick={() => selecionarPlano(item)}
                  aria-current={item.id === planoId ? 'true' : undefined}
                  className={`min-h-11 rounded-md border px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria ${item.id === planoId ? 'border-primaria bg-primaria-suave' : 'border-linha bg-white hover:bg-superficie-hover'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="block break-words text-sm font-semibold text-tinta">{item.titulo}</span>
                  <span className="mt-1 block text-xs text-texto-suave">
                    {item.draft ? `Rascunho v${item.draft.numero}` : item.current ? `Publicado v${item.current.numero}` : 'Sem versao publicada'}
                  </span>
                </button>
              ))}
              {!planos.length ? <EstadoVazio titulo="Nenhum plano alimentar" descricao={podeGerenciar ? 'Crie o primeiro plano para iniciar o cuidado nutricional.' : 'Ainda nao existe plano disponivel para consulta.'} /> : null}
            </CartaoConteudo>
          </Cartao>

          {podeGerenciar ? <Cartao className="border border-linha shadow-none">
            <CartaoConteudo className="grid gap-2">
              <Rotulo htmlFor="titulo-novo-plano">Novo plano</Rotulo>
              <Campo id="titulo-novo-plano" value={tituloNovo} onChange={(evento) => setTituloNovo(evento.target.value)} maxLength={180} />
              <Botao type="button" variante="primario" onClick={solicitarCriacao} carregando={operacao === 'criando'} disabled={Boolean(operacao)}>
                <Plus size={16} />
                Criar plano
              </Botao>
            </CartaoConteudo>
          </Cartao> : null}
        </aside>

        <main className="grid min-w-0 content-start gap-4">
          <div aria-live="polite" className="grid gap-2">
            {erro ? <AlertaOperacional mensagem={erro} /> : null}
            {sucesso ? <div role="status" className="flex items-start gap-2 rounded-md border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />{sucesso}</div> : null}
            {alterado ? <div role="status" className="rounded-md border border-alerta-borda bg-alerta-suave px-4 py-3 text-sm text-alerta-forte">Existem alteracoes nao salvas neste rascunho.</div> : null}
          </div>

          {!plano ? <EstadoVazio titulo={podeGerenciar ? 'Selecione ou crie um plano' : 'Selecione um plano'} descricao={podeGerenciar ? 'O editor sera exibido depois que um plano alimentar for selecionado.' : 'O conteudo sera exibido somente para consulta.'} /> : null}

          {plano ? (
            <>
              <Cartao className="border border-linha shadow-none">
                <CartaoCabecalho>
                  <div>
                    <CartaoTitulo>{plano.titulo}</CartaoTitulo>
                    <CartaoSubtitulo>
                      {plano.draft ? `Rascunho da versao ${plano.draft.numero}` : 'Sem rascunho ativo'}
                    </CartaoSubtitulo>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Botao type="button" onClick={() => void carregar(plano.id)} disabled={alterado || Boolean(operacao)}>
                      <RefreshCcw size={16} /> Atualizar
                    </Botao>
                    {plano.current ? <Botao type="button" onClick={() => window.print()}><Printer size={16} /> Imprimir</Botao> : null}
                    {podeGerenciar ? <Botao type="button" variante="perigo" onClick={() => setConfirmarArquivo(true)} disabled={alterado || Boolean(operacao)}>
                      <Archive size={16} /> Arquivar
                    </Botao> : null}
                  </div>
                </CartaoCabecalho>
              </Cartao>

              {podeGerenciar ? (plano.draft ? (
                <form onSubmit={(evento) => { evento.preventDefault(); void salvar(); }} className="grid gap-4">
                  {errosFormulario.length ? (
                    <div role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave p-4 text-sm text-perigo-forte">
                      <p className="font-semibold">Revise o rascunho antes de salvar:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">{errosFormulario.map((item) => <li key={item}>{item}</li>)}</ul>
                    </div>
                  ) : null}

                  <fieldset className="grid gap-4 rounded-md border border-linha bg-white p-4">
                    <legend className="px-1 text-sm font-semibold text-tinta">Calculo energetico</legend>
                    <p className="text-sm text-texto-suave">Estimativa baseada em equacao populacional. Revise os dados e a aplicabilidade antes de definir ou publicar uma meta.</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                        Avaliacao antropometrica
                        <Selecao value={formulario.avaliacaoAntropometricaId} onChange={(evento) => atualizar((atual) => ({ ...atual, avaliacaoAntropometricaId: evento.target.value }))} required>
                          <option value="">Selecione</option>
                          {avaliacoes.map((avaliacao) => <option key={avaliacao.id} value={avaliacao.id}>{formatarData(avaliacao.avaliadaEm)} - {avaliacao.medidas.pesoKg ?? '-'} kg / {avaliacao.medidas.alturaCm ?? '-'} cm</option>)}
                        </Selecao>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                        Formula
                        <Selecao value={formulario.formula} onChange={(evento) => atualizar((atual) => ({ ...atual, formula: evento.target.value as FormulaEnergeticaApi }))}>
                          <option value="mifflin_st_jeor_1990">Mifflin-St Jeor (1990)</option>
                          <option value="harris_benedict_revisada_1984">Harris-Benedict revisada (1984)</option>
                          <option value="fao_oms_unu_1985">FAO/OMS/UNU (1985)</option>
                        </Selecao>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                        Fator de atividade
                        <Campo type="number" min="1.4" max="2.4" step="0.01" value={formulario.fatorAtividade} onChange={(evento) => atualizar((atual) => ({ ...atual, fatorAtividade: Number(evento.target.value) }))} required />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                        Ajuste energetico (kcal)
                        <Campo type="number" min="-10000" max="10000" step="1" value={formulario.ajusteEnergeticoKcal} onChange={(evento) => atualizar((atual) => ({ ...atual, ajusteEnergeticoKcal: Number(evento.target.value) }))} />
                      </label>
                    </div>
                    <div className="grid gap-3 rounded-md bg-superficie p-3 sm:grid-cols-3">
                      {([
                        ['carboidratosBasisPoints', 'Carboidratos (%)'],
                        ['proteinasBasisPoints', 'Proteinas (%)'],
                        ['gordurasBasisPoints', 'Gorduras (%)']
                      ] as const).map(([campo, rotulo]) => (
                        <label key={campo} className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                          {rotulo}
                          <Campo type="number" min="0" max="100" step="0.01" value={formulario[campo] / 100} onChange={(evento) => atualizar((atual) => ({ ...atual, [campo]: Math.round(Number(evento.target.value) * 100) }))} required />
                        </label>
                      ))}
                      <p className={`sm:col-span-3 text-sm font-medium ${somaMacros === 10000 ? 'text-sucesso-forte' : 'text-perigo'}`}>Total: {(somaMacros / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p>
                    </div>
                    <label className="flex min-h-11 items-start gap-3 rounded-md border border-linha p-3 text-sm text-tinta">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-primaria" checked={formulario.aplicabilidadeFormulaConfirmada} onChange={(evento) => atualizar((atual) => ({ ...atual, aplicabilidadeFormulaConfirmada: evento.target.checked }))} />
                      <span>Revisei os dados da avaliacao e confirmo a aplicabilidade da formula para este paciente.</span>
                    </label>
                    <label className="flex min-h-11 items-start gap-3 rounded-md border border-linha p-3 text-sm text-tinta">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-primaria" checked={formulario.possuiCondicaoEspecial} onChange={(evento) => atualizar((atual) => ({ ...atual, possuiCondicaoEspecial: evento.target.checked }))} />
                      <span>O paciente possui condicao especial que exige justificativa clinica.</span>
                    </label>
                    {formulario.possuiCondicaoEspecial ? <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Justificativa da condicao especial<AreaTexto value={formulario.justificativaCondicaoEspecial} onChange={(evento) => atualizar((atual) => ({ ...atual, justificativaCondicaoEspecial: evento.target.value }))} maxLength={2000} required /></label> : null}
                    {formulario.possuiCondicaoEspecial ? <AlertaOperacional mensagem="O calculo automatico deste MVP nao atende condicoes especiais. Registre a justificativa e use uma conduta individual fora deste fluxo." /> : null}
                  </fieldset>

                  <fieldset className="grid gap-3 rounded-md border border-linha bg-white p-4">
                    <legend className="px-1 text-sm font-semibold text-tinta">Conduta</legend>
                    <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Objetivo clinico<AreaTexto value={formulario.objetivos} onChange={(evento) => atualizar((atual) => ({ ...atual, objetivos: evento.target.value }))} maxLength={4000} required /></label>
                    <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Observacoes para o plano<AreaTexto value={formulario.observacoes} onChange={(evento) => atualizar((atual) => ({ ...atual, observacoes: evento.target.value }))} maxLength={8000} /></label>
                  </fieldset>

                  <div className="grid gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><h3 className="text-base font-semibold text-tinta">Refeicoes e alimentos</h3><p className="text-sm text-texto-suave">A composicao selecionada e congelada quando a versao e publicada.</p></div>
                      <Botao type="button" onClick={() => atualizar((atual) => ({ ...atual, refeicoes: [...atual.refeicoes, novaRefeicao()] }))}><Plus size={16} /> Adicionar refeicao</Botao>
                    </div>
                    {formulario.refeicoes.map((refeicao, indiceRefeicao) => (
                      <section key={refeicao.chaveCliente} className="grid gap-4 rounded-md border border-linha bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-tinta">Refeicao {indiceRefeicao + 1}</h4>
                          <div className="flex flex-wrap gap-1">
                            <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11 min-w-11" onClick={() => atualizar((atual) => ({ ...atual, refeicoes: mover(atual.refeicoes, indiceRefeicao, indiceRefeicao - 1) }))} disabled={indiceRefeicao === 0} aria-label="Mover refeicao para cima"><ArrowUp size={15} /></Botao>
                            <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11 min-w-11" onClick={() => atualizar((atual) => ({ ...atual, refeicoes: mover(atual.refeicoes, indiceRefeicao, indiceRefeicao + 1) }))} disabled={indiceRefeicao === formulario.refeicoes.length - 1} aria-label="Mover refeicao para baixo"><ArrowDown size={15} /></Botao>
                            <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11" onClick={() => atualizar((atual) => ({ ...atual, refeicoes: atual.refeicoes.filter((_, posicao) => posicao !== indiceRefeicao) }))} disabled={formulario.refeicoes.length === 1}><Trash2 size={15} /> Remover</Botao>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Nome da refeicao<Campo value={refeicao.nome} onChange={(evento) => atualizarRefeicao(indiceRefeicao, { ...refeicao, nome: evento.target.value })} maxLength={180} required /></label>
                          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Horario<Campo type="time" value={refeicao.horarioLocal ?? ''} onChange={(evento) => atualizarRefeicao(indiceRefeicao, { ...refeicao, horarioLocal: evento.target.value })} /></label>
                        </div>
                        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Orientacoes da refeicao<AreaTexto value={refeicao.orientacoes ?? ''} onChange={(evento) => atualizarRefeicao(indiceRefeicao, { ...refeicao, orientacoes: evento.target.value })} maxLength={2000} /></label>
                        <div className="grid gap-3">
                          {refeicao.itens.map((item, indiceItem) => (
                            <EditorItem
                              key={item.chaveCliente}
                              pacienteId={pacienteId}
                              item={item}
                              indice={indiceItem}
                              total={refeicao.itens.length}
                              aoAlterar={(novo) => atualizarRefeicao(indiceRefeicao, { ...refeicao, itens: refeicao.itens.map((atual, posicao) => posicao === indiceItem ? novo : atual) })}
                              aoRemover={() => atualizarRefeicao(indiceRefeicao, { ...refeicao, itens: refeicao.itens.filter((_, posicao) => posicao !== indiceItem) })}
                              aoMover={(destino) => atualizarRefeicao(indiceRefeicao, { ...refeicao, itens: mover(refeicao.itens, indiceItem, destino) })}
                            />
                          ))}
                          <Botao type="button" onClick={() => atualizarRefeicao(indiceRefeicao, { ...refeicao, itens: [...refeicao.itens, novoItem()] })}><Plus size={16} /> Adicionar alimento</Botao>
                        </div>
                      </section>
                    ))}
                  </div>

                  {plano.draft.calculo ? (
                    <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
                      <div><h3 className="text-sm font-semibold text-tinta">Resultado calculado</h3><p className="text-sm text-texto-suave">{plano.draft.calculo.estimativa.aviso}</p></div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div><p className="text-xs text-texto-suave">Repouso estimado</p><p className="text-lg font-semibold text-tinta">{formatarNumero(plano.draft.calculo.estimativa.metabolismoRepousoKcal)} kcal</p></div>
                        <div><p className="text-xs text-texto-suave">GET estimado</p><p className="text-lg font-semibold text-tinta">{formatarNumero(plano.draft.calculo.estimativa.gastoEnergeticoTotalKcal)} kcal</p></div>
                        <div><p className="text-xs text-texto-suave">Meta ajustada</p><p className="text-lg font-semibold text-tinta">{formatarNumero(plano.draft.calculo.metaEnergeticaKcal)} kcal</p></div>
                        <div><p className="text-xs text-texto-suave">Total das refeicoes</p><p className="text-lg font-semibold text-tinta">{formatarNumero(plano.draft.totais?.energiaKcal)} kcal</p></div>
                      </div>
                      {plano.draft.calculo.alertasDivergenciaClinica?.length ? (
                        <div className="grid gap-3 rounded-md border border-alerta-borda bg-alerta-suave p-3">
                          <div>
                            <p className="text-sm font-semibold text-alerta-forte">Divergencias que exigem revisao clinica</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-alerta-forte">
                              {plano.draft.calculo.alertasDivergenciaClinica.map((alerta) => <li key={alerta}>{alerta}</li>)}
                            </ul>
                          </div>
                          <label className="grid gap-1 text-xs font-semibold uppercase text-alerta-forte">
                            Justificativa clinica para prosseguir
                            <AreaTexto
                              value={formulario.justificativaDivergenciaClinica}
                              onChange={(evento) => atualizar((atual) => ({ ...atual, justificativaDivergenciaClinica: evento.target.value }))}
                              minLength={10}
                              maxLength={2000}
                              required
                            />
                          </label>
                        </div>
                      ) : null}
                      <details className="text-sm text-texto-suave"><summary className="cursor-pointer font-medium text-tinta">Formula e fonte</summary><p className="mt-2">{plano.draft.calculo.estimativa.formulaAplicada}</p><p className="mt-1">{plano.draft.calculo.estimativa.fonte}</p></details>
                    </section>
                  ) : null}

                  <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-2 rounded-md border border-linha bg-white p-3 shadow-cartao">
                    <Botao type="submit" variante="primario" carregando={operacao === 'salvando'} disabled={Boolean(operacao)}><Save size={16} /> Salvar rascunho</Botao>
                    <Botao type="button" carregando={operacao === 'revisando'} disabled={alterado || Boolean(operacao) || !plano.draft.calculo} onClick={() => void executar('revisando', () => revisarPlanoAlimentar(pacienteId, plano.id), 'Plano revisado. Confira a versao antes de publicar.')}><ClipboardCheck size={16} /> Revisar</Botao>
                    <Botao type="button" variante="primario" carregando={operacao === 'publicando'} disabled={alterado || Boolean(operacao) || !plano.draft.revisadaEm} onClick={() => void executar('publicando', () => publicarPlanoAlimentar(pacienteId, plano.id), 'Plano publicado para o paciente.')}><CheckCircle2 size={16} /> Publicar</Botao>
                  </div>
                </form>
              ) : (
                <EstadoVazio titulo="Nenhum rascunho ativo" descricao="Crie uma nova versao a partir do plano publicado para continuar a edicao." acao={plano.current ? <Botao type="button" variante="primario" carregando={operacao === 'nova-versao'} onClick={() => void executar('nova-versao', () => criarNovaVersaoPlanoAlimentar(pacienteId, plano.id), 'Nova versao criada a partir da publicacao atual.')}><Plus size={16} /> Criar nova versao</Botao> : undefined} />
              )) : (
                <div className="grid gap-4">
                  <div role="status" className="rounded-md border border-linha bg-superficie px-4 py-3 text-sm text-texto-suave">
                    Acesso somente para consulta. A edicao e a publicacao dependem da permissao de gestao de planos alimentares.
                  </div>
                  {plano.current || plano.draft ? (
                    <ResumoVersao plano={plano} versao={plano.current ?? plano.draft!} />
                  ) : (
                    <EstadoVazio titulo="Plano sem versao disponivel" descricao="Nao ha conteudo clinico disponivel para consulta neste plano." />
                  )}
                </div>
              )}

              {plano.historico.length ? (
                <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
                  <div className="flex items-center gap-2"><History size={17} className="text-primaria" /><h3 className="text-sm font-semibold text-tinta">Historico de versoes</h3></div>
                  <div className="grid gap-2">
                    {plano.historico.map((versao) => <div key={versao.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-2 first:border-t-0 first:pt-0"><div><p className="text-sm font-medium text-tinta">Versao {versao.numero}</p><p className="text-xs text-texto-suave">{versao.status === 'publicada' ? `Publicada em ${formatarData(versao.publicadaEm)}` : `Descartada em ${formatarData(versao.descartadaEm)}`}</p></div>{versao.hashConteudo ? <span className="max-w-48 truncate font-mono text-xs text-texto-suave" title={versao.hashConteudo}>{versao.hashConteudo}</span> : null}</div>)}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </main>
      </div>

      {podeGerenciar && plano?.current ? <ResumoVersao plano={plano} versao={plano.current} /> : null}

      {podeGerenciar ? <ModalConfirmacao
        aberto={confirmarCriacao}
        titulo="Criar outro plano"
        mensagem="Existem alteracoes nao salvas no rascunho atual. Criar outro plano descartara essas alteracoes."
        rotuloConfirmar="Descartar e criar"
        confirmando={operacao === 'criando'}
        aoCancelar={() => setConfirmarCriacao(false)}
        aoConfirmar={() => {
          setConfirmarCriacao(false);
          void criar();
        }}
      /> : null}

      {podeGerenciar ? <ModalConfirmacao
        aberto={confirmarArquivo}
        titulo="Arquivar plano alimentar"
        mensagem="O plano deixara a lista ativa. As versoes publicadas permanecem preservadas no historico clinico."
        rotuloConfirmar="Arquivar plano"
        confirmando={operacao === 'arquivando'}
        aoCancelar={() => setConfirmarArquivo(false)}
        aoConfirmar={() => {
          if (!plano) return;
          void executar('arquivando', () => arquivarPlanoAlimentar(pacienteId, plano.id), 'Plano alimentar arquivado.', '').finally(() => setConfirmarArquivo(false));
        }}
      /> : null}
    </div>
  );
}
