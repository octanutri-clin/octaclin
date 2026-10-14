# Revisão independente dos oráculos — 30 casos sintéticos (Fase 319)

**Base auditada:** `corpus.json`, `run-001.json`, `RELATORIO_POC_SINTETICA_V3.md` recebidos nesta conversa. Apenas dados sintéticos. **Esta revisão não reexecutou BM25/E5/MiniLM.**

## Veredito

- **18/30:** fonte gold compatível com o que a consulta pergunta.
- **4/30:** fonte localizada corretamente, mas o enunciado precisa de maior precisão (`q-016`, `q-021`, `q-029`, `q-033`).
- **3/30:** fonte gold não comprova a afirmação solicitada (`q-019`, `q-023`, `q-027`).
- **5/30:** casos marcados como sem resposta contêm, cada um, uma fonte que responde diretamente sobre a ausência de registro (`q-036` a `q-040`). Não são exemplos válidos de ausência de fonte pertinente.

**Interpretação:** “não há fonte de evidência positiva” e “não há fonte relevante para a pergunta” são rótulos diferentes; os cinco negativos só cumprem o primeiro. O gabarito é adequado por construção, mas não está totalmente validado semanticamente.

## Matriz de todos os 30 casos

| ID | Categoria | Fonte gold | Avaliação | BM25 | E5 | MiniLM |
|---|---|---|---|---:|---:|---:|
| `q-011` | termo-raro | `syn-011` | VALIDADO | 1 | 1 | — |
| `q-012` | termo-raro | `syn-012` | VALIDADO | 1 | 1 | 1 |
| `q-013` | negação | `syn-013` | VALIDADO | 1 | 1 | 1 |
| `q-014` | negação | `syn-014` | VALIDADO | 1 | 1 | 1 |
| `q-015` | negação | `syn-015` | VALIDADO | 3 | 1 | 1 |
| `q-016` | negação | `syn-016` | AJUSTAR | 1 | 1 | 1 |
| `q-017` | número-data | `syn-017` | VALIDADO | 1 | 1 | 1 |
| `q-018` | número-unidade | `syn-018` | VALIDADO | 1 | 1 | 1 |
| `q-019` | número-unidade | `syn-019` | INSUFICIENTE | — | 5 | 3 |
| `q-020` | número-unidade | `syn-020` | VALIDADO | 1 | 1 | 1 |
| `q-021` | data | `syn-021` | AJUSTAR | 1 | 1 | 1 |
| `q-022` | horário | `syn-022` | VALIDADO | — | 1 | 1 |
| `q-023` | número-unidade | `syn-023` | INSUFICIENTE | 1 | 1 | 1 |
| `q-024` | número | `syn-024` | VALIDADO | 1 | 1 | 1 |
| `q-025` | fonte-antiga | `syn-025` | VALIDADO | 1 | 1 | — |
| `q-026` | fonte-antiga | `syn-026` | VALIDADO | 1 | 1 | 1 |
| `q-027` | fonte-antiga | `syn-027` | INSUFICIENTE | 1 | 1 | 1 |
| `q-028` | fonte-antiga | `syn-028` | VALIDADO | 1 | 1 | 1 |
| `q-029` | termo-raro | `syn-029` | AJUSTAR | 1 | 1 | 1 |
| `q-030` | paráfrase | `syn-030` | VALIDADO | 1 | 2 | 1 |
| `q-031` | termo-raro | `syn-031` | VALIDADO | 1 | 1 | 1 |
| `q-032` | paráfrase | `syn-032` | VALIDADO | 1 | 1 | 2 |
| `q-033` | negação | `syn-033` | AJUSTAR | 3 | 1 | 1 |
| `q-034` | paráfrase | `syn-034` | VALIDADO | 1 | 1 | 1 |
| `q-035` | termo-raro | `syn-035` | VALIDADO | 1 | 1 | 1 |
| `q-036` | sem-resposta | `—` | SEM-RESPOSTA INVÁLIDO | — | — | — |
| `q-037` | sem-resposta | `—` | SEM-RESPOSTA INVÁLIDO | — | — | — |
| `q-038` | sem-resposta | `—` | SEM-RESPOSTA INVÁLIDO | — | — | — |
| `q-039` | sem-resposta | `—` | SEM-RESPOSTA INVÁLIDO | — | — | — |
| `q-040` | sem-resposta | `—` | SEM-RESPOSTA INVÁLIDO | — | — | — |

