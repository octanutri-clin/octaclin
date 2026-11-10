import { formatarNutrientePlano } from './micronutrientes-plano';
import type { ComparacaoNutrienteFactual, MotivoComparacaoFactual, MotivoContextoFactual, ReferenciasFactuais, ResumoComparacao, RespostasPacienteReferencias } from './referencias-dieteticas-factuais';

/**
 * Único lugar dos textos da comparação com a DRI (FOOD06 T4a). Linguagem factual: sem cor,
 * sem "seguro", "excesso" ou "risco", sem verbo de ação. O conteúdo final de RDA/AI/UL
 * precisa ser validado por quem responde pelo conteúdo; mudar aqui muda tela e relatório.
 */
export function formatarPercentualReferencia(p: number): string {
  if (!Number.isFinite(p) || p < 0) return '—';
  if (p === 0) return '0';
  if (p < 1) return '<1';
  const casas = p < 10 ? 1 : 0;
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas }).format(p);
}

const POSICAO_UL = { abaixo: 'abaixo de', igual: 'igual a', acima: 'acima de' } as const;

/** Duas linhas do mesmo padrão em todo nutriente; o período ("do dia") está no cabeçalho da coluna. */
export function textoReferencia(codigo: string, c: Extract<ComparacaoNutrienteFactual, { estado: 'comparavel' }>, paraFolha = false): string {
  const pct = formatarPercentualReferencia(c.percentual);
  const base = `Planejado: ${formatarNutrientePlano(codigo, c.quantidadePlanejada)} ${c.unidadePlanejada} = ${pct === '<1' ? 'menos de 1' : pct}% da ${c.tipo} (${formatarNutrientePlano(codigo, c.valorReferencia)} ${c.unidadeReferencia})`;
  // Na folha o ajuste aparece sem dizer o motivo: tabagismo é dado de saúde e a folha pode ser lida por terceiros.
  return c.ajusteTabagismoMg ? `${base}, ${paraFolha ? `com ajuste de +${c.ajusteTabagismoMg} mg na referência` : `com +${c.ajusteTabagismoMg} mg por tabagismo confirmado`}` : base;
}
export function textoUl(codigo: string, c: Extract<ComparacaoNutrienteFactual, { estado: 'comparavel' }>): string {
  return `Limite superior (UL): total planejado ${POSICAO_UL[c.posicao ?? 'abaixo']} ${formatarNutrientePlano(codigo, c.valorReferencia)} ${c.unidadeReferencia}`;
}

/** Curto, para a célula. Os motivos de contexto aparecem uma vez acima da tabela, não em 22 linhas. */
export const MOTIVO_COMPARACAO_CURTO: Readonly<Record<MotivoComparacaoFactual, string>> = Object.freeze({
  contexto_nao_elegivel: 'fora do escopo (ver aviso acima)',
  dia_nao_confirmado: 'dia completo não confirmado',
  dados_incompletos: 'faltam dados de alguns alimentos do plano',
  valor_invalido: 'valor planejado inválido',
  referencia_indisponivel: 'sem valor de referência para este nutriente',
  definicao_incompativel: 'forma do nutriente diferente da referência',
  unidade_incompativel: 'unidade diferente da referência',
  abrangencia_ul_incompativel: 'o limite vale para uma forma específica',
  tabagismo_nao_informado: 'tabagismo não informado',
  nao_estabelecido: 'limite superior não estabelecido pela fonte',
  limite_precisao: 'valor fora do limite de precisão'
});
/** Completo, para os detalhes da linha. */
export const MOTIVO_COMPARACAO_LONGO: Readonly<Record<MotivoComparacaoFactual, string>> = Object.freeze({
  contexto_nao_elegivel: 'A comparação não se aplica ao contexto confirmado. O motivo está no aviso acima da tabela.',
  dia_nao_confirmado: 'A confirmação de que as refeições selecionadas formam o dia completo não foi dada.',
  dados_incompletos: 'Nem todos os alimentos incluídos têm este nutriente na composição. Dado ausente não equivale a zero, por isso não há percentual.',
  valor_invalido: 'O total planejado não pôde ser usado na comparação.',
  referencia_indisponivel: 'A fonte não traz valor de referência para este nutriente e grupo.',
  definicao_incompativel: 'A forma em que o nutriente é registrado na composição não corresponde à forma da referência.',
  unidade_incompativel: 'A unidade do total planejado não corresponde à da referência.',
  abrangencia_ul_incompativel: 'O limite superior deste nutriente vale para uma forma específica (por exemplo, suplemento), que o total dos alimentos não permite identificar.',
  tabagismo_nao_informado: 'A referência da vitamina C depende da resposta sobre tabagismo. Informe a resposta e aplique de novo.',
  nao_estabelecido: 'A fonte não estabelece limite superior para este nutriente e grupo.',
  limite_precisao: 'O valor está fora do limite de precisão do cálculo.'
});

