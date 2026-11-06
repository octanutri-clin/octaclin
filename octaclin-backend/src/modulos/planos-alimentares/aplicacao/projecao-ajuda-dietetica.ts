import {AJUDA_DIETETICA,EXPLICACOES_DIETETICAS} from '../dominio/explicacoes-dieteticas';
export interface AjudaDieteticaProjetada {
 schemaVersao:1;conteudoVersao:'food06-ajuda-v1';autor:'OctaClin';comparacoesHabilitadas:false;
 fontes:{id:string;titulo:string;url:string;consultadaEm:string}[];
 topicos:{codigo:string;titulo:string;texto:string;detalhe?:string}[];
}
/** Texto próprio já aprovado no protocolo; nenhuma tabela ou valor DRI no runtime. */
export function projetarAjudaDietetica():AjudaDieteticaProjetada {
 return {schemaVersao:1,conteudoVersao:'food06-ajuda-v1',autor:'OctaClin',comparacoesHabilitadas:false,
  fontes:[{id:'nih-ods-nutrient-recommendations',titulo:'NIH ODS — Nutrient Recommendations',url:'https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx',consultadaEm:'2026-11-02'}],
  topicos:[
   {codigo:'RDA',titulo:'Ingestão recomendada (RDA)',texto:AJUDA_DIETETICA.RDA},
   {codigo:'AI',titulo:'Ingestão adequada (AI)',texto:AJUDA_DIETETICA.AI},
   {codigo:'UL',titulo:'Limite superior (UL)',texto:AJUDA_DIETETICA.UL,detalhe:EXPLICACOES_DIETETICAS.abrangencia_ul_incompativel.detalhe},
   {codigo:'planejado',titulo:'Planejado não é consumido',texto:AJUDA_DIETETICA.planejado},
   {codigo:'parcial',titulo:'Dados parciais e desconhecidos',texto:AJUDA_DIETETICA.parcial},
   {codigo:'indisponibilidade',titulo:'Por que a comparação está indisponível?',texto:'As referências numéricas não estão habilitadas nesta análise. Um total completo não habilita a comparação.',detalhe:'Para comparar são necessários contexto confirmado, composição compatível e referência apropriada e autorizada.'},
   {codigo:'limites',titulo:'Limites de interpretação',texto:'Valores do planejamento abaixo ou acima das referências não estabelecem diagnóstico de deficiência ou excesso, nem são metas individuais automáticas.'}
  ]};
}
