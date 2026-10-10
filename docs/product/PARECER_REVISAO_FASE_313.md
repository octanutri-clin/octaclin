# Parecer de conferência documental — OctaClin, Fase 313

**Data da revisão:** 10/10/2026
**Situação:** CONFERÊNCIA DOCUMENTAL CONCLUÍDA; APROVAÇÃO CLÍNICA FINAL PENDENTE.
**Escopo:** ficha `FICHA_VALIDACAO_CLINICA_FASE_313.md`, sem dados identificáveis de pacientes.
**Importante:** este parecer valida correspondência com fontes e coerência de regras propostas, **não** substitui a ratificação da equipe/proprietário responsável pelas decisões clínicas e de produto.

## 1. Resultado da conferência das fontes

1. **Tabela semanal MS/UFS 2022** — Foram comparadas todas as 31 linhas (10–40 semanas), quatro grupos de IMC e dois extremos por grupo: **124 faixas e 248 valores**. **Nenhuma divergência de transcrição** em relação ao anexo da página impressa 50 (índice PDF 51). Todos os limites inferiores são menores que os superiores. Fonte: https://docs.bvsalud.org/biblioref/2022/12/1401909/livro_saps_guia_organizacao_vigilancia_alimentar_nutricional_2022.pdf
2. **Caderneta Brasileira das Gestantes 2026** — Página impressa 87, índice 87 do PDF (página 88 do arquivo), confirma: curvas destinadas a gestantes adultas de feto único, ausência de teste para adolescentes e gemelares e arredondamento de 1–3 dias para semana completa e 4–6 dias para a próxima. O dia zero mantém naturalmente a semana completa. Fonte: https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/saude-da-mulher/publicacoes/caderneta-brasileira-das-gestantes.pdf
3. **FEBRASGO 2023** — Confirma uso na população adulta em gestação única de baixo risco, IMC pré-gestacional, ganho cumulativo e origem do peso de referência. Aponta alternativas de peso do início da gestação *até oito semanas* ou *peso habitual*, quando não há peso pré-gestacional conhecido. A fonte não desambigua expressamente 8s0d versus 8s6d. Fonte: https://www.scielo.br/j/rbgo/a/Tz7zqByTjv9WYwwcjWCKMRH/?lang=en
4. **Kac et al. 2021** — A amostra original incluiu mulheres com idade **≥18 anos**. Referência científica às curvas; para os limites de adequação adotados pelo produto, a tabela operacional primária é a do MS/UFS 2022. Fonte: https://pmc.ncbi.nlm.nih.gov/articles/PMC8106749/ ; DOI https://doi.org/10.1093/ajcn/nqaa402
5. **UFRJ dataset V3** — O endereço específico informado na ficha não pôde ser conferido integralmente nesta revisão. A existência do projeto e das ferramentas de curvas foi confirmada no observatório da UFRJ: https://observatorio.nutricao.ufrj.br/projects/view/6 . Isso **não** autoriza afirmar que a versão V3 do dataset foi inspecionada ou validada.

## 2. Divergência editorial real: 13ª semana

| Fonte | Sobrepeso, até/na semana 13 | Obesidade, até/na semana 13 |
| --- | --- | --- |
| Anexo semanal MS/UFS 2022 | [-1,6; -0,5] kg | [-1,7; -0,5] kg |
| Resumo trimestral MS/UFS 2022 e FEBRASGO 2023 | [-1,6; -0,05] kg | [-1,6; -0,05] kg |
| Cartaz do MS 2024 | [-1,6; -0,05] kg | [-1,6; **+0,05**] kg |

Cartaz oficial: https://bvsms.saude.gov.br/bvs/cartazes/ganho_peso_gestacional.pdf

**Encaminhamento recomendado:** manter a tabela **semanal MS/UFS 2022**, na íntegra e exclusivamente, no identificador `ms_ufs_2022_semanal_v1`. Não misturar anexo, quadro trimestral e cartaz em uma mesma série. Documentar a divergência, sua repercussão no resultado e o aceite clínico. A escolha é uma convenção explícita do produto, **não uma errata oficial** e não demonstra superioridade clínica de uma publicação sobre a outra.

## 3. Regras propostas: parecer e pontos pendentes

