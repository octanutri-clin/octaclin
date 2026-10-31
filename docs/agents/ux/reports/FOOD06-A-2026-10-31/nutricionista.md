# Nutricionista — FOOD06, etapa A

Síntese editorial pelo coordenador a partir da resposta independente de
`/root/food06_nutricionista_ux_a`. Papel textual da #451/`0d3382b6`; entrada comum
resumida do brief. Sem ferramentas, UI, PDF, pacientes ou testes reais. Evidência
é a proposta/auditoria e os seis cenários sintéticos, não defeito visual observado.
Não é revisão clínica, jurídica, científica ou R4. Nenhum P0 identificado.

**Pontos positivos:** quantidades/cobertura antes das referências; zero distinto
de desconhecido; contexto diário confirmado; explorar e cancelar sem gravar;
distinguir dieta/fonte/ref/contexto/cobertura; registro de análise diferente de
publicação. Principais riscos: excesso de informações sem hierarquia, perda de
contexto após interrupção e confirmação de cenário desatualizado.

| ID/Prioridade | Cenário e objetivo | Dificuldade/impacto | Tipo e evidência | Sugestão e aceite verificável |
| --- | --- | --- | --- | --- |
| NUX-01/P1 | Conferir ferro zero+ausente e cálcio completo | Subtotal pode ser lido como total se a lacuna estiver só no detalhe | Risco plausível; cenário1, UI ainda não observada | Cobertura “1 de2 itens” junto ao valor e acesso ao item ausente; ferro parcial/cálcio completo/zero explícito, nunca percentagem de confiança |
| NUX-02/P1 | Receita1,5porções e contribuição por alimento | Confundir rendimento com quantidade planejada e multiplicar duas vezes | Risco plausível; cenário4/contrato FOOD07 | Quantidade/unidade efetiva e denominador visíveis; soma reconcilia snapshot aplicado uma vez |
| NUX-03/P2 | Entender por que comparação indisponível | Código genérico atrasa descobrir ação possível | Hipótese de fricção; redação ainda não apresentada | Mensagem curta por causa e próximo passo real; distinguir técnica/contrato/unidade/ausência, sem botão inoperante |
| NUX-04/P1 | Confirmar troca após outra aba mudar rascunho | Aplicar resultado diferente do conferido | Risco plausível; cenário3 | Impedir confirmação stale, recalcular/reconferir, preservar identificação da proposta; cancelar não desfaz escrita alheia |
| NUX-05/P2 | Reencontrar referência de análise antiga | Detalhe excessivo atrapalha ou detalhe oculto dificulta reprodução | Hipótese e sugestão; cenário6 | Resumo curto e expansão com fonte/contexto originais; atualização mostra diferença sem reescrever análise |
| NUX-06/P2 | Filtrar tabela e ordenar valores | Filtros ocultam lacunas; desconhecido pode virar zero na ordem | Risco plausível; contrato M06 | Filtros ativos/contagem/limpar, ordenar por dimensão; ausente não é zero; teclado/cabeçalhos testados depois |
| NUX-07/P1 | Dois planos de dias alternados | “Comparar” genérico induz confirmação diária indevida | Risco plausível; cenário2 | Identificar planos/dia no aceite; sem confirmação só totais factuais, sem comparações diárias; distinguir causas de mudança |
| NUX-08/P2 | PDF profissional mostrado no celular | Quebra de página/separação afasta ressalva do número | Risco plausível; sem PDF observado | Revisar conteúdo e manter análise/cobertura/limites perto dos resultados; documento legível e sem entrega automática |
| NUX-09/P1 | Consulta curta, siglas e tabagismo desconhecido | Texto excessivo ignorado ou rótulo breve entendido como diagnóstico | Hipótese e risco plausível; regras ratificadas | Explicação curta+detalhe; desconhecido afeta só RDA C; +35mg não altera UL; distinguir real/planejado/meta |
| NUX-10/P1 | Histórico com lacunas e fontes diferentes | Linha contínua sugere comparabilidade/melhora não comprovada | Risco plausível; cenário6 | Quebras e origem por ponto; gráfico/tabela sem interpolação, sem afirmação clínica |
| NUX-11/P1 | Consultar ferro, preparos/porções e restrição sem regra | Ranking parece adequação individual/compatibilidade | Risco plausível; auditoria sem contrato de restrições | Base/preparo/porção explícitos; desconhecido não zero, restrição não verificada não vira alegação de segurança |
| NUX-12/P1 | Retomar cenários temporários e confirmar correto | Confusão cenário/rascunho/análise registrada | Hipótese e risco plausível; cenários3/6 | Nome/resumo/estado compreensíveis, fingerprint interno; cancelar não grava, revisão atual, A ou B, duração temporária clara |

**Produtividade:** procurar a lacuna no contexto do nutriente e reaproveitar contexto
válido pode reduzir trocas de tela. Trata-se de hipótese, sem medição de cliques
ou tempo. Contexto em memória deve ser revalidado pelo servidor e reconfirmado
quando mudar, preservando autorização/individualização.

**Questões de desenho levantadas:** informar fim dos cenários em memória;
identificar análise registrada para reencontro; mostrar mudanças simultâneas de
contexto/cobertura/rascunho na confirmação. Coordenador deve resolver detalhes
técnicos cobertos e submeter apenas mudança relevante de produto ao proprietário.

Parecer favorável ao avanço do desenho com esses critérios; não atesta prontidão
da interface, a11y, ciência, direitos ou gates de segurança.
