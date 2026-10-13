# OctaClin — Matriz de rastreabilidade (v2): 71 sugestões × PRs × GitHub

> **Data da conferência:** 09/10/2026. **Uso:** auditoria e planejamento; não autoriza implementar antes da conclusão formal da Fase 320 e de uma reconciliação com a `main`.
>
> **Fontes de referência:** `ROADMAP_IMPLEMENTACAO_PRS_ONDAS_POS_320.md` e `CATALOGO_MESTRE_REPOSITORIOS_GITHUB_OCTACLIN_POS_320_V2.md`.
>
> Esta matriz faz a ligação explícita que não estava pronta nos documentos anteriores: **número original da sugestão (1 a 71) → ID do PR / situação → repositório(s) aplicáveis**.
>
> Repositórios são *candidatos*, não dependências aprovadas. **“Sem biblioteca” não quer dizer que a funcionalidade está esquecida**: significa que o domínio existente é a melhor base provável.

## Índice de rastreabilidade completo


## Resultado da busca de repositórios adicionais

- **20 das 71 sugestões** estavam marcadas como dependentes apenas do código atual (6 eram recursos já existentes/baseline; as restantes eram candidatas a complementos, sem que isso prove necessidade de dependência).
- **10 novos repositórios pesquisados (R069–R078)**; nove com licença de código permissiva confirmada e um (`R078`) somente como inspiração, **sem licença localizada e com METs de 2011**.
- **Situação final da matriz:** 53 sugestões possuem pelo menos um link direto de GitHub; as 18 restantes não receberam repositório externo de propósito — 6 representam baseline e 12 são adequadas para implementação com a stack/domínio existente. Isso não equivale a 53 necessidades de instalar pacotes.
- Sugestões que ganharam referências concretas: **2, 8, 10, 15, 27, 33, 45, 47, 51, 53, 55, 56, 63, 66, 67 e 69**; além de correções de qualidade de referência nas **3, 34 e 37**.
- Sem biblioteca continua sendo a decisão recomendada em várias melhorias simples ou server-side (por exemplo: duplicar avaliação antropométrica, copiar refeição, ocultar dados financeiros ou fazer links nativos).
- Mesmo com 78 referências, **1 ID de sugestão não deve virar 1 instalação**. O Codex continua obrigado a escolher a solução mínima adequada após a Fase 320.