/** Aviso único acima da tabela quando o contexto não permite comparar. Não sugere mudar resposta para "passar". */
export const MOTIVO_CONTEXTO_TEXTO: Readonly<Record<MotivoContextoFactual, string>> = Object.freeze({
  data_invalida: 'Não foi possível determinar a data da análise.',
  nascimento_nao_informado: 'O nascimento do paciente não está cadastrado.',
  nascimento_futuro: 'O nascimento cadastrado é posterior à data da análise.',
  idade_fora_do_escopo: 'A comparação cobre apenas adultos de 19 anos ou mais.',
  populacao_nao_confirmada: 'A população de referência não foi confirmada.',
  gestacao_fora_do_escopo: 'A comparação não cobre gestação.',
  lactacao_fora_do_escopo: 'A comparação não cobre lactação.',
  fisiologia_nao_confirmada: 'Gestação ou lactação não foram confirmadas.',
  aplicabilidade_nao_confirmada: 'A aplicabilidade da população não foi confirmada.',
  confirmacao_invalida: 'As confirmações enviadas não são válidas.'
});
export const AVISO_CONTEXTO_TITULO = 'Sem comparação com referências para este contexto.';

export const AVISO_FORA_DO_ESCOPO: Readonly<Record<'gestacao' | 'lactacao' | 'aplicabilidade', string>> = Object.freeze({
  gestacao: 'Fora do escopo: a comparação cobre apenas adultos sem gestação ou lactação. Os valores factuais continuam disponíveis.',
  lactacao: 'Fora do escopo: a comparação cobre apenas adultos sem gestação ou lactação. Os valores factuais continuam disponíveis.',
  aplicabilidade: 'A população não é aplicável a esta comparação. Os valores factuais continuam disponíveis.'
});

export const PENDENCIA_TEXTO = Object.freeze({
  gestacao: 'gestação', lactacao: 'lactação', populacao: 'população de referência', populacao_conferida: 'conferência da população',
  aplicabilidade: 'aplicabilidade', dia_completo: 'dia completo'
} as const);

export function textoResumoComparacao(r: ResumoComparacao): string {
  const partes = [`Comparado em ${r.comparados} de ${r.total} nutrientes.`];
  if (r.dadosIncompletos > 0) partes.push(`Faltam dados de alguns alimentos do plano em ${r.dadosIncompletos}.`);
  if (r.semReferencia > 0) partes.push(`Sem valor de referência para ${r.semReferencia}.`);
  return partes.join(' ');
}

/** Mesmos rótulos do formulário; "não informado" deixa explícito o efeito na vitamina C. */
export function textoRespostasAtivas(r: RespostasPacienteReferencias): string {
  const tabagismo = r.tabagismo === 'sim' ? 'fuma' : r.tabagismo === 'nao' ? 'não fuma' : 'tabagismo não informado (a vitamina C fica sem comparação)';
  return `população de referência ${r.populacaoReferencia === 'masculina' ? 'masculina' : 'feminina'}, sem gestação nem lactação, ${tabagismo}`;
}

