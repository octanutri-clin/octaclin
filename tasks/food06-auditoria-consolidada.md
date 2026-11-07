# FOOD06 — auditoria consolidada M01–M12 (reconstrução)

**Reconstruído em 07/11/2026 a partir do histórico da conversa e de conferência
estática direcionada da base preservada. Não é cópia literal do commit perdido
`cfaa42f5`, nem recuperação de seus arquivos, testes ou assinaturas.**

## Base e alcance

- Código analisado: `137aa547cfc13fd380a554af81542bec0663a556` (M11→prévia M04).
- Worktree: `/workspace/octaclin/.worktrees/food06-m01-rastreabilidade-recuperacao`.
- Branch documental: `feat/food06-m01-rastreabilidade-recuperacao`; ponto de partida
  desta reconstrução: `97ddc707784fe1e72f7315384f0117dd3b396353`, somente guia Claude
  sobre a base de código acima. Identificar o commit destes relatórios pelo Git.
- PR455 consultada na retomada: aberta/Draft, HEAD137aa547, base main3b35e104.
  Ref remota da PR reconferida neste ciclo; esta publicação não a atualiza.
- Estado inicial da worktree: limpo. Main tem `next-env.d.ts` preexistente modificado;
  outra worktree FOOD06 em004eab71 tem histórico divergente. Ambas preservadas.
- Seis documentos originais e implementação M01 posterior estavam apenas no TEMP
  perdido. A implementação não está nesta base e não é aprovada por esta reconstrução.
- Nenhuma funcionalidade, dependência, workflow, critério clínico ou permissão foi
  alterada. Não há nova execução de testes funcionais, browser, PDF ou banco aqui.

## Diagnóstico gerencial

Há um conjunto factual integrado relevante: cobertura, contribuições, prévias,
registros cifrados, comparação, histórico, relatório e consulta assistida. A presença
dessas camadas não encerra os requisitos científicos nem todas as jornadas M01–M12.

Preserva-se **50,0% administrativos** da matriz: M09 encerrada tecnicamente, dez
melhorias parciais e M12 pendente. Método original:100×(1+10×0,5)/12. Não é esforço,
prazo, porcentagem de critérios ou prontidão assistencial. Não foi calculado novo
percentual subjetivo. Os29 critérios oficiais são examinados separadamente.

**M01 e M02 são candidatas condicionais a fechamento**, pois seus critérios não
exigem habilitar referências DRI numéricas. Precisam resolver as lacunas próprias
e apresentar provas de integração; não estão concluídas. M03 pode avançar com
motivos explícitos de indisponibilidade, mas ainda tem lacunas de integração.
M09 mantém o aceite técnico existente; não foi reaberta artificialmente.

## Índice de evidências (arquivos na base137aa547)

Os paths abaixo são relativos à raiz. Specs presentes são localização de prova,
não alegação de nova execução. Histórico documentado conserva o SHA informado.

| ID | Código/contrato conferido e documentação de prova |
| --- | --- |
| E01 | Backend `src/modulos/planos-alimentares/dominio/cobertura-dietetica.ts`: `analisarCoberturaDietetica`, cinco estados, classificação por nutriente, somas PA06; spec adjacente. `tasks/onda-a-pos-320-food06.md` |
| E02 | Mesmo domínio: `contribuicoes-dieteticas.ts`/`decomporContribuicoesDieteticas`, seletor de `calculo-combinado.ts`; projeção `aplicacao/projecao-origem-contribuicao.ts`; Web `components/pacientes/contribuicoes-micronutrientes.tsx`. `food06-contribuicoes-dominio.md`, `food06-m02-origem-ordenacao.md` |
| E03 | Backend `aplicacao/projecao-ajuda-dietetica.ts` e catálogo de motivos/ajuda; Web leitor/componente de ajuda. `food06-interface-ajuda.md`, especificação M03/M09 |
| E04 | Domínio `previa-dietetica.ts`/`compararCenariosFactuais`, DTOs e métodos de prévia/confirmação em `servico-planos-alimentares.ts`; Web integração do editor. `food06-api-previa-micronutrientes.md`, `food06-api-previa-receitas.md`, `food06-interface-previa*.md` |
| E05 | `aplicacao/construtor-analise-factual.ts`, `projecao-registro-factual.ts`, leitura/persistência cifrada e spec1081 de integração. `food06-fonte-versao.md`, `food06-api-registros-factuais.md`, `food06-contexto-confirmado.md` |
| E06 | Web `lib/micronutrientes-factuais.ts`/`filtrarMicronutrientesFactuais`, componente homônimo, browser `tests/visual/food06-tabela-factual.spec.mjs`. `food06-interface-factual.md` |
| E07 | Domínio `comparacao-versoes-factuais.ts`/`compararVersoesFactuais`; projeção/comparação de registros e UI. `food06-comparacao-versoes-dominio.md`, `food06-handoff-registro-factual.md` |
| E08 | `aplicacao/fontes-relatorio-factual.ts`/`resumirFontesRegistro`: resumo global50grupos, não fonte por célula; `relatorio-analise-factual.ts`, Web `lib/relatorio-factual.ts` e componente. `food06-m08-relatorio.md`, `food06-contexto-historico-relatorio.md` |
| E09 | Ajuda própria versionada, `comparacoesHabilitadas:false`; contrato e histórico técnico em `food06-interface-ajuda.md`, CIb9ed65bc e correção PA07 em `food06-pa07-release.md` |
| E10 | `projecao-registro-factual.ts`/`compararBasesHistoricas`/`projetarResumoHistoricoFactual`; Web `lib/historico-micronutrientes-factuais.ts` e componente homônimo. `food06-m10-historico.md`, `food06-contexto-historico-relatorio.md` |
| E11 | `aplicacao/consulta-teor-catalogo.ts`, `servico-consulta-teor-catalogo.ts`, controlador/DTO, specs e integração; Web `components/pacientes/consulta-teor-catalogo.tsx`, callback `aoSelecionar` apenas para conhecido, preenchimento da prévia. `food06-m11-api-catalogo.md`, `food06-m11-interface-catalogo.md`, `food06-m11-previa-editor.md` |
| E12 | Reutilização M12 possível pelo comparador E04, seletor PA06, receitas existentes e writer CAS. Não foi identificado fluxo integrado de múltiplos cenários que satisfaça M12-C1/C2/C3. Nome `compararCenariosFactuais` sozinho não prova a entrega M12 |