Os números de posição são os registrados em `run-001.json`; `—` significa que o *gold* não aparece entre os dez primeiros (ou que não há gold). Não constituem nova avaliação após a correção dos enunciados.

## Justificativas por consulta (30/30)

### `q-011` — VALIDADO
- **Pergunta:** Procure o registro que cita amaranto.
- **Documento syn-011:** A conversa incluiu o alimento amaranto como ingrediente já conhecido.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-012` — VALIDADO
- **Pergunta:** Qual nota menciona farinha de grão-de-bico?
- **Documento syn-012:** Informou que usa farinha de grão-de-bico em algumas receitas.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-013` — VALIDADO
- **Pergunta:** A pessoa não consome leite de vaca.
- **Documento syn-013:** Nega consumo de leite de vaca; a anotação não informa intolerância.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-014` — VALIDADO
- **Pergunta:** Foi relatado que não costuma pular o café da manhã?
- **Documento syn-014:** Disse que não costuma pular o café da manhã nos dias úteis.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-015` — VALIDADO
- **Pergunta:** A evolução diz que a pessoa consome peixe?
- **Documento syn-015:** Relatou que não come peixe há vários meses.
- **Avaliação:** A resposta à pergunta polar é **não**; a fonte nega consumo atual de peixe. Não interpretar como evidência positiva de consumo.

### `q-016` — AJUSTAR
- **Pergunta:** Localize a hipótese de que o lanche causa desconforto, não uma confirmação.
- **Documento syn-016:** Relatou desconforto após o lanche em uma ocasião, sem afirmar relação causal.
- **Avaliação:** A fonte informa desconforto **após** o lanche e não atribui causalidade nem formula explicitamente a hipótese. Redigir como observação temporal, não como hipótese causal.
- **Correção recomendada:** “Localize a anotação que relata desconforto após o lanche, sem afirmar causalidade.”

### `q-017` — VALIDADO
- **Pergunta:** Qual foi o peso anotado em 12 de março?
- **Documento syn-017:** Em 12/03/2025 foi registrado peso de 68,4 kg (valor sintético).
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-018` — VALIDADO
- **Pergunta:** Localize a medida de 1,72 m.
- **Documento syn-018:** Estatura referida na anotação: 1,72 m, medida sintética para teste.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-019` — INSUFICIENTE
- **Pergunta:** Qual quantidade de água, em mililitros, foi citada?
- **Documento syn-019:** A pessoa mencionou levar uma garrafa de 750 mL ao trabalho.
- **Avaliação:** O gold registra **garrafa de 750 mL**, sem afirmar que continha água ou que 750 mL foram consumidos. Enunciado não sustentado. E5 encontrou o documento, mas não validou a resposta pedida.
- **Correção recomendada:** “Qual é a capacidade, em mililitros, da garrafa levada ao trabalho?” [mantém gold syn-019] OU editar o documento para dizer explicitamente que a garrafa continha 750 mL de água; não inferir ingestão.