export const COMO_LER_TITULO = 'Como ler esta comparação';
export const COMO_LER: readonly string[] = Object.freeze([
  'DRI (Ingestões Dietéticas de Referência) é o conjunto de valores de referência usado aqui. Os números vêm do total planejado do dia (as refeições selecionadas formam o dia completo) e não mostram o que foi consumido.',
  'RDA (Ingestão Dietética Recomendada) e AI (Ingestão Adequada) são valores de referência diários para o grupo selecionado. Não são metas individuais nem um teto.',
  'UL (limite superior de ingestão) é um valor de referência que vale para o total dos alimentos do plano. Nem todo nutriente tem UL. Ficar acima ou abaixo de um valor de referência, por si só, não é diagnóstico.',
  'O total considera só o que está no plano alimentar. Produtos fora do plano, como suplementos que não foram incluídos nele, não são somados.',
  'Quando faltam dados de alguns alimentos, o nutriente não é comparado. Ausência não equivale a zero.',
  'Perdas no preparo, absorção e necessidades individuais não são consideradas. Não é diagnóstico nem orientação para mudar a alimentação.'
]);
export function textoFonteReferencias(r: Pick<ReferenciasFactuais, 'fonte' | 'versao'>): string {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.fonte.modificadaEm);
  const data = d ? `${d[3]}/${d[2]}/${d[1]}` : r.fonte.modificadaEm;
  return `Fonte: ${r.fonte.autoridade}, tabela de ${data}, licença ${r.fonte.licenca}. Versão ${r.versao}.`;
}

/** Relatório impresso (T4b). A comparação só entra por escolha explícita; desligada, a folha é a de sempre. */
export const RELATORIO_REFERENCIAS = Object.freeze({
  controle: 'Incluir comparação com referências DRI nesta folha',
  lembrete: 'Desligada por padrão. A folha impressa pode ser lida pelo paciente sem você por perto.',
  registroSemReferencias: 'Este registro não tem referências: foi salvo sem as confirmações de contexto ou antes desta versão. Para incluí-las, salve um novo registro com a comparação ativa na tabela; o novo registro usa o plano e a versão de referência atuais. Nada sobre referências vai para a folha.',
  versaoIndisponivel: 'A versão de referência registrada neste registro não está disponível nesta versão do sistema. Nada é recalculado com a versão atual, e nada sobre referências vai para a folha.',
  avisoAcima: 'Há nutrientes com total planejado acima do limite superior (UL). Confira antes de entregar a folha.',
  atualizando: 'Atualizando a prévia com a sua escolha…',
  falhaAtualizar: 'Não foi possível atualizar a prévia com a sua escolha. Nada foi enviado à impressão.',
  ligacao: 'Esta parte compara os totais do dia, mostrados acima, com valores de referência.',
  rodape: 'Comparação com referências DRI do total planejado do dia; não é diagnóstico. Dúvidas sobre estes números? Converse com seu nutricionista.',
  titulo: 'Comparação com referências DRI (total planejado do dia)',
  conversa: 'Dúvidas sobre estes números? Converse com seu nutricionista.',
  limitacao: 'A comparação usa a versão de referência registrada nesta análise. Os percentuais só comparam números: não avaliam a saúde nem indicam mudanças na alimentação.'
});

/** Indicador por registro no histórico (NUX-15): só texto, sem números nem percentuais. */
export const INDICADOR_REFERENCIAS_HISTORICO = Object.freeze({
  semReferencias: 'Sem referências registradas',
  versaoIndisponivel: 'Referências registradas em versão não disponível nesta versão do sistema',
  explicacaoSem: 'Este registro foi salvo sem as confirmações de contexto ou antes desta versão. Para incluir referências, salve um novo registro com a comparação ativa na tabela.',
  registrada: (modificadaEm: string): string => {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(modificadaEm);
    return `Referências registradas · tabela DRI de ${d ? `${d[3]}/${d[2]}/${d[1]}` : modificadaEm}`;
  }
});