O prefixo dos paths backend abreviados é `octaclin-backend/`; o de Web é
`octaclin-web/`. Documentos abreviados na tabela estão em `tasks/`.

## Achados e divergências concretas

1. **Fontes M01:** cobertura não projeta fonte por nutriente; M08 resume origem
   global dos itens congelados. Não é suficiente para identificar quais origens
   documentadas contribuíram para cada subtotal. Não inferir vínculo por célula.
2. **M11-C1/C3 desatualizados:** a tabela canônica ainda diz PENDENTE; o código e
   o checkpoint vigente mostram API/BFF/UI e seleção para M04. Recomendação: PARCIAL,
   mantendo M11-C2 bloqueado e demais critérios. Matriz canônica não foi reescrita.
3. **M08/contexto:** linhas antigas ainda dizem contexto indisponível. O formato2
   posterior tem resumo congelado opt-in. Isso resolve parte factual, não referências
   científicas, acessibilidade integral ou todas as combinações de exportação.
4. **CI antigo rotulado pendente:** checkpoints dos incrementos não refletem o CI
   posterior137aa547, agora consultado. Preservar registros como históricos e citar
   o CI correspondente; verde não prova critérios fora das suítes executadas.
5. **M12:** seleção M11 preenche um formulário M04; não é comparação persistente
   de múltiplos cenários, biblioteca de propostas ou confirmação de cenário composto.
6. **Referências:** projeções ainda devolvem `referencias_nao_habilitadas`. A
   ratificação clínica CL01–CL08 não equivale a liberação jurídica/operacional.

Não se concluiu duplicação defeituosa de motores pela leitura feita. A soma PA06 e
os seletores existentes devem ser reutilizados. Evitar novo agrupador de fontes
divergente em React/BFF/relatório; completar a projeção backend existente. Não há
nova alegação de vulnerabilidade P0 baseada apenas no histórico perdido.

## Incremento M11 realmente entregue e reutilização

E11 oferece consulta factual autorizada/paginada, estado conhecido/zero/ausente,
fonte/porção/preparo e escolha explícita. No editor, preenche quantidade/peso emg,
limpa prévia anterior e preserva confirmação pelo writer M04. Não calcula ou grava
ao selecionar; filtros de disponibilidade não atestam compatibilidade clínica.

O handoff da base relata46browser,180serviço e150BFF PASS para esse incremento,
com Node22/build, R4 estática e UX delimitadas. São provas históricas do código
preservado, não testes desta reconstrução. M12 pode reutilizar cálculo/deltas,
estado temporário, cancelamento, revisões/fingerprint e CAS; ainda deve definir e
implementar a composição de alterações, seus limites e a confirmação segura.

## CI e limites de validação desta reconstrução

Consulta GitHub deste ciclo para137aa547: OctaClin CI
[42311035746](https://github.com/octanutri-clin/octaclin/actions/runs/42311035746)
concluído SUCCESS. Jobs Backend, Web, Demo e PR Gate SUCCESS; etapas de migrations
em Postgres CI, provisionamento da role RLS e Testcontainers SUCCESS; Web authz
SUCCESS. Isso não fornece uma nova contagem de casos nem prova cenários não mapeados.

Workflows de pesquisa42311035841, Dependency Review42311035687,
Semgrep42311035722, CodeQL42311035685 e Trivy42311035708 também SUCCESS na consulta.
O wrapper retorna a primeira página; não se afirma enumeração universal de checks.
Consulta de status legacy retornou lista vazia: não foi usada como prova de verde.
SBOM provenance tinha SKIPPED documentado no histórico; o resultado individual
atual não foi reconfirmado nesta consulta e não é promovido a PASS.

Nenhuma suíte funcional, build, PDF ou PostgreSQL foi executada de novo nesta
reconstrução exclusivamente documental. Não há nova R4 independente ou nova UX.
Os testes/pareceres do incremento M01 perdido não são reaproveitados como aceite.
Verificação documental local:29 critérios únicos reconciliados com os IDs oficiais,
links locais resolvidos, `git diff --check` e scanner local de segredos PASS.
Essas verificações não validam funcionalmente M01–M12.

Ambiente: sete caches gerados removidos com autorização permitiram o checkout;
restavam cerca de877MiB. O bloqueio anterior de Docker por ENOSPC não demonstra
falha funcional, nem foi resolvido para banco apenas porque o checkout agora existe.

## Documentos de continuidade

- [Maturidade M01–M12](food06-matriz-maturidade.md)
- [Todos os29 critérios e lacunas](food06-pendencias-por-criterio.md)
- [Bloqueios compartilhados](food06-bloqueios-compartilhados.md)
- [Roadmap em cinco frentes](food06-roadmap-conclusao.md)
- [Próxima tarefa única](food06-handoff-proxima-execucao.md)
- [Guia completo de entrada do Claude](CLAUDE_CODE_INICIO_E_HANDOFF_FOOD06_M01.md)

G06, fontes/direitos, testes transversais e critérios específicos permanecem
separados. Nenhum merge, deploy, migration externa ou novo código por esta auditoria.
