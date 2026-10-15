# Handoff atual — PA06: planejamento, sem implementação

Base `eae74b1e`, merge confirmado da PR #419 em 2026-10-15; árvore igual ao
HEAD aprovado `9e12271b`. CI `38656591697` e checks aplicáveis PASS, inclusive
Backend/Web/Demo/PR Gate; scanners SUCCESS; SBOM provenance SKIPPED.
Estado externo da migration1072/deploy não consultado. Nenhuma autorização
operacional inferida pelo merge.

Worktree `/workspace/octaclin/.worktrees/pos320-pa06-planejamento`, branch
`docs/pos320-pa06-planejamento`. Principal e demais worktrees preservados.
Autorização desta etapa: planejamento/análise de gaps e referências pertinentes.

- [Plano PA06](plan-pos-320-pa06.md) e [T00–T10](todo-pos-320-pa06.md).
- Próximo item do roadmap: autosave do rascunho no editor profissional.
- Pesquisa restrita a R013 TanStack/query e R014 react-hook-form; licenças MIT,
  commits fixados e aplicação conceitual no plano. Não instalar bibliotecas.
- D01–D03 respondidas: habilitado por padrão, em ciclos de 60 segundos sem reiniciar por
  tecla; alimentos com porção válida salvos mesmo com outros campos incompletos;
  saída oferece salvar e sair/continuar/descartar com confirmação. Plano anterior
  de opt-in e debounce de 3 segundos substituído. Novo fundamento: snapshot editorial parcial
  cifrado com cálculo/completude vinculados à revisão e sem publicação automática.
- D04/D05 pendentes: efeito do on/off sobre versão publicada e tratamento das
  linhas incompletas. Perguntas enviadas; não inferir retirada de publicação.
- Gaps críticos: revisão PA05 não cobre writer legado de conteúdo; salvar hoje
  recarrega e pode apagar edição posterior. Fechar revisão geral/adesão segura,
  provas PostgreSQL/RLS e coordenador testado antes de entregar UI a Luna.
- Sol6.1 médio: contratos, persistência/concorrência e integração final. Luna alto:
  UI após checkpoint B. Avisar e pausar antes de toda troca manual.
- Próxima ação: incorporar D04/D05 e autorização de implementação. T01–T10
  ainda não iniciadas. Sem runtime, dependências, migrations, merge ou deploy.

O handoff PA05 abaixo é histórico. Pendências de CI nele foram encerradas pelos
checks do HEAD final acima; não representam bloqueios atuais de implementação.
Preservado para rastrear decisões, falhas RED/GREEN e limites operacionais.

## Handoff anterior — PA05: integração Sol e T09

