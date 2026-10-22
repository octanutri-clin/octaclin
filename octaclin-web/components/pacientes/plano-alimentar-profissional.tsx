'use client';

import { type Dispatch, type SetStateAction, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
  Star,
  Trash2,
  Utensils
} from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoSubtitulo, CartaoTitulo } from '@/components/ui/cartao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { RefeicaoOrdenavel } from '@/components/pacientes/refeicao-ordenavel';
import { AvisoEdicaoAbasPlano } from '@/components/pacientes/aviso-edicao-abas-plano';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import { useProtecaoAlteracoesNaoSalvas } from '@/lib/usar-protecao-alteracoes-nao-salvas';
import {
  arquivarPlanoAlimentar,
  alterarAtivacaoPlanoAlimentar,
  alterarAtivacaoRefeicaoPlanoAlimentar,
  buscarAlimentosPlanoAlimentar,
  alterarFavoritoAlimento,
  criarNovaVersaoPlanoAlimentar,
  criarPlanoAlimentar,
  ErroApiPlanoAlimentar,
  listarPlanosAlimentares,
  obterAcompanhamentoVersaoPlanoAlimentar,
  obterApresentacaoPacientePlano,
  obterPlanoAlimentar,
  obterVersaoPlanoAlimentar,
  publicarPlanoAlimentar,
  revisarPlanoAlimentar,
  salvarEdicaoPlanoAlimentar,
  type AlimentoComposicaoApi,
  type AlimentoPersonalizadoApi,
  type AcompanhamentoVersaoPlanoApi,
  type ApresentacaoPacientePlanoApi,
  type FonteCatalogoApi,
  type FormulaEnergeticaApi,
  type ItemPlanoAlimentarEntrada,
  type MetodoMacrosManualApi,
  type NutrientesPor100gApi,
  type PlanoAlimentarApi,
  type PlanoAlimentarResumoApi,
  type SelecaoCalculoLocal,
  type ResumoNutricionalPlanoApi,
  type RefeicaoPlanoAlimentarEntrada,
  type SubstituicaoPlanoAlimentarEntrada,
  type VersaoPlanoAlimentarApi
} from '@/lib/plano-alimentar-api';
import type { MedidaCaseiraAplicadaApi, MedidaCaseiraReferenciaApi } from '@/lib/medidas-caseiras-plano';
import { calcularPesoMedidaCaseira } from '@/lib/medidas-caseiras-plano';
import {
  listarAvaliacoesAntropometricas,
  type AvaliacaoAntropometricaApi
} from '@/lib/prontuario-api';
import { PainelNutricional } from '@/components/pacientes/painel-nutricional';
import { calcularSubtotalRefeicao } from '@/lib/nutricao-plano';
import { useCoordenacaoAbasPlano } from '@/lib/usar-coordenacao-abas-plano';
import { CoordenadorEdicaoPlano, type EstadoSalvamentoPlano, type PrecondicaoEdicaoPlano } from '@/lib/coordenador-edicao-plano';
import { LIMITE_BYTES_DOCUMENTO_EDICAO, campoNumeroEdicao as valorNumericoEdicao, percentualParaBasisPointsEdicao, interpretarNumeroEdicao, micronutrientesNumericosEdicao, nutrientesNumericosEdicao, serializarAlimentoPersonalizadoEdicao, validarMicronutrientesEdicao, type DocumentoEdicaoPlano, type MicronutrientesEdicao, type NutrientesEdicao } from '@/lib/edicao-plano';
import { CAMPOS_MICRONUTRIENTES_PLANO } from '@/lib/micronutrientes-plano';
import { aplicarAckAtivacao, localizarAtivacaoRefeicao, mesclarProjecaoAtivacao } from '@/lib/ativacao-plano';
import { DuplicarPlanoDeOutroPaciente } from '@/components/pacientes/duplicar-plano-de-outro-paciente';
import { ModelosPlanoAlimentar } from '@/components/pacientes/modelos-plano-alimentar';
import { BibliotecaReceitasNutricionais } from '@/components/pacientes/biblioteca-receitas-nutricionais';
import { CopiarRefeicaoDePlano } from '@/components/pacientes/copiar-refeicao-de-plano';
import { PreferenciasApresentacaoPlano } from '@/components/pacientes/preferencias-apresentacao-plano';
import { CalculoCombinadoPlanos } from '@/components/pacientes/calculo-combinado-planos';
import { MedidasCaseirasAlimento } from '@/components/pacientes/medidas-caseiras-alimento';
import { AlimentosPersonalizados } from '@/components/pacientes/alimentos-personalizados';
import { novasPreferenciasApresentacaoPlano, type PreferenciasApresentacaoPlanoApi, type PreferenciasExibicaoRefeicoesApi } from '@/lib/preferencias-apresentacao-plano';
import { PlanoAlimentarPaciente } from '@/components/portal/plano-alimentar-paciente';
import {
  LIMITE_REFEICOES_PLANO,
  acrescentarItensDeRefeicao,
  duplicarRefeicaoNoRascunho,
  type RefeicaoFormularioCopia
} from '@/lib/copia-refeicoes-plano';

const nutrientesVazios: NutrientesPor100gApi = {
  energiaKcal: 0,
  proteinasG: 0,
  carboidratosG: 0,
  gordurasG: 0
};
const LIMITE_PLANOS_LISTA = 25;

type NumeroFormulario = number | string;

interface OrigemComposicaoPersonalizadaFormulario {
  baseOrigem?: { tipo: 'por100g' | 'porcao'; pesoGramas: number };
  composicaoOrigem?: { nutrientes: Partial<NutrientesPor100gApi>; micronutrientes: Record<string, number> };
  baseGramas?: number;
  nutrientes?: Partial<NutrientesPor100gApi>;
  micronutrientes?: Record<string, number>;
  normalizacaoVersao?: string;
  referencia?: string;
}

interface AlimentoFormulario extends Omit<SubstituicaoPlanoAlimentarEntrada, 'nutrientesPor100g' | 'micronutrientesPor100g' | 'quantidade' | 'porcaoGramas'> {
  quantidade: NumeroFormulario;
  porcaoGramas: NumeroFormulario;
  chaveCliente: string;
  descricao: string;
  nutrientesPor100g: NutrientesEdicao;
  micronutrientesPor100g?: MicronutrientesEdicao;
  fonteRotulo?: string;
  medidaCaseira?: MedidaCaseiraAplicadaApi | null;
  referenciaMedidaCaseira?: MedidaCaseiraReferenciaApi;
  alimentoPersonalizado?: DocumentoEdicaoPlano['refeicoes'][number]['itens'][number]['alimentoPersonalizado'];
  origemComposicaoPersonalizada?: OrigemComposicaoPersonalizadaFormulario;
}

interface AlternativaFormulario extends AlimentoFormulario {
  liberadaParaPaciente: boolean;
  preferida: boolean;
}

interface ItemFormulario extends AlimentoFormulario {
  substituicoes: AlternativaFormulario[];
  substituicoesVisiveisInicialmente?: NumeroFormulario;
}

interface RefeicaoFormulario extends Omit<RefeicaoPlanoAlimentarEntrada, 'itens'> {
  chaveCliente: string;
  itens: ItemFormulario[];
}

interface FormularioPlano {
  avaliacaoAntropometricaId: string;
  formula: FormulaEnergeticaApi | '';
  fatorAtividade: NumeroFormulario;
  ajusteEnergeticoKcal: NumeroFormulario;
  carboidratosBasisPoints: NumeroFormulario;
  proteinasBasisPoints: NumeroFormulario;
  gordurasBasisPoints: NumeroFormulario;
  percentuaisMacrosEdicao?: DocumentoEdicaoPlano['percentuaisMacrosEdicao'];
  possuiCondicaoEspecial: boolean;
  aplicabilidadeFormulaConfirmada: boolean;
  justificativaCondicaoEspecial: string;
  metodoMacrosManual: MetodoMacrosManualApi | '';
  metaEnergeticaManualKcal: NumeroFormulario;
  carboidratosGPorKg: NumeroFormulario;
  proteinasGPorKg: NumeroFormulario;
  gordurasGPorKg: NumeroFormulario;
  justificativaDivergenciaClinica: string;
  objetivos: string;
  observacoes: string;
  preferenciasApresentacao: PreferenciasApresentacaoPlanoApi;
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
    nutrientesPor100g: { ...nutrientesVazios },
    micronutrientesPor100g: {}
  };
}