### `q-020` — VALIDADO
- **Pergunta:** Encontre o registro de 3,5 g de fibra.
- **Documento syn-020:** O exemplo sintético da embalagem citada informa 3,5 g de fibra por porção.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-021` — AJUSTAR
- **Pergunta:** O que foi combinado para a próxima conversa em 5 de abril?
- **Documento syn-021:** Próxima conversa combinada para 05/04/2025.
- **Avaliação:** A fonte só registra que a próxima conversa foi combinada para 05/04/2025. A pergunta já contém o dia e pergunta “o que”; não há pauta ou conduta acordada.
- **Correção recomendada:** “Para qual data foi combinada a próxima conversa?” (sem fornecer a data na consulta)

### `q-022` — VALIDADO
- **Pergunta:** Localize a nota sobre acordar às seis e quinze.
- **Documento syn-022:** Em dias presenciais, desperta às 06:15.
- **Avaliação:** Fonte exata: “desperta às 06:15”. Diferença entre escrita por extenso e horário digital explica o cenário de recuperação sem alterar a validade do gold.

### `q-023` — INSUFICIENTE
- **Pergunta:** Existe registro de uso de um copo de 200 ml?
- **Documento syn-023:** Descreveu como referência um copo com capacidade aproximada de 200 mL.
- **Avaliação:** Documento descreve como **referência** um copo de capacidade aproximada de 200 mL; não comprova seu **uso**.
- **Correção recomendada:** “Existe registro de um copo tomado como referência de aproximadamente 200 mL?”

### `q-024` — VALIDADO
- **Pergunta:** Procure o valor 42,7 que aparece na anotação.
- **Documento syn-024:** Exemplo de rótulo mencionado: 42,7 g por porção declarada.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-025` — VALIDADO
- **Pergunta:** Qual evolução cita manga no lanche da tarde?
- **Documento syn-025:** À tarde costuma escolher manga como fruta do lanche.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-026` — VALIDADO
- **Pergunta:** Há anotação sobre uma feira visitada em janeiro?
- **Documento syn-026:** Em janeiro comentou que visitou uma feira de produtores locais.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-027` — INSUFICIENTE
- **Pergunta:** O registro mais antigo fala de pão de fermentação natural?
- **Documento syn-027:** Mencionou pão de fermentação natural em uma conversa inicial.
- **Avaliação:** “Registro mais antigo” é incorreto: syn-027 está em 2020-08-15, enquanto syn-001 data de 2020-01-02. É uma fonte antiga, não a mais antiga.
- **Correção recomendada:** “Qual nota antiga menciona pão de fermentação natural?”

### `q-028` — VALIDADO
- **Pergunta:** Localize a preferência por sopa no jantar nas notas antigas.
- **Documento syn-028:** Em uma anotação antiga contou que prefere sopa no jantar durante o inverno.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-029` — AJUSTAR
- **Pergunta:** Qual texto descreve uma receita de milho roxo?
- **Documento syn-029:** Compartilhou uma receita de milho roxo que conheceu em uma viagem.
- **Avaliação:** Fonte relata que compartilhou uma receita de milho roxo, mas não descreve ingredientes, preparo ou conteúdo da receita.
- **Correção recomendada:** “Qual nota menciona que uma receita de milho roxo foi compartilhada?”

### `q-030` — VALIDADO
- **Pergunta:** Existe nota que mencione água com gás?
- **Documento syn-030:** Disse que às vezes escolhe água com gás no almoço.
- **Avaliação:** Fonte syn-030 fala explicitamente “água com gás”. E5 ranqueia à frente syn-010, sobre kefir de água, que não implica água gaseificada.

### `q-031` — VALIDADO
- **Pergunta:** Qual documento registra chá de hibisco?
- **Documento syn-031:** O chá de hibisco foi citado como bebida que experimentou.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-032` — VALIDADO
- **Pergunta:** Encontre uma nota sobre couve-flor assada.
- **Documento syn-032:** Comentou que preparou couve-flor assada para o jantar.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-033` — AJUSTAR
- **Pergunta:** Há relato de que a pessoa deixou de consumir café?
- **Documento syn-033:** Informou que parou de tomar café no período da tarde.
- **Avaliação:** Fonte registra interrupção do café **no período da tarde**; não demonstra abandono completo de café.
- **Correção recomendada:** “Há relato de que a pessoa deixou de consumir café no período da tarde?”

### `q-034` — VALIDADO
- **Pergunta:** Qual avaliação menciona rotina de turnos noturnos?
- **Documento syn-034:** Descreveu trabalho em turnos noturnos alternados.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-035` — VALIDADO
- **Pergunta:** Procure uma referência a castanha de baru.
- **Documento syn-035:** A conversa registrou castanha de baru entre os alimentos que conhece.
- **Avaliação:** A fonte gold sustenta diretamente o conteúdo pedido. Não foi identificada fonte alternativa no conjunto elegível que sustente melhor esta consulta.

