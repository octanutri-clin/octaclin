/** Fixture gerada da projeção própria M09; sem paciente ou tabela clínica. */
export function ajudaSintetica() {
 return {
  "schemaVersao": 1,
  "conteudoVersao": "food06-ajuda-v1",
  "autor": "OctaClin",
  "comparacoesHabilitadas": false,
  "fontes": [
    {
      "id": "nih-ods-nutrient-recommendations",
      "titulo": "NIH ODS — Nutrient Recommendations",
      "url": "https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx",
      "consultadaEm": "2026-11-02"
    }
  ],
  "topicos": [
    {
      "codigo": "RDA",
      "titulo": "Ingestão recomendada (RDA)",
      "texto": "RDA é a ingestão recomendada para atender às necessidades de quase todas as pessoas saudáveis de um grupo. Ficar abaixo da RDA em um plano não comprova deficiência."
    },
    {
      "codigo": "AI",
      "titulo": "Ingestão adequada (AI)",
      "texto": "AI é a ingestão adequada usada quando não é possível estabelecer uma RDA. Ficar abaixo da AI não permite concluir inadequação individual."
    },
    {
      "codigo": "UL",
      "titulo": "Limite superior (UL)",
      "texto": "UL é o limite superior de ingestão usual conforme a forma e a população da referência; não é uma meta. Ultrapassá-lo não constitui diagnóstico de toxicidade e estar abaixo não garante segurança individual.",
      "detalhe": "Alguns ULs abrangem somente suplementos, medicamentos ou formas específicas. O total alimentar não identifica necessariamente essas frações."
    },
    {
      "codigo": "planejado",
      "titulo": "Planejado não é consumido",
      "texto": "Esta análise descreve alimentação planejada e não representa consumo efetivo nem avalia, por si só, o estado nutricional."
    },
    {
      "codigo": "parcial",
      "titulo": "Dados parciais e desconhecidos",
      "texto": "A quantidade contabilizada inclui apenas dados conhecidos: total real desconhecido. Não use cobertura por número de alimentos como percentual de confiança científica."
    },
    {
      "codigo": "indisponibilidade",
      "titulo": "Por que a comparação está indisponível?",
      "texto": "As referências numéricas não estão habilitadas nesta análise. Um total completo não habilita a comparação.",
      "detalhe": "Para comparar são necessários contexto confirmado, composição compatível e referência apropriada e autorizada."
    },
    {
      "codigo": "limites",
      "titulo": "Limites de interpretação",
      "texto": "Valores do planejamento abaixo ou acima das referências não estabelecem diagnóstico de deficiência ou excesso, nem são metas individuais automáticas."
    }
  ]
};
}
