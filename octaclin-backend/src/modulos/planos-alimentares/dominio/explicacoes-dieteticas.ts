import type { MotivoComparacaoIndisponivel } from './comparacao-dietetica';

export interface ExplicacaoDietetica {
  mensagem: string;
  detalhe: string;
  acao: 'conferir_contexto' | 'confirmar_dia' | 'conferir_composicao' | 'consultar_referencia' | 'informar_tabagismo';
}
function explicacao(mensagem: string, detalhe: string, acao: ExplicacaoDietetica['acao']): Readonly<ExplicacaoDietetica> {
  return Object.freeze({ mensagem, detalhe, acao });
}
/** Textos próprios baseados na ficha ratificada. Não resolvem nem habilitam referências. */
export const EXPLICACOES_DIETETICAS: Readonly<Record<MotivoComparacaoIndisponivel, Readonly<ExplicacaoDietetica>>> = Object.freeze({
  contexto_nao_elegivel: explicacao('Comparação indisponível: contexto não confirmado ou fora do escopo.',
    'Confira a população de referência: adultos de 19 anos ou mais, sem gestação ou lactação, nos limites do protocolo.', 'conferir_contexto'),
  dia_nao_confirmado: explicacao('Confirme se a seleção representa o mesmo dia planejado.',
    'Os totais da seleção permanecem factuais; a comparação diária exige essa confirmação.', 'confirmar_dia'),
  dados_incompletos: explicacao('Comparação indisponível: composição nutricional incompleta.',
    'A quantidade contabilizada pode ser parcial. Valores desconhecidos não equivalem a zero.', 'conferir_composicao'),
  valor_invalido: explicacao('Comparação indisponível: valor não interpretável.',
    'Confira a composição e a referência utilizadas. Não substitua um valor inválido por zero.', 'conferir_composicao'),
  referencia_indisponivel: explicacao('Comparação indisponível: referência não disponível.',
    'A referência precisa estar identificada, versionada e autorizada para esta análise.', 'consultar_referencia'),
  definicao_incompativel: explicacao('Comparação indisponível: formas nutricionais incompatíveis.',
    'As formas nutricionais precisam corresponder à referência. Não presumir conversões entre formas.', 'consultar_referencia'),
  unidade_incompativel: explicacao('Comparação indisponível: unidades incompatíveis.',
    'Confira as unidades e a definição do nutriente antes de comparar.', 'conferir_composicao'),
  abrangencia_ul_incompativel: explicacao('Este UL não se aplica automaticamente ao total alimentar.',
    'Alguns ULs abrangem somente suplementos, medicamentos ou formas específicas. O total alimentar não identifica necessariamente essas frações.', 'consultar_referencia'),
  tabagismo_nao_informado: explicacao('Vitamina C: confirme a condição de tabagismo para comparar a RDA.',
    'A condição não informada impede essa comparação com a RDA; não altera o UL.', 'informar_tabagismo'),
  nao_estabelecido: explicacao('Não há UL estabelecido nesta referência.',
    'A ausência de UL não significa ausência de risco nem autoriza consumo ilimitado.', 'consultar_referencia'),
  limite_precisao: explicacao('Comparação indisponível: limite técnico de cálculo.',
    'Confira os valores e as quantidades. O sistema não apresenta um resultado numérico fora dos limites de precisão suportados.', 'conferir_composicao')
});

export const AJUDA_DIETETICA = Object.freeze({
  RDA: 'RDA é a ingestão recomendada para atender às necessidades de quase todas as pessoas saudáveis de um grupo. Ficar abaixo da RDA em um plano não comprova deficiência.',
  AI: 'AI é a ingestão adequada usada quando não é possível estabelecer uma RDA. Ficar abaixo da AI não permite concluir inadequação individual.',
  UL: 'UL é o limite superior de ingestão usual conforme a forma e a população da referência; não é uma meta. Ultrapassá-lo não constitui diagnóstico de toxicidade e estar abaixo não garante segurança individual.',
  planejado: 'Esta análise descreve alimentação planejada e não representa consumo efetivo nem avalia, por si só, o estado nutricional.',
  parcial: 'A quantidade contabilizada inclui apenas dados conhecidos: total real desconhecido. Não use cobertura por número de alimentos como percentual de confiança científica.'
});
