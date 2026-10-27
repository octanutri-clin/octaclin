'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Campo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional } from '@/components/ui/feedback';
import {
  obterPreferenciasEquivalencia,
  preverEquivalenciasPlano,
  salvarPreferenciasEquivalencia,
  type LinhaPreviaEquivalenciaApi,
  type NutrienteEquivalencia,
  type PedidoPreviaEquivalenciasApi,
  type PoliticaEquivalencia,
  type PreferenciasEquivalencia,
  type PreviaEquivalenciasApi
} from '@/lib/equivalencias-plano-api';
import type { AlternativaEdicao, DocumentoEdicaoPlano } from '@/lib/edicao-plano';

const NUTRIENTES: { valor: NutrienteEquivalencia; rotulo: string; unidade: string }[] = [
  { valor: 'energiaKcal', rotulo: 'Energia', unidade: 'kcal' },
  { valor: 'proteinasG', rotulo: 'Proteínas', unidade: 'g' },
  { valor: 'carboidratosG', rotulo: 'Carboidratos', unidade: 'g' },
  { valor: 'gordurasG', rotulo: 'Gorduras totais', unidade: 'g' }
];
const PADRAO: PreferenciasEquivalencia = {
  schemaVersao: 1, unidades: 'gramas_e_medida_disponivel', casasGramas: 3,
  casasNutrientes: 2, passoPorcaoGramas: '1', modoComparacao: 'detalhado'
};

export interface PainelEquivalenciaNutrienteProps<T extends AlternativaEdicao> {
  pacienteId: string;
  planoId: string;
  versaoId?: string;
  rascunhoRevisao?: number;
  documentoEdicao: DocumentoEdicaoPlano;
  itemChave: string;
  principalDescricao: string;
  porcaoPrincipalGramas?: number | string;
  alternativas: T[];
  /** Estados projetados pelo backend para reapresentar equivalências antigas. */
  recalculosPendentes?: Array<{ chaveCliente: string; descricao: string; nutriente: NutrienteEquivalencia }>;
  desabilitado?: boolean;
  /** Atualiza somente as alternativas escolhidas; o principal permanece intacto. */
  aoConfirmar: (alternativas: T[]) => void | boolean | Promise<void | boolean>;
}

interface EscolhaMedida {
  id: string; revisao: number; aplicacaoId: string; nome: string; quantidade: string;
  quantidadeReferencia: number; pesoReferenciaGramas: number;
}

function mostrar(valor: string | undefined, unidade = '') {
  return valor === undefined ? '—' : `${valor}${unidade ? ` ${unidade}` : ''}`;
}

/** Arredondamento visual decimal exato; preserva sentinelas pequenos não zero. */
function formatarDecimalVisual(valor: string | undefined, casas: number): string | undefined {
  if (valor === undefined || valor.startsWith('<') || valor.startsWith('-<')) return valor;
  const correspondencia = /^(-?)(\d+)(?:\.(\d+))?$/.exec(valor);
  if (!correspondencia) return valor;
  const [, sinal, inteiro, fracao = ''] = correspondencia;
  const escala = 10n ** BigInt(casas);
  const parcela = BigInt((fracao.slice(0, casas) || '').padEnd(casas, '0') || '0');
  const proximo = fracao[casas];
  const magnitude = BigInt(inteiro) * escala + parcela + (proximo && proximo >= '5' ? 1n : 0n);
  const totalInteiro = casas ? magnitude / escala : magnitude;
  const totalFracao = casas ? String(magnitude % escala).padStart(casas, '0') : '';
  if (magnitude === 0n && (BigInt(inteiro) !== 0n || BigInt(fracao || '0') !== 0n)) {
    return `${sinal}<${casas ? `0,${'0'.repeat(casas - 1)}1` : '1'}`;
  }
  return `${sinal}${totalInteiro}${casas ? `,${totalFracao}` : ''}`;
}

function mostrarPreferencia(valor: string | undefined, casas: number, unidade: string) {
  return mostrar(formatarDecimalVisual(valor, casas), unidade);
}