// Alternativa nova nasce fechada: liberar ao paciente e decisao explicita, e
// nao um efeito colateral de adicionar uma linha.
function novaAlternativa(): AlternativaFormulario {
  return { ...novoAlimento(), liberadaParaPaciente: false, preferida: false };
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
    metodoMacrosManual: 'percentual',
    metaEnergeticaManualKcal: 2000,
    carboidratosGPorKg: 3,
    proteinasGPorKg: 1.2,
    gordurasGPorKg: 1,
    justificativaDivergenciaClinica: '',
    objetivos: '',
    observacoes: '',
    preferenciasApresentacao: novasPreferenciasApresentacaoPlano(),
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
    porcaoGramas: interpretarNumeroEdicao(alimento.porcaoGramas) ?? 0,
    nutrientesPor100g: { ...alimento.composicaoSnapshot.nutrientesPor100g },
    micronutrientesPor100g: alimento.alimentoComposicaoId ? undefined : Object.fromEntries(Object.entries(alimento.composicaoSnapshot.micronutrientes?.nutrientes ?? {}).flatMap(([codigo, valor]) => valor.estado === 'conhecido' && valor.por100g !== undefined ? [[codigo, valor.por100g]] : [])),
    fonteRotulo: alimento.composicaoSnapshot.origem === 'custom' ? 'Alimento personalizado' : alimento.composicaoSnapshot.fonte
      ? `${alimento.composicaoSnapshot.fonte.nome} - ${alimento.composicaoSnapshot.fonte.versao}`
      : undefined,
    origemComposicaoPersonalizada: alimento.composicaoSnapshot.composicaoInformada
  };
  if ('substituicoes' in alimento) {
    return {
      ...base,
      substituicoes: alimento.substituicoes.map((substituicao) => ({
        ...alimentoDaVersao(substituicao),
        liberadaParaPaciente: substituicao.liberadaParaPaciente === true,
        preferida: substituicao.preferida === true
      })),
      substituicoesVisiveisInicialmente: alimento.substituicoesVisiveisInicialmente
    };
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
    // Ausente quando o plano foi feito em g/kg: volta para o padrao percentual.
    carboidratosBasisPoints: calculo?.distribuicaoMacros?.carboidratosBasisPoints ?? 5000,
    proteinasBasisPoints: calculo?.distribuicaoMacros?.proteinasBasisPoints ?? 2000,
    gordurasBasisPoints: calculo?.distribuicaoMacros?.gordurasBasisPoints ?? 3000,
    possuiCondicaoEspecial: calculo?.possuiCondicaoEspecial ?? false,
    aplicabilidadeFormulaConfirmada: calculo?.aplicabilidadeFormulaConfirmada ?? false,
    justificativaCondicaoEspecial: calculo?.justificativaCondicaoEspecial ?? '',
    metodoMacrosManual: calculo?.metodoMacrosManual ?? 'percentual',
    metaEnergeticaManualKcal:
      calculo?.origemMeta === 'manual' ? (calculo.metaEnergeticaKcal ?? 2000) : 2000,
    carboidratosGPorKg: calculo?.macrosGramasPorKg?.carboidratosGPorKg ?? 3,
    proteinasGPorKg: calculo?.macrosGramasPorKg?.proteinasGPorKg ?? 1.2,
    gordurasGPorKg: calculo?.macrosGramasPorKg?.gordurasGPorKg ?? 1,
    justificativaDivergenciaClinica: calculo?.justificativaDivergenciaClinica ?? '',
    objetivos: versao.objetivos ?? '',
    observacoes: versao.observacoes ?? '',
    preferenciasApresentacao: versao.preferenciasApresentacao ?? novasPreferenciasApresentacaoPlano(),
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

function nutrientesCompletos(valores: NutrientesEdicao): NutrientesPor100gApi | undefined {
  const nutrientes = nutrientesNumericosEdicao(valores);
  const essenciais = ['energiaKcal', 'proteinasG', 'carboidratosG', 'gordurasG'] as const;
  if (essenciais.some((campo) => typeof nutrientes[campo] !== 'number' || !Number.isFinite(nutrientes[campo]) || nutrientes[campo]! < 0)) {
    return undefined;
  }
  return nutrientes as NutrientesPor100gApi;
}

// Modelo guarda o item completo, e nao a entrada minima de `entradaAlimento`:
// para item de catalogo aquela omite descricao e nutrientes, e o modelo
// aplicado apareceria com a linha sem rotulo ate ser salvo.
function alimentoParaModelo(alimento: AlimentoFormulario): SubstituicaoPlanoAlimentarEntrada {
  return {
    alimentoComposicaoId: alimento.alimentoComposicaoId,
    descricao: alimento.descricao.trim(),
    quantidade: interpretarNumeroEdicao(alimento.quantidade) ?? 0,
    unidade: alimento.unidade.trim(),
    porcaoGramas: interpretarNumeroEdicao(alimento.porcaoGramas) ?? 0,
    ...(nutrientesCompletos(alimento.nutrientesPor100g)
      ? { nutrientesPor100g: nutrientesCompletos(alimento.nutrientesPor100g) }
      : {}),
    ...(!alimento.alimentoComposicaoId && Object.keys(micronutrientesNumericosEdicao(alimento.micronutrientesPor100g)).length
      ? { micronutrientesPor100g: micronutrientesNumericosEdicao(alimento.micronutrientesPor100g) }
      : {})
  };
}

function validarMicronutrientesFormulario(formulario: FormularioPlano, chaveRefeicao?: string) {
  const refeicoes = chaveRefeicao
    ? formulario.refeicoes.filter(refeicao => refeicao.chaveCliente === chaveRefeicao)
    : formulario.refeicoes;
  for (const refeicao of refeicoes) for (const item of refeicao.itens) {
    if (!item.alimentoComposicaoId) validarMicronutrientesEdicao(item.micronutrientesPor100g);
    for (const alternativa of item.substituicoes) if (!alternativa.alimentoComposicaoId) validarMicronutrientesEdicao(alternativa.micronutrientesPor100g);
  }
}

function refeicoesParaModelo(formulario: FormularioPlano): RefeicaoPlanoAlimentarEntrada[] {
  validarMicronutrientesFormulario(formulario);
  return formulario.refeicoes.map((refeicao) => ({
    nome: refeicao.nome.trim(),
    horarioLocal: refeicao.horarioLocal || undefined,
    orientacoes: refeicao.orientacoes?.trim() || undefined,
    itens: refeicao.itens.map((item) => ({
      ...alimentoParaModelo(item),
      substituicoes: item.substituicoes.map((substituicao) => ({
        ...alimentoParaModelo(substituicao),
        liberadaParaPaciente: substituicao.liberadaParaPaciente,
        preferida: substituicao.preferida
      })),
      substituicoesVisiveisInicialmente: interpretarNumeroEdicao(item.substituicoesVisiveisInicialmente)
    }))
  }));
}

function alimentoDoModelo(entrada: SubstituicaoPlanoAlimentarEntrada): AlimentoFormulario {
  return {
    chaveCliente: novaChaveCliente('alimento'),
    alimentoComposicaoId: entrada.alimentoComposicaoId,
    descricao: entrada.descricao ?? '',
    quantidade: entrada.quantidade,
    unidade: entrada.unidade,
    porcaoGramas: entrada.porcaoGramas,
    nutrientesPor100g: { ...(entrada.nutrientesPor100g ?? {}) },
    micronutrientesPor100g: entrada.alimentoComposicaoId ? undefined : { ...(entrada.micronutrientesPor100g ?? {}) },
    fonteRotulo: entrada.alimentoComposicaoId ? 'Catalogo nutricional' : undefined
  };
}

function refeicoesDoModelo(refeicoes: RefeicaoPlanoAlimentarEntrada[]): RefeicaoFormulario[] {
  return refeicoes.map((refeicao) => ({
    chaveCliente: novaChaveCliente('refeicao'),
    nome: refeicao.nome,
    horarioLocal: refeicao.horarioLocal?.slice(0, 5) ?? '',
    orientacoes: refeicao.orientacoes ?? '',
    itens: refeicao.itens.map((item) => ({
      ...alimentoDoModelo(item),
      substituicoes: (item.substituicoes ?? []).map((substituicao) => ({
        ...alimentoDoModelo(substituicao),
        liberadaParaPaciente: substituicao.liberadaParaPaciente === true,
        preferida: substituicao.preferida === true
      })),
      substituicoesVisiveisInicialmente: interpretarNumeroEdicao(item.substituicoesVisiveisInicialmente)
    }))
  }));
}

function itensDaBiblioteca(itens: ItemPlanoAlimentarEntrada[]): ItemFormulario[] {
  return itens.map((item) => ({
    ...alimentoDoModelo(item),
    substituicoes: (item.substituicoes ?? []).map((substituicao) => ({
      ...alimentoDoModelo(substituicao),
      liberadaParaPaciente: substituicao.liberadaParaPaciente === true,
      preferida: substituicao.preferida === true
    })),
    substituicoesVisiveisInicialmente: interpretarNumeroEdicao(item.substituicoesVisiveisInicialmente)
  }));
}

function itensParaBiblioteca(itens: ItemFormulario[]): ItemPlanoAlimentarEntrada[] {
  return itens.map((item) => ({
    ...alimentoParaModelo(item),
    substituicoes: item.substituicoes.map((substituicao) => ({
      ...alimentoParaModelo(substituicao),
      liberadaParaPaciente: substituicao.liberadaParaPaciente,
      preferida: substituicao.preferida
    })),
    substituicoesVisiveisInicialmente: item.substituicoes.length
      ? interpretarNumeroEdicao(item.substituicoesVisiveisInicialmente)
      : undefined
  }));
}

function documentoDoFormulario(formulario: FormularioPlano): DocumentoEdicaoPlano {
  return {
    schemaVersao: 1,
    avaliacaoAntropometricaId: formulario.avaliacaoAntropometricaId || null,
    formula: formulario.formula,
    fatorAtividade: formulario.fatorAtividade,
    ajusteEnergeticoKcal: formulario.ajusteEnergeticoKcal,
    carboidratosBasisPoints: formulario.carboidratosBasisPoints,
    proteinasBasisPoints: formulario.proteinasBasisPoints,
    gordurasBasisPoints: formulario.gordurasBasisPoints,
    percentuaisMacrosEdicao: formulario.percentuaisMacrosEdicao,
    possuiCondicaoEspecial: formulario.possuiCondicaoEspecial,
    aplicabilidadeFormulaConfirmada: formulario.aplicabilidadeFormulaConfirmada,
    justificativaCondicaoEspecial: formulario.justificativaCondicaoEspecial,
    metodoMacrosManual: formulario.metodoMacrosManual,
    metaEnergeticaManualKcal: formulario.metaEnergeticaManualKcal,
    carboidratosGPorKg: formulario.carboidratosGPorKg,
    proteinasGPorKg: formulario.proteinasGPorKg,
    gordurasGPorKg: formulario.gordurasGPorKg,
    justificativaDivergenciaClinica: formulario.justificativaDivergenciaClinica,
    objetivos: formulario.objetivos,
    observacoes: formulario.observacoes,
    preferenciasApresentacao: formulario.preferenciasApresentacao,
    refeicoes: formulario.refeicoes.map((refeicao) => ({
      chaveCliente: refeicao.chaveCliente,
      nome: refeicao.nome,
      horarioLocal: refeicao.horarioLocal,
      orientacoes: refeicao.orientacoes,
      itens: refeicao.itens.map((item) => ({
        chaveCliente: item.chaveCliente,
        alimentoComposicaoId: item.alimentoComposicaoId,
        alimentoPersonalizado: serializarAlimentoPersonalizadoEdicao(item.alimentoPersonalizado),
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        porcaoGramas: item.porcaoGramas,
        nutrientesPor100g: item.nutrientesPor100g,
        micronutrientesPor100g: item.alimentoComposicaoId ? undefined : item.micronutrientesPor100g,
        fonteRotulo: item.fonteRotulo,
        medidaCaseira: item.medidaCaseira,
        substituicoes: item.substituicoes.map((alternativa) => ({
          chaveCliente: alternativa.chaveCliente,
          alimentoComposicaoId: alternativa.alimentoComposicaoId,
          alimentoPersonalizado: serializarAlimentoPersonalizadoEdicao(alternativa.alimentoPersonalizado),
          descricao: alternativa.descricao,
          quantidade: alternativa.quantidade,
          unidade: alternativa.unidade,
          porcaoGramas: alternativa.porcaoGramas,
          nutrientesPor100g: alternativa.nutrientesPor100g,
          micronutrientesPor100g: alternativa.alimentoComposicaoId ? undefined : alternativa.micronutrientesPor100g,
          fonteRotulo: alternativa.fonteRotulo,
          liberadaParaPaciente: alternativa.liberadaParaPaciente,
          preferida: alternativa.preferida,
          medidaCaseira: alternativa.medidaCaseira
        })),
        substituicoesVisiveisInicialmente: item.substituicoesVisiveisInicialmente
      }))
    }))
  };
}

function formularioDoDocumento(documento: DocumentoEdicaoPlano, versao: VersaoPlanoAlimentarApi, avaliacaoPadrao = ''): FormularioPlano {
  const base = formularioDaVersao(versao, avaliacaoPadrao);
  const mapearAlimento = (item: DocumentoEdicaoPlano['refeicoes'][number]['itens'][number]) => ({
    chaveCliente: item.chaveCliente || novaChaveCliente('alimento'),
    alimentoComposicaoId: item.alimentoComposicaoId ?? undefined,
    alimentoPersonalizado: serializarAlimentoPersonalizadoEdicao(item.alimentoPersonalizado),
    descricao: item.descricao ?? '',
    quantidade: valorNumericoEdicao(item.quantidade),
    unidade: item.unidade ?? '',
    porcaoGramas: valorNumericoEdicao(item.porcaoGramas),
    nutrientesPor100g: Object.fromEntries(Object.entries(item.nutrientesPor100g ?? {}).map(([campo, valor]) => [campo, valorNumericoEdicao(valor)])),
    micronutrientesPor100g: item.alimentoComposicaoId ? undefined : Object.fromEntries(Object.entries(item.micronutrientesPor100g ?? {}).map(([campo, valor]) => [campo, valorNumericoEdicao(valor)])),
    fonteRotulo: item.alimentoPersonalizado ? 'Alimento personalizado' : item.fonteRotulo,
    origemComposicaoPersonalizada: item.alimentoPersonalizado
      ? versao.alimentosPersonalizadosAplicados?.[item.chaveCliente]
      : undefined,
    medidaCaseira: item.medidaCaseira,
    referenciaMedidaCaseira: versao.medidasCaseirasAplicadas?.[item.chaveCliente]
  });
  return {
    ...base,
    avaliacaoAntropometricaId: documento.avaliacaoAntropometricaId ?? '',
    formula: documento.formula ?? '',
    fatorAtividade: valorNumericoEdicao(documento.fatorAtividade),
    ajusteEnergeticoKcal: valorNumericoEdicao(documento.ajusteEnergeticoKcal),
    carboidratosBasisPoints: valorNumericoEdicao(documento.carboidratosBasisPoints),
    proteinasBasisPoints: valorNumericoEdicao(documento.proteinasBasisPoints),
    gordurasBasisPoints: valorNumericoEdicao(documento.gordurasBasisPoints),
    percentuaisMacrosEdicao: documento.percentuaisMacrosEdicao,
    possuiCondicaoEspecial: documento.possuiCondicaoEspecial ?? false,
    aplicabilidadeFormulaConfirmada: documento.aplicabilidadeFormulaConfirmada ?? false,
    justificativaCondicaoEspecial: documento.justificativaCondicaoEspecial ?? '',
    metodoMacrosManual: documento.metodoMacrosManual ?? '',
    metaEnergeticaManualKcal: valorNumericoEdicao(documento.metaEnergeticaManualKcal),
    carboidratosGPorKg: valorNumericoEdicao(documento.carboidratosGPorKg),
    proteinasGPorKg: valorNumericoEdicao(documento.proteinasGPorKg),
    gordurasGPorKg: valorNumericoEdicao(documento.gordurasGPorKg),
    justificativaDivergenciaClinica: documento.justificativaDivergenciaClinica ?? '',
    objetivos: documento.objetivos ?? '',
    observacoes: documento.observacoes ?? '',
    preferenciasApresentacao: documento.preferenciasApresentacao ?? versao.preferenciasApresentacao ?? base.preferenciasApresentacao,
    refeicoes: documento.refeicoes.map((refeicao) => ({
      chaveCliente: refeicao.chaveCliente || novaChaveCliente('refeicao'),
      nome: refeicao.nome ?? '',
      horarioLocal: refeicao.horarioLocal ?? '',
      orientacoes: refeicao.orientacoes ?? '',
      itens: refeicao.itens.map((item) => ({
        ...mapearAlimento(item),
        substituicoes: (item.substituicoes ?? []).map((alternativa) => ({
          ...mapearAlimento(alternativa),
          liberadaParaPaciente: alternativa.liberadaParaPaciente === true,
          preferida: alternativa.preferida === true
        })),
        substituicoesVisiveisInicialmente: item.substituicoesVisiveisInicialmente == null
          ? undefined
          : valorNumericoEdicao(item.substituicoesVisiveisInicialmente)
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

function mensagemEstadoAutosave(estado: EstadoSalvamentoPlano): string {
  switch (estado) {
    case 'alterado': return 'Há alterações ainda não salvas.';
    case 'salvando': return 'Salvando o rascunho…';
    case 'erro': return 'O salvamento automático foi pausado. Use “Salvar rascunho” para tentar novamente.';
    case 'conflito': return 'A edição mudou em outra sessão. Recarregue e reconcilie o rascunho antes de continuar.';
    case 'incerto': return 'Não foi possível confirmar o salvamento. Recarregue o rascunho antes de continuar.';
    case 'acesso-negado': return 'O acesso ao rascunho foi alterado. Recarregue para confirmar as permissões.';
    case 'salvo': return 'Rascunho salvo; os resultados clínicos não foram recalculados.';
  }
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

function formatarNutrienteSubtotal(valor?: number, casas = 0) {
  return valor === undefined ? '—' : formatarNumero(valor, casas);
}

function projetarEstruturaAlimento(item: ItemFormulario) {
  const numero = (valor: unknown) => {
    if (valor === null || valor === undefined || valor === '') return null;
    const interpretado = interpretarNumeroEdicao(valor as string | number);
    return interpretado === undefined ? String(valor) : interpretado;
  };
  const projetarBase = (alimento: AlimentoFormulario) => ({
    identificacao: alimento.alimentoComposicaoId ?? alimento.descricao,
    quantidade: numero(alimento.quantidade),
    unidade: alimento.unidade,
    porcaoGramas: numero(alimento.porcaoGramas),
    medidaCaseira: alimento.medidaCaseira
  });
  return {
    ...projetarBase(item),
    substituicoes: item.substituicoes.map((substituicao) => ({
      ...projetarBase(substituicao),
      liberadaParaPaciente: substituicao.liberadaParaPaciente,
      preferida: substituicao.preferida
    }))
  };
}

function estruturasDeRefeicoesCoincidem(atual: RefeicaoFormulario[], materializada: RefeicaoFormulario[]) {
  if (atual.length !== materializada.length) return false;
  return atual.every((refeicao, indice) => {
    const salva = materializada[indice];
    if (!salva || refeicao.nome !== salva.nome || (refeicao.horarioLocal || '') !== (salva.horarioLocal || '')
      || (refeicao.orientacoes || '') !== (salva.orientacoes || '') || refeicao.itens.length !== salva.itens.length) return false;
    return refeicao.itens.every((item, indiceItem) => {
      const itemSalvo = salva.itens[indiceItem];
      if (!itemSalvo || JSON.stringify(projetarEstruturaAlimento(item)) !== JSON.stringify(projetarEstruturaAlimento(itemSalvo))) return false;
      return true;
    });
  });
}

function ResumoMacrosVersao({ rotulo, numero, resumo }: { rotulo: string; numero: number; resumo?: ResumoNutricionalPlanoApi }) {
  const metricas = [
    { nome: 'Energia', valor: resumo?.energiaKcal, unidade: 'kcal', casas: 0 },
    { nome: 'Proteínas', valor: resumo?.proteinasG, unidade: 'g', casas: 1 },
    { nome: 'Carboidratos', valor: resumo?.carboidratosG, unidade: 'g', casas: 1 },
    { nome: 'Gorduras', valor: resumo?.gordurasG, unidade: 'g', casas: 1 }
  ];
  const rotuloEstado = resumo?.estado === 'completo'
    ? 'Totais salvos dos alimentos previstos'
    : resumo?.estado === 'incompleto'
      ? 'Dados incompletos'
      : resumo?.estado === 'sem_snapshot'
        ? 'Sem resumo salvo'
        : 'Resumo indisponível';

  return (
    <div className="mt-2 rounded-md border border-linha bg-white px-3 py-2 text-xs text-tinta">
      <p className="font-semibold">{rotulo} v{numero} · Salvo</p>
      <p className="mt-1 text-texto-suave">{rotuloEstado}</p>
      <p className="mt-1 text-texto-suave">Resumo salvo da versão; pode incluir refeições atualmente ocultas. Os totais ativos aparecem no plano selecionado.</p>
      {resumo?.estado === 'completo' || resumo?.estado === 'incompleto' ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
          {metricas.map((metrica) => {
            const valorValido = typeof metrica.valor === 'number' && Number.isFinite(metrica.valor) && metrica.valor >= 0;
            return (
              <div key={metrica.nome}>
                <dt className="text-texto-suave">{metrica.nome}</dt>
                <dd className="font-medium">{valorValido ? formatarNumero(metrica.valor, metrica.casas) : '—'} {metrica.unidade}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </div>
  );
}

function resumoPorcaoAlimento(alimento: AlimentoFormulario) {
  const subtotal = calcularSubtotalRefeicao([{
    identificacao: alimento.alimentoComposicaoId || alimento.descricao,
    porcaoGramas: interpretarNumeroEdicao(alimento.porcaoGramas) ?? 0,
    nutrientesPor100g: nutrientesNumericosEdicao(alimento.nutrientesPor100g)
  }]);
  if (subtotal.estado === 'sem_alimentos') return { visual: 'Sem alimentos', acessivel: 'Sem alimentos' };
  const visual = [
    `${formatarNutrienteSubtotal(subtotal.energiaKcal)} kcal`,
    `P ${formatarNutrienteSubtotal(subtotal.proteinasG, 1)} g`,
    `C ${formatarNutrienteSubtotal(subtotal.carboidratosG, 1)} g`,
    `G ${formatarNutrienteSubtotal(subtotal.gordurasG, 1)} g`
  ];
  const acessivel = [
    `Energia: ${formatarNutrienteSubtotal(subtotal.energiaKcal)} quilocalorias`,
    `Proteínas: ${formatarNutrienteSubtotal(subtotal.proteinasG, 1)} gramas`,
    `Carboidratos: ${formatarNutrienteSubtotal(subtotal.carboidratosG, 1)} gramas`,
    `Gorduras: ${formatarNutrienteSubtotal(subtotal.gordurasG, 1)} gramas`
  ];
  if (subtotal.estado === 'incompleto') {
    visual.push('Dados incompletos');
    acessivel.push('Dados incompletos');
  }
  return { visual: visual.join(' · '), acessivel: `Porção do alimento ${alimento.descricao || 'sem nome'}: ${acessivel.join(', ')}` };
}

// A identidade de uma fonte e a tripla `(codigo, versao, baseCodigo)` — e o que
// o indice unico do backend garante. `codigo` sozinho repete: a propria fase
// modela a TBCA 7.3 como duas fontes ativas (bases BD-AIN e BD-B) com o mesmo
// codigo e a mesma versao. Filtrar so por codigo mesclaria as duas em silencio.
function identificarFonte(fonte: FonteCatalogoApi): string {
  // Serializa em JSON em vez de concatenar: nenhum delimitador escolhido a
  // mao seria comprovadamente impossivel dentro de codigo, versao ou base.
  return JSON.stringify([fonte.codigo, fonte.versao, fonte.baseCodigo ?? '']);
}

interface EditorAlimentoProps {
  pacienteId: string;
  contextoEdicao: string;
  podeEditar: boolean;
  rotulo: string;
  valor: AlimentoFormulario;
  resumo?: AlimentoFormulario;
  aoAlterar: (valor: AlimentoFormulario) => void;
  aoRemover?: () => void;
  mostrarResumo?: boolean;
}

function EditorAlimento({ pacienteId, contextoEdicao, podeEditar, rotulo, valor, resumo, aoAlterar, aoRemover, mostrarResumo = true }: EditorAlimentoProps) {
  const id = useId();
  const [busca, setBusca] = useState('');
  // Guarda a fonte escolhida, e nao a chave: assim o efeito de busca depende so
  // da escolha do profissional e nunca de `fontes`, que ele proprio preenche —
  // o que o faria disparar a si mesmo em laco.
  const [fonteSelecionada, setFonteSelecionada] = useState<FonteCatalogoApi | null>(null);
  const [resultados, setResultados] = useState<AlimentoComposicaoApi[]>([]);
  const [fontes, setFontes] = useState<FonteCatalogoApi[]>([]);
  const [total, setTotal] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [favoritosEmAtualizacao, setFavoritosEmAtualizacao] = useState<Set<string>>(new Set());

  async function alternarFavorito(alimento: AlimentoComposicaoApi) {
    const novoEstado = !alimento.favorito;
    setFavoritosEmAtualizacao((atual) => new Set(atual).add(alimento.id));
    setErroBusca(null);
    try {
      await alterarFavoritoAlimento('catalogo', alimento.id, novoEstado);
      setResultados((atuais) => atuais
        .map((item) => item.id === alimento.id ? { ...item, favorito: novoEstado } : item)
        .sort((a, b) => Number(b.favorito === true) - Number(a.favorito === true)));
    } catch (erro) {
      setErroBusca(mensagemFalhaInterface(erro, 'Não foi possível atualizar o favorito.'));
    } finally {
      setFavoritosEmAtualizacao((atual) => { const proximo = new Set(atual); proximo.delete(alimento.id); return proximo; });
    }
  }

  useEffect(() => {
    if (busca.trim().length < 2) {
      setResultados([]);
      setTotal(0);
      setErroBusca(null);
      return;
    }
    const controle = new AbortController();
    const temporizador = window.setTimeout(async () => {
      setBuscando(true);
      setErroBusca(null);
      try {
        const pagina = await buscarAlimentosPlanoAlimentar(
          pacienteId,
          {
            busca: busca.trim(),
            pagina: 1,
            limite: 50,
            // Os tres campos vao juntos: mandar so o codigo devolveria todas as
            // versoes e bases daquela fonte misturadas num resultado unico.
            fonteCodigo: fonteSelecionada?.codigo,
            versao: fonteSelecionada?.versao,
            baseCodigo: fonteSelecionada?.baseCodigo
          },
          controle.signal
        );
        setResultados(pagina.itens);
        setTotal(pagina.total);
        // As fontes ativas vem junto do resultado e independem do filtro
        // aplicado, entao o seletor nao se esvazia ao filtrar.
        setFontes(pagina.fontes);
        // Se a fonte escolhida saiu das ativas (foi suspensa ou revogada), o
        // filtro e descartado. Manter valeria um recorte que o seletor nao
        // consegue mais exibir nem limpar.
        setFonteSelecionada((atual) =>
          atual && !pagina.fontes.some((fonte) => identificarFonte(fonte) === identificarFonte(atual))
            ? null
            : atual
        );
      } catch (erro) {
        if (!controle.signal.aborted) {
          setErroBusca(mensagemFalhaInterface(erro, 'Não foi possível buscar os alimentos.'));
        }
      } finally {
        if (!controle.signal.aborted) setBuscando(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(temporizador);
      controle.abort();
    };
  }, [busca, fonteSelecionada, pacienteId]);

  function selecionar(alimento: AlimentoComposicaoApi) {
    if (!alimento.nutrientesPor100g || !alimento.disponivelParaCalculo) return;
    aoAlterar({
      ...valor,
      alimentoComposicaoId: alimento.id,
      alimentoPersonalizado: null,
      descricao: alimento.preparacao ? `${alimento.nome}, ${alimento.preparacao}` : alimento.nome,
      nutrientesPor100g: { ...alimento.nutrientesPor100g },
      micronutrientesPor100g: undefined,
      fonteRotulo: alimento.fonte ? `${alimento.fonte.nome} - ${alimento.fonte.versao}` : 'Catalogo TACO',
      medidaCaseira: null,
      referenciaMedidaCaseira: undefined
    });
    setBusca('');
    setResultados([]);
  }

  function alterarNutriente(campo: keyof NutrientesPor100gApi, numero: NumeroFormulario | undefined) {
    aoAlterar({ ...valor, nutrientesPor100g: { ...valor.nutrientesPor100g, [campo]: numero } });
  }

  function alterarQuantidade(quantidade: string) {
    const proximo = { ...valor, quantidade };
    if (valor.medidaCaseira) {
      if (!valor.referenciaMedidaCaseira) proximo.porcaoGramas = '';
      else {
        try { proximo.porcaoGramas = calcularPesoMedidaCaseira(quantidade, valor.referenciaMedidaCaseira.pesoReferenciaGramas, valor.referenciaMedidaCaseira.quantidadeReferencia); }
        catch { proximo.porcaoGramas = ''; }
      }
    }
    aoAlterar(proximo);
  }

  function aplicarMedida(medidaCaseira: MedidaCaseiraAplicadaApi, referenciaMedidaCaseira: MedidaCaseiraReferenciaApi, unidade: string, porcaoGramas: number | '') {
    aoAlterar({ ...valor, medidaCaseira, referenciaMedidaCaseira, unidade, porcaoGramas });
  }

  function selecionarPersonalizado(alimento: AlimentoPersonalizadoApi, aplicacaoId: string) {
    aoAlterar({
      ...valor,
      alimentoComposicaoId: undefined,
      alimentoPersonalizado: { id: alimento.id, revisao: alimento.revisao, aplicacaoId },
      origemComposicaoPersonalizada: {
        baseOrigem: alimento.baseOrigem,
        composicaoOrigem: alimento.composicaoOrigem,
        normalizacaoVersao: 'octaclin-custom-v1',
        referencia: alimento.referenciaComposicao
      },
      descricao: alimento.preparacao ? `${alimento.nome}, ${alimento.preparacao}` : alimento.nome,
      nutrientesPor100g: { ...alimento.nutrientesPor100g },
      micronutrientesPor100g: { ...alimento.micronutrientesPor100g },
      fonteRotulo: 'Alimento personalizado',
      medidaCaseira: null,
      referenciaMedidaCaseira: undefined
    });
  }

  const possuiVinculoBiblioteca = Boolean(valor.alimentoComposicaoId || valor.alimentoPersonalizado);
  const idBiblioteca = valor.alimentoComposicaoId ?? valor.alimentoPersonalizado?.id;
  const origemBiblioteca = valor.alimentoPersonalizado ? 'custom' as const : 'catalogo' as const;

  return (
    <fieldset className="grid min-w-0 gap-3 border-t border-linha pt-3 first:border-t-0 first:pt-0">
      <legend className="sr-only">{rotulo}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-tinta">{rotulo}</p>
          <p className="text-xs text-texto-suave">
            {valor.alimentoPersonalizado ? 'Alimento personalizado' : valor.alimentoComposicaoId ? valor.fonteRotulo ?? 'Catálogo nutricional' : 'Composição informada manualmente'}
          </p>
        </div>
        {aoRemover ? (
          <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11" onClick={aoRemover} aria-label={`Remover ${rotulo}`}>
            <Trash2 size={15} />
            Remover
          </Botao>
        ) : null}
      </div>

      {valor.alimentoPersonalizado && valor.origemComposicaoPersonalizada ? <details className="rounded border border-linha px-3">
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-primaria">Conferir composição de origem</summary>
        <div className="grid gap-1 pb-3 text-xs text-texto-suave">
          <p>Base original: {valor.origemComposicaoPersonalizada.baseOrigem?.pesoGramas ?? valor.origemComposicaoPersonalizada.baseGramas} g</p>
          {valor.origemComposicaoPersonalizada.normalizacaoVersao ? <p>Normalização: {valor.origemComposicaoPersonalizada.normalizacaoVersao}</p> : null}
          {valor.origemComposicaoPersonalizada.referencia ? <p>Referência informada: {valor.origemComposicaoPersonalizada.referencia}</p> : null}
          {Object.entries(valor.origemComposicaoPersonalizada.composicaoOrigem?.nutrientes ?? valor.origemComposicaoPersonalizada.nutrientes ?? {}).map(([campo, numero]) => <p key={campo}>{campo}: {numero}</p>)}
          {Object.entries(valor.origemComposicaoPersonalizada.composicaoOrigem?.micronutrientes ?? valor.origemComposicaoPersonalizada.micronutrientes ?? {}).map(([campo, numero]) => <p key={campo}>{campo}: {numero}</p>)}
        </div>
      </details> : null}

      <div className="grid gap-2">
        <Rotulo htmlFor={`${id}-busca`}>Buscar no catálogo</Rotulo>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
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
          {/* Com uma unica fonte ativa o seletor seria uma escolha sem
              alternativa. Mas se ja houver filtro aplicado ele continua a
              vista, senao o filtro seguiria valendo sem controle para limpa-lo. */}
          {fontes.length > 1 || fonteSelecionada ? (
            <div className="grid gap-1">
              <Rotulo htmlFor={`${id}-fonte`} className="sr-only">Fonte do catálogo</Rotulo>
              <Selecao
                id={`${id}-fonte`}
                value={fonteSelecionada ? identificarFonte(fonteSelecionada) : ''}
                onChange={(evento) =>
                  setFonteSelecionada(
                    fontes.find((fonte) => identificarFonte(fonte) === evento.target.value) ?? null
                  )
                }
              >
                <option value="">Todas as fontes</option>
                {fontes.map((fonte) => (
                  <option key={identificarFonte(fonte)} value={identificarFonte(fonte)}>
                    {[fonte.nome, fonte.versao, fonte.baseCodigo].filter(Boolean).join(' ')}
                  </option>
                ))}
              </Selecao>
            </div>
          ) : null}
        </div>
        {buscando ? <p role="status" className="text-xs text-texto-suave">Buscando no catálogo...</p> : null}
        {erroBusca ? <p role="alert" className="text-xs text-perigo">{erroBusca}</p> : null}
        {resultados.length ? (
          <>
            <p role="status" className="text-xs text-texto-suave">
              {total > resultados.length
                ? `Mostrando ${resultados.length} de ${total} alimentos. Refine a busca para ver os demais.`
                : `${total} alimento${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}.`}
            </p>
            <ul className="max-h-52 overflow-y-auto rounded-md border border-linha bg-white" aria-label="Resultados da busca de alimentos">
              {resultados.map((alimento) => (
                <li key={alimento.id} className="flex items-stretch border-b border-linha last:border-b-0">
                  <button
                    type="button"
                    disabled={!alimento.disponivelParaCalculo}
                    onClick={() => selecionar(alimento)}
                    className="min-h-11 min-w-0 flex-1 px-3 py-2 text-left text-sm hover:bg-superficie-hover disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primaria"
                  >
                    <span className="block font-medium text-tinta">{alimento.nome}</span>
                    <span className="block text-xs text-texto-suave">
                      {/* Fonte e versao sempre visiveis: a mesma preparacao tem
                          valores diferentes entre tabelas, e a escolha e clinica. */}
                      {[alimento.preparacao, alimento.fonte ? `${alimento.fonte.nome} ${alimento.fonte.versao}` : null]
                        .filter(Boolean)
                        .join(' - ') || 'Catálogo nutricional'}
                      {!alimento.disponivelParaCalculo ? ' - composição incompleta' : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={alimento.favorito === true}
                    aria-label={`${alimento.favorito ? 'Remover' : 'Adicionar'} ${alimento.nome} ${alimento.favorito ? 'dos' : 'aos'} favoritos`}
                    title={alimento.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    disabled={favoritosEmAtualizacao.has(alimento.id)}
                    onClick={() => void alternarFavorito(alimento)}
                    className="min-h-11 min-w-11 px-3 text-primaria hover:bg-superficie-hover disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primaria"
                  >
                    <Star aria-hidden="true" size={18} fill={alimento.favorito ? 'currentColor' : 'none'} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <AlimentosPersonalizados
        key={`${pacienteId}:${contextoEdicao}:${valor.chaveCliente}`}
        podeEditar={podeEditar}
        contextoSelecao={JSON.stringify([
          valor.alimentoComposicaoId ?? null,
          valor.alimentoPersonalizado?.id ?? null,
          valor.alimentoPersonalizado?.revisao ?? null,
          valor.alimentoPersonalizado?.aplicacaoId ?? null
        ])}
        aoSelecionar={({ alimento, aplicacaoId }) => selecionarPersonalizado(alimento, aplicacaoId)}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_120px_150px_150px]">
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-descricao`}>Alimento</Rotulo>
          <Campo
            id={`${id}-descricao`}
            value={valor.descricao}
            onChange={(evento) => aoAlterar({ ...valor, descricao: evento.target.value })}
            disabled={possuiVinculoBiblioteca}
            maxLength={240}
            required
          />
        </div>
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-quantidade`}>Quantidade</Rotulo>
          <Campo
            id={`${id}-quantidade`}
            type="text" inputMode="decimal" maxLength={32}
            min="0.001"
            max="10000"
            step="0.001"
            value={valor.quantidade}
            onChange={(evento) => alterarQuantidade(evento.target.value)}
            required
          />
        </div>
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-unidade`}>Unidade</Rotulo>
          <Campo
            id={`${id}-unidade`}
            value={valor.unidade}
            onChange={(evento) => aoAlterar({ ...valor, unidade: evento.target.value, medidaCaseira: null, referenciaMedidaCaseira: undefined })}
            maxLength={40}
            required
          />
        </div>
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-gramas`}>Porcao (g)</Rotulo>
          <Campo
            id={`${id}-gramas`}
            type="text" inputMode="decimal" maxLength={32}
            min="0.001"
            max="10000"
            step="0.001"
            value={valor.porcaoGramas}
            onChange={(evento) => aoAlterar({ ...valor, porcaoGramas: evento.target.value, medidaCaseira: null, referenciaMedidaCaseira: undefined })}
            required
          />
        </div>
      </div>

      {idBiblioteca ? <MedidasCaseirasAlimento
        key={`${origemBiblioteca}:${idBiblioteca}:${pacienteId}:${contextoEdicao}:${valor.chaveCliente}`}
        alimentoId={idBiblioteca}
        origemBiblioteca={origemBiblioteca}
        quantidade={valor.quantidade}
        aplicada={valor.medidaCaseira}
        referenciaAplicada={valor.referenciaMedidaCaseira}
        podeEditar={podeEditar}
        aoAplicar={aplicarMedida}
      /> : null}

      {possuiVinculoBiblioteca ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Item de catalogo nao tem campos editaveis de nutriente, entao a
              porcao calculada e o unico retorno nutricional da linha. */}
          {mostrarResumo ? <p className="text-xs tabular-nums text-texto-suave" aria-label={resumoPorcaoAlimento(resumo ?? valor).acessivel}>{resumoPorcaoAlimento(resumo ?? valor).visual}</p> : <p role="status" className="text-xs text-texto-suave">Resumo nutricional aguardando materialização.</p>}
          <button
            type="button"
            onClick={() => aoAlterar({ ...valor, alimentoComposicaoId: undefined, alimentoPersonalizado: valor.alimentoPersonalizado ? null : undefined, fonteRotulo: undefined, medidaCaseira: null, referenciaMedidaCaseira: undefined })}
            className="flex min-h-11 w-fit items-center text-xs font-semibold text-primaria underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          >
            Transformar em item manual
          </button>
        </div>
      ) : (
        <fieldset className="grid gap-2 rounded-md bg-superficie p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-texto-suave">Nutrientes por 100 g</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ['energiaKcal', 'Energia (kcal)'],
              ['proteinasG', 'Proteinas (g)'],
              ['carboidratosG', 'Carboidratos (g)'],
              ['gordurasG', 'Gorduras (g)']
            ] as const).map(([campo, rotuloNutriente]) => (
              <label key={campo} className="grid gap-1 text-xs font-semibold text-texto-suave">
                {rotuloNutriente}
                <Campo
                  type="text" inputMode="decimal" maxLength={32}
                  min="0"
                  step="0.0001"
                  value={valor.nutrientesPor100g[campo] ?? ''}
                  onChange={(evento) =>
                    alterarNutriente(campo, evento.target.value)
                  }
                  required
                />
              </label>
            ))}
          </div>
          {/* Fibras e sodio ficam recolhidos para a linha respirar. Os quatro
              campos acima sao obrigatorios e por isso continuam a vista: um
              campo required escondido reprova o envio sem o profissional ver
              onde. */}
          <details className="mt-1">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center text-xs font-semibold text-primaria focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria">
              Mais nutrientes (opcional)
            </summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {([
                ['fibrasG', 'Fibras (g)'],
                ['sodioMg', 'Sodio (mg)']
              ] as const).map(([campo, rotuloNutriente]) => (
                <label key={campo} className="grid gap-1 text-xs font-semibold text-texto-suave">
                  {rotuloNutriente}
                  <Campo
                    type="text" inputMode="decimal" maxLength={32}
                    min="0"
                    step="0.0001"
                    value={valor.nutrientesPor100g[campo] ?? ''}
                    onChange={(evento) =>
                      alterarNutriente(campo, evento.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          <details className="mt-1">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center text-xs font-semibold text-primaria focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria">
              Micronutrientes por 100 g (opcional)
            </summary>
            <p className="mt-1 text-xs text-texto-suave">Informe somente valores conhecidos do alimento manual. Campos vazios permanecem sem valor informado.</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPOS_MICRONUTRIENTES_PLANO.map(({ codigo, rotulo: rotuloMicro, unidade }) => (
                <label key={codigo} className="grid gap-1 text-xs font-semibold text-texto-suave">
                  {rotuloMicro} ({unidade})
                  <Campo
                    type="text" inputMode="decimal" maxLength={32} min="0" step="0.0001"
                    value={valor.micronutrientesPor100g?.[codigo] ?? ''}
                    onChange={(evento) => aoAlterar({ ...valor, micronutrientesPor100g: { ...valor.micronutrientesPor100g, [codigo]: evento.target.value } })}
                  />
                </label>
              ))}
            </div>
          </details>
        </fieldset>
      )}
    </fieldset>
  );
}

interface EditorItemProps {
  pacienteId: string;
  contextoEdicao: string;
  podeEditar: boolean;
  item: ItemFormulario;
  resumo?: ItemFormulario;
  indice: number;
  total: number;
  aoAlterar: (item: ItemFormulario) => void;
  aoRemover: () => void;
  aoMover: (destino: number) => void;
  mostrarResumo: boolean;
}

function EditorItem({ pacienteId, contextoEdicao, podeEditar, item, resumo, indice, total, aoAlterar, aoRemover, aoMover, mostrarResumo }: EditorItemProps) {
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
      <EditorAlimento pacienteId={pacienteId} contextoEdicao={contextoEdicao} podeEditar={podeEditar} rotulo={`Alimento ${indice + 1}`} valor={item} resumo={resumo} aoAlterar={(valor) => aoAlterar({ ...item, ...valor })} aoRemover={aoRemover} mostrarResumo={mostrarResumo} />
      <div className="ml-0 grid gap-3 border-l-2 border-primaria-suave pl-3 sm:ml-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-texto-suave">Substituicoes</p>
          <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => aoAlterar({ ...item, substituicoes: [...item.substituicoes, novaAlternativa()] })}>
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
              contextoEdicao={contextoEdicao}
              podeEditar={podeEditar}
              rotulo={`Substituicao ${indiceSubstituicao + 1}`}
              mostrarResumo={mostrarResumo}
              valor={substituicao}
              resumo={resumo?.substituicoes[indiceSubstituicao]}
              aoAlterar={(valor) => aoAlterar({ ...item, substituicoes: item.substituicoes.map((atual, posicao) => posicao === indiceSubstituicao ? { ...atual, ...valor } : atual) })}
              aoRemover={() => aoAlterar({ ...item, substituicoes: item.substituicoes.filter((_, posicao) => posicao !== indiceSubstituicao) })}
            />
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-texto-suave">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primaria"
                  checked={substituicao.liberadaParaPaciente}
                  onChange={(evento) => aoAlterar({ ...item, substituicoes: item.substituicoes.map((atual, posicao) => posicao === indiceSubstituicao ? { ...atual, liberadaParaPaciente: evento.target.checked } : atual) })}
                />
                O paciente pode escolher esta troca
              </label>
              <label className="flex items-center gap-2 text-xs text-texto-suave">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primaria"
                  checked={substituicao.preferida}
                  onChange={(evento) => aoAlterar({ ...item, substituicoes: item.substituicoes.map((atual, posicao) => posicao === indiceSubstituicao ? { ...atual, preferida: evento.target.checked } : atual) })}
                />
                Recomendar esta troca
              </label>
            </div>
          </div>
        )) : <p className="text-sm text-texto-suave">Nenhuma substituicao cadastrada.</p>}
        {item.substituicoes.length ? (
          <div className="grid gap-1">
            <Rotulo htmlFor={`visiveis-${item.chaveCliente}`}>Trocas visiveis antes de expandir</Rotulo>
            <Campo
              id={`visiveis-${item.chaveCliente}`}
              type="text" inputMode="decimal" maxLength={32}
              min={1}
              max={20}
              value={item.substituicoesVisiveisInicialmente ?? ''}
              placeholder="Todas"
              onChange={(evento) => aoAlterar({ ...item, substituicoesVisiveisInicialmente: evento.target.value })}
            />
            <p className="text-xs text-texto-suave">Em branco mostra todas as trocas liberadas ao paciente.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ControleAtivacao({ rotulo, ativo, desabilitado, aoAlternar }: { rotulo: string; ativo: boolean; desabilitado?: boolean; aoAlternar: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={`${rotulo}: ${ativo ? 'visível para o paciente' : 'oculto do paciente'}`}
      disabled={desabilitado}
      onClick={aoAlternar}
      className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span aria-hidden="true" className={`relative h-6 w-11 rounded-full transition-colors ${ativo ? 'bg-primaria' : 'bg-texto-suave'}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${ativo ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
      <span>{ativo ? 'Visível' : 'Oculto'}</span>
    </button>
  );
}

function ResumoVersao({ plano, versao, podeAlterarVisibilidade = false, aoAlternarRefeicao, operacaoPendente = false }: {
  plano: PlanoAlimentarApi;
  versao: VersaoPlanoAlimentarApi;
  podeAlterarVisibilidade?: boolean;
  aoAlternarRefeicao?: (identidadeId: string, ativo: boolean) => void;
  operacaoPendente?: boolean;
}) {
  const preferencias = versao.preferenciasApresentacao?.profissional ?? {
    ...novasPreferenciasApresentacaoPlano().profissional,
    substituicoesExpandidas: true
  };
  return (
    <article className={`grid rounded-md border border-linha bg-white ${preferencias.modoCompacto ? 'gap-3 p-3' : 'gap-5 p-5'}`}>
      <header className="border-b border-linha pb-4">
        <p className="text-xs font-semibold uppercase text-primaria">Plano alimentar</p>
        <h2 className="mt-1 text-xl font-semibold text-tinta">{plano.titulo}</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Versão {versao.numero} - {versao.status === 'publicada' ? `publicada em ${formatarData(versao.publicadaEm)}` : versao.status === 'descartada' ? `descartada em ${formatarData(versao.descartadaEm)}` : 'rascunho em consulta'}
        </p>
      </header>
      {versao.apresentacaoEstado === 'indisponivel' ? (
        <p role="alert" className="rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm text-alerta-forte">As preferências de apresentação desta versão não puderam ser lidas. A versão clínica continua disponível para o profissional; use a prévia autorizada do paciente somente após reconferir a configuração.</p>
      ) : null}
      <section>
        <h3 className="text-sm font-semibold text-tinta">Objetivo</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-texto-suave">{versao.objetivos}</p>
      </section>
      {versao.calculo && preferencias.macros ? (
        <section className="grid gap-3 rounded-md bg-superficie p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-texto-suave">Meta energética</p><p className="text-lg font-semibold text-tinta">{formatarNumero(versao.calculo.metaEnergeticaKcal)} kcal</p></div>
          <div><p className="text-xs text-texto-suave">Carboidratos</p><p className="text-lg font-semibold text-tinta">{formatarNumero(versao.calculo.metasMacronutrientes.carboidratosG, 1)} g</p></div>
          <div><p className="text-xs text-texto-suave">Proteínas</p><p className="text-lg font-semibold text-tinta">{formatarNumero(versao.calculo.metasMacronutrientes.proteinasG, 1)} g</p></div>
          <div><p className="text-xs text-texto-suave">Gorduras</p><p className="text-lg font-semibold text-tinta">{formatarNumero(versao.calculo.metasMacronutrientes.gordurasG, 1)} g</p></div>
        </section>
      ) : null}
      <div className="grid gap-4">
        {versao.refeicoes.map((refeicao) => (
          <section key={refeicao.id} className="break-inside-avoid border-t border-linha pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-base font-semibold text-tinta">{refeicao.nome}</h3>
                {preferencias.horario && refeicao.horarioLocal ? <p className="text-sm text-texto-suave">{refeicao.horarioLocal.slice(0, 5)}</p> : null}
              </div>
              {podeAlterarVisibilidade && versao.id === plano.current?.id ? (() => {
                const estado = localizarAtivacaoRefeicao(versao, refeicao.id);
                return estado ? <ControleAtivacao rotulo={`Visibilidade da refeição ${refeicao.nome || 'sem nome'}`} ativo={estado.ativa} desabilitado={operacaoPendente || !aoAlternarRefeicao} aoAlternar={() => aoAlternarRefeicao?.(estado.identidadeId, !estado.ativa)} />
                  : <span className="text-xs text-alerta-forte">Estado de visibilidade indisponível</span>;
              })() : null}
            </div>
            {preferencias.orientacoes && refeicao.orientacoes ? <p className="mt-1 whitespace-pre-wrap text-sm text-texto-suave">{refeicao.orientacoes}</p> : null}
            <ul className="mt-3 grid gap-2">
              {refeicao.itens.map((item) => (
                <li key={item.id} className="text-sm text-tinta">
                  <span className="font-medium">{item.descricao}</span>{preferencias.medidasCaseiras ? ` - ${formatarNumero(item.quantidade, 1)} ${item.unidade}` : ''} ({formatarNumero(item.porcaoGramas, 1)} g)
                  {item.substituicoes.length ? (
                    <details className="mt-1 pl-3 text-xs text-texto-suave" open={preferencias.substituicoesExpandidas || undefined}>
                      <summary className="cursor-pointer">Substituições ({item.substituicoes.length})</summary>
                      <p className="mt-1">{item.substituicoes.map((substituicao) => `${substituicao.descricao} (${preferencias.medidasCaseiras ? `${formatarNumero(substituicao.quantidade, 1)} ${substituicao.unidade}; ` : ''}${formatarNumero(substituicao.porcaoGramas, 1)} g)`).join(' · ')}</p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {preferencias.orientacoes && versao.observacoes ? <section className="border-t border-linha pt-4"><h3 className="text-sm font-semibold text-tinta">Observações</h3><p className="mt-1 whitespace-pre-wrap text-sm text-texto-suave">{versao.observacoes}</p></section> : null}
    </article>
  );
}

type GrupoPaginacaoAcompanhamento = 'checkins' | 'questionarios' | 'escolhas';

interface PaginasAcompanhamento {
  checkins: number;
  questionarios: number;
  escolhas: number;
}

const paginasIniciaisAcompanhamento: PaginasAcompanhamento = {
  checkins: 1,
  questionarios: 1,
  escolhas: 1
};

function ControlesPaginacaoAcompanhamento({
  rotulo,
  pagina,
  limite,
  total,
  aoMudarPagina
}: {
  rotulo: string;
  pagina: number;
  limite: number;
  total: number;
  aoMudarPagina: (pagina: number) => void;
}) {
  if (total <= limite) return null;
  const temProxima = pagina * limite < total;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Botao
        type="button"
        variante="fantasma"
        tamanho="sm"
        aria-label={`Página anterior de ${rotulo}`}
        disabled={pagina <= 1}
        onClick={() => aoMudarPagina(pagina - 1)}
      >
        Anterior
      </Botao>
      <span className="text-xs text-texto-suave">Página {pagina}</span>
      <Botao
        type="button"
        variante="fantasma"
        tamanho="sm"
        aria-label={`Próxima página de ${rotulo}`}
        disabled={!temProxima}
        onClick={() => aoMudarPagina(pagina + 1)}
      >
        Próxima
      </Botao>
    </div>
  );
}

function PainelAcompanhamentoVersao({
  acompanhamento,
  aoMudarPagina
}: {
  acompanhamento: AcompanhamentoVersaoPlanoApi;
  aoMudarPagina: (grupo: GrupoPaginacaoAcompanhamento, pagina: number) => void;
}) {
  const { checkins, questionariosSemResposta, escolhas, periodo, versao } = acompanhamento;
  return (
    <section className="grid gap-4 rounded-md border border-linha bg-white p-4" aria-labelledby={`acompanhamento-versao-${versao.numero}`}>
      <div>
        <h3 id={`acompanhamento-versao-${versao.numero}`} className="text-base font-semibold text-tinta">
          Acompanhamento factual da versão {versao.numero}
        </h3>
        <p className="mt-1 text-sm text-texto-suave">
          Registros entre {formatarData(periodo.inicioEm)} e {periodo.fimExclusivoEm ? formatarData(periodo.fimExclusivoEm) : 'o momento da consulta'} enquanto esta versão estava publicada.
        </p>
        <p className="mt-2 rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm text-alerta-forte">
          Check-ins, ausências de resposta e trocas são fatos registrados; não comprovam consumo real, cumprimento do plano ou relação de causa com esta versão.
        </p>
      </div>

      <section className="grid gap-2 border-t border-linha pt-3">
        <h4 className="text-sm font-semibold text-tinta">Check-ins declarados</h4>
        {!checkins.itens.length ? <p className="text-sm text-texto-suave">Nenhum check-in registrado nesta janela.</p> : (
          <ul className="grid gap-2">
            {checkins.itens.map((checkin) => (
              <li key={checkin.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-tinta">
                  {checkin.dadoIndisponivel
                    ? 'Registro indisponível para leitura'
                    : typeof checkin.adesaoPlano === 'number'
                    ? `${formatarNumero(checkin.adesaoPlano)}% declarado pelo paciente`
                    : 'Percentual não informado'}
                </span>
                <span className="text-xs text-texto-suave">{formatarData(checkin.registradoEm)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-texto-suave">Mostrando {checkins.itens.length} de {checkins.total} registros.</p>
        <ControlesPaginacaoAcompanhamento
          rotulo="check-ins"
          pagina={checkins.pagina}
          limite={checkins.limite}
          total={checkins.total}
          aoMudarPagina={(pagina) => aoMudarPagina('checkins', pagina)}
        />
      </section>

      <section className="grid gap-2 border-t border-linha pt-3">
        <h4 className="text-sm font-semibold text-tinta">Questionários sem resposta finalizada</h4>
        {!questionariosSemResposta.itens.length ? <p className="text-sm text-texto-suave">Nenhum envio com data registrado nesta janela.</p> : (
          <ul className="grid gap-2">
            {questionariosSemResposta.itens.map((envio) => (
              <li key={envio.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-tinta">{envio.titulo ?? 'Questionário sem título'} — {envio.status}</span>
                <span className="text-xs text-texto-suave">{envio.enviadoEm ? formatarData(envio.enviadoEm) : 'Data de envio não informada'}</span>
              </li>
            ))}
          </ul>
        )}
        {questionariosSemResposta.semReferenciaTemporal > 0 ? (
          <p className="text-sm text-texto-suave">
            {questionariosSemResposta.semReferenciaTemporal} {questionariosSemResposta.semReferenciaTemporal === 1 ? 'envio sem data de envio não foi atribuído' : 'envios sem data de envio não foram atribuídos'} a esta versão.
          </p>
        ) : null}
        <p className="text-xs text-texto-suave">Mostrando {questionariosSemResposta.itens.length} de {questionariosSemResposta.total} envios datados.</p>
        <ControlesPaginacaoAcompanhamento
          rotulo="questionários"
          pagina={questionariosSemResposta.pagina}
          limite={questionariosSemResposta.limite}
          total={questionariosSemResposta.total}
          aoMudarPagina={(pagina) => aoMudarPagina('questionarios', pagina)}
        />
      </section>

      <section className="grid gap-2 border-t border-linha pt-3">
        <h4 className="text-sm font-semibold text-tinta">Trocas registradas pelo paciente</h4>
        {!escolhas.itens.length ? <p className="text-sm text-texto-suave">Nenhuma troca foi registrada para esta versão.</p> : (
          <ol className="grid gap-2">
            {escolhas.itens.map((escolha) => (
              <li key={escolha.id} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-tinta"><span className="font-medium">{escolha.refeicaoNome}:</span> {escolha.itemDescricao}</p>
                  <p className="text-sm text-texto-suave">{escolha.retornouAoPrincipal ? 'Voltou ao alimento principal.' : `Escolheu ${escolha.substituicaoDescricao ?? 'uma substituição indisponível'}.`}</p>
                </div>
                <p className="text-xs text-texto-suave">{formatarData(escolha.criadoEm)}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-texto-suave">Mostrando {escolhas.itens.length} de {escolhas.total} escolhas.</p>
        <ControlesPaginacaoAcompanhamento
          rotulo="trocas"
          pagina={escolhas.pagina}
          limite={escolhas.limite}
          total={escolhas.total}
          aoMudarPagina={(pagina) => aoMudarPagina('escolhas', pagina)}
        />
      </section>
    </section>
  );
}

interface PlanoAlimentarProfissionalProps {
  pacienteId: string;
  podeGerenciar: boolean;
  aoAlterarRascunho?: (alterado: boolean) => void;
  aoRegistrarSalvamentoRascunho?: (salvar: (() => Promise<boolean>) | null) => void;
  selecoesCalculo: SelecaoCalculoLocal[];
  aoMudarSelecoesCalculo: Dispatch<SetStateAction<SelecaoCalculoLocal[]>>;
}

type ModoProjecaoPaciente = 'rascunho' | 'impressao';
interface ProjecaoPacienteLocal {
  chave: string;
  ativacaoRevisao: number;
  modo: ModoProjecaoPaciente;
  dados: ApresentacaoPacientePlanoApi;
}

export function PlanoAlimentarProfissional({ pacienteId, podeGerenciar, aoAlterarRascunho, aoRegistrarSalvamentoRascunho, selecoesCalculo, aoMudarSelecoesCalculo }: PlanoAlimentarProfissionalProps) {
  const [planos, setPlanos] = useState<PlanoAlimentarResumoApi[]>([]);
  const [paginaPlanos, setPaginaPlanos] = useState(1);
  const [totalPlanos, setTotalPlanos] = useState(0);
  const paginaPlanosRef = useRef(1);
  const pacienteCarregadoRef = useRef(pacienteId);
  const controladorListaRef = useRef<AbortController | null>(null);
  const [plano, setPlano] = useState<PlanoAlimentarApi | null>(null);
  const planoAtualRef = useRef<PlanoAlimentarApi | null>(null);
  const pacienteAtualRef = useRef(pacienteId);
  const [projecaoPaciente, setProjecaoPaciente] = useState<ProjecaoPacienteLocal | null>(null);
  const [carregandoProjecao, setCarregandoProjecao] = useState(false);
  const sequenciaProjecao = useRef(0);
  const controladorProjecao = useRef<AbortController | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoAntropometricaApi[]>([]);
  const [numeroVersaoConsultada, setNumeroVersaoConsultada] = useState<number | null>(null);
  const [paginasAcompanhamento, setPaginasAcompanhamento] = useState<PaginasAcompanhamento>(paginasIniciaisAcompanhamento);
  const [versaoConsultada, setVersaoConsultada] = useState<VersaoPlanoAlimentarApi | null>(null);
  const [acompanhamento, setAcompanhamento] = useState<AcompanhamentoVersaoPlanoApi | null>(null);
  const [carregandoAcompanhamento, setCarregandoAcompanhamento] = useState(false);
  const [erroAcompanhamento, setErroAcompanhamento] = useState<string | null>(null);
  const [planoId, setPlanoId] = useState('');
  const [formulario, setFormulario] = useState<FormularioPlano>(() => formularioInicial());
  const [reconferiuApresentacao, setReconferiuApresentacao] = useState(true);
  const [tituloNovo, setTituloNovo] = useState('Plano alimentar');
  const [carregando, setCarregando] = useState(true);
  const [operacao, setOperacao] = useState<string | null>(null);
  const [ativacaoNaoConfirmada, setAtivacaoNaoConfirmada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [estadoAutosave, setEstadoAutosave] = useState<EstadoSalvamentoPlano>('salvo');
  const [ultimoSalvamentoConfirmado, setUltimoSalvamentoConfirmado] = useState<{ chave: string; data: Date } | null>(null);
  const [edicaoIndisponivel, setEdicaoIndisponivel] = useState(false);
  const [contextoEdicao, setContextoEdicao] = useState(0);
  const [refeicoesAbertas, setRefeicoesAbertas] = useState<Set<string>>(() => new Set());
  const [alterado, setAlterado] = useState(false);
  const [copiaEmAndamento, setCopiaEmAndamento] = useState(false);
  const coordenadorEdicaoRef = useRef<CoordenadorEdicaoPlano<DocumentoEdicaoPlano> | null>(null);
  const posseEdicaoRef = useRef(false);
  const operacaoRascunhoRef = useRef<Promise<void> | null>(null);
  const documentoInicialEdicaoRef = useRef<DocumentoEdicaoPlano | null>(null);
  const compondoRef = useRef(false);
  const salvarRascunhoRef = useRef<() => Promise<boolean>>(async () => false);
  const copiaEmAndamentoRef = useRef<symbol | null>(null);
  const iniciarCopia = useCallback(() => {
    const token = Symbol('copia-refeicao');
    copiaEmAndamentoRef.current = token;
    coordenadorEdicaoRef.current?.configurar({ suspenso: true });
    setCopiaEmAndamento(true);
    return () => {
      if (copiaEmAndamentoRef.current !== token) return;
      copiaEmAndamentoRef.current = null;
      coordenadorEdicaoRef.current?.configurar({ suspenso: compondoRef.current });
      setCopiaEmAndamento(false);
    };
  }, []);
  const formularioAtualRef = useRef(formulario);
  useLayoutEffect(() => {
    formularioAtualRef.current = formulario;
  }, [formulario]);
  useLayoutEffect(() => {
    planoAtualRef.current = plano;
    pacienteAtualRef.current = pacienteId;
  }, [plano, pacienteId]);
  const [confirmarArquivo, setConfirmarArquivo] = useState(false);
  const [confirmarCriacao, setConfirmarCriacao] = useState(false);
  const [confirmarReconciliacao, setConfirmarReconciliacao] = useState(false);
  const sequenciaCarregamento = useRef(0);
  const sequenciaAcompanhamento = useRef(0);
  const sensoresArraste = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const componentesMacros = [formulario.carboidratosBasisPoints, formulario.proteinasBasisPoints, formulario.gordurasBasisPoints].map(interpretarNumeroEdicao);
  const somaMacros = componentesMacros.every((valor) => valor !== undefined) ? componentesMacros.reduce<number>((total, valor) => total + (valor ?? 0), 0) : undefined;
  // Condicao especial implica meta manual: e a saida que substitui a recusa.
  const metaManual = formulario.possuiCondicaoEspecial;
  const macrosPorPeso = metaManual && formulario.metodoMacrosManual === 'gramas_por_kg';
  const refeicoesMaterializadas = plano?.draft
    ? formularioDaVersao(plano.draft, avaliacoes[0]?.id ?? '').refeicoes
    : [];
  const materializacaoCompativel = estruturasDeRefeicoesCoincidem(formulario.refeicoes, refeicoesMaterializadas);
  const estadosAtivacaoEdicao = formulario.refeicoes.map((refeicao) => localizarAtivacaoRefeicao(plano?.draft, refeicao.chaveCliente));
  const ativacaoEdicaoCompleta = Boolean(plano?.draft) && estadosAtivacaoEdicao.every(Boolean);
  const resultadosVigentes = Boolean(
    plano?.draft && materializacaoCompativel && !alterado
      && plano.draft.edicaoEstado !== 'pendente' && plano.draft.edicaoEstado !== 'indisponivel'
      && ativacaoEdicaoCompleta
  );
  // Totais exibidos após ACK usam a materialização canônica retornada pelo
  // backend. O formulário local continua intacto para preservar caret/IME.
  const refeicoesParaResultado = resultadosVigentes && plano?.draft
    ? refeicoesMaterializadas.map((refeicao, indice) => ({
        ...refeicao,
        chaveCliente: formulario.refeicoes[indice]?.chaveCliente ?? refeicao.chaveCliente
      }))
    : formulario.refeicoes;

  const refeicoesPrevistas = refeicoesParaResultado.filter((refeicao) => {
    const estado = localizarAtivacaoRefeicao(plano?.draft, refeicao.chaveCliente);
    return estado?.ativa === true;
  }).map((refeicao) => ({
    itens: refeicao.itens.map((item) => ({
      porcaoGramas: Number(item.porcaoGramas),
      nutrientesPor100g: nutrientesNumericosEdicao(item.nutrientesPor100g)
    }))
  }));
  const subtotaisRefeicoes = refeicoesParaResultado.map((refeicao) => calcularSubtotalRefeicao(
    refeicao.itens.map((item) => ({
      identificacao: item.alimentoComposicaoId || item.descricao,
      porcaoGramas: Number(item.porcaoGramas),
      nutrientesPor100g: nutrientesNumericosEdicao(item.nutrientesPor100g)
    }))
  ));
  const todasRefeicoesAbertas = formulario.refeicoes.every((refeicao) => refeicoesAbertas.has(refeicao.chaveCliente));
  const pesoTotalGramas = refeicoesPrevistas.reduce(
    (soma, refeicao) => soma + refeicao.itens.reduce((parcial, item) => parcial + Number(item.porcaoGramas || 0), 0),
    0
  );
  // As metas vem do ultimo rascunho salvo. Enquanto houver alteracao pendente,
  // formula/fator/ajuste podem ja ter mudado, entao a comparacao e sinalizada
  // como defasada em vez de aparentar precisao que nao tem.
  const metasSalvas = plano?.draft?.calculo
    ? {
        metaEnergeticaKcal: plano.draft.calculo.metaEnergeticaKcal,
        metasMacronutrientes: plano.draft.calculo.metasMacronutrientes
      }
    : undefined;
  const aplicarPlano = useCallback((detalhe: PlanoAlimentarApi | null, avaliacoesAtuais: AvaliacaoAntropometricaApi[] = []) => {
    coordenadorEdicaoRef.current?.encerrar();
    coordenadorEdicaoRef.current = null;
    controladorProjecao.current?.abort();
    sequenciaProjecao.current += 1;
    setProjecaoPaciente(null);
    setCarregandoProjecao(false);
    setPlano(detalhe);
    setAtivacaoNaoConfirmada(false);
    setContextoEdicao((valor) => valor + 1);
    setPlanoId(detalhe?.id ?? '');
    const avaliacaoPadrao = avaliacoesAtuais[0]?.id ?? '';
    const draft = detalhe?.draft;
    const indisponivel = draft?.edicaoEstado === 'indisponivel';
    setEdicaoIndisponivel(indisponivel);
    const formularioAplicado = draft?.documentoEdicao && !indisponivel
      ? formularioDoDocumento(draft.documentoEdicao, draft, avaliacaoPadrao)
      : draft ? formularioDaVersao(draft, avaliacaoPadrao) : formularioInicial(avaliacaoPadrao);
    formularioAtualRef.current = formularioAplicado;
    documentoInicialEdicaoRef.current = draft ? documentoDoFormulario(formularioAplicado) : null;
    setFormulario(formularioAplicado);
    setReconferiuApresentacao(detalhe?.draft?.apresentacaoEstado !== 'indisponivel');
    setRefeicoesAbertas(new Set());
    setNumeroVersaoConsultada(detalhe?.current?.numero ?? null);
    setPaginasAcompanhamento(paginasIniciaisAcompanhamento);
    setVersaoConsultada(detalhe?.current ?? null);
    setAcompanhamento(null);
    setErroAcompanhamento(null);
    setAlterado(false);
    setEstadoAutosave(indisponivel ? 'incerto' : 'salvo');
  }, []);

  const edicaoEntreAbas = useCoordenacaoAbasPlano({
    pacienteId, planoId: plano?.id, habilitado: podeGerenciar,
    definirPosse: permitida => {
      posseEdicaoRef.current = permitida;
      coordenadorEdicaoRef.current?.configurar({ posseEdicao: permitida });
    },
    drenar: async () => {
      await coordenadorEdicaoRef.current?.aguardarEnvio();
      await operacaoRascunhoRef.current;
    },
    conferir: async signal => {
      const anterior = planoAtualRef.current;
      if (!anterior || pacienteAtualRef.current !== pacienteId) return false;
      const remoto = await obterPlanoAlimentar(pacienteId, anterior.id, signal);
      if (signal.aborted || pacienteAtualRef.current !== pacienteId || planoAtualRef.current?.id !== anterior.id) return false;
      const estado = coordenadorEdicaoRef.current?.estado;
      const mesmaBase = remoto.draft?.id === (estado?.precondicao.rascunhoIdEsperado ?? anterior.draft?.id)
        && (remoto.draft?.rascunhoRevisao ?? 0) === (estado?.precondicao.rascunhoRevisaoEsperada ?? anterior.draft?.rascunhoRevisao ?? 0);
      const bloqueado = estado && ['conflito', 'incerto', 'acesso-negado'].includes(estado.status);
      if (bloqueado || (estado?.alterado && (!mesmaBase || remoto.arquivadoEm))) {
        setErro('O rascunho precisa ser reconferido. Suas alterações locais foram preservadas. Use Recarregar rascunho para descartar e conferir a versão salva.');
        return false;
      }
      if (!mesmaBase || remoto.current?.id !== anterior.current?.id || remoto.arquivadoEm !== anterior.arquivadoEm) {
        if (estado?.alterado) return false;
        aplicarPlano(remoto, avaliacoes);
      } else {
        // Uma leitura de foco com a mesma base não reinicia o ciclo de60s,
        // reidrata campos ou perde o foco/IME. Só reconcilia estado operacional.
        reconciliarDetalheAtivacao(remoto);
      }
      return !remoto.arquivadoEm && remoto.draft?.edicaoEstado !== 'indisponivel';
    }
  });
  const permiteEscreverRascunho = edicaoEntreAbas.permiteEscrever;

  const carregar = useCallback(async (preferido?: string, paginaSolicitada?: number) => {
    const sequencia = ++sequenciaCarregamento.current;
    controladorProjecao.current?.abort();
    sequenciaProjecao.current += 1;
    setProjecaoPaciente(null);
    setCarregandoProjecao(false);
    controladorListaRef.current?.abort();
    const controlador = new AbortController();
    controladorListaRef.current = controlador;
    setCarregando(true);
    setErro(null);
    if (pacienteCarregadoRef.current !== pacienteId) {
      pacienteCarregadoRef.current = pacienteId;
      paginaPlanosRef.current = 1;
      setPaginaPlanos(1);
      setTotalPlanos(0);
      setPlanos([]);
      setAvaliacoes([]);
      aplicarPlano(null, []);
    }
    try {
      let paginaConsultada = paginaSolicitada ?? paginaPlanosRef.current;
      let resposta = await listarPlanosAlimentares(
        pacienteId,
        { pagina: paginaConsultada, limite: LIMITE_PLANOS_LISTA },
        controlador.signal
      );
      const ultimaPagina = Math.max(1, Math.ceil(resposta.total / LIMITE_PLANOS_LISTA));
      if (!resposta.itens.length && paginaConsultada > ultimaPagina) {
        paginaConsultada = ultimaPagina;
        resposta = await listarPlanosAlimentares(
          pacienteId,
          { pagina: paginaConsultada, limite: LIMITE_PLANOS_LISTA },
          controlador.signal
        );
      }
      if (sequencia !== sequenciaCarregamento.current) return;
      const lista = resposta.itens;
      const selecionado = lista.find((item) => item.id === preferido) ?? lista[0];
      const [detalhe, serie] = await Promise.all([
        selecionado ? obterPlanoAlimentar(pacienteId, selecionado.id) : Promise.resolve(null),
        podeGerenciar ? listarAvaliacoesAntropometricas(pacienteId) : Promise.resolve({ avaliacoes: [] })
      ]);
      if (sequencia !== sequenciaCarregamento.current) return;
      paginaPlanosRef.current = paginaConsultada;
      setPaginaPlanos(paginaConsultada);
      setTotalPlanos(resposta.total);
      setPlanos(lista);
      setAvaliacoes(serie.avaliacoes);
      aplicarPlano(detalhe, serie.avaliacoes);
      return true;
    } catch (erroAtual) {
      if (sequencia !== sequenciaCarregamento.current) return;
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível carregar os planos alimentares.'));
    } finally {
      if (sequencia === sequenciaCarregamento.current) setCarregando(false);
    }
  }, [aplicarPlano, pacienteId, podeGerenciar]);

  useEffect(() => {
    paginaPlanosRef.current = 1;
    void carregar(undefined, 1);
    return () => {
      sequenciaCarregamento.current += 1;
      controladorListaRef.current?.abort();
    };
  }, [carregar]);

  useEffect(() => {
    const versao = plano?.draft;
    if (!podeGerenciar || !plano || !versao || versao.edicaoEstado === 'indisponivel') {
      coordenadorEdicaoRef.current = null;
      return;
    }
    const inicial = documentoInicialEdicaoRef.current
      ?? documentoDoFormulario(formularioDaVersao(versao, avaliacoes[0]?.id ?? ''));
    let ultimaRevisaoConfirmadaNotificada = versao.rascunhoRevisao ?? 0;
    const coordenador = new CoordenadorEdicaoPlano<DocumentoEdicaoPlano>({
      documentoInicial: inicial,
      precondicao: { rascunhoIdEsperado: versao.id, rascunhoRevisaoEsperada: versao.rascunhoRevisao ?? 0 },
      enviar: async (documento, precondicao, signal) => {
        const bytes = new TextEncoder().encode(JSON.stringify(documento)).byteLength;
        if (bytes > LIMITE_BYTES_DOCUMENTO_EDICAO) throw Object.assign(new Error('O rascunho ultrapassa o limite de segurança.'), { status: 413 });
        const salvo = await salvarEdicaoPlanoAlimentar(pacienteId, plano.id, { ...precondicao, documento }, signal);
        if (salvo.id !== precondicao.rascunhoIdEsperado || !Number.isSafeInteger(salvo.rascunhoRevisao) || salvo.rascunhoRevisao !== precondicao.rascunhoRevisaoEsperada + 1) {
          throw Object.assign(new Error('A confirmação da revisão não pôde ser reconciliada.'), { status: 502 });
        }
        if (!signal.aborted && pacienteAtualRef.current === pacienteId && planoAtualRef.current?.id === plano.id) {
          setPlano((atual) => {
            if (!atual || atual.id !== plano.id || atual.draft?.id !== salvo.id) return atual;
            const ativacaoObsoleta = (salvo.ativacaoRevisao ?? 0) < Math.max(
              atual.ativacaoRevisao ?? 0,
              atual.draft.ativacaoRevisao ?? 0
            );
            const draft = {
              ...atual.draft,
              ...salvo,
              ...(ativacaoObsoleta ? {
                ativoParaPaciente: atual.draft.ativoParaPaciente ?? atual.ativoParaPaciente,
                ativacaoRevisao: Math.max(atual.ativacaoRevisao ?? 0, atual.draft.ativacaoRevisao ?? 0),
                ativacaoEdicao: atual.draft.ativacaoEdicao,
                ativacaoRefeicoes: atual.draft.ativacaoRefeicoes,
                resumoRefeicoesAtivas: atual.draft.resumoRefeicoesAtivas
              } : {})
            };
            if (salvo.edicaoEstado === 'pendente' || salvo.edicaoEstado === 'indisponivel') {
              draft.calculo = undefined;
              draft.totais = undefined;
              draft.refeicoes = [];
              draft.revisadaEm = undefined;
            }
            return {
              ...atual,
              ...(ativacaoObsoleta ? {} : {
                ativoParaPaciente: salvo.ativoParaPaciente ?? atual.ativoParaPaciente,
                ativacaoRevisao: salvo.ativacaoRevisao ?? atual.ativacaoRevisao
              }),
              draft
            };
          });
        }
        return { id: salvo.id, rascunhoRevisao: salvo.rascunhoRevisao! };
      },
      notificar: () => {
        const estado = coordenador.estado;
        if (estado.precondicao.rascunhoRevisaoEsperada > ultimaRevisaoConfirmadaNotificada) {
          setUltimoSalvamentoConfirmado({ chave: `${pacienteId}:${plano.id}:${versao.id}`, data: new Date() });
        }
        ultimaRevisaoConfirmadaNotificada = estado.precondicao.rascunhoRevisaoEsperada;
        setEstadoAutosave(estado.status);
        setAlterado(estado.alterado);
      }
    });
    coordenador.configurar({ posseEdicao: posseEdicaoRef.current });
    coordenadorEdicaoRef.current = coordenador;
    coordenador.iniciar();
    const documentoAtual = documentoDoFormulario(formularioAtualRef.current);
    if (JSON.stringify(documentoAtual) !== JSON.stringify(inicial)) coordenador.alterar(documentoAtual);
    return () => {
      if (coordenadorEdicaoRef.current === coordenador) coordenadorEdicaoRef.current = null;
      coordenador.encerrar();
    };
  }, [pacienteId, plano?.id, plano?.draft?.id, avaliacoes[0]?.id, podeGerenciar, contextoEdicao]);

  useEffect(() => {
    coordenadorEdicaoRef.current?.configurar({ suspenso: copiaEmAndamento || compondoRef.current });
  }, [copiaEmAndamento]);

  useEffect(() => {
    if (!plano || numeroVersaoConsultada === null) return;
    const resumo = plano.historico.find((versao) => versao.numero === numeroVersaoConsultada);
    const versaoPublicada = resumo?.status === 'publicada' || plano.current?.numero === numeroVersaoConsultada;
    const sequencia = ++sequenciaAcompanhamento.current;
    const controlador = new AbortController();
    setCarregandoAcompanhamento(true);
    setErroAcompanhamento(null);
    setAcompanhamento(null);
    setVersaoConsultada(plano.current?.numero === numeroVersaoConsultada ? plano.current : null);
    const detalhe = plano.current?.numero === numeroVersaoConsultada
      ? Promise.resolve(plano.current)
      : obterVersaoPlanoAlimentar(pacienteId, plano.id, numeroVersaoConsultada, controlador.signal);
    void Promise.all([
      detalhe,
      versaoPublicada
        ? obterAcompanhamentoVersaoPlanoAlimentar(
            pacienteId,
            plano.id,
            numeroVersaoConsultada,
            {
              paginaCheckins: paginasAcompanhamento.checkins,
              paginaQuestionarios: paginasAcompanhamento.questionarios,
              paginaEscolhas: paginasAcompanhamento.escolhas,
              limite: 25
            },
            controlador.signal
          )
        : Promise.resolve(null)
    ]).then(([versao, fatos]) => {
      if (controlador.signal.aborted || sequencia !== sequenciaAcompanhamento.current) return;
      setVersaoConsultada(versao);
      setAcompanhamento(fatos);
    }).catch((erroAtual: unknown) => {
      if (controlador.signal.aborted || sequencia !== sequenciaAcompanhamento.current) return;
      setAcompanhamento(null);
      setErroAcompanhamento(mensagemFalhaInterface(erroAtual, 'Não foi possível consultar o acompanhamento desta versão.'));
    }).finally(() => {
      if (!controlador.signal.aborted && sequencia === sequenciaAcompanhamento.current) {
        setCarregandoAcompanhamento(false);
      }
    });
    return () => controlador.abort();
  }, [numeroVersaoConsultada, pacienteId, paginasAcompanhamento, plano]);

  function consultarVersao(numero: number | null) {
    setPaginasAcompanhamento(paginasIniciaisAcompanhamento);
    setNumeroVersaoConsultada(numero);
  }

  function mudarPaginaAcompanhamento(grupo: GrupoPaginacaoAcompanhamento, pagina: number) {
    setPaginasAcompanhamento((atual) => ({ ...atual, [grupo]: pagina }));
  }

  useEffect(() => {
    aoAlterarRascunho?.(alterado);
    return () => aoAlterarRascunho?.(false);
  }, [alterado, aoAlterarRascunho]);

  useProtecaoAlteracoesNaoSalvas(alterado);

  function atualizar(mutacao: (atual: FormularioPlano) => FormularioPlano) {
    if (!podeGerenciar || !permiteEscreverRascunho() || operacao === 'revisando' || operacao === 'publicando') return;
    controladorProjecao.current?.abort();
    sequenciaProjecao.current += 1;
    setCarregandoProjecao(false);
    const proximo = mutacao(formularioAtualRef.current);
    formularioAtualRef.current = proximo;
    setFormulario(proximo);
    const coordenador = coordenadorEdicaoRef.current;
    if (coordenador) coordenador.alterar(documentoDoFormulario(proximo));
    else setAlterado(true);
    setSucesso(null);
    setProjecaoPaciente(null);
  }

  async function carregarProjecaoPaciente(modo: ModoProjecaoPaciente) {
    const versao = modo === 'impressao' ? plano?.current : plano?.draft;
    if (!plano || !versao || operacao || ativacaoNaoConfirmada || (modo === 'rascunho' && alterado) || (modo === 'impressao' && versao.status !== 'publicada')) return;

    controladorProjecao.current?.abort();
    const controlador = new AbortController();
    controladorProjecao.current = controlador;
    const sequencia = ++sequenciaProjecao.current;
    const ativacaoRevisao = plano.ativacaoRevisao ?? 0;
    const chave = `${pacienteId}:${plano.id}:${versao.numero}:${versao.id}`;
    setProjecaoPaciente(null);
    setCarregandoProjecao(true);
    setErro(null);
    try {
      const dados = await obterApresentacaoPacientePlano(pacienteId, plano.id, versao.numero, controlador.signal);
      const planoAtual = planoAtualRef.current;
      if (
        controlador.signal.aborted || sequencia !== sequenciaProjecao.current ||
        pacienteAtualRef.current !== pacienteId || planoAtual?.id !== plano.id ||
        (planoAtual.ativacaoRevisao ?? 0) !== ativacaoRevisao ||
        (modo === 'impressao' ? planoAtual.current?.id : planoAtual.draft?.id) !== versao.id
      ) return;
      if (dados.apresentacaoEstado === 'indisponivel') {
        throw new Error('A apresentação do paciente está indisponível. Revise a configuração antes de continuar.');
      }

      flushSync(() => setProjecaoPaciente({ chave, modo, dados, ativacaoRevisao }));
      if (modo === 'impressao') {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const atual = planoAtualRef.current;
        const alvo = document.querySelector<HTMLElement>('[data-impressao-paciente-chave]');
        if (
          controlador.signal.aborted || sequencia !== sequenciaProjecao.current ||
          pacienteAtualRef.current !== pacienteId || atual?.id !== plano.id || atual.current?.id !== versao.id ||
          (atual.ativacaoRevisao ?? 0) !== ativacaoRevisao ||
          alvo?.dataset.impressaoPacienteChave !== chave
        ) return;
        window.print();
      }
    } catch (falha: unknown) {
      if (!controlador.signal.aborted && sequencia === sequenciaProjecao.current) {
        setProjecaoPaciente(null);
        setErro(mensagemFalhaInterface(falha, 'Não foi possível preparar a apresentação do paciente. Nenhum conteúdo foi enviado à impressão.'));
      }
    } finally {
      if (sequencia === sequenciaProjecao.current) setCarregandoProjecao(false);
    }
  }

  useEffect(() => () => {
    sequenciaProjecao.current += 1;
    controladorProjecao.current?.abort();
  }, []);

  function atualizarPreferenciaApresentacao(
    conjunto: 'profissional' | 'paciente',
    campo: keyof PreferenciasExibicaoRefeicoesApi,
    valor: boolean
  ) {
    if (!permiteEscreverRascunho()) return;
    setReconferiuApresentacao(true);
    atualizar((atual) => ({
      ...atual,
      preferenciasApresentacao: {
        ...atual.preferenciasApresentacao,
        [conjunto]: { ...atual.preferenciasApresentacao[conjunto], [campo]: valor }
      }
    }));
  }

  function reconciliarDetalheAtivacao(remoto: PlanoAlimentarApi) {
    setPlano((atual) => atual && atual.id === remoto.id ? mesclarProjecaoAtivacao(atual, remoto) : atual);
    setPlanos((atuais) => atuais.map((item) => item.id === remoto.id
      && (remoto.ativacaoRevisao ?? 0) >= (item.ativacaoRevisao ?? 0)
      ? { ...item, ativoParaPaciente: remoto.ativoParaPaciente, ativacaoRevisao: remoto.ativacaoRevisao }
      : item));
  }

  async function reconciliarAtivacao() {
    if (!plano || !podeGerenciar || operacao) return;
    setOperacao('consultando-ativacao');
    try {
      const remoto = await obterPlanoAlimentar(pacienteId, plano.id);
      reconciliarDetalheAtivacao(remoto);
      setAtivacaoNaoConfirmada(false);
      setErro(null);
      setSucesso('Estado de visibilidade atualizado a partir do servidor.');
    } catch {
      setErro('Não foi possível consultar o estado de visibilidade. Tente novamente quando a conexão estiver disponível.');
    } finally {
      setOperacao(null);
    }
  }

  async function alterarVisibilidade(ativo: boolean, identidadeRefeicaoId?: string) {
    if (!plano || !podeGerenciar || operacao || copiaEmAndamentoRef.current) return;
    controladorProjecao.current?.abort();
    sequenciaProjecao.current += 1;
    setProjecaoPaciente(null);
    setCarregandoProjecao(false);
    const planoAlvo = plano;
    const revisaoEsperada = planoAlvo.ativacaoRevisao ?? 0;
    setOperacao(identidadeRefeicaoId ? 'ativando-refeicao' : 'ativando-plano');
    setErro(null);
    setSucesso(null);
    try {
      const resultado = identidadeRefeicaoId
        ? await alterarAtivacaoRefeicaoPlanoAlimentar(pacienteId, planoAlvo.id, identidadeRefeicaoId, ativo, revisaoEsperada)
        : await alterarAtivacaoPlanoAlimentar(pacienteId, planoAlvo.id, ativo, revisaoEsperada);
      setPlano((atual) => atual && atual.id === planoAlvo.id ? aplicarAckAtivacao(atual, resultado) : atual);
      setPlanos((atuais) => atuais.map((item) => item.id === planoAlvo.id
        && resultado.ativacaoRevisao >= (item.ativacaoRevisao ?? 0)
        ? { ...item, ativoParaPaciente: resultado.ativoParaPaciente, ativacaoRevisao: resultado.ativacaoRevisao }
        : item));
      aoMudarSelecoesCalculo(atuais => atuais.map(selecao => selecao.planoId !== planoAlvo.id || selecao.ativacaoRevisao > resultado.ativacaoRevisao ? selecao : {
        ...selecao,
        ativoParaPaciente: resultado.ativoParaPaciente,
        ativacaoRevisao: resultado.ativacaoRevisao,
        refeicoes: resultado.identidadeRefeicaoId
          ? selecao.refeicoes.map(refeicao => refeicao.identidadeId === resultado.identidadeRefeicaoId ? { ...refeicao, ativa: resultado.ativa ?? ativo } : refeicao)
          : selecao.refeicoes
      }));
      setAtivacaoNaoConfirmada(false);
      setSucesso(identidadeRefeicaoId
        ? `Refeição ${ativo ? 'liberada ao' : 'ocultada do'} paciente.`
        : `Plano ${ativo ? 'liberado ao' : 'ocultado do'} paciente.`);
      // Atualiza os totais operacionais sem substituir campos editoriais locais.
      try {
        const remoto = await obterPlanoAlimentar(pacienteId, planoAlvo.id);
        reconciliarDetalheAtivacao(remoto);
      } catch {
        // O ACK já confirma a alteração; somente a projeção agregada pode ficar
        // indisponível até a próxima consulta explícita.
      }
    } catch (erroAtual) {
      const status = erroAtual instanceof ErroApiPlanoAlimentar ? erroAtual.status : undefined;
      if (status === 409) {
        try {
          const remoto = await obterPlanoAlimentar(pacienteId, planoAlvo.id);
          reconciliarDetalheAtivacao(remoto);
          setAtivacaoNaoConfirmada(false);
          setErro('A visibilidade foi alterada em outra operação. O estado atual foi atualizado; confira antes de tentar novamente.');
        } catch {
          setAtivacaoNaoConfirmada(true);
          setErro('A visibilidade mudou durante a operação e não foi possível reconciliar o estado.');
        }
      } else if (status === undefined || status >= 500) {
        setAtivacaoNaoConfirmada(true);
        setErro('A resposta da alteração de visibilidade não foi confirmada. Consulte o estado no servidor antes de tentar novamente.');
      } else {
        setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível alterar a visibilidade.'));
      }
    } finally {
      setOperacao(null);
    }
  }

  function alterarVisibilidadePlano(ativo: boolean) {
    return alterarVisibilidade(ativo);
  }

  function alterarVisibilidadeRefeicao(identidadeId: string, ativa: boolean) {
    return alterarVisibilidade(ativa, identidadeId);
  }

  async function executar(rotulo: string, tarefa: () => Promise<unknown>, mensagem: string, preferido = planoId) {
    if (!podeGerenciar || !permiteEscreverRascunho() || copiaEmAndamentoRef.current) return;
    let concluir!: () => void;
    const fim = new Promise<void>(resolve => { concluir = resolve; });
    operacaoRascunhoRef.current = fim;
    setOperacao(rotulo);
    setErro(null);
    setSucesso(null);
    try {
      await tarefa();
      setSucesso(mensagem);
      await carregar(preferido);
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível concluir a operação.'));
      if (rotulo === 'revisando' || rotulo === 'publicando') {
        const status = typeof erroAtual === 'object' && erroAtual !== null && 'status' in erroAtual
          ? erroAtual.status
          : undefined;
        if (status === 409) coordenadorEdicaoRef.current?.invalidar('conflito');
        else if ([401, 403, 404].includes(status as number)) coordenadorEdicaoRef.current?.invalidar('acesso-negado');
        else if (![400, 413, 422, 429].includes(status as number)) coordenadorEdicaoRef.current?.invalidar('incerto');
        else setEstadoAutosave('salvo');
        coordenadorEdicaoRef.current?.configurar({ suspenso: ![400, 413, 422, 429].includes(status as number) });
      }
    } finally {
      if (operacaoRascunhoRef.current === fim) operacaoRascunhoRef.current = null;
      concluir();
      setOperacao(null);
    }
  }

  async function criar() {
    if (!podeGerenciar || copiaEmAndamentoRef.current) return;
    const titulo = tituloNovo.trim();
    if (!titulo) return;
    setOperacao('criando');
    setErro(null);
    try {
      const criado = await criarPlanoAlimentar(pacienteId, titulo);
      setSucesso('Plano criado. Complete o rascunho antes da revisão.');
      await carregar(criado.id, 1);
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível criar o plano alimentar.'));
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

  const salvar = useCallback(async () => {
    if (!podeGerenciar || !permiteEscreverRascunho() || !plano?.draft || copiaEmAndamentoRef.current) return;
    const coordenador = coordenadorEdicaoRef.current;
    if (!coordenador) {
      setErro('O estado seguro deste rascunho está indisponível. Atualize o plano antes de editar.');
      return;
    }
    if (plano.draft.apresentacaoEstado === 'indisponivel' && !reconferiuApresentacao) {
      setErro('A apresentação salva está indisponível. Revise e altere uma preferência antes de salvar novamente.');
      return;
    }
    setOperacao('salvando-edicao');
    setErro(null);
    setSucesso(null);
    try {
      const salvo = await coordenador.salvarManual();
      if (salvo) setSucesso('Rascunho salvo. Os resultados clínicos continuam pendentes de revisão.');
      else setErro(mensagemEstadoAutosave(coordenador.estado.status));
    } finally {
      setOperacao(null);
    }
  }, [copiaEmAndamento, podeGerenciar, plano, reconferiuApresentacao, permiteEscreverRascunho]);

  useEffect(() => {
    salvarRascunhoRef.current = async () => {
      await salvar();
      return !coordenadorEdicaoRef.current?.estado.alterado
        && coordenadorEdicaoRef.current?.estado.status === 'salvo';
    };
  }, [salvar]);

  useEffect(() => {
    aoRegistrarSalvamentoRascunho?.(() => salvarRascunhoRef.current());
    return () => aoRegistrarSalvamentoRascunho?.(null);
  }, [aoRegistrarSalvamentoRascunho]);

  function selecionarPlano(destino: PlanoAlimentarResumoApi) {
    if (alterado || operacao || copiaEmAndamentoRef.current) return;
    void carregar(destino.id);
  }

  function transicionarVersao(tipo: 'revisando' | 'publicando') {
    if (!plano || !permiteEscreverRascunho()) return;
    const coordenador = coordenadorEdicaoRef.current;
    if (!coordenador || alterado || coordenador.estado.status !== 'salvo') return;
    const precondicao: PrecondicaoEdicaoPlano = { ...coordenador.estado.precondicao };
    coordenador.configurar({ suspenso: true });
    const revisar = tipo === 'revisando';
    void executar(
      tipo,
      () => revisar
        ? revisarPlanoAlimentar(pacienteId, plano.id, precondicao)
        : publicarPlanoAlimentar(pacienteId, plano.id, precondicao),
      revisar ? 'Plano revisado. Confira a versão antes de publicar.' : 'Plano publicado para o paciente.'
    );
  }

  function mudarPaginaPlanos(proximaPagina: number) {
    if (alterado || operacao || copiaEmAndamentoRef.current || proximaPagina < 1) return;
    const paginas = Math.max(1, Math.ceil(totalPlanos / LIMITE_PLANOS_LISTA));
    if (proximaPagina > paginas || proximaPagina === paginaPlanosRef.current) return;
    void carregar(undefined, proximaPagina);
  }

  function atualizarRefeicao(indice: number, refeicao: RefeicaoFormulario) {
    atualizar((atual) => ({ ...atual, refeicoes: atual.refeicoes.map((item, posicao) => posicao === indice ? refeicao : item) }));
  }

  function alternarRefeicao(chave: string) {
    setRefeicoesAbertas((atuais) => {
      const proximas = new Set(atuais);
      if (proximas.has(chave)) proximas.delete(chave);
      else proximas.add(chave);
      return proximas;
    });
  }

  function definirTodasRefeicoesAbertas(aberto: boolean) {
    setRefeicoesAbertas(aberto ? new Set(formulario.refeicoes.map((refeicao) => refeicao.chaveCliente)) : new Set());
  }

  function adicionarRefeicao() {
    if (!permiteEscreverRascunho()) return;
    const refeicao = novaRefeicao();
    atualizar((atual) => ({ ...atual, refeicoes: [...atual.refeicoes, refeicao] }));
    setRefeicoesAbertas((atuais) => new Set(atuais).add(refeicao.chaveCliente));
  }

  function aplicarRefeicoesDeModelo(refeicoesEntrada: RefeicaoPlanoAlimentarEntrada[]) {
    if (!permiteEscreverRascunho()) return;
    const refeicoes = refeicoesDoModelo(refeicoesEntrada);
    atualizar((atual) => ({ ...atual, refeicoes }));
    setRefeicoesAbertas(new Set(refeicoes.map((refeicao) => refeicao.chaveCliente)));
  }



  function duplicarRefeicaoLocal(indice: number) {
    if (!permiteEscreverRascunho()) return;
    try {
      const atual = formularioAtualRef.current;
      const refeicoes = duplicarRefeicaoNoRascunho(atual.refeicoes, indice, novaChaveCliente);
      atualizar((rascunho) => ({ ...rascunho, refeicoes }));
      const nova = refeicoes.find((refeicao) => !atual.refeicoes.some((anterior) => anterior.chaveCliente === refeicao.chaveCliente));
      if (nova) setRefeicoesAbertas((atuais) => new Set(atuais).add(nova.chaveCliente));
      setSucesso('Refeição duplicada no rascunho. Revise e salve as alterações.');
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível duplicar a refeição.'));
    }
  }

  function aplicarRefeicaoCopiada(
    refeicao: RefeicaoFormularioCopia,
    destino: { tipo: 'nova' } | { tipo: 'acrescentar'; chaveRefeicao?: string }
  ) {
    if (!permiteEscreverRascunho()) throw new Error('A edição foi transferida. Assuma novamente antes de copiar.');
    const atual = formularioAtualRef.current;
    let refeicoes: RefeicaoFormulario[];
    if (destino.tipo === 'nova') {
      if (atual.refeicoes.length >= LIMITE_REFEICOES_PLANO) {
        throw new Error(`O plano atingiu o limite de ${LIMITE_REFEICOES_PLANO} refeições.`);
      }
      refeicoes = [...atual.refeicoes, refeicao];
    } else {
      const indice = atual.refeicoes.findIndex((item) => item.chaveCliente === destino.chaveRefeicao);
      if (indice < 0) throw new Error('A refeição de destino não está mais disponível. Selecione-a novamente.');
      refeicoes = atual.refeicoes.map((item, posicao) => posicao === indice
        ? acrescentarItensDeRefeicao(item, refeicao.itens, novaChaveCliente)
        : item);
    }
    atualizar(() => ({ ...atual, refeicoes }));
    const aberta = destino.tipo === 'nova'
      ? refeicoes.find((item) => !atual.refeicoes.some((anterior) => anterior.chaveCliente === item.chaveCliente))
      : refeicoes.find((item) => item.chaveCliente === destino.chaveRefeicao);
    if (aberta) setRefeicoesAbertas((atuais) => new Set(atuais).add(aberta.chaveCliente));
    setSucesso(destino.tipo === 'nova'
      ? 'Refeição copiada para o rascunho. Revise e salve para recalcular.'
      : 'Alimentos e substituições acrescentados ao rascunho. Revise e salve para recalcular.');
    setErro(null);
  }

  function finalizarArrasteRefeicao(evento: DragEndEvent) {
    if (!permiteEscreverRascunho()) return;
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    atualizar((atual) => {
      const origem = atual.refeicoes.findIndex((refeicao) => refeicao.chaveCliente === active.id);
      const destino = atual.refeicoes.findIndex((refeicao) => refeicao.chaveCliente === over.id);
      if (origem < 0 || destino < 0 || origem === destino) return atual;
      return { ...atual, refeicoes: arrayMove(atual.refeicoes, origem, destino) };
    });
  }

  if (carregando || pacienteCarregadoRef.current !== pacienteId) {
    return <BarraCarregamento visivel rotulo="Carregando planos alimentares" />;
  }

  return (
    <div className="grid gap-4">
      <div className="nao-imprimir">
        <CalculoCombinadoPlanos
          pacienteId={pacienteId}
          planos={planos}
          selecoes={selecoesCalculo}
          aoMudarSelecoes={aoMudarSelecoesCalculo}
          revisaoOperacional={plano?.ativacaoRevisao ?? 0}
          versaoPublicadaSelecionada={plano?.current?.id}
        />
      </div>
      <div className="nao-imprimir grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="grid content-start gap-3">
          <Cartao className="border border-linha shadow-none">
            <CartaoCabecalho>
              <div>
                <CartaoTitulo icone={<Utensils size={17} />}>Planos alimentares</CartaoTitulo>
                <CartaoSubtitulo>{totalPlanos} plano(s) ativo(s)</CartaoSubtitulo>
              </div>
            </CartaoCabecalho>
            <CartaoConteudo className="grid gap-2">
              <ul id="lista-planos-alimentares" className="grid gap-3" aria-label="Planos alimentares">
                {planos.map((item) => (
                  <li key={item.id} className={`rounded-md border p-2 ${item.id === planoId ? 'border-primaria bg-primaria-suave' : 'border-linha bg-white'}`}>
                    <button
                      type="button"
                      disabled={(alterado && item.id !== planoId) || Boolean(operacao) || copiaEmAndamento}
                      onClick={() => selecionarPlano(item)}
                      aria-current={item.id === planoId ? 'true' : undefined}
                      className="min-h-11 w-full rounded-md px-1 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="block break-words text-sm font-semibold text-tinta">{item.titulo}</span>
                      {!item.current && !item.draft ? <span className="mt-1 block text-xs text-texto-suave">Sem versão atual</span> : null}
                    </button>
                    {item.draft ? <ResumoMacrosVersao rotulo="Rascunho" numero={item.draft.numero} resumo={item.draft.resumoNutricional} /> : null}
                    {item.current ? <ResumoMacrosVersao rotulo="Publicado" numero={item.current.numero} resumo={item.current.resumoNutricional} /> : null}
                  </li>
                ))}
              </ul>
              {totalPlanos > LIMITE_PLANOS_LISTA ? (
                <nav className="flex items-center justify-between gap-2 border-t border-linha pt-3" aria-label="Paginação de planos alimentares">
                  <button type="button" className="min-h-11 rounded-md border border-linha px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria disabled:opacity-50" disabled={paginaPlanos <= 1 || carregando || Boolean(operacao) || alterado || copiaEmAndamento} onClick={() => mudarPaginaPlanos(paginaPlanos - 1)} aria-label="Página anterior de planos">
                    Anterior
                  </button>
                  <span role="status" aria-live="polite" className="text-center text-xs text-texto-suave">Página {paginaPlanos} de {Math.max(1, Math.ceil(totalPlanos / LIMITE_PLANOS_LISTA))}</span>
                  <button type="button" className="min-h-11 rounded-md border border-linha px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria disabled:opacity-50" disabled={paginaPlanos >= Math.ceil(totalPlanos / LIMITE_PLANOS_LISTA) || carregando || Boolean(operacao) || alterado || copiaEmAndamento} onClick={() => mudarPaginaPlanos(paginaPlanos + 1)} aria-label="Próxima página de planos" aria-controls="lista-planos-alimentares">
                    Próxima
                  </button>
                </nav>
              ) : null}
              {!planos.length ? <EstadoVazio titulo="Nenhum plano alimentar" descricao={podeGerenciar ? 'Crie o primeiro plano para iniciar o cuidado nutricional.' : 'Ainda não existe plano disponível para consulta.'} /> : null}
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
            {alterado && plano?.draft ? <div role="status" className="rounded-md border border-alerta-borda bg-alerta-suave px-4 py-3 text-sm text-alerta-forte">Existem alterações não salvas neste rascunho.</div> : null}
            {ativacaoNaoConfirmada ? <div className="rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm text-alerta-forte">
              <p>Não foi possível confirmar a última alteração de visibilidade. Consulte o estado atualizado antes de tentar novamente.</p>
              <Botao type="button" tamanho="sm" className="mt-2" onClick={() => void reconciliarAtivacao()} disabled={Boolean(operacao)}>Consultar estado da visibilidade</Botao>
            </div> : null}
            {plano?.draft && podeGerenciar ? <div role="status" aria-live="polite" className="rounded-md border border-linha bg-superficie px-4 py-3 text-sm text-texto-suave">{edicaoEntreAbas.podeEditar ? `Salvamento automático ativo (60 segundos). ${mensagemEstadoAutosave(estadoAutosave)}` : 'Salvamento automático pausado nesta aba.'}{ultimoSalvamentoConfirmado?.chave === `${pacienteId}:${plano.id}:${plano.draft.id}` ? ` Último salvamento confirmado: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(ultimoSalvamentoConfirmado.data)}.` : ''}</div> : null}
          </div>

          {!plano ? <EstadoVazio titulo={podeGerenciar ? 'Selecione ou crie um plano' : 'Selecione um plano'} descricao={podeGerenciar ? 'O editor será exibido depois que um plano alimentar for selecionado.' : 'O conteúdo será exibido somente para consulta.'} /> : null}

          {plano ? (
            <>
              <Cartao className="border border-linha shadow-none">
                <CartaoCabecalho>
                  <div>
                    <CartaoTitulo>{plano.titulo}</CartaoTitulo>
                    <CartaoSubtitulo>
                      {plano.draft ? `Rascunho da versao ${plano.draft.numero}` : 'Sem rascunho ativo'}
                    </CartaoSubtitulo>
                    {podeGerenciar ? <div className="mt-2 flex flex-wrap items-center gap-3">
                      <ControleAtivacao
                        rotulo="Plano alimentar para o paciente"
                        ativo={plano.ativoParaPaciente === true}
                        desabilitado={Boolean(operacao) || copiaEmAndamento || (!plano.ativoParaPaciente && !plano.current)}
                        aoAlternar={() => void alterarVisibilidadePlano(!(plano.ativoParaPaciente === true))}
                      />
                      <span className="text-xs text-texto-suave">
                        {plano.current ? `Versão publicada ${plano.current.numero}; mudanças de visibilidade são independentes do rascunho.` : 'Publique uma versão salva antes de liberar ao paciente.'}
                      </span>
                    </div> : <p className="mt-2 text-xs text-texto-suave">{plano.ativoParaPaciente ? 'Disponível no portal do paciente.' : 'Oculto do paciente.'}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Botao type="button" onClick={() => {
                      if (['conflito', 'incerto', 'acesso-negado'].includes(estadoAutosave)) setConfirmarReconciliacao(true);
                      else void carregar(plano.id);
                    }} disabled={Boolean(operacao) || (alterado && !['conflito', 'incerto', 'acesso-negado'].includes(estadoAutosave))}>
                      <RefreshCcw size={16} /> {['conflito', 'incerto', 'acesso-negado'].includes(estadoAutosave) ? 'Reconciliar' : 'Atualizar'}
                    </Botao>
                    {plano.draft ? <Botao type="button" onClick={() => void carregarProjecaoPaciente('rascunho')} disabled={alterado || carregandoProjecao || Boolean(operacao) || ativacaoNaoConfirmada}><Search size={16} /> Prévia do paciente</Botao> : null}
                    {plano.current ? <Botao type="button" onClick={() => void carregarProjecaoPaciente('impressao')} disabled={alterado || carregandoProjecao || Boolean(operacao) || ativacaoNaoConfirmada}>{carregandoProjecao ? <RefreshCcw size={16} className="animate-spin" /> : <Printer size={16} />} {carregandoProjecao ? 'Preparando impressão' : 'Imprimir'}</Botao> : null}
                    {podeGerenciar ? <Botao type="button" variante="perigo" onClick={() => setConfirmarArquivo(true)} disabled={!edicaoEntreAbas.podeEditar || alterado || Boolean(operacao)}>
                      <Archive size={16} /> Arquivar
                    </Botao> : null}
                  </div>
                </CartaoCabecalho>
              </Cartao>

              {podeGerenciar ? <AvisoEdicaoAbasPlano
                key={`${pacienteId}:${plano.id}`}
                estado={edicaoEntreAbas.estado}
                aoAssumir={edicaoEntreAbas.assumir}
                aoRecarregar={() => setConfirmarReconciliacao(true)}
              /> : null}

              {podeGerenciar ? (plano.draft ? (edicaoIndisponivel ? (
                <div role="alert" className="grid gap-3 rounded-md border border-alerta-borda bg-alerta-suave p-4 text-sm text-alerta-forte">
                  <p>O documento editorial protegido não pôde ser lido. O conteúdo materializado não será usado como substituto. Atualize o plano para tentar reconciliar o rascunho.</p>
                  <Botao type="button" onClick={() => setConfirmarReconciliacao(true)} disabled={Boolean(operacao)}>Recarregar rascunho</Botao>
                </div>
              ) : (
                <form noValidate onSubmit={(evento) => { evento.preventDefault(); void salvar(); }} onCompositionStartCapture={() => {
                  compondoRef.current = true;
                  coordenadorEdicaoRef.current?.configurar({ suspenso: true });
                }} onCompositionEndCapture={() => {
                  compondoRef.current = false;
                  coordenadorEdicaoRef.current?.configurar({ suspenso: copiaEmAndamento });
                }} className="grid gap-4 pb-16 lg:pb-0">
                  {plano.draft.apresentacaoEstado === 'indisponivel' ? (
                    <div role="alert" className="rounded-md border border-alerta-borda bg-alerta-suave p-4 text-sm text-alerta-forte">
                      A configuração de exibição salva não pode ser lida. Revise as opções abaixo e salve novamente para reconferir esta versão antes de revisar ou publicar.
                    </div>
                  ) : null}
                  <fieldset disabled={!edicaoEntreAbas.podeEditar} className="grid gap-4 rounded-md border border-linha bg-white p-4">
                    <legend className="px-1 text-sm font-semibold text-tinta">Cálculo energetico</legend>
                    <p className="text-sm text-texto-suave">{metaManual ? 'Condição especial: a fórmula populacional não se aplica. Informe a meta manualmente e registre a justificativa clínica.' : 'Estimativa baseada em equacao populacional. Revise os dados e a aplicabilidade antes de definir ou publicar uma meta.'}</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                        Avaliação antropométrica
                        <Selecao value={formulario.avaliacaoAntropometricaId} onChange={(evento) => atualizar((atual) => ({ ...atual, avaliacaoAntropometricaId: evento.target.value }))} required>
                          <option value="">Selecione</option>
                          {avaliacoes.map((avaliacao) => <option key={avaliacao.id} value={avaliacao.id}>{formatarData(avaliacao.avaliadaEm)} - {avaliacao.medidas.pesoKg ?? '-'} kg / {avaliacao.medidas.alturaCm ?? '-'} cm</option>)}
                        </Selecao>
                      </label>
                      {metaManual ? null : (
                        <>
                          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                            Fórmula
                            <Selecao value={formulario.formula} onChange={(evento) => atualizar((atual) => ({ ...atual, formula: evento.target.value as FormulaEnergeticaApi }))}>
                              <option value="">Selecione</option>
                              <option value="mifflin_st_jeor_1990">Mifflin-St Jeor (1990)</option>
                              <option value="harris_benedict_revisada_1984">Harris-Benedict revisada (1984)</option>
                              <option value="fao_oms_unu_1985">FAO/OMS/UNU (1985)</option>
                            </Selecao>
                          </label>
                          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                            Fator de atividade
                            <Campo type="text" inputMode="decimal" maxLength={32} min="1.4" max="2.4" step="0.01" value={formulario.fatorAtividade} onChange={(evento) => atualizar((atual) => ({ ...atual, fatorAtividade: evento.target.value }))} required />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                            Ajuste energetico (kcal)
                            <Campo type="text" inputMode="decimal" maxLength={32} min="-10000" max="10000" step="1" value={formulario.ajusteEnergeticoKcal} onChange={(evento) => atualizar((atual) => ({ ...atual, ajusteEnergeticoKcal: evento.target.value }))} />
                          </label>
                        </>
                      )}
                      {metaManual ? (
                        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                          Método dos macronutrientes
                          <Selecao value={formulario.metodoMacrosManual} onChange={(evento) => atualizar((atual) => ({ ...atual, metodoMacrosManual: evento.target.value as MetodoMacrosManualApi }))}>
                            <option value="">Selecione</option>
                            <option value="percentual">Percentual da meta energética</option>
                            <option value="gramas_por_kg">Gramas por quilo (g/kg)</option>
                          </Selecao>
                        </label>
                      ) : null}
                      {metaManual && !macrosPorPeso ? (
                        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                          Meta energética (kcal)
                          <Campo type="text" inputMode="decimal" maxLength={32} min="1" max="20000" step="1" value={formulario.metaEnergeticaManualKcal} onChange={(evento) => atualizar((atual) => ({ ...atual, metaEnergeticaManualKcal: evento.target.value }))} required />
                        </label>
                      ) : null}
                    </div>
                    {macrosPorPeso ? (
                      <div className="grid gap-3 rounded-md bg-superficie p-3 sm:grid-cols-3">
                        {([
                          ['carboidratosGPorKg', 'Carboidratos (g/kg)'],
                          ['proteinasGPorKg', 'Proteinas (g/kg)'],
                          ['gordurasGPorKg', 'Gorduras (g/kg)']
                        ] as const).map(([campo, rotulo]) => (
                          <label key={campo} className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                            {rotulo}
                            <Campo type="text" inputMode="decimal" maxLength={32} min="0" max="50" step="0.01" value={formulario[campo]} onChange={(evento) => atualizar((atual) => ({ ...atual, [campo]: evento.target.value }))} required />
                          </label>
                        ))}
                        <p className="sm:col-span-3 text-sm text-texto-suave">A meta energética é calculada a partir dos gramas prescritos e do peso da avaliação selecionada.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 rounded-md bg-superficie p-3 sm:grid-cols-3">
                        {([
                          ['carboidratosBasisPoints', 'Carboidratos (%)'],
                          ['proteinasBasisPoints', 'Proteinas (%)'],
                          ['gordurasBasisPoints', 'Gorduras (%)']
                        ] as const).map(([campo, rotulo]) => (
                          <label key={campo} className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">
                            {rotulo}
                            <Campo type="text" inputMode="decimal" maxLength={32} min="0" max="100" step="0.01" value={formulario.percentuaisMacrosEdicao && Object.prototype.hasOwnProperty.call(formulario.percentuaisMacrosEdicao, campo) ? valorNumericoEdicao(formulario.percentuaisMacrosEdicao[campo]) : interpretarNumeroEdicao(formulario[campo]) === undefined ? formulario[campo] : Number(interpretarNumeroEdicao(formulario[campo])) / 100} onChange={(evento) => { const texto = evento.target.value; atualizar((atual) => ({ ...atual, [campo]: percentualParaBasisPointsEdicao(texto) ?? texto, percentuaisMacrosEdicao: { ...atual.percentuaisMacrosEdicao, [campo]: texto } })); }} required />
                          </label>
                        ))}
                        <p className={`sm:col-span-3 text-sm font-medium ${somaMacros === 10000 ? 'text-sucesso-forte' : 'text-perigo'}`}>Total: {somaMacros === undefined ? 'Dados incompletos' : `${(somaMacros / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</p>
                      </div>
                    )}
                    {metaManual ? null : (
                      <label className="flex min-h-11 items-start gap-3 rounded-md border border-linha p-3 text-sm text-tinta">
                        <input type="checkbox" className="mt-1 h-4 w-4 accent-primaria" checked={formulario.aplicabilidadeFormulaConfirmada} onChange={(evento) => atualizar((atual) => ({ ...atual, aplicabilidadeFormulaConfirmada: evento.target.checked }))} />
                        <span>Revisei os dados da avaliação e confirmo a aplicabilidade da fórmula para este paciente.</span>
                      </label>
                    )}
                    <label className="flex min-h-11 items-start gap-3 rounded-md border border-linha p-3 text-sm text-tinta">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-primaria" checked={formulario.possuiCondicaoEspecial} onChange={(evento) => atualizar((atual) => ({ ...atual, possuiCondicaoEspecial: evento.target.checked }))} />
                      <span>O paciente possui condicao especial que exige justificativa clínica.</span>
                    </label>
                    {metaManual ? <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Justificativa da condicao especial<AreaTexto value={formulario.justificativaCondicaoEspecial} onChange={(evento) => atualizar((atual) => ({ ...atual, justificativaCondicaoEspecial: evento.target.value }))} maxLength={2000} required /></label> : null}
                  </fieldset>

                  <fieldset disabled={!edicaoEntreAbas.podeEditar} className="grid gap-3 rounded-md border border-linha bg-white p-4">
                    <legend className="px-1 text-sm font-semibold text-tinta">Conduta</legend>
                    <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Objetivo clínico<AreaTexto value={formulario.objetivos} onChange={(evento) => atualizar((atual) => ({ ...atual, objetivos: evento.target.value }))} maxLength={4000} required /></label>
                    <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Observações para o plano<AreaTexto value={formulario.observacoes} onChange={(evento) => atualizar((atual) => ({ ...atual, observacoes: evento.target.value }))} maxLength={8000} /></label>
                  </fieldset>

                  <ModelosPlanoAlimentar
                    refeicoesAtuais={() => refeicoesParaModelo(formulario)}
                    aoAplicar={aplicarRefeicoesDeModelo}
                    desabilitado={!edicaoEntreAbas.podeEditar || Boolean(operacao)}
                  />

                  <CopiarRefeicaoDePlano
                    key={`${pacienteId}:${plano.id}:${plano.draft.id}`}
                    pacienteIdAtual={pacienteId}
                    planoIdDestino={plano.id}
                    versaoRascunhoDestinoId={plano.draft.id}
                    destinoChave={`${pacienteId}:${plano.id}:${plano.draft.id}`}
                    refeicoesDestino={formulario.refeicoes}
                    gerarChave={novaChaveCliente}
                    aoAplicar={aplicarRefeicaoCopiada}
                    aoIniciarCopia={iniciarCopia}
                    desabilitado={!edicaoEntreAbas.podeEditar || Boolean(operacao)}
                  />

                  {/* Mesma conversao do modelo de proposito: duplicar so difere na origem
                      das refeicoes, entao passar pelo mesmo par garante chaves novas e o
                      item completo, sem um segundo caminho de copia para divergir. */}
                  <DuplicarPlanoDeOutroPaciente
                    pacienteIdAtual={pacienteId}
                    aoAplicar={(versao) => aplicarRefeicoesDeModelo(refeicoesParaModelo(formularioDaVersao(versao)))}
                    desabilitado={!edicaoEntreAbas.podeEditar || Boolean(operacao)}
                  />

                  <BibliotecaReceitasNutricionais
                    pacienteId={pacienteId}
                    validarAntesDeSalvar={(chaveRefeicao) => validarMicronutrientesFormulario(formularioAtualRef.current, chaveRefeicao)}
                    refeicoes={() => formulario.refeicoes.map((refeicao) => ({
                      chave: refeicao.chaveCliente,
                      nome: refeicao.nome,
                      itens: itensParaBiblioteca(refeicao.itens)
                    }))}
                    aoInserir={(chaveRefeicao, itens) => {
                      atualizar((atual) => ({
                        ...atual,
                        refeicoes: atual.refeicoes.map((refeicao) =>
                          refeicao.chaveCliente === chaveRefeicao
                            ? { ...refeicao, itens: [...refeicao.itens, ...itensDaBiblioteca(itens)] }
                            : refeicao
                        )
                      }));
                      setRefeicoesAbertas((atuais) => new Set(atuais).add(chaveRefeicao));
                    }}
                    desabilitado={!edicaoEntreAbas.podeEditar || Boolean(operacao)}
                  />

                  <PreferenciasApresentacaoPlano
                    profissional={formulario.preferenciasApresentacao.profissional}
                    paciente={formulario.preferenciasApresentacao.paciente}
                    aoAlterar={atualizarPreferenciaApresentacao}
                    desabilitado={!edicaoEntreAbas.podeEditar || Boolean(operacao) || copiaEmAndamento}
                    refeicoes={formulario.refeicoes}
                    metas={resultadosVigentes && metasSalvas ? {
                      energiaKcal: metasSalvas.metaEnergeticaKcal,
                      carboidratosG: metasSalvas.metasMacronutrientes.carboidratosG,
                      proteinasG: metasSalvas.metasMacronutrientes.proteinasG,
                      gordurasG: metasSalvas.metasMacronutrientes.gordurasG
                    } : undefined}
                  />

                  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  <div className="grid gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><h3 className="text-base font-semibold text-tinta">Refeições e alimentos</h3><p className="text-sm text-texto-suave">A composição selecionada e congelada quando a versão e publicada.</p></div>
                      <div className="flex flex-wrap gap-2">
                        <Botao type="button" variante="fantasma" onClick={() => definirTodasRefeicoesAbertas(!todasRefeicoesAbertas)}>
                          {todasRefeicoesAbertas ? 'Recolher todas' : 'Expandir todas'}
                        </Botao>
                        <Botao type="button" onClick={adicionarRefeicao} disabled={!edicaoEntreAbas.podeEditar}><Plus size={16} /> Adicionar refeição</Botao>
                      </div>
                    </div>
                    <DndContext sensors={sensoresArraste} collisionDetection={closestCenter} onDragEnd={finalizarArrasteRefeicao}>
                      <SortableContext items={formulario.refeicoes.map((refeicao) => refeicao.chaveCliente)} strategy={verticalListSortingStrategy}>
                    {formulario.refeicoes.map((refeicao, indiceRefeicao) => (
                      <RefeicaoOrdenavel
                        key={refeicao.chaveCliente}
                        id={refeicao.chaveCliente}
                        nome={refeicao.nome}
                        posicao={indiceRefeicao}
                        aberto={refeicoesAbertas.has(refeicao.chaveCliente)}
                        aoAlternar={() => alternarRefeicao(refeicao.chaveCliente)}
                        subtotalVisual={localizarAtivacaoRefeicao(plano.draft, refeicao.chaveCliente)?.ativa === false
                          ? 'Desativada · fora dos totais'
                          : !localizarAtivacaoRefeicao(plano.draft, refeicao.chaveCliente)
                            ? 'Visibilidade pendente de salvamento'
                            : resultadosVigentes ? (() => {
                          const subtotal = subtotaisRefeicoes[indiceRefeicao];
                          if (subtotal.estado === 'sem_alimentos') return 'Sem alimentos';
                          const partes = [
                            `${formatarNutrienteSubtotal(subtotal.energiaKcal)} kcal`,
                            `P ${formatarNutrienteSubtotal(subtotal.proteinasG, 1)} g`,
                            `C ${formatarNutrienteSubtotal(subtotal.carboidratosG, 1)} g`,
                            `G ${formatarNutrienteSubtotal(subtotal.gordurasG, 1)} g`
                          ];
                          if (subtotal.estado === 'incompleto') partes.push('Dados incompletos');
                          return partes.join(' · ');
                        })() : 'Pendente de materialização'}
                        subtotalAcessivel={localizarAtivacaoRefeicao(plano.draft, refeicao.chaveCliente)?.ativa === false
                          ? `Subtotal da refeição ${indiceRefeicao + 1} não incluído nos totais porque está desativada.`
                          : !localizarAtivacaoRefeicao(plano.draft, refeicao.chaveCliente)
                            ? `Visibilidade da refeição ${indiceRefeicao + 1} pendente de salvamento.`
                            : resultadosVigentes ? (() => {
                          const subtotal = subtotaisRefeicoes[indiceRefeicao];
                          if (subtotal.estado === 'sem_alimentos') return 'Sem alimentos';
                          const partes = [
                            `Energia: ${formatarNutrienteSubtotal(subtotal.energiaKcal)} quilocalorias`,
                            `Proteínas: ${formatarNutrienteSubtotal(subtotal.proteinasG, 1)} gramas`,
                            `Carboidratos: ${formatarNutrienteSubtotal(subtotal.carboidratosG, 1)} gramas`,
                            `Gorduras: ${formatarNutrienteSubtotal(subtotal.gordurasG, 1)} gramas`
                          ];
                          if (subtotal.estado === 'incompleto') partes.push('Dados incompletos');
                          return `Subtotal da refeição ${indiceRefeicao + 1}, ${refeicao.nome || 'sem nome'}: ${partes.join(', ')}`;
                        })() : `Subtotal da refeição ${indiceRefeicao + 1} indisponível enquanto o rascunho estiver pendente de materialização.`}
                        arrasteDesabilitado={!edicaoEntreAbas.podeEditar}
                        acoes={<>
                          {podeGerenciar ? (() => {
                            const estado = localizarAtivacaoRefeicao(plano.draft, refeicao.chaveCliente);
                            return estado ? <ControleAtivacao
                              rotulo={`Visibilidade da refeição ${refeicao.nome || indiceRefeicao + 1}`}
                              ativo={estado.ativa}
                              desabilitado={Boolean(operacao) || copiaEmAndamento}
                              aoAlternar={() => void alterarVisibilidadeRefeicao(estado.identidadeId, !estado.ativa)}
                            /> : <span className="px-2 text-xs text-texto-suave">Salve para definir a visibilidade</span>;
                          })() : null}
                          <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11 min-w-11" onClick={() => atualizar((atual) => ({ ...atual, refeicoes: mover(atual.refeicoes, indiceRefeicao, indiceRefeicao - 1) }))} disabled={!edicaoEntreAbas.podeEditar || indiceRefeicao === 0} aria-label={`Mover refeição ${refeicao.nome || indiceRefeicao + 1} para cima`}><ArrowUp size={15} /></Botao>
                          <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11 min-w-11" onClick={() => atualizar((atual) => ({ ...atual, refeicoes: mover(atual.refeicoes, indiceRefeicao, indiceRefeicao + 1) }))} disabled={!edicaoEntreAbas.podeEditar || indiceRefeicao === formulario.refeicoes.length - 1} aria-label={`Mover refeição ${refeicao.nome || indiceRefeicao + 1} para baixo`}><ArrowDown size={15} /></Botao>
                          <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11" onClick={() => duplicarRefeicaoLocal(indiceRefeicao)} disabled={!edicaoEntreAbas.podeEditar || Boolean(operacao)} aria-label={`Duplicar refeição ${refeicao.nome || indiceRefeicao + 1}`}>Duplicar</Botao>
                          <Botao type="button" variante="fantasma" tamanho="sm" className="min-h-11" onClick={() => {
                            atualizar((atual) => ({ ...atual, refeicoes: atual.refeicoes.filter((_, posicao) => posicao !== indiceRefeicao) }));
                            setRefeicoesAbertas((atuais) => {
                              const proximas = new Set(atuais);
                              proximas.delete(refeicao.chaveCliente);
                              return proximas;
                            });
                          }} disabled={!edicaoEntreAbas.podeEditar || formulario.refeicoes.length === 1}><Trash2 size={15} /> Remover</Botao>
                        </>}
                      >
                        <fieldset disabled={!edicaoEntreAbas.podeEditar} className="contents" aria-label="Campos da refeição">
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Nome da refeição<Campo value={refeicao.nome} onChange={(evento) => atualizarRefeicao(indiceRefeicao, { ...refeicao, nome: evento.target.value })} maxLength={180} required /></label>
                          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Horário<Campo type="time" value={refeicao.horarioLocal ?? ''} onChange={(evento) => atualizarRefeicao(indiceRefeicao, { ...refeicao, horarioLocal: evento.target.value })} /></label>
                        </div>
                        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave">Orientações da refeição<AreaTexto value={refeicao.orientacoes ?? ''} onChange={(evento) => atualizarRefeicao(indiceRefeicao, { ...refeicao, orientacoes: evento.target.value })} maxLength={2000} /></label>
                        <div className="grid gap-3">
                          {refeicao.itens.map((item, indiceItem) => (
                            <EditorItem
                              key={item.chaveCliente}
                              pacienteId={pacienteId}
                              contextoEdicao={`${plano.id}:${plano.draft?.id ?? ''}`}
                              podeEditar={edicaoEntreAbas.podeEditar}
                              item={item}
                              resumo={refeicoesParaResultado[indiceRefeicao]?.itens[indiceItem]}
                              indice={indiceItem}
                              total={refeicao.itens.length}
                              mostrarResumo={resultadosVigentes}
                              aoAlterar={(novo) => atualizarRefeicao(indiceRefeicao, { ...refeicao, itens: refeicao.itens.map((atual, posicao) => posicao === indiceItem ? novo : atual) })}
                              aoRemover={() => atualizarRefeicao(indiceRefeicao, { ...refeicao, itens: refeicao.itens.filter((_, posicao) => posicao !== indiceItem) })}
                              aoMover={(destino) => atualizarRefeicao(indiceRefeicao, { ...refeicao, itens: mover(refeicao.itens, indiceItem, destino) })}
                            />
                          ))}
                          <Botao type="button" onClick={() => atualizarRefeicao(indiceRefeicao, { ...refeicao, itens: [...refeicao.itens, novoItem()] })} disabled={!edicaoEntreAbas.podeEditar}><Plus size={16} /> Adicionar alimento</Botao>
                        </div>
                        </fieldset>
                      </RefeicaoOrdenavel>
                    ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                    {resultadosVigentes && plano.ativoParaPaciente === true ? (
                      <PainelNutricional
                        refeicoes={refeicoesPrevistas}
                        pesoTotalGramas={pesoTotalGramas}
                        metas={metasSalvas}
                        metasDesatualizadas={false}
                      />
                    ) : resultadosVigentes ? (
                      <div role="status" className="rounded-md border border-linha bg-superficie p-3 text-sm text-texto-suave">Plano oculto do paciente e excluído dos totais ativos. Ative o plano para incluir suas refeições que estiverem visíveis.</div>
                    ) : !ativacaoEdicaoCompleta && !alterado ? (
                      <div role="status" className="rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm text-alerta-forte">A visibilidade de uma ou mais refeições não pôde ser confirmada. Atualize o plano antes de consultar os totais.</div>
                    ) : <div role="status" className="rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm text-alerta-forte">Cálculos e subtotais indisponíveis enquanto há alterações locais ou uma revisão editorial pendente de materialização.</div>}
                  </div>

                  {resultadosVigentes && plano.draft.calculo ? (
                    <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
                      <div><h3 className="text-sm font-semibold text-tinta">{plano.draft.calculo.estimativa ? 'Resultado calculado' : 'Meta definida manualmente'}</h3><p className="text-sm text-texto-suave">{plano.draft.calculo.estimativa ? plano.draft.calculo.estimativa.aviso : 'Condição especial: meta informada pelo profissional, sem fórmula populacional.'}</p></div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {plano.draft.calculo.estimativa ? (
                          <>
                            <div><p className="text-xs text-texto-suave">Repouso estimado</p><p className="text-lg font-semibold text-tinta">{formatarNumero(plano.draft.calculo.estimativa.metabolismoRepousoKcal)} kcal</p></div>
                            <div><p className="text-xs text-texto-suave">GET estimado</p><p className="text-lg font-semibold text-tinta">{formatarNumero(plano.draft.calculo.estimativa.gastoEnergeticoTotalKcal)} kcal</p></div>
                          </>
                        ) : (
                          <div><p className="text-xs text-texto-suave">Método dos macros</p><p className="text-lg font-semibold text-tinta">{plano.draft.calculo.metodoMacrosManual === 'gramas_por_kg' ? 'g/kg' : 'Percentual'}</p></div>
                        )}
                        <div><p className="text-xs text-texto-suave">{plano.draft.calculo.estimativa ? 'Meta ajustada' : 'Meta energética'}</p><p className="text-lg font-semibold text-tinta">{formatarNumero(plano.draft.calculo.metaEnergeticaKcal)} kcal</p></div>
                      </div>
                      {plano.draft.calculo.alertasDivergenciaClinica?.length ? (
                        <div className="grid gap-3 rounded-md border border-alerta-borda bg-alerta-suave p-3">
                          <div>
                            <p className="text-sm font-semibold text-alerta-forte">Divergencias que exigem revisão clínica</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-alerta-forte">
                              {plano.draft.calculo.alertasDivergenciaClinica.map((alerta) => <li key={alerta}>{alerta}</li>)}
                            </ul>
                          </div>
                          <label className="grid gap-1 text-xs font-semibold uppercase text-alerta-forte">
                            Justificativa clínica para prosseguir
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
                      {plano.draft.calculo.estimativa ? (
                        <details className="text-sm text-texto-suave"><summary className="cursor-pointer font-medium text-tinta">Fórmula e fonte</summary><p className="mt-2">{plano.draft.calculo.estimativa.formulaAplicada}</p><p className="mt-1">{plano.draft.calculo.estimativa.fonte}</p></details>
                      ) : (
                        <details className="text-sm text-texto-suave"><summary className="cursor-pointer font-medium text-tinta">Justificativa da condição especial</summary><p className="mt-2">{plano.draft.calculo.justificativaCondicaoEspecial}</p></details>
                      )}
                    </section>
                  ) : null}

                  {/* No mobile a previa nutricional ocupa a base da tela. A
                      barra de acoes sobe e fica acima dela no empilhamento:
                      com a folha expandida, tabular ate Salvar deixaria o foco
                      escondido atras dela (WCAG 2.2 SC 2.4.11). */}
                  <div className="sticky bottom-20 z-30 flex flex-wrap justify-end gap-2 rounded-md border border-linha bg-white p-3 shadow-cartao lg:bottom-3 lg:z-10">
                    {copiaEmAndamento ? <p role="status" className="w-full text-sm text-texto-suave">Aguarde a cópia antes de salvar, revisar ou publicar.</p> : null}
                    <Botao type="submit" variante="primario" carregando={operacao === 'salvando-edicao'} disabled={!edicaoEntreAbas.podeEditar || Boolean(operacao) || copiaEmAndamento || edicaoIndisponivel || ['conflito', 'incerto', 'acesso-negado'].includes(estadoAutosave)}><Save size={16} /> Salvar rascunho</Botao>
                    <Botao type="button" carregando={operacao === 'revisando'} disabled={!edicaoEntreAbas.podeEditar || alterado || estadoAutosave !== 'salvo' || Boolean(operacao) || copiaEmAndamento || !plano.draft.calculo} onClick={() => transicionarVersao('revisando')}><ClipboardCheck size={16} /> Revisar</Botao>
                    <Botao type="button" variante="primario" carregando={operacao === 'publicando'} disabled={!edicaoEntreAbas.podeEditar || alterado || estadoAutosave !== 'salvo' || Boolean(operacao) || copiaEmAndamento || !plano.draft.revisadaEm} onClick={() => transicionarVersao('publicando')}><CheckCircle2 size={16} /> Publicar</Botao>
                  </div>
                </form>
              )) : (
                plano.current ? <div className="grid gap-3">
                  {podeGerenciar ? <div role="status" className="rounded-md border border-linha bg-superficie p-3 text-sm text-texto-suave">O plano publicado continua disponível para o paciente enquanto você não o ocultar. As refeições podem ser ativadas separadamente.</div> : null}
                  <ResumoVersao
                    plano={plano}
                    versao={plano.current}
                    podeAlterarVisibilidade={podeGerenciar}
                    aoAlternarRefeicao={alterarVisibilidadeRefeicao}
                    operacaoPendente={Boolean(operacao) || copiaEmAndamento}
                  />
                  {podeGerenciar ? <Botao type="button" variante="primario" carregando={operacao === 'nova-versao'} onClick={() => void executar('nova-versao', () => criarNovaVersaoPlanoAlimentar(pacienteId, plano.id), 'Nova versão criada a partir da publicação atual.')} disabled={!edicaoEntreAbas.podeEditar || Boolean(operacao)}><Plus size={16} /> Criar nova versão</Botao> : null}
                </div> : <EstadoVazio titulo="Nenhum rascunho ativo" descricao="Crie uma versão para continuar a edição do plano." acao={undefined} />
              )) : (
                <div className="grid gap-4">
                  <div role="status" className="rounded-md border border-linha bg-superficie px-4 py-3 text-sm text-texto-suave">
                    Acesso somente para consulta. A edição e a públicação dependem da permissão de gestao de planos alimentares.
                  </div>
                  {plano.current || plano.draft ? (
                    <ResumoVersao plano={plano} versao={plano.current ?? plano.draft!} />
                  ) : (
                    <EstadoVazio titulo="Plano sem versão disponível" descricao="Não há conteúdo clínico disponível para consulta neste plano." />
                  )}
                </div>
              )}

              {plano.historico.length ? (
                <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
                  <div className="flex items-center gap-2"><History size={17} className="text-primaria" /><h3 className="text-sm font-semibold text-tinta">Histórico de versões</h3></div>
                  <div className="grid gap-2">
                    {plano.historico.map((versao) => (
                      <div key={versao.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-2 first:border-t-0 first:pt-0">
                        <div>
                          <p className="text-sm font-medium text-tinta">Versão {versao.numero}</p>
                          <p className="text-xs text-texto-suave">{versao.status === 'publicada' ? `Publicada em ${formatarData(versao.publicadaEm)}` : `Descartada em ${formatarData(versao.descartadaEm)}`}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {versao.hashConteudo ? <span className="max-w-48 truncate font-mono text-xs text-texto-suave" title={versao.hashConteudo}>{versao.hashConteudo}</span> : null}
                          <Botao
                            type="button"
                            variante={numeroVersaoConsultada === versao.numero ? 'primario' : 'fantasma'}
                            tamanho="sm"
                            onClick={() => consultarVersao(versao.numero)}
                            disabled={carregandoAcompanhamento && numeroVersaoConsultada === versao.numero}
                          >
                            Consultar versão {versao.numero}
                          </Botao>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {carregandoProjecao ? <p role="status" className="text-sm text-texto-suave">Preparando a apresentação autorizada do paciente…</p> : null}
              {projecaoPaciente?.modo === 'rascunho' && projecaoPaciente.ativacaoRevisao === (plano.ativacaoRevisao ?? 0) && projecaoPaciente.chave.startsWith(`${pacienteId}:${plano.id}:`) ? (
                <section className="nao-imprimir grid gap-2" aria-label="Prévia do paciente">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-tinta">Prévia do paciente</h3>
                    <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setProjecaoPaciente(null)}>Fechar prévia</Botao>
                  </div>
                  <PlanoAlimentarPaciente plano={projecaoPaciente.dados} rotuloPreview="Prévia do rascunho salvo — ainda não publicado" mostrarBotaoImprimir={false} />
                </section>
              ) : null}

              {carregandoAcompanhamento ? <BarraCarregamento visivel rotulo="Carregando acompanhamento da versão" /> : null}
              {erroAcompanhamento ? <AlertaOperacional mensagem={erroAcompanhamento} /> : null}
              {versaoConsultada && plano.current?.numero !== versaoConsultada.numero ? (
                <section className="grid gap-3" aria-label={`Conteúdo histórico da versão ${versaoConsultada.numero}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-tinta">Conteúdo congelado da versão {versaoConsultada.numero}</p>
                    <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => consultarVersao(plano.current?.numero ?? null)}>
                      Voltar à versão atual
                    </Botao>
                  </div>
                  <ResumoVersao plano={plano} versao={versaoConsultada} />
                  {versaoConsultada.status !== 'publicada' ? (
                    <p className="rounded-md border border-linha bg-superficie p-3 text-sm text-texto-suave">
                      Esta versão não foi publicada; não existe janela factual de acompanhamento.
                    </p>
                  ) : null}
                </section>
              ) : null}
              {acompanhamento ? (
                <PainelAcompanhamentoVersao
                  acompanhamento={acompanhamento}
                  aoMudarPagina={mudarPaginaAcompanhamento}
                />
              ) : null}
            </>
          ) : null}
        </main>
      </div>

      {projecaoPaciente?.modo === 'impressao' && plano?.current && projecaoPaciente.ativacaoRevisao === (plano.ativacaoRevisao ?? 0) && projecaoPaciente.chave.startsWith(`${pacienteId}:${plano.id}:`) ? (
        <div className="hidden print:block" data-impressao-paciente-chave={projecaoPaciente.chave}>
          <PlanoAlimentarPaciente plano={projecaoPaciente.dados} impressaoSomente mostrarBotaoImprimir={false} />
        </div>
      ) : null}

      {podeGerenciar ? <ModalConfirmacao
        aberto={confirmarCriacao}
        titulo="Criar outro plano"
        mensagem="Existem alterações não salvas no rascunho atual. Criar outro plano descartara essas alterações."
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
        mensagem="O plano deixara a lista ativa. As versões publicadas permanecem preservadas no histórico clínico."
        rotuloConfirmar="Arquivar plano"
        confirmando={operacao === 'arquivando'}
        aoCancelar={() => setConfirmarArquivo(false)}
        aoConfirmar={() => {
          if (!plano) return;
          void executar('arquivando', () => arquivarPlanoAlimentar(pacienteId, plano.id), 'Plano alimentar arquivado.', '').finally(() => setConfirmarArquivo(false));
        }}
      /> : null}

      {podeGerenciar ? <ModalConfirmacao
        aberto={confirmarReconciliacao}
        titulo="Recarregar rascunho"
        mensagem="As alterações que ainda estão somente nesta tela serão descartadas. O sistema carregará novamente a revisão confirmada pelo servidor."
        rotuloConfirmar="Descartar e recarregar"
        confirmando={carregando}
        aoCancelar={() => setConfirmarReconciliacao(false)}
        aoConfirmar={() => {
          const id = plano?.id;
          setConfirmarReconciliacao(false);
          edicaoEntreAbas.pausarParaReconferencia();
          coordenadorEdicaoRef.current?.encerrar();
          coordenadorEdicaoRef.current = null;
          if (id) void carregar(id).then(carregado => {
            if (carregado && pacienteAtualRef.current === pacienteId && planoAtualRef.current?.id === id) {
              void edicaoEntreAbas.reiniciarEmConsulta();
            }
          });
        }}
      /> : null}
    </div>
  );
}