Worktree `/workspace/octaclin/.worktrees/pos320-pa05-planejamento`, branch
`feat/pos320-pa05-preferencias`, base `64f54b88` (#418). Implementação autorizada
em 2026-10-14; UI entregue por Luna alto e retorno manual ao Sol confirmado.

- [Contrato e handoff detalhado Luna](plan-pos-320-pa05.md);
  [T00–T09](todo-pos-320-pa05.md);
  [evidências backend](../docs/governance/EVIDENCIAS_PA05_BACKEND_2026-10-14.md).
- D01–D03 mantidas: dois conjuntos, snapshot por versão e liberadas recolhidas.
  R014/R041 apenas referências; nenhuma nova dependência.
- Revisão R4 independente estática final PASS após quatro achados corrigidos
  com RED: escolha atual escondida, limite ignorado, prévia obsoleta após edição
  e medidas nas alternativas profissionais. Relatório:
  [REVISAO_R4_PA05_2026-10-14.md](../docs/governance/REVISAO_R4_PA05_2026-10-14.md).
- Backend, DTOs, cifra/CAS, clone/hash/publicação, projeção paciente e BFF/tipos
  entregues. Refinamento comprovado: revisão1 para snapshot herdado; zero só
  legado. Isso impede que perda do snapshot pareça ausência legítima.
- T07–T08 implementados: formulário versionado com CAS/reconferência de snapshot,
  prévia profissional, preview de rascunho somente leitura, portal e impressão/PDF
  pela projeção paciente, substituições recolhidas conforme preferência e falha
  segura sem reutilizar conteúdo antigo.
- Verificações locais Luna: typecheck Web PASS; Playwright PA05 focado 6/6 PASS;
  regressões direcionadas de portal/cópia 6/6 PASS desktop/mobile; lint focado sem
  erros (avisos de hooks/refs no componente profissional). Sem build/CI integral,
  revisão R4 ou PR. A tentativa ampla de 38 casos foi interrompida por timeouts
  com servidor Next órfão; os casos relevantes passaram após reinício limpo.
- PostgreSQL 15 local descartável: provas PA05 reais com RLS/concorrência PASS.
  Fixture omite extensões Timescale/pgvector fora do escopo; gate integral
  Testcontainers padrão será validado no CI. ENOSPC anterior não é aprovação.
- [PR única #419](https://github.com/octanutri-clin/octaclin/pull/419), Draft.
  Próxima ação: validar CI do HEAD final; regressões PA02/PA03 38/38 PASS.
  CI inicial `38653741126` falhou na interação PA04/PA05;
  reprodução RED e correção GREEN real 3/3 sem enfraquecer asserções PA04.
  UI conjunta 50/50 + teclado/a11y 4/4, Web/backend typecheck/build PASS.
  Autorização BFF ampla local PASS. CI `38654959106`, HEAD `4eafd661`: Backend
  2.923 testes PASS, PostgreSQL/RLS 66/66 PASS, Redis 2/2 PASS, Web/Governança PASS;
  Demo/PR Gate pendentes. Nova regressão visual reproduzida: seletor parcial
  “Horário” escolhia a checkbox “Horários”; correção exige nome exato e preserva
  a asserção do horário da refeição. Não houve alteração de runtime nesse ajuste.
- PR única preparada inicialmente como Draft para validar CI; migração1072
  somente na fixture local. Não
  aplicar em staging/produção, nem fazer merge/deploy. Autorrevisão não substitui
  revisão independente. Outros checkouts/alteração next-env.d.ts preservados.

PA04 integrada pela PR #418, main `64f54b88`, checks aplicáveis PASS; estado de
produção não inferido. Registro anterior preservado a seguir.

---

# Handoff histórico — PA04: checkpoint anterior ao merge

PA03 integrada pela PR #417, main `6f0be7d`; conteúdo idêntico ao HEAD aprovado
`a013555`. Cinco workflows SUCCESS e dez jobs do CI `38608333870` SUCCESS,
incluindo Web, Backend, Demo e PR Gate. Não inferir deploy pelo merge.

PA04 — resumo de macros na lista de planos. Worktree isolada, base main
`6f0be7d`, implementação em `feat/pos320-pa04-resumos-macros`.

- [Plano e gaps](plan-pos-320-pa04.md); [checklist T00–T08](todo-pos-320-pa04.md).
- D01–D03 confirmadas: ambas as versões separadas, totais dos alimentos
  previstos salvos e somente console profissional.
- Referências específicas PA04 recomendam código interno; nenhum repositório
  externo indicado ou biblioteca nova necessária.
- Implementado: projeção permitida dos snapshots salvos, duas consultas em lote,
  trava compartilhada do paciente, resumo de rascunho/publicada e paginação25.
  Nenhuma migration ou mudança em portal/impressão.
- PASS local: typecheck e build backend/Web; testes focados backend 44/44; BFF
  26/26; Playwright R4 4/4 em desktop/mobile; lint focado 0 erros/10 avisos de
  hooks existentes; secrets, sintaxe e diff checks PASS.
- PostgreSQL real BLOCKED por `ENOSPC` no Testcontainers. A imagem
  `timescale/timescaledb-ha:pg15` foi puxada, mas a inicialização esgotou os
  8,7 GB disponíveis sob Docker VFS; o hook expirou e os 64 casos de integração
  não executaram. A imagem de teste foi removida após a tentativa. Revisão R4
  independente estática confirmou as correções sem executar testes; as
  regressões R4 locais passaram posteriormente.
- PR Draft #418 aberta para executar os gates em CI; checagens remotas pendentes
  neste checkpoint. Nenhuma migration, staging, produção, deploy ou ativação.
- Sem PR/CI. Nenhuma migration, staging, produção, deploy ou ativação.

---

# Handoff histórico — PA03: integrada pela PR #417

Fechamento confirmado em 2026-10-14: merge `6f0be7d`; CI `38608333870`,
Semgrep, CodeQL, Trivy e Dependency Review SUCCESS. Estado Draft/CI pendente
abaixo pertence ao handoff anterior e foi superado por este checkpoint.

Base auditada em 2026-10-14: main `5b47fb1`, merge #416. Worktree isolada
`/workspace/octaclin/.worktrees/pos320-pa03-planejamento`, branch
`feat/pos320-pa03-subtotais-refeicoes`. O proprietário autorizou implementação em
2026-10-14; código e testes locais validados, incluindo build e visual 48/48
mais complementos 4/4. PR [#417](https://github.com/octanutri-clin/octaclin/pull/417)
Draft aberta; CI do HEAD pendente. Sem migration/backend.

- Contratos, gaps G01–G07 e arquivos:
  [plan-pos-320-pa03.md](plan-pos-320-pa03.md).
- T00–T06 e checkpoints:
  [todo-pos-320-pa03.md](todo-pos-320-pa03.md).
- D01–D03 confirmadas: somente editor do profissional; todas as refeições
  recolhidas na carga; subtotais parciais com aviso. Referências específicas
  PA03 recomendam código interno, sem dependência externa.
- Prioridades: preservar ausência de nutrientes, arredondamento por porção,
  identidade/estado, validação de campos recolhidos e trava PA02 colagem/save.
- Implementação executada em modelo Luna; revisão Sol autorizada pelo
  proprietário. Revisão cruzada independente corrigiu um P2 de overflow com
  RED/GREEN. Relatório `docs/governance/REVISAO_R4_PA03_2026-10-14.md`.
- #416 mergeada: HEAD `38c3596`, todos os workflows SUCCESS; CI
  `38583138559` SUCCESS. O registro PA02 abaixo preserva o checkpoint anterior;
  seus itens pendentes de integração/CI foram resolvidos conforme o relatório R4.
- Uma PR Draft PA03 reunirá documentação/código após T05 local; seus checks
  encerram T05 remoto. Nenhuma migration, merge, deploy ou ativação autorizada.

---

# Handoff histórico — PA02: implementação autorizada

Em 2026-10-14 o proprietário autorizou a análise e, após responder D01–D03,
autorizou a implementação da PA02. Main auditada: `2d2edcf`, merge #414/PA01,
com FND02/#411 integrado. A PR #415 já foi mergeada; correções na PR Draft #416. Revisão cruzada R4 fechou dois P2
com RED/GREEN. CI do HEAD corrigido deve ser conferido.

- Contratos, gaps, referências e continuidade:
  [plan-pos-320-pa02.md](plan-pos-320-pa02.md).
- T00–T05 e checkpoints:
  [todo-pos-320-pa02.md](todo-pos-320-pa02.md).
- Branch ativa `fix/pa02-copia-revisao-r4`, main `50a9590` (#415), checkout
  `/workspace/octaclin/.worktrees/pos320-pa02-planejamento`.
- Catálogo/mapa e JSON78 conferidos: PA02 recomenda código interno, sem
  biblioteca nova. D01–D03 confirmadas pelo proprietário em2026-10-14:
  ambos os escopos autorizados, acrescentar/criar e origem salva entre planos.
- Implementação disponível nesta branch: duplicação local por refeição,
  seleção paginada de origem salva, revalidação da versão/acesso no momento da
  cópia e colagem como refeição nova ou acréscimo não destrutivo.
- Evidências e limitações em `todo-pos-320-pa02.md`; a revisão cruzada passou após correções, e CI deve validar o
  HEAD corrigido. A PR permanece Draft até isso ocorrer. Não declarar autorização de uso operacional além da implementação
  técnica; merge/deploy seguem fora da autorização.
- A entrega original reuniu documentos/código na PR #415. O followup #416
  tornou-se necessário após constatar que a original já estava mergeada.

---

# Handoff histórico — Fase 320 encerrada; Onda 0/FND02 iniciada

Em 2026-10-14, por autorização do proprietário, a Fase 320 foi registrada como
`NO-GO` nesta rodada para ingestão/uso da TBCA. O catálogo TACO/USDA/IBGE foi
preservado. Handoff formal: [`plan-fase-320.md`](plan-fase-320.md) e
[`PLANO_FASE_320.md`](../docs/history/phases/PLANO_FASE_320.md).

A Onda 0 começa nesta PR somente com FND02 (consolidação da proteção contra
saída com alterações não salvas), descrita em
[`plan-pos-320-fnd02.md`](plan-pos-320-fnd02.md). Nenhuma outra sugestão das
ondas está autorizada automaticamente. Não há migration TBCA, ativação,
deploy ou alteração de ambiente externo nesta tarefa.

Base da branch de entrega: `bd4e436b` (`origin/main`, 2026-10-14). Estado dos
gates pós-320 e histórico das Fases 314/315/318 no checklist vigente.

---

# Handoff histórico — Fase 318: planejamento e análise de gaps

Branch `feature/fase-318-ia-rascunhos`, worktree
`/workspace/octaclin/.worktrees/docs-fase-318-planejamento`, base main8ea67a08
(merge407). Checkout principal e sua alteração em next-env.d.ts preservados.

## Autorização e próxima ação

Em2026-10-13 o proprietário autorizou prosseguir com implementação técnica,
mocks, fixtures e testes sintéticos conforme o contrato preparado. Branch
feature/fase-318-ia-rascunhos; gates clínicos/contratuais continuam bloqueados.
Nenhuma chamada paga, envio de dados reais, migration externa, merge, deploy ou
ativação está autorizado. Uma PR de entrega técnica, Draft enquanto houver gates.
Não abrir PR documental isolada; integrar estes documentos à futura PR única.

## Decisões e contratos

D01: pré-consulta e rascunho de evolução, sem orientação nesta fase.
D02 revisada: API externa com chave própria do nutricionista; OpenAI, chave individual
não compartilhada e integração habilitada pela clínica confirmadas. Substitui local CPU; nenhuma chamada paga
ou transferência clínica autorizada ao agente. Pesquisa/testes somente sintéticos.
D03: apenas responsável atual gera/confirma no console; manual legado preservado.
D04: contexto mínimo selecionado e revisão jurídica/privacidade pela equipe;
revisão ainda não concluída. D05: rascunho somente na tela, limpar ao sair/trocar.
D06: proprietário/equipe revisarão30casos, ainda não executados. D07: catálogo
aprovado com padrão econômico e limites. Sem pergunta de produto pendente.


- [Plano, evidências, limites e gates](../docs/history/phases/PLANO_FASE_318.md).
- [T00–T12, arquivos, dependências e critérios](todo-fase-318.md).
- [Contrato técnico BYOK](../docs/product/CONTRATO_OPENAI_BYOK_FASE_318.md).
- [30casos para revisão humana](../docs/product/CORPUS_REVISAO_FASE_318.md).
- Modelos/baseline reais: fases271/272/274 e código pacientes/IA/FastAPI.
- Gate legado ia.clinica não libera318; não copiar persistência/ORM do legado.
- Inferência fora de lock; contexto/identidade revalidados no retorno e
  confirmação, inclusive transferência A→B→A e resposta tardia.
- Prévia com fontes/datas/limites; revisão humana não é assinatura digital.
- Evolução privada/cifrada, título180/conteúdo6000; não prometer replay seguro
  sem desenhar/testar contrato idempotente; não alterar manual por consequência.
- Termos/privacidade da API OpenAI, preços e qualidade clínica não presumidos.
- Adaptador OpenAI no backend; não repassar BYOK ao FastAPI legado.
- PoC pode concluir NO-GO; baseline permanece caminho completo para profissional.

## Continuidade

316 permanece stand-by. 317 integrada407/CI main38324741937 PASS consultado nesta
rodada; ativação global não executada pelo agente, preflight processo/providers
pendente. Aceites/autorização já recebidos mantidos. Não habilitar flags aqui.
314 classificadores permanecem bloqueados; medidas factuais autorizadas não são
protocolo de IA. Handoff313 antigo preservado em plan-fase-313.md.

## Modelos e execução

GPT-6.1 Sol médio para análise/contratos/segurança e integraçãoR4. Luna alto pode
preparar fixtures e UI com contrato fechado; não recomendado sozinho para fase
inteira. Se houver transição, avisar modelo alvo e pausar para troca manual.
Não houve troca nem delegação. Execução futura nativa, sem reabrir planejamento
por preferência; novas decisões só para lacunas demonstradas.

## Histórico das verificações do planejamento

Inspeção de Git/worktrees/diff, contratos/código e GitHub407/CI main. No planejamento não rodados
benchmarks/testes de implementação318; CI317 não prova318. Diff/secrets/links documentais conferidos ao concluir; consulta de páginas públicas
OpenAI200, sem chamadasAPI. Nenhum resultado clínico ou modelo ratificado pelo agente.

## Execução técnica — estado atual

Backend318, credenciais cifradas/CAS, gates, fontes, adaptador, prova efêmera,
confirmação transacional/idempotente e auditoria implementados. Migration1071
aditiva cobre invalidação monotônica em pacientes/profissionais/usuários;1070
intocada. BFF allowlist e UI no prontuário/integrações/configuração da clínica.
Ledger: `docs/history/phases/reviews/fase-318/EXECUCAO.md`. Testes de fornecedor
exclusivamente mock; nenhum modelo ou contrato ratificado. Gates G01/G02/G05
BLOCKED. Terminar provas/CI e revisão antes de concluir T11; T12 exige autorização.

## Followup após408 — correções de uso e piloto ainda bloqueado

Base4aeb5297. Usuário pediu revisão do500 Metas e Adesão, clareza da tela de
Integrações, identificação de profissional e backlog de Perfil. Desenvolvimento
e testes das correções autorizados; nenhum deploy/flag/migration externa executado.

- SQL legado badges: Raw gerava BadgeOrm.regraConquista sem quoting; PostgreSQL
  reportou missing FROM-clause. Teste gera SQL TypeORM sem conectar ao banco: RED,
  correção mantém tenant/exclusão317, GREEN. Prova real nova só CI descartável.
- Estado cadastral OpenAI deriva de direitos===true no backend e projeção BFF.
  UI não infere permissão de estado ausente; não muda aprovação contratual/global.
- Drawer mostra IDs já recebidos pelo DTO profissional autorizado; sem novo
  acesso, inferência por nome, armazenamento de dados pessoais ou edição de perfil.
- Perfil completo: pendência documentada e ligada ao roadmap, sem escopo novo.
- Piloto sintético continua exigindo isolamento server-side e alvo comprovado;
  não ativar direitos/catálogo clínicos para contornar o cadastro bloqueado.

Finalizar regressões, navegador desktop/mobile, build/typecheck/lint, revisão
R4 com autoria e PR única de followup. APIs/código só são considerados corrigidos
em produção após revisão/merge/deploy próprio, não por testes locais.

## Continuidade técnica do piloto após409

Branch feature/fase-318-revisao-sintetica, baseb9535170. IDs do titular recebidos
por canal da sessão; não versionados. Grant/flag/revisão de custódia continuam
pendentes, sem dados reais ou chamadas pagas. Implementação do corpus30casos,
composição factual, serviço/prova/quota, BFF fechado, chave individual reutilizada
e UI de revisão sintética. Nenhuma migration. R4 e evidências no ledger
`docs/history/phases/reviews/fase-318/PILOTO_SINTETICO_EXECUCAO.md`.
Checkout ativo para entrega: /tmp/octaclin-f318-entrega por ENOSPC do disco
principal; worktree original preservada, sem novo escritor nela. Não fazer
merge/deploy/configuração externa/ativação sem autorização correspondente.

## Fase 319 — pesquisa técnica concluída com NO-GO

PoC sintética v4 concluída; decisão NO-GO para E5/MiniLM. Resultados e artefatos
v3/v4 preservados em `research/fase319/`; plano e relatório em
`docs/history/phases/PLANO_FASE_319.md` e `docs/history/phases/reviews/fase-319/`.
G01/G02/G03 bloqueados, G04 skipped, G05 bloqueado/não executado; T05–T10 não
iniciadas. Sem runtime/índice clínico. A Fase 320 é a etapa seguinte, com ingestão
TBCA sujeita a direitos comprovados.