const MENSAGENS_INDISPONIBILIDADE: Record<string, string> = {
  nutriente_invalido: 'Escolha um dos nutrientes disponíveis.',
  principal_invalido: 'Confira a porção do alimento principal.',
  base_invalida: 'A base nutricional de um dos alimentos está indisponível.',
  alvo_ausente: 'Falta a informação do nutriente escolhido para o alimento principal.',
  concentracao_ausente: 'Falta a informação do nutriente escolhido para esta alternativa.',
  alvo_zero_sem_porcao_positiva: 'O alimento principal não tem quantidade positiva do nutriente escolhido; não há uma porção alternativa positiva para igualar.',
  alvo_zero_indeterminado: 'Os dois alimentos têm valor zero para o nutriente escolhido; não é possível determinar uma porção equivalente por esse critério.',
  concentracao_zero: 'A alternativa não tem quantidade do nutriente escolhido para igualar um alvo positivo.',
  porcao_efetiva_invalida: 'A porção informada está fora dos valores permitidos.',
  dados_invalidos_ou_limite_precisao: 'Não foi possível calcular com esses dados. Confira as porções e os valores nutricionais.',
  referencia_indisponivel: 'A referência nutricional desta alternativa está indisponível.'
};

function explicarIndisponibilidade(motivo: string) {
  return Object.prototype.hasOwnProperty.call(MENSAGENS_INDISPONIBILIDADE, motivo)
    ? MENSAGENS_INDISPONIBILIDADE[motivo]
    : 'Confira a porção, o preparo e os dados nutricionais dos alimentos.';
}

function idAleatorio() {
  return globalThis.crypto.randomUUID();
}