### `q-036` — SEM-RESPOSTA INVÁLIDO
- **Pergunta:** O prontuário informa consumo de tofu nesta semana?
- **Documento syn-036:** Não há menção a tofu nesta semana; o texto fala apenas de feijão.
- **Avaliação:** syn-036 nega haver menção a tofu; é diretamente pertinente à pergunta sobre existência de registro, embora não prove consumo de tofu.
- **Correção recomendada:** Substituir syn-036 por texto neutro, sem tofu e sem metacomentário sobre ausência.

### `q-037` — SEM-RESPOSTA INVÁLIDO
- **Pergunta:** Existe algum registro de suplemento de zinco?
- **Documento syn-037:** As notas disponíveis não citam suplemento de zinco.
- **Avaliação:** syn-037 afirma ausência de notas sobre suplemento de zinco; diretamente pertinente à pergunta.
- **Correção recomendada:** Substituir syn-037 por texto neutro, sem zinco e sem metacomentário sobre ausência.

### `q-038` — SEM-RESPOSTA INVÁLIDO
- **Pergunta:** Qual nota descreve caminhada na neve?
- **Documento syn-038:** Nenhuma anotação deste conjunto fala sobre caminhada na neve.
- **Avaliação:** syn-038 afirma que nenhuma anotação fala sobre caminhada na neve; diretamente pertinente à pergunta.
- **Correção recomendada:** Substituir syn-038 por texto neutro, sem neve e sem metacomentário sobre ausência.

### `q-039` — SEM-RESPOSTA INVÁLIDO
- **Pergunta:** Foi registrada alergia a kiwi?
- **Documento syn-039:** Não existe informação sobre alergia a kiwi nas notas sintéticas.
- **Avaliação:** syn-039 afirma que não existe informação sobre alergia a kiwi; diretamente pertinente à pergunta.
- **Correção recomendada:** Substituir syn-039 por texto neutro, sem kiwi e sem metacomentário sobre ausência.

### `q-040` — SEM-RESPOSTA INVÁLIDO
- **Pergunta:** O histórico registra consumo de pitaya amarela?
- **Documento syn-040:** Nenhuma evolução menciona pitaya amarela.
- **Avaliação:** syn-040 afirma que nenhuma evolução menciona pitaya amarela; diretamente pertinente à pergunta.
- **Correção recomendada:** Substituir syn-040 por texto neutro, sem pitaya e sem metacomentário sobre ausência.

## Os três pontos de divergência BM25 versus E5

### `q-019` — Qual quantidade de água, em mililitros, foi citada?
- **BM25:** `syn-010` (Foi anotado que experimentou kefir de água pela primeira vez.) · `syn-020` (O exemplo sintético da embalagem citada informa 3,5 g de fibra por porção.) · `syn-030` (Disse que às vezes escolhe água com gás no almoço.) · `syn-002` (No trabalho costuma esquecer de beber água e relata baixa ingestão de líquidos.) · `fill-003` (Foi relatada preferência por refeições preparadas em casa.)
- **E5:** `syn-009` (Na lista de alimentos citados apareceu lentilha vermelha.) · `syn-017` (Em 12/03/2025 foi registrado peso de 68,4 kg (valor sintético).) · `syn-010` (Foi anotado que experimentou kefir de água pela primeira vez.) · `syn-029` (Compartilhou uma receita de milho roxo que conheceu em uma viagem.) · `syn-019` (A pessoa mencionou levar uma garrafa de 750 mL ao trabalho.)
- **MINILM:** `syn-010` (Foi anotado que experimentou kefir de água pela primeira vez.) · `syn-023` (Descreveu como referência um copo com capacidade aproximada de 200 mL.) · `syn-019` (A pessoa mencionou levar uma garrafa de 750 mL ao trabalho.) · `syn-024` (Exemplo de rótulo mencionado: 42,7 g por porção declarada.) · `syn-030` (Disse que às vezes escolhe água com gás no almoço.)