| Regra | Parecer documental | Encaminhamento |
| --- | --- | --- |
| População com idade ≥18 anos, feto único e risco habitual confirmado | Fundamentada: artigo original usa ≥18; FEBRASGO considera gestações únicas de baixo risco | **Aprovação clínica necessária** para bloquear desconhecido, múltipla ou alto risco; conservar dados brutos |
| Referência pelo peso pré-gestacional medido ou informado | Fundamentada | Registrar origem, data e gravidez vinculada |
| Fallback por medida até **8s0d** | Defensável como limite conservador; a FEBRASGO só escreve “até 8 semanas” | **Decisão de produto/clínica**; não atribuir interpretação 8s0d à fonte como citação literal |
| Alternativa por “peso habitual” | Prevista pela FEBRASGO, mas **não contemplada** explicitamente no algoritmo proposto | Decidir se não entra nesta versão ou se entra como origem separada, identificada e auditável |
| IMC pré-gestacional bruto e faixas OMS | Fundamentada | Não arredondar para escolher categoria; manter peso e altura originais |
| GPG = peso atual – referência, admitindo resultado negativo | Fundamentada | Não substituir pelo peso da consulta anterior nem truncar negativos |
| Arredondamento de semana/dias | Corresponde à Caderneta 2026 | Manter semanas/dias originais; confirmar bordas 9s4d, 40s3d, 40s4d como comportamento de produto |
| Comparações inclusivas sem arredondar o valor clínico | Coerente com uso da faixa da tabela | Decimal exato ou valores em escala inteira; guardar unidade e precisão dos campos |
| IMC referência entre 8 e 100 para classificar | **Não encontrado como corte de aplicabilidade clínica** nas fontes revisadas | Rotular como validação técnica de plausibilidade (a justificar e testar), nunca como orientação MS/FEBRASGO |
| Não produzir IMC atual adulto interpretado, RCQ adulto nem composição corporal durante a gestação | Salvaguarda clínica/funcional apropriada como regra do produto | Definir claramente onde desabilitar cálculos e onde apenas mostrar dados históricos ou medidas brutas |
| Versão imutável, textos descritivos e não prescritivos | Boas escolhas de segurança de produto | Vincular avaliação à gestação, versão e origem; histórico não reclassificado automaticamente |

## 4. Ajustes recomendados ao arquivo antes do aceite

1. Em **§1**, nomear a Caderneta como edição **2026**, especificando a página impressa 87; deixar o link UFRJ V3 marcado como **referência adicional não conferida nesta revisão**, sem depender dele para os números.
2. Em **§2.2**, explicitar que 8s0d é uma **decisão conservadora local**, e especificar a decisão sobre o uso ou não de peso habitual. O caso sintético 8s1d deve dizer “**não elegível como medida substituta**”, e não “sem classificação” de modo absoluto se houver outro peso de referência legítimo.
3. Em **§2.3**, remover a expressão **“sem Lipschitz”**; não possui função operacional nesse classificador.
4. Em **§2.7**, separar **checagem de qualidade dos dados** de **restrição clínica de aplicabilidade**. O limite IMC 8–100 precisa ser definido como heurística técnica local e não deve ser apresentado como corte das curvas brasileiras.
5. Em **§2.5**, documentar se IG vem do pré-natal/USG/DUM, como é registrada na data exata da consulta, o que acontece quando está inconsistente ou não disponível e como impedir o uso acidental da idade gestacional *de hoje* em avaliação antiga.
6. Em **§2.8**, especificar se RCQ factual pode ser mostrado sem classificação ou se fica oculto durante a gestação; impedir qualquer interpretação automatizada, estimativa de percentual de gordura e gatilhos derivados para a gestante.
7. Em **§3**, preservar a divergência da semana 13 com os **três números distintos** para obesidade: -0,5 (semanal), -0,05 (trimestral), **+0,05** (cartaz 2024). Não assumir errata inexistente.
8. Em **§5**, ampliar testes: faltas de IG, IG inválida, idade 18 exatamente, risco incerto, gemelar, gravidez diferente, ausência de origem do peso, alteração da altura de cadastro, entrada decimal e histórico de diferentes versões.
9. Acrescentar teste de transparência: resultado deve carregar `source_id`, `algorithm_version`, semana original, semana arredondada, intervalo aplicado e motivo de não classificação quando houver.
10. No registro de revisão, **não assinalar aprovação clínica final** só porque a transcrição foi conferida. Guardar aceite humano datado no handoff, em repositório/registro apropriado, sem dados pessoais desnecessários.

## 5. Decisões finais solicitadas ao responsável

- [ ] Usar **somente** a tabela semanal do MS/UFS 2022 para a versão `ms_ufs_2022_semanal_v1`, aceitando a divergência da 13ª semana.
- [ ] Incluir **apenas adultas (≥18), gestação de feto único e risco habitual confirmados**; não classificar quando esses dados forem desconhecidos.
- [ ] Admitir peso substituto medido **até 8s0d**, sem estender automaticamente a 8s6d.
- [ ] Decidir o tratamento de **peso habitual**, citado pela FEBRASGO: excluir da versão inicial ou incorporar como origem própria validada.
- [ ] Aplicar a regra de semana arredondada 0–3/4–6 dias, com limites 9s4d e 40s3d inclusos e 40s4d sem faixa.
- [ ] Aceitar extremos inclusivos, precisão decimal e GPG negativo válido.
- [ ] Ratificar textos não prescritivos e desativação de interpretações adultas inadequadas para gestação.
- [ ] Formalizar o limite técnico de plausibilidade do IMC e os casos de IG e histórico.
- [ ] Registrar decisão, data, versão e aceite responsável no handoff da fase.

**Conclusão:** A tabela está conferida e pode ser usada como **candidata a fonte de dados** da versão proposta. O **classificador não deve receber status de “clinicamente validado”**, nem ser liberado em produção antes das decisões acima e dos testes clínicos/funcionais correspondentes.
