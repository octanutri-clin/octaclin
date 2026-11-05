# FOOD07 A — avaliação octaclin-nutricionista-ux

Revisor: subagente real `/root/octaclin_nutricionista_ux`, instância nova sem histórico da conversa. Modalidade: runtime com instruções do papel fornecidas no prompt; seleção nativa automática de TOML não exercitada. Somente brief derivado do plano9dd9bd6d e cenários sintéticos; nenhuma ferramenta, tela, teste ou dado real. Este registro é **síntese editorial do coordenador**, preservando os seis achados; o parecer original está no retorno da instância na trilha desta conversa. Não é R4/validação clínica/pesquisa humana.

## Pontos positivos e jornada

Duas bases evitam cadastros duplicados; legados sem inferência, arredondamento sem acúmulo e congelamento por envio ajudam confiabilidade. Catálogo310/234 e filtros/tags reaproveitados. Simulação de consulta: cadastrar preparação4porções (A500g/B200g), comparar cadastro por porção, aplicar1,5porção (A187,5g/B75g/225kcal), revisar texto original, mudar base, revisar lote e reenviar/retirar. Dificuldade central: identificar a que quantidade cada número se refere.

## Achados completos

### NUX-01 — totais da prévia, P1

Cenário/objetivo: comparar receitas e aplicar1,5porção com contribuição nutricional compreensível. Comportamento proposto: motor recalcula pelo peso, mas apresentação da composição ainda não definida. Dificuldade/impacto: comparar preparo inteiro com porção ou100g e precisar conferir fora do fluxo. Tipo: **risco plausível que exige teste**. Evidência: lacuna de apresentação declarada no brief, confusão é hipótese. Sugestão: bloco “Total para1,5porção”, denominador explícito nos demais valores. Aceite:1/1,5/2,5→150/225/375kcal e macros correspondentes; bases equivalentes geram a mesma apresentação. Prioridade justificada pela decisão essencial de aplicação.

### NUX-02 — mudar base, P1

Cenário/objetivo: corrigir base de receita preenchida sem mudar significado por engano. Comportamento: confirmar reinterpretação sem converter números. Dificuldade/impacto: confirmação genérica parece troca de rótulo/conversão equivalente, alterando aplicações futuras. Tipo: **risco plausível que exige teste**; conteúdo explicativo não especificado. Sugestão: antes/depois “500g representam preparo inteiro” → “500g representarão uma porção”, rendimento e ação “Confirmar nova interpretação”. Aceite: significado anterior/novo com valores reais, cancelar preserva, confirmar mantém números e muda base explicitamente.

### NUX-03 — instruções conflitantes, P1

Cenário/objetivo: enviar1,5porção sem orientações quantitativas concorrentes. Proposto: lista ajustada, texto original mantido com revisão profissional. Dificuldade/impacto: texto500g/200g contra lista187,5g/75g gera preparo diferente/dúvidas. Tipo: **risco plausível que exige teste**; divergência demonstrada no exemplo sintético, entendimento não testado. Sugestão: exibir ambos ao profissional, destacar revisão e distinguir instruções originais das quantidades enviadas. Aceite: ambos visíveis na revisão, portal diferencia sem jargão. Revisor aceita explorar distinção pública; paciente questiona sua suficiência (ver consolidado).

### NUX-04 — origem/base/destino, P1

Cenário/objetivo: salvar receita a partir da refeição atual e aplicá-la corretamente. Proposto: captura itens e escolhe destino/porções. Dificuldade/impacto: supor que os itens são uma porção, ou confirmar outra refeição, propagando erro. Tipo: **hipótese de fricção**; apresentação não definida. Sugestão: nome da refeição de origem, base escolhida explicitamente, destino sempre no resumo. Aceite: origem/itens presentes ao cadastrar, base não inferida, confirmação identifica destino.

### NUX-05 — lote, P2

Cenário/objetivo: revisar até10receitas com modos mistos rapidamente. Proposto: modo e porções individuais, validação antes de enviar. Dificuldade/impacto: sem resumo reabre cada receita para conferir ou corrigir bloqueio. Tipo: **sugestão de melhoria**; organização visual aberta. Sugestão: lista nome/modo/porções/pendência e acesso direto à linha problemática. Aceite: conferir modos numa revisão e corrigir uma receita sem perder configurações das demais.

### NUX-06 — biblioteca/plano/envios, P1 sugerido pelo revisor

Cenário/objetivo: editar, reenviar/retirar sabendo o que o paciente consulta. Proposto: cópias anteriores preservadas e novo envio explícito. Dificuldade/impacto: esperar atualização automática ou presumir substituição/retirada diferente do contrato, mantendo orientação antiga. Tipo: **risco plausível que exige teste**. Sugestão: histórico com data/porções/estado e informação do efeito do reenvio. Aceite: biblioteca não altera conteúdo anterior; estados distinguem envios e retirada respeita cada registro. A premissa de que envio anterior poderia continuar ativo é confrontada pelo coordenador com310; não adotar nova política de manter ambos sem decisão.

## Oportunidades e limites

Reutilizar resumo de aplicação/envio, filtros ao retornar e preservação de campos após erro, sem esconder controles úteis. Contratos matemáticos, limites, locks/versionamento, consentimento e proteção interna já estão propostos. Nenhum P0 ou defeito implementado comprovado. Decisões de UI ainda precisam protótipo/validação posterior; nenhuma contagem real de cliques foi obtida.