### `q-022` — Localize a nota sobre acordar às seis e quinze.
- **BM25:** `fill-002` (Conversaram sobre horários disponíveis para a próxima consulta.) · `fill-010` (Conversaram sobre horários disponíveis para a próxima consulta.) · `fill-018` (Conversaram sobre horários disponíveis para a próxima consulta.) · `fill-026` (Conversaram sobre horários disponíveis para a próxima consulta.) · `fill-034` (Conversaram sobre horários disponíveis para a próxima consulta.)
- **E5:** `syn-022` (Em dias presenciais, desperta às 06:15.) · `fill-002` (Conversaram sobre horários disponíveis para a próxima consulta.) · `fill-010` (Conversaram sobre horários disponíveis para a próxima consulta.) · `fill-018` (Conversaram sobre horários disponíveis para a próxima consulta.) · `fill-026` (Conversaram sobre horários disponíveis para a próxima consulta.)
- **MINILM:** `syn-022` (Em dias presenciais, desperta às 06:15.) · `syn-005` (Janta geralmente por volta das dez e meia da noite.) · `fill-002` (Conversaram sobre horários disponíveis para a próxima consulta.) · `fill-010` (Conversaram sobre horários disponíveis para a próxima consulta.) · `fill-018` (Conversaram sobre horários disponíveis para a próxima consulta.)

### `q-030` — Existe nota que mencione água com gás?
- **BM25:** `syn-030` (Disse que às vezes escolhe água com gás no almoço.) · `syn-039` (Não existe informação sobre alergia a kiwi nas notas sintéticas.) · `syn-010` (Foi anotado que experimentou kefir de água pela primeira vez.) · `syn-002` (No trabalho costuma esquecer de beber água e relata baixa ingestão de líquidos.) · `fill-000` (Foi revisada a organização das refeições nos dias de rotina habitual.)
- **E5:** `syn-010` (Foi anotado que experimentou kefir de água pela primeira vez.) · `syn-030` (Disse que às vezes escolhe água com gás no almoço.) · `syn-019` (A pessoa mencionou levar uma garrafa de 750 mL ao trabalho.) · `syn-002` (No trabalho costuma esquecer de beber água e relata baixa ingestão de líquidos.) · `syn-027` (Mencionou pão de fermentação natural em uma conversa inicial.)
- **MINILM:** `syn-030` (Disse que às vezes escolhe água com gás no almoço.) · `syn-010` (Foi anotado que experimentou kefir de água pela primeira vez.) · `syn-002` (No trabalho costuma esquecer de beber água e relata baixa ingestão de líquidos.) · `syn-019` (A pessoa mencionou levar uma garrafa de 750 mL ao trabalho.) · `syn-023` (Descreveu como referência um copo com capacidade aproximada de 200 mL.)

**Conclusão:** `q-019` mede uma associação que não está explicitada pela fonte; `q-022` é um exemplo válido de normalização semântica de horário por extenso; `q-030` demonstra um erro de ranqueamento do E5 na primeira posição (kefir de água ≠ água com gás).

## Os cinco casos rotulados como “sem resposta”

| ID | Fonte pertinente que existe no corpus | Impacto |
|---|---|---|
| `q-036` | `syn-036`: Não há menção a tofu nesta semana; o texto fala apenas de feijão. | Relato explícito de ausência; não serve como caso sem fonte relevante. |
| `q-037` | `syn-037`: As notas disponíveis não citam suplemento de zinco. | Relato explícito de ausência; não serve como caso sem fonte relevante. |
| `q-038` | `syn-038`: Nenhuma anotação deste conjunto fala sobre caminhada na neve. | Relato explícito de ausência; não serve como caso sem fonte relevante. |
| `q-039` | `syn-039`: Não existe informação sobre alergia a kiwi nas notas sintéticas. | Relato explícito de ausência; não serve como caso sem fonte relevante. |
| `q-040` | `syn-040`: Nenhuma evolução menciona pitaya amarela. | Relato explícito de ausência; não serve como caso sem fonte relevante. |