| Nº original | Sugestão original resumida | PR / cobertura no roadmap | Situação pós-320 | Referências GitHub indicadas |
|---:|---|---|---|---|
| 1 | Zoom nas curvas de crescimento | `ANT06` | PR pós-320 | [R004 — recharts/recharts](https://github.com/recharts/recharts), [R020 — BetterTyped/react-zoom-pan-pinch](https://github.com/BetterTyped/react-zoom-pan-pinch) |
| 2 | Revisar/reagir a todos os registros do diário | `APP03` | PR pós-320 | [R046 — TanStack/table](https://github.com/TanStack/table) somente para seleção em lote; revisão clínica no backend atual |
| 3 | Descrições em português e METs das atividades físicas | `CALC01` | PR pós-320 | [R078 — michael-m-2983/metbrowser](https://github.com/michael-m-2983/metbrowser) **somente inspiração, sem licença/atualização clínica**; valores da [fonte primária 2024](https://pacompendium.com/adult-compendium/); [R056 — fast-check](https://github.com/dubzzz/fast-check) para testes |
| 4 | Arrastar/soltar para reordenar refeições | `PA01` | PR pós-320 | [R001 — clauderic/dnd-kit](https://github.com/clauderic/dnd-kit) |
| 5 | Habit Tracker (alimentação, água, atividade, sono, glicemia) | `APP01` | PR pós-320 | [R017 — simonoppowa/OpenNutriTracker](https://github.com/simonoppowa/OpenNutriTracker), [R067 — Nozbe/WatermelonDB](https://github.com/Nozbe/WatermelonDB) |
| 6 | Crescimento e acompanhamento pediátrico | `ANT05` | CONDICIONAL: fase 314 | [R005 — SunnySeedApp/who-growth-standards](https://github.com/SunnySeedApp/who-growth-standards), [R019 — FlatNineOrg/medilab-pediatric-growth-calc](https://github.com/FlatNineOrg/medilab-pediatric-growth-calc), [R056 — dubzzz/fast-check](https://github.com/dubzzz/fast-check) |
| 7 | Gestação: lote de pesos e escolha da curva | `ANT07` | CONDICIONAL: fase 313 | [R004 — recharts/recharts](https://github.com/recharts/recharts) |
| 8 | Controle financeiro detalhado | `OPS04` | PR pós-320 | [R075 — dinerojs/dinero.js](https://github.com/dinerojs/dinero.js) se faltar aritmética monetária segura; [R046 — TanStack/table](https://github.com/TanStack/table) para UI |
| 9 | Macros sempre visíveis ao montar o plano | `BASELINE: já existe` | SEM NOVO PR | Código atual; sem nova biblioteca necessária |
| 10 | Edição simultânea em diferentes abas | `PA07` | PR pós-320 | BroadcastChannel nativo primeiro; [R071 — pubkey/broadcast-channel](https://github.com/pubkey/broadcast-channel) como fallback; [R068 — yjs/yjs](https://github.com/yjs/yjs) só se colaboração real for autorizada |
| 11 | Mostrar/ocultar valores financeiros | `OPS03` | PR pós-320 | Código atual; sem nova biblioteca necessária |
| 12 | Aba Evolução do paciente reunindo antropometria, exames, fotos, bioimpedância | `APP10 (PROPOSTO)` + `fase 307/ANT04` | GAP: PR específica ausente | [R004 — recharts/recharts](https://github.com/recharts/recharts), [R010 — medplum/medplum](https://github.com/medplum/medplum) |
| 13 | Área de conteúdo e materiais | `BASELINE: já existe; DOC10 melhora a ordenação` | SEM NOVO PR para a base | Código atual; sem nova biblioteca necessária |
| 14 | Unidades/medidas caseiras customizadas por alimento | `FOOD01` | PR pós-320 | [R017 — simonoppowa/OpenNutriTracker](https://github.com/simonoppowa/OpenNutriTracker) |
| 15 | Exames laboratoriais: modelos, comparação e duplicação | `LAB01` + `LAB02` + `LAB03 (PROPOSTOS)` | GAP: 3 PRs específicos ausentes | [R010 — medplum/medplum](https://github.com/medplum/medplum) para modelos, [R004 — recharts/recharts](https://github.com/recharts/recharts) para séries, [R046 — TanStack/table](https://github.com/TanStack/table), [R074 — TanStack/virtual](https://github.com/TanStack/virtual) só se volume justificar |
| 16 | Autosave opcional dos planos alimentares | `PA06` | PR pós-320 | [R013 — TanStack/query](https://github.com/TanStack/query), [R014 — react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form) |
| 17 | Editar modelos de plano, refeições e grupos | `FND01 (já integrado)` + `PA08 (PROPOSTO)` + `FOOD04` | GAP: modelo isolado de refeição | Código atual; sem nova biblioteca necessária |
| 18 | Configurar apresentação das refeições no plano | `PA05` | PR pós-320 | [R014 — react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form), [R041 — storybookjs/storybook](https://github.com/storybookjs/storybook) |
| 19 | Ingredientes e tags em receitas | `FOOD07; reavaliar fase 310` | RESIDUAL PÓS-310 | [R017 — simonoppowa/OpenNutriTracker](https://github.com/simonoppowa/OpenNutriTracker), [R018 — TandoorRecipes/recipes](https://github.com/TandoorRecipes/recipes) |
| 20 | Assinatura/carimbo em declarações e recibos | `DOC01` | PR pós-320 | [R029 — szimek/signature_pad](https://github.com/szimek/signature_pad) |
| 21 | Até 50 substitutos por grupo | `BASELINE: já existe` | SEM NOVO PR | Código atual; sem nova biblioteca necessária |
| 22 | Templates de prontuário | `QST07` | PR pós-320 | [R010 — medplum/medplum](https://github.com/medplum/medplum), [R050 — rjsf-team/react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form) |
| 23 | Páginas dedicadas para anamnese/prontuário | `QST05` | PR pós-320 | [R014 — react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form), [R050 — rjsf-team/react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form) |
| 24 | Cadastrar alimento no próprio editor do plano | `FOOD02` | PR pós-320 | [R047 — downshift-js/downshift](https://github.com/downshift-js/downshift), [R064 — zxing-js/browser](https://github.com/zxing-js/browser) |
| 25 | Exames de bioimpedância | `ANT04` | PR pós-320 | [R010 — medplum/medplum](https://github.com/medplum/medplum) |
| 26 | Copiar última avaliação antropométrica | `ANT02` | PR pós-320 | Código atual; sem nova biblioteca necessária |
| 27 | Importar GET em metas e cálculo de VET | `CALC06 (PROPOSTO)` | GAP: PR específica ausente | Motor GET atual + [R076 — MikeMcl/decimal.js](https://github.com/MikeMcl/decimal.js) somente se teste demonstrar necessidade de precisão |
| 28 | Leitor interno/nativo de PDFs | `DOC03` | PR pós-320 | [R006 — wojtekmaj/react-pdf](https://github.com/wojtekmaj/react-pdf), [R028 — mozilla/pdf.js](https://github.com/mozilla/pdf.js) |
| 29 | Relação cintura/estatura | `ANT01` | PR pós-320 | [R056 — dubzzz/fast-check](https://github.com/dubzzz/fast-check) |
| 30 | Favoritar substitutos de alimentos | `FOOD03` | PR pós-320 | [R047 — downshift-js/downshift](https://github.com/downshift-js/downshift) |
| 31 | Gerador de assinatura/carimbo | `DOC02` | PR pós-320 | [R029 — szimek/signature_pad](https://github.com/szimek/signature_pad) |
| 32 | Selecionar campos no PDF antropométrico | `DOC04` | PR pós-320 | [R002 — pdfme/pdfme](https://github.com/pdfme/pdfme), [R027 — diegomura/react-pdf](https://github.com/diegomura/react-pdf) |
| 33 | Expandir/recolher respostas de questionário | `QST01` | PR pós-320 | [R073 — radix-ui/primitives](https://github.com/radix-ui/primitives) Accordion; [R041 — storybookjs/storybook](https://github.com/storybookjs/storybook) para estados |
| 34 | Nomes clicáveis em listas de recursos | `UX01 (PROPOSTO)` | GAP: PR específica ausente | Usar `next/link` nativo da stack Next.js; **nuqs não é necessário para tornar nomes clicáveis** |
| 35 | Guia de logo e posicionamento em PDFs | `DOC09` | PR pós-320 | [R002 — pdfme/pdfme](https://github.com/pdfme/pdfme) |
| 36 | Botão voltar ao paciente | `BASELINE: já existe` | SEM NOVO PR | Código atual; sem nova biblioteca necessária |
| 37 | Nomes adequados para arquivos PDF | `DOC05` | PR pós-320 | Helper de nome/sanitização e exportação já existentes; **react-to-print não controla sozinho o filename final** |
| 38 | Inserir tabelas em textos | `DOC06` | PR pós-320 | [R003 — facebook/lexical](https://github.com/facebook/lexical) |
| 39 | Aviso de alterações não salvas | `BASELINE: já existe; FND02 consolida` | MELHORIA, não reconstrução | Código atual; sem nova biblioteca necessária |
| 40 | Parâmetros bioquímicos personalizados | `BASELINE: já existe` | SEM NOVO PR | Código atual; sem nova biblioteca necessária |
| 41 | Questionários: link permanente, relatórios, gráficos, envio em massa | `QST02` + `QST03; envio em massa já existe` | PARCIAL: PRs residuais | [R004 — recharts/recharts](https://github.com/recharts/recharts), [R022 — surveyjs/survey-library](https://github.com/surveyjs/survey-library), [R046 — TanStack/table](https://github.com/TanStack/table) |
| 42 | IA para reduzir tarefas manuais clínicas | `AI01` + `AI02` + `AI03` + `AI04` + `AI06; AI05 é da fase 316` | CONDICIONAL: fases 316/318 | [R012 — langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs), [R039 — data-privacy-stack/presidio](https://github.com/data-privacy-stack/presidio), [R040 — promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) |
| 43 | Reordenar materiais de apoio | `DOC10` | PR pós-320 | [R001 — clauderic/dnd-kit](https://github.com/clauderic/dnd-kit) |
| 44 | Copiar e duplicar refeições entre planos | `PA02` | PR pós-320 | Código atual; sem nova biblioteca necessária |
| 45 | Equivalência automática por nutriente selecionado | `FOOD05` | PR pós-320 | [R056 — fast-check](https://github.com/dubzzz/fast-check), [R057 — StrykerJS](https://github.com/stryker-mutator/stryker-js) para testes; [R076 — decimal.js](https://github.com/MikeMcl/decimal.js) somente se necessário |
| 46 | Exibir macros em refeição colapsada | `PA03` | PR pós-320 | Código atual; sem nova biblioteca necessária |
| 47 | Comparar micronutrientes com IDR/DRI e UL | `FOOD06` | PR pós-320 | [R056 — fast-check](https://github.com/dubzzz/fast-check), [R057 — StrykerJS](https://github.com/stryker-mutator/stryker-js), [R076 — decimal.js](https://github.com/MikeMcl/decimal.js) para matemática; **fonte DRI/UL oficial externa obrigatória** |
| 48 | Mostrar macros na lista de planos | `PA04` | PR pós-320 | Código atual; sem nova biblioteca necessária |
| 49 | Reutilizar listas/grupos de substituições | `FOOD04` | PR pós-320 | Código atual; sem nova biblioteca necessária |
| 50 | Agenda: links, busca, título e cores | `OPS01` + `OPS02; link público já existe` | PARCIAL: PRs residuais | [R031 — bigcalendar/react-big-calendar](https://github.com/bigcalendar/react-big-calendar), [R051 — 47ng/nuqs](https://github.com/47ng/nuqs) |
| 51 | Filtrar diário consolidado por paciente | `APP02` | PR pós-320 | [R046 — TanStack/table](https://github.com/TanStack/table), [R051 — nuqs](https://github.com/47ng/nuqs); [R074 — TanStack/virtual](https://github.com/TanStack/virtual) apenas se houver gargalo |
| 52 | Streak de diário/hábitos | `APP04` | CONDICIONAL: fase 317 | [R024 — HabitRPG/habitica](https://github.com/HabitRPG/habitica) |
| 53 | Download de plano e prescrições no app | `APP05` | PR pós-320 | [R077 — expo/expo](https://github.com/expo/expo) (`expo-file-system`, `expo-sharing`, `expo-print` conforme PoC); React-PDF R006 é voltado ao web, não ao app nativo |
| 54 | Macros por refeição no app, com controle de visibilidade | `APP06` | PR pós-320 | Código atual; sem nova biblioteca necessária |
| 55 | Compartilhar registro do diário nos Stories | `APP08` | PR pós-320 | [R077 — expo/expo](https://github.com/expo/expo) para APIs oficiais; [R070 — react-native-view-shot](https://github.com/gre/react-native-view-shot) para card; [R069 — react-native-share](https://github.com/react-native-share/react-native-share) se Stories exigir integração específica |
| 56 | Conversas contextuais em registro de refeição | `APP07` | PR pós-320 | Conversa contextual via domínio de mensagens existente; [R073 — radix-ui/primitives](https://github.com/radix-ui/primitives) somente UI; **WatermelonDB não implementa threads** |
| 57 | Internacionalização/tradução do app | `APP09` | PR pós-320 | [R008 — amannn/next-intl](https://github.com/amannn/next-intl), [R021 — i18next/react-i18next](https://github.com/i18next/react-i18next) |
| 58 | Avaliação física por fotos | `BASELINE: já existe; ANT08 melhora UX` | MELHORIA, não reconstrução | [R007 — nerdyman/react-compare-slider](https://github.com/nerdyman/react-compare-slider), [R020 — BetterTyped/react-zoom-pan-pinch](https://github.com/BetterTyped/react-zoom-pan-pinch) |
| 59 | Estatísticas da conta | `BASELINE: já existe; OPS06 amplia` | MELHORIA residual pós-306 | [R004 — recharts/recharts](https://github.com/recharts/recharts), [R046 — TanStack/table](https://github.com/TanStack/table) |
| 60 | Links clicáveis em textos de orientação | `DOC07` | PR pós-320 | [R003 — facebook/lexical](https://github.com/facebook/lexical) |
| 61 | Equipes/organizações/permissões individuais | `OPS07; organizações/roles já existem` | PR residual pós-320 | [R009 — apache/casbin-node-casbin](https://github.com/apache/casbin-node-casbin) |
| 62 | Aniversariantes no dashboard | `OPS05` | PR pós-320 | Código atual; sem nova biblioteca necessária |
| 63 | Comentários em qualquer registro | `OPS08` | PR pós-320 | Domínio de comentários próprio; [R073 — radix-ui/primitives](https://github.com/radix-ui/primitives) apenas UI de diálogos/threads |
| 64 | Ocultar medidas antropométricas específicas do paciente | `ANT03; confrontar fase 307` | RESIDUAL PÓS-307 | Código atual; sem nova biblioteca necessária |
| 65 | Cores e layout personalizável dos PDFs | `DOC08` | PR pós-320 | [R002 — pdfme/pdfme](https://github.com/pdfme/pdfme), [R027 — diegomura/react-pdf](https://github.com/diegomura/react-pdf) |
| 66 | Recordatório alimentar 24h calculável | `QST04` | PR pós-320 | [R072 — intake24/intake24](https://github.com/intake24/intake24) para metodologia/UX do recordatório; [R010 — medplum/medplum](https://github.com/medplum/medplum) apenas modelagem clínica geral |
| 67 | Modal/painel de prontuário/anamnese em outras telas | `QST06` | PR pós-320 | [R073 — radix-ui/primitives](https://github.com/radix-ui/primitives) Dialog/Popover acessíveis; dados e autorização do prontuário atual |
| 68 | Novas equações de gasto energético | `CALC02` | PR pós-320 | [R056 — dubzzz/fast-check](https://github.com/dubzzz/fast-check), [R057 — stryker-mutator/stryker-js](https://github.com/stryker-mutator/stryker-js) |
| 69 | FA, VO2, MET diário e METy | `CALC03` + `CALC04` | PRs pós-320 | [R056 — fast-check](https://github.com/dubzzz/fast-check) para testes; [R076 — decimal.js](https://github.com/MikeMcl/decimal.js) somente se necessário |
| 70 | Modelo de projeção de perda de peso VENTA | `CALC05` | PR pós-320 | [R011 — INSP-RH/bw](https://github.com/INSP-RH/bw), [R056 — dubzzz/fast-check](https://github.com/dubzzz/fast-check) |
| 71 | Biblioteca pública de receitas entre profissionais | `FOOD08; pós-310` | PR residual pós-320 | [R018 — TandoorRecipes/recipes](https://github.com/TandoorRecipes/recipes), [R042 — openfoodfacts/openfoodfacts-server](https://github.com/openfoodfacts/openfoodfacts-server) |

## Atenção: 7 IDs de PR que faltavam no roadmap anterior

A versão anterior fazia a ligação **por IDs de PR**, mas **não incluía o espelho das 71 sugestões originais**. A revisão identificou **7 PRs ainda não formalizados**, que representam lacunas reais de planejamento. **São propostas para avaliação no handoff pós-Fase 320, não tarefas autorizadas.**

| ID proposto | Escopo exato | Sugestão original | Critério para confirmar necessidade |
|---|---|---|---|
| `APP10` | Área unificada de Evolução no app/portal, com abas de antropometria, exames, fotos e bioimpedância autorizados | Nº 12 | Conferir Fase 307, portal, escopo de visualização e bioimpedância antes de decidir nova tela |
| `LAB01` | Templates reutilizáveis de painéis laboratoriais | Nº 15 | Inspecionar módulo de exames e templates atuais |
| `LAB02` | Comparação lado a lado de duas ou mais coletas laboratoriais | Nº 15 | Inspecionar séries por marcador, Fases 305/308 e não criar outra timeline |
| `LAB03` | Duplicação de coleta/exame como rascunho com data/valores a revisar | Nº 15 | Não duplicar exames como resultados confirmados nem falsificar datas |
| `PA08` | Biblioteca de modelos independentes de refeição, com uso direto no editor | Nº 17 | Fase 298 já cobre modelos de plano; verificar abstração de receita/refeição pronta existente |
| `CALC06` | Ação explícita de importar GET como base para VET/meta do plano | Nº 27 | Auditoria do cálculo energético atual; não duplicar motor GET |
| `UX01` | Padronização de links semânticos em nomes de itens das listagens | Nº 34 | Mapear listagens onde o nome ainda não abre recurso e reutilizar rota atual |

**Recomendação:** depois da Fase 320, primeiro auditar esses sete gaps e decidir se devem virar PR própria, ser absorvidos por outra PR sem violar escopo, ou ser marcados `JÁ COBERTO`.

## Como o Codex deve interpretar os cruzamentos

1. **Se a sugestão já existe:** não abrir novo PR. O vínculo apenas documenta a decisão e eventuais melhorias específicas.
2. **Se a sugestão cruza uma fase 302–320:** comparar o escopo final entregue e a decisão `GO/NO-GO` antes de planejar o residual.
3. **Se houver referências:** ler o campo `how` e `caution` das fichas do catálogo mestre; consultar licença da versão exata antes de integrar.
4. **Se não houver referências:** preferir o serviço, componente ou domínio atual. Não pesquisar nova dependência apenas para preencher uma célula.
5. **Se houver PR proposto:** NÃO executar automaticamente. Exigir primeiro status `RESIDUAL CONFIRMADO`, critérios de aceite e decisão de produto.
6. **Uma PR por função:** sugestões compostas podem se desdobrar em PRs independentes se cada uma entregar um comportamento testável isoladamente.

## Repositórios indicados não são garantia de aplicabilidade

Nem todo repositório referenciado resolve a funcionalidade diretamente. Por exemplo, um projeto de prontuário serve como **referência de modelagem**, enquanto `fast-check` é **ferramenta de teste**, não uma biblioteca que implementa fórmulas clínicas. Reutilizar uma referência por causa da associação no mapa, sem ler sua ficha e sem auditar o código atual, é uma decisão inválida.

**Importante:** o mapa acima se refere às **71 sugestões de produto originais**. Os 19 `ENGxx` propostos depois são uma camada transversal de engenharia; suas referências permanecem na seção específica do catálogo mestre. Portanto, não foram somados como sugestões 72–90.

## Distinção importante: licença de biblioteca versus fonte científica

- **CALC01/MET:** repositório `R078` não fornece um catálogo atual licenciado. Consultar a fonte primária [Compendium of Physical Activities 2024](https://pacompendium.com/adult-compendium/), avaliar direitos de uso, faixa etária/população e tradução. Não importar 2011 por conveniência.
- **FOOD06/IDR/UL:** nenhum repositório testado substitui tabelas oficiais de referência, seu versionamento e regras por idade/sexo/gestação. Biblioteca decimal resolve apenas matemática.
- **QST04/recordatório:** `R072` é Apache-2.0 para o código; alimentos, fotografias, porções e tabelas exigem verificação separada antes de incorporar.
- **APP08/Stories:** captura/compartilhamento é iniciado pelo paciente após preview; sem postagem automática nem PHI involuntária.
- **APP05/PDF:** separar tecnologias de visualização web de download/compartilhamento Expo mobile.

## Orientação pronta para o Codex

> Leia o roadmap pós-320, este arquivo e o catálogo mestre v2. Para cada sugestão/PR, audite primeiro a `main` e o estado final das Fases 302–320. Repositórios são referências candidatas, não pacotes obrigatórios. Confira código existente, licença na versão exata, compatibilidade com Expo/React/Next/Nest, autorização tenant, retenção de PHI, fontes científicas, custo, testes e alternativas nativas. Se a funcionalidade já existir, não abra PR. Se não houver motivo para dependência nova, use o domínio/componente atual. Uma PR por funcionalidade autorizada; documente evidências e critérios de aceite.