export function PainelEquivalenciaNutriente<T extends AlternativaEdicao>(props: PainelEquivalenciaNutrienteProps<T>) {
  const { pacienteId, planoId, versaoId, rascunhoRevisao, documentoEdicao, itemChave, principalDescricao,
    porcaoPrincipalGramas, alternativas, recalculosPendentes = [], desabilitado = false, aoConfirmar } = props;
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [nutriente, setNutriente] = useState<NutrienteEquivalencia>('energiaKcal');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [previa, setPrevia] = useState<PreviaEquivalenciasApi>();
  const [assinaturaPrevia, setAssinaturaPrevia] = useState<string>();
  const [preferencias, setPreferencias] = useState<PreferenciasEquivalencia>(PADRAO);
  const [revisaoPreferencias, setRevisaoPreferencias] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [salvandoPreferencias, setSalvandoPreferencias] = useState(false);
  const [erro, setErro] = useState('');
  const [ajustes, setAjustes] = useState<Record<string, string>>({});
  const [medidasEscolhidas, setMedidasEscolhidas] = useState<Record<string, EscolhaMedida>>({});
  const [recalculoExplicitoChave, setRecalculoExplicitoChave] = useState<string>();
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const previaSolicitadaRef = useRef(false);
  const assinaturaEntrada = useMemo(() => JSON.stringify({
    versaoId, rascunhoRevisao, documentoEdicao, itemChave, principalDescricao, porcaoPrincipalGramas, nutriente, alternativas,
    passoPorcaoGramas: preferencias.passoPorcaoGramas, ajustes, medidasEscolhidas, recalculoExplicitoChave
  }), [ajustes, alternativas, documentoEdicao, itemChave, medidasEscolhidas, nutriente, porcaoPrincipalGramas, preferencias.passoPorcaoGramas, principalDescricao, rascunhoRevisao, recalculoExplicitoChave, versaoId]);
  const previaCorresponde = Boolean(previa && assinaturaPrevia === assinaturaEntrada);

  useEffect(() => {
    if (!aberto) return;
    const controller = new AbortController();
    void obterPreferenciasEquivalencia(controller.signal).then((resposta) => {
      setPreferencias(resposta.preferencias);
      setRevisaoPreferencias(resposta.revisao);
    }).catch(() => { if (!controller.signal.aborted) setErro('Não foi possível carregar suas preferências. Os padrões estão em uso.'); });
    return () => controller.abort();
  }, [aberto]);

  useEffect(() => () => { requestRef.current?.abort(); }, []);

  const calcular = useCallback(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const generation = ++generationRef.current;
    setCarregando(false);
    setPrevia(undefined);
    setAssinaturaPrevia(undefined);
    setErro('');
    if (!versaoId || !Number.isSafeInteger(rascunhoRevisao) || rascunhoRevisao! < 0) {
      setErro('Salve o rascunho antes de calcular equivalências.');
      return;
    }
    if (!alternativas.length) {
      setErro('Adicione ao menos uma alternativa antes de calcular.');
      return;
    }
    const politica: PoliticaEquivalencia = { passoPorcaoGramas: preferencias.passoPorcaoGramas };
    const pedido: PedidoPreviaEquivalenciasApi = {
      versaoId, rascunhoRevisaoEsperada: rascunhoRevisao!, documentoEdicao,
      itemChave, nutriente,
      // A quantidade salva não é uma escolha nova do nutricionista. Só enviamos
      // porção quando houve edição explícita neste painel.
      alternativas: alternativas.map((alternativa) => {
        const porcaoEscolhida = ajustes[alternativa.chaveCliente];
        const medida = medidasEscolhidas[alternativa.chaveCliente];
        const fatos = { ...alternativa, porcaoGramas: undefined, medidaCaseira: undefined };
        if (medida) return { ...fatos, medidaCaseira: { id: medida.id, revisao: medida.revisao, aplicacaoId: medida.aplicacaoId }, quantidade: medida.quantidade, unidade: medida.nome };
        return porcaoEscolhida === undefined ? fatos : { ...fatos, porcaoGramas: porcaoEscolhida };
      }),
      politica,
      ...(recalculoExplicitoChave ? { recalculoExplicitoChaves: [recalculoExplicitoChave] } : {})
    };
    previaSolicitadaRef.current = true;
    const assinaturaSolicitada = assinaturaEntrada;
    setCarregando(true);
    void preverEquivalenciasPlano(pacienteId, planoId, pedido, controller.signal).then((resposta) => {
      if (generationRef.current === generation && !controller.signal.aborted) {
        setPrevia(resposta);
        setAssinaturaPrevia(assinaturaSolicitada);
      }
    }).catch((falha: unknown) => {
      if (generationRef.current === generation && !controller.signal.aborted) {
        setErro(falha instanceof Error ? falha.message : 'Não foi possível calcular as equivalências.');
      }
    }).finally(() => {
      if (generationRef.current === generation) setCarregando(false);
    });
  }, [alternativas, ajustes, assinaturaEntrada, documentoEdicao, itemChave, medidasEscolhidas, nutriente, pacienteId, planoId, preferencias.passoPorcaoGramas, recalculoExplicitoChave, rascunhoRevisao, versaoId]);

  useEffect(() => {
    if (!aberto || !previaSolicitadaRef.current) return;
    const timer = window.setTimeout(calcular, 150);
    return () => window.clearTimeout(timer);
  // Once the user requests a preview, new inputs invalidate it and schedule a
  // replacement. The preview itself is not a dependency to avoid a request loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, nutriente, ajustes, medidasEscolhidas, preferencias.passoPorcaoGramas, assinaturaEntrada]);

  function alternarAlternativa(chave: string) {
    setSelecionadas((atuais) => {
      const proximas = new Set(atuais);
      if (proximas.has(chave)) proximas.delete(chave); else proximas.add(chave);
      return proximas;
    });
  }

  async function salvarPreferencias() {
    setSalvandoPreferencias(true); setErro('');
    try {
      const resultado = await salvarPreferenciasEquivalencia({ preferencias, revisaoEsperada: revisaoPreferencias });
      setPreferencias(resultado.preferencias); setRevisaoPreferencias(resultado.revisao);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar as preferências.');
    } finally { setSalvandoPreferencias(false); }
  }

  async function confirmar() {
    if (!previa || !previaCorresponde || desabilitado || !versaoId || previa.rascunhoRevisao !== rascunhoRevisao) return;
    const resultadoPorChave = new Map(previa.alternativas.map((linha) => [linha.chaveCliente, linha]));
    const escolhidas = alternativas.filter((alternativa) => selecionadas.has(alternativa.chaveCliente));
    if (!escolhidas.length) return;
    const atualizadas = escolhidas.map((alternativa) => {
      const linha = resultadoPorChave.get(alternativa.chaveCliente);
      if (!linha || linha.resultado.estado !== 'calculavel' || !linha.resultado.aplicavel || !linha.fingerprint) return alternativa;
      const porcao = linha.resultado.porcaoEfetivaGramas;
      const contextoAnterior = alternativa.equivalencia;
      const anteriorAplicacaoId = contextoAnterior && 'aplicacaoId' in contextoAnterior ? contextoAnterior.aplicacaoId : undefined;
      const recalcular = Boolean(anteriorAplicacaoId);
      const comando = {
        acao: recalcular ? 'recalcular' as const : 'calcular' as const,
        aplicacaoId: idAleatorio(),
        ...(recalcular ? { anteriorAplicacaoId } : {}),
        fingerprintEsperado: linha.fingerprint,
        nutriente,
        politica: { passoPorcaoGramas: preferencias.passoPorcaoGramas },
        porcaoEfetiva: porcao
      };
      const medida = medidasEscolhidas[alternativa.chaveCliente];
      return { ...alternativa, quantidade: medida?.quantidade ?? porcao,
        unidade: medida?.nome ?? 'g', porcaoGramas: porcao,
        ...(medida ? {
          medidaCaseira: { id: medida.id, revisao: medida.revisao, aplicacaoId: medida.aplicacaoId },
          referenciaMedidaCaseira: { nome: medida.nome, quantidadeReferencia: medida.quantidadeReferencia, pesoReferenciaGramas: medida.pesoReferenciaGramas }
        } : { medidaCaseira: null, referenciaMedidaCaseira: undefined }),
        equivalencia: comando } as T;
    });
    const confirmada = await aoConfirmar(alternativas.map((alternativa) => atualizadas.find((item) => item.chaveCliente === alternativa.chaveCliente) ?? alternativa));
    if (confirmada === false) return;
    setPrevia(undefined); setSelecionadas(new Set()); setAjustes({}); setMedidasEscolhidas({});
  }

  const linhasSelecionadas = previa?.alternativas.filter((linha) => selecionadas.has(linha.chaveCliente)) ?? [];
  const podeConfirmar = Boolean(previaCorresponde && linhasSelecionadas.length > 0 && linhasSelecionadas.every((linha) =>
    linha.resultado.estado === 'calculavel' && linha.resultado.aplicavel && Boolean(linha.fingerprint)
  ));
  const selecionadasParaRecalculo = alternativas.some((alternativa) => alternativa.chaveCliente === recalculoExplicitoChave && selecionadas.has(alternativa.chaveCliente));

  function atualizarPasso(passo: PoliticaEquivalencia['passoPorcaoGramas']) {
    setPreferencias((atual) => ({ ...atual, passoPorcaoGramas: passo }));
  }

  return <section className="rounded-md border border-linha bg-superficie p-3" aria-label={`Equivalência por nutriente para ${principalDescricao}`}>
    {recalculosPendentes.length ? <div className="grid gap-2 pb-2" aria-label="Equivalências que precisam de revisão">
      {recalculosPendentes.map((pendencia) => <div key={pendencia.chaveCliente} className="flex flex-wrap items-center justify-between gap-2 rounded border border-aviso/40 bg-white p-2">
        <span className="text-sm"><strong>Equivalência — revisão pendente.</strong> {pendencia.descricao}</span>
        <Botao type="button" variante="secundario" disabled={desabilitado || !versaoId} onClick={() => {
          requestRef.current?.abort(); generationRef.current++;
          setCarregando(false); setPrevia(undefined); setAssinaturaPrevia(undefined); setErro(''); setAjustes({}); setMedidasEscolhidas({});
          setNutriente(pendencia.nutriente); setSelecionadas(new Set([pendencia.chaveCliente]));
          setRecalculoExplicitoChave(pendencia.chaveCliente); setAberto(true);
        }}>Recalcular equivalência</Botao>
      </div>)}
    </div> : null}
    <Botao type="button" variante="fantasma" aria-expanded={aberto} onClick={() => {
      setAberto((atual) => !atual);
      if (aberto) { requestRef.current?.abort(); generationRef.current++; previaSolicitadaRef.current = false; setCarregando(false); setPrevia(undefined); setAssinaturaPrevia(undefined); setSelecionadas(new Set()); setMedidasEscolhidas({}); }
    }}>Equivalência por nutriente</Botao>
    {aberto ? <div className="mt-3 grid gap-3">
      <p className="text-sm text-texto-suave">A equivalência iguala apenas o nutriente escolhido. Compare os outros nutrientes e confirme as porções manualmente. Alimento principal: {principalDescricao} ({mostrar(String(porcaoPrincipalGramas ?? ''), 'g')}).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-nutriente`}>Nutriente-alvo
          <Selecao id={`${id}-nutriente`} value={nutriente} onChange={(evento) => { setNutriente(evento.target.value as NutrienteEquivalencia); setPrevia(undefined); setAssinaturaPrevia(undefined); }}>
            {NUTRIENTES.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
          </Selecao>
        </label>
        <label className="grid gap-1 text-sm font-semibold" htmlFor={`${id}-passo`}>Arredondamento sugerido
          <Selecao id={`${id}-passo`} value={preferencias.passoPorcaoGramas} onChange={(evento) => atualizarPasso(evento.target.value as PoliticaEquivalencia['passoPorcaoGramas'])}>
            <option value="1">1 g</option><option value="0.1">0,1 g</option><option value="0.01">0,01 g</option><option value="0.001">0,001 g</option>
          </Selecao>
        </label>
      </div>
      <details>
        <summary className="min-h-11 cursor-pointer pt-2 font-semibold">Preferências de apresentação</summary>
        <div className="grid gap-3 border-l-2 border-primaria-suave pl-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">Casas decimais de gramas<Campo type="number" min="0" max="3" value={preferencias.casasGramas} onChange={(e) => setPreferencias((p) => ({ ...p, casasGramas: Number(e.target.value) }))} /></label>
          <label className="grid gap-1 text-sm">Casas decimais nutricionais<Campo type="number" min="0" max="4" value={preferencias.casasNutrientes} onChange={(e) => setPreferencias((p) => ({ ...p, casasNutrientes: Number(e.target.value) }))} /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={preferencias.unidades === 'gramas_e_medida_disponivel'} onChange={(e) => setPreferencias((p) => ({ ...p, unidades: e.target.checked ? 'gramas_e_medida_disponivel' : 'gramas' }))} />Exibir medidas caseiras disponíveis</label>
          <label className="grid gap-1 text-sm">Comparação
            <Selecao value={preferencias.modoComparacao} onChange={(e) => setPreferencias((p) => ({ ...p, modoComparacao: e.target.value as PreferenciasEquivalencia['modoComparacao'] }))}><option value="detalhado">Detalhada</option><option value="compacto">Compacta</option></Selecao>
          </label>
          <Botao type="button" variante="secundario" carregando={salvandoPreferencias} onClick={() => void salvarPreferencias()}>Salvar preferências pessoais</Botao>
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <Botao type="button" variante="primario" carregando={carregando} disabled={desabilitado || !versaoId || !alternativas.length} onClick={() => { void calcular(); }}>Calcular alternativas</Botao>
        {previa ? <Botao type="button" variante="secundario" onClick={confirmar} disabled={desabilitado || !podeConfirmar || previa.rascunhoRevisao !== rascunhoRevisao}>{selecionadasParaRecalculo ? 'Confirmar recálculo' : 'Aplicar selecionadas'}</Botao> : null}
      <Botao type="button" variante="fantasma" onClick={() => { requestRef.current?.abort(); generationRef.current++; previaSolicitadaRef.current = false; setCarregando(false); setPrevia(undefined); setAssinaturaPrevia(undefined); setSelecionadas(new Set()); setAjustes({}); setErro(''); }}>Cancelar</Botao>
      </div>
      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {previa && !previaCorresponde ? <p className="text-sm" role="status">Os dados mudaram. Aguarde a prévia atualizada antes de confirmar.</p> : null}
      {previaCorresponde && previa ? <div className="grid gap-3">
        <p className="text-sm" role="status">Alvo calculado: {NUTRIENTES.find((opcao) => opcao.valor === nutriente)?.rotulo}. Cada alternativa representa um cenário independente da refeição.</p>
        {linhasSelecionadas.length && !podeConfirmar ? <p role="alert" className="text-sm text-alerta-forte">Remova da seleção as alternativas sem cálculo aplicável antes de confirmar.</p> : null}
        <div className="overflow-x-auto" role="region" aria-label="Tabela comparativa de alternativas" tabIndex={0}>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <caption className="sr-only">Comparação das alternativas para {principalDescricao}</caption>
            <thead><tr>{['Selecionar', 'Alternativa e preparo', 'Porção sugerida', 'Alvo', 'Obtido', 'Diferença', 'Refeição após troca'].map((t) => <th key={t} scope="col" className="border-b border-linha p-2">{t}</th>)}</tr></thead>
            <tbody>{previa.alternativas.map((linha) => linha.resultado.estado === 'indisponivel'
              ? <tr key={linha.chaveCliente} className="border-b border-linha"><th scope="row" className="p-2">{linha.alimento?.descricao ?? alternativas.find((a) => a.chaveCliente === linha.chaveCliente)?.descricao}</th><td className="p-2" colSpan={6}>Cálculo indisponível: {explicarIndisponibilidade(linha.resultado.motivo)}</td></tr>
              : <LinhaComparacao key={linha.chaveCliente} linha={linha} alternativas={alternativas} selecionada={selecionadas.has(linha.chaveCliente)} aoSelecionar={() => alternarAlternativa(linha.chaveCliente)} ajuste={ajustes[linha.chaveCliente]} aoAjustar={(valor) => { setAjustes((atual) => ({ ...atual, [linha.chaveCliente]: valor })); setMedidasEscolhidas((atual) => { const proximo = { ...atual }; delete proximo[linha.chaveCliente]; return proximo; }); }} medidaEscolhida={medidasEscolhidas[linha.chaveCliente]} aoEscolherMedida={(medida) => { setAjustes((atual) => { const proximo = { ...atual }; delete proximo[linha.chaveCliente]; return proximo; }); setMedidasEscolhidas((atual) => { const proximo = { ...atual }; if (medida) proximo[linha.chaveCliente] = { ...medida, aplicacaoId: idAleatorio() }; else delete proximo[linha.chaveCliente]; return proximo; }); }} preferencias={preferencias} />)}</tbody>
          </table>
        </div>
      </div> : null}
    </div> : null}
  </section>;
}

function LinhaComparacao({ linha, alternativas, selecionada, aoSelecionar, ajuste, aoAjustar, preferencias, medidaEscolhida, aoEscolherMedida }: {
  linha: LinhaPreviaEquivalenciaApi; alternativas: AlternativaEdicao[]; selecionada: boolean;
  aoSelecionar: () => void; ajuste?: string; aoAjustar: (valor: string) => void; preferencias: PreferenciasEquivalencia;
  medidaEscolhida?: EscolhaMedida; aoEscolherMedida: (medida?: Omit<EscolhaMedida, 'aplicacaoId'>) => void;
}) {
  const resultado = linha.resultado;
  if (resultado.estado !== 'calculavel') return null;
  const alternativa = alternativas.find((item) => item.chaveCliente === linha.chaveCliente);
  const valorPorcao = ajuste ?? (medidaEscolhida ? resultado.porcaoEfetivaGramas : resultado.porcaoSugeridaGramas);
  const chaveMedida = (medida: { id: string; revisao: number }) => `${medida.id}:${medida.revisao}`;
  const selecaoMedida = medidaEscolhida ? chaveMedida(medidaEscolhida) : '';
  const unidadeAlvo = NUTRIENTES.find((item) => item.valor === resultado.nutriente)?.unidade ?? '';
  const impacto = linha.impacto;
  const individual = linha.comparacaoIndividual;
  return <tr className="border-b border-linha align-top">
    <td className="p-2"><input type="checkbox" aria-label={`Selecionar ${linha.alimento?.descricao ?? alternativa?.descricao ?? 'alternativa'}`} checked={selecionada} disabled={!resultado.aplicavel} onChange={aoSelecionar} /></td>
    <th scope="row" className="p-2">{linha.alimento?.descricao ?? alternativa?.descricao}<span className="block text-xs font-normal text-texto-suave">{linha.alimento?.preparacao ?? 'Preparo não informado'} · base {linha.alimento?.baseGramas} g · {linha.alimento?.fonte?.codigo ?? 'fonte indisponível'}</span>{!resultado.aplicavel ? <span className="block text-xs text-alerta-forte">{resultado.motivosAplicacao.join(' ')}</span> : null}{resultado.avisos.map((aviso) => <span key={aviso} className="block text-xs text-alerta-forte">{aviso}</span>)}</th>
    <td className="p-2">
      <label className="sr-only" htmlFor={`q-${linha.chaveCliente}`}>Porção efetiva em gramas</label>
      <Campo id={`q-${linha.chaveCliente}`} type="text" inputMode="decimal" value={valorPorcao} onChange={(e) => aoAjustar(e.target.value)} disabled={!resultado.aplicavel} />
      <span className="block text-xs">Sugerida: {mostrarPreferencia(resultado.porcaoSugeridaGramas, preferencias.casasGramas, 'g')}</span>
      <span className="block text-xs">Matemática: {mostrarPreferencia(resultado.porcaoMatematicaGramas, preferencias.casasGramas, 'g')}</span>
      {linha.medidas?.total && preferencias.unidades === 'gramas_e_medida_disponivel' ? <label className="mt-1 grid gap-1 text-xs" htmlFor={`m-${linha.chaveCliente}`}>Medida caseira
        <Selecao id={`m-${linha.chaveCliente}`} value={selecaoMedida} onChange={(evento) => {
          const escolhido = linha.medidas?.itens.find((item) => chaveMedida(item) === evento.target.value && item.podeAplicarQuantidade);
          aoEscolherMedida(escolhido ? { id: escolhido.id, revisao: escolhido.revisao, nome: escolhido.nome, quantidade: escolhido.quantidade,
            quantidadeReferencia: escolhido.quantidadeReferencia, pesoReferenciaGramas: escolhido.pesoReferenciaGramas } : undefined);
        }} disabled={!resultado.aplicavel}>
          <option value="">Manter em gramas</option>
          {linha.medidas.itens.map((item) => <option key={chaveMedida(item)} value={chaveMedida(item)} disabled={!item.podeAplicarQuantidade}>{item.quantidade} {item.nome} ({mostrarPreferencia(item.gramasAposMedida, preferencias.casasGramas, 'g')})</option>)}
        </Selecao>
        <span className="text-texto-suave">Conversões cadastradas para este alimento e preparo. A escolha será conferida pelo servidor.</span>
      </label> : null}
    </td>
    <td className="p-2">{mostrarPreferencia(resultado.nutrienteAlvo, preferencias.casasNutrientes, unidadeAlvo)}</td><td className="p-2">{mostrarPreferencia(resultado.obtido, preferencias.casasNutrientes, unidadeAlvo)}</td><td className="p-2">Δ {mostrarPreferencia(resultado.delta, preferencias.casasNutrientes, unidadeAlvo)}<span className="block text-xs">Residual absoluto: {mostrarPreferencia(resultado.diferencaAbsoluta, preferencias.casasNutrientes, unidadeAlvo)}</span><span className="block text-xs">Diferença: {mostrarPreferencia(resultado.deltaPercentual, preferencias.casasNutrientes, '%')}</span></td>
    <td className="p-2">{impacto?.estado === 'completo' ? <><span>Antes: E {mostrarPreferencia(impacto.antes.energiaKcal, preferencias.casasNutrientes, 'kcal')} · P {mostrarPreferencia(impacto.antes.proteinasG, preferencias.casasNutrientes, 'g')} · C {mostrarPreferencia(impacto.antes.carboidratosG, preferencias.casasNutrientes, 'g')} · G {mostrarPreferencia(impacto.antes.gordurasG, preferencias.casasNutrientes, 'g')}</span><span className="block">Depois: E {mostrarPreferencia(impacto.depois.energiaKcal, preferencias.casasNutrientes, 'kcal')} · P {mostrarPreferencia(impacto.depois.proteinasG, preferencias.casasNutrientes, 'g')} · C {mostrarPreferencia(impacto.depois.carboidratosG, preferencias.casasNutrientes, 'g')} · G {mostrarPreferencia(impacto.depois.gordurasG, preferencias.casasNutrientes, 'g')}</span><span className="block text-xs">Δ E {mostrarPreferencia(impacto.diferencas.energiaKcal, preferencias.casasNutrientes, 'kcal')} · P {mostrarPreferencia(impacto.diferencas.proteinasG, preferencias.casasNutrientes, 'g')} · C {mostrarPreferencia(impacto.diferencas.carboidratosG, preferencias.casasNutrientes, 'g')} · G {mostrarPreferencia(impacto.diferencas.gordurasG, preferencias.casasNutrientes, 'g')}</span></> : <span>Refeição incompleta; comparação individual disponível: {individual?.estado === 'completo' ? `E ${mostrarPreferencia(individual.depois.energiaKcal, preferencias.casasNutrientes, 'kcal')}, P ${mostrarPreferencia(individual.depois.proteinasG, preferencias.casasNutrientes, 'g')}, C ${mostrarPreferencia(individual.depois.carboidratosG, preferencias.casasNutrientes, 'g')}, G ${mostrarPreferencia(individual.depois.gordurasG, preferencias.casasNutrientes, 'g')}` : 'indisponível'}.</span>}</td>
  </tr>;
}