Todos os cinco documentos estão no **mesmo tenant e paciente** das consultas. BM25 e E5 recuperam o respectivo `syn-036`…`syn-040` entre as primeiras duas posições (E5 sempre na primeira); isso não é, por si só, recuperação enganosa: os documentos foram escritos para mencionar exatamente a ausência do objeto buscado. A evidência textual da ausência é distinta de uma afirmação factual de não consumo ou inexistência real.

## Checagens de integridade e limites da amostra

- Corpus: **210 documentos**; **200 elegíveis** e **10 de outro tenant**.
- **30 perguntas de teste:** 25 com gold e 5 classificadas “sem resposta”.
- SHA-256 do arquivo `corpus.json` coincide exatamente com `run-001.json`.
- Nenhum resultado top-10 dos três métodos aponta para documento do outro tenant; isto confirma o artefato sintético, **não** isolamento/RLS de produção.
- As 120 fontes `fill-*` consistem em apenas **8 textos repetidos 15 vezes** cada. A alta repetição afeta os rankings, sobretudo em `q-022`: o top-10 do BM25 é ocupado por cópias de “horários disponíveis para a próxima consulta”.
- `syn-027` é antiga por data e está além das 50 fontes mais recentes, mas **não** é a fonte mais antiga do corpus. `syn-001` é mais antiga.
- Esta revisão foi de rastreabilidade/semântica do corpus. Não revisou pesos/licenças de modelos nem executou API, RLS, serviços ou ambientes reais.

## Plano recomendado para o Codex (sem atualizar silenciosamente v3)

1. Preservar **v3, hashes, relatório e run-001** como baseline auditado; não alterar retroativamente o protocolo congelado.
2. Criar **corpus/protocolo v4** ou complemento versionado de errata, com decisões editoriais explícitas para `q-016`, `q-019`, `q-021`, `q-023`, `q-027`, `q-029` e `q-033`. Não manter como gold válido uma relação não afirmada pela fonte.
3. Reescrever `syn-036`…`syn-040` como notas neutras sobre outros temas, sem menção nem negativa explícita a tofu, zinco, neve, kiwi e pitaya; preservar o total de fontes e o mesmo isolamento de tenant.
4. Conferir semanticamente **todas** as fontes elegíveis para os cinco novos negativos, não apenas busca de substring. Acrescentar revisão independente e justificativa curta por pergunta.
5. Gerar novos SHA-256 e executar novamente BM25, E5 e MiniLM com os mesmos limites e critérios **sem mudar os limiares após ver resultado**. Calcular NDCG@10, Recall@10, cobertura, ranks, casos de abstenção e quaisquer variações por categoria.
6. Para rótulo “sem resposta”, exigir avaliação de **relevância da fonte** separada da evidência positiva; testar mecanismos de abstenção sem forçar top-10 como se houvesse resposta.
7. Revisar amostragem dos fillers: há só oito textos repetidos 15 vezes, tornando a dificuldade artificial. Se substituídos, documentar mudança de benchmark e não comparar como se fosse a mesma versão.
8. Manter **G01 bloqueado**. Evidência de valor, direitos/licença G02 e gates de PHI/operacionais continuam separados; revisão de gold não autoriza produção.

## Texto pronto de execução

> Audite os 30 casos de teste da PoC Fase 319 usando esta revisão e os arquivos corpus.json, run-001.json e RELATORIO_POC_SINTETICA_V3.md. Preserve v3 integralmente. Trate q-019, q-023 e q-027 como incompatibilidades entre pergunta e fonte; ajuste q-016, q-021, q-029 e q-033; corrija q-036 a q-040, pois há fontes syn-036 a syn-040 diretamente pertinentes afirmando ausência de registro. Crie somente uma proposta versionada v4, não altere thresholds retroativamente, não integre ao runtime nem mude gates ou provoque deploy. Registre o racional de cada rótulo, gere novos hashes e apresente comparativo antes de qualquer decisão de produto.
