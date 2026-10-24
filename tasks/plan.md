# Handoff ativo — FOOD05 em implementação autorizada

O proprietário autorizou a execução em “Pode seguir, sol médio”. D01–D14/M01–M08
permanecem integrais. Não há autorização de merge, deploy, migrations externas,
infraestrutura ou alteração de cobrança/quota.

- [Plano](plan-pos-320-food05.md), [tarefas](todo-pos-320-food05.md),
  [execução e evidências](execucao-pos-320-food05.md),
  [referências](referencias-pos-320-food05.md).
- Branch `docs/pos320-food05-planning`, base main2f24fcb1; worktree física
  `pos320-food04-planning`. PR446 Draft; implementação ainda em consolidação local.
- T01–T09 com fundamentos/API implementados; T07 agora transporta proveniência
  de cópias entre refeições/planos salvos sob revalidação server-side; aplicação
  por modelos continua pendente e impede fechar T07.
  Contagens completas em `tasks/execucao-pos-320-food05.md`. Gates CI/R4 ainda
  não foram repetidos no delta.
- Uma PR funcional, commits por tarefa, conforme alternativa aprovada no plano.
- FOOD04 produção continua BLOCKED pelo último registro HTTP402;1078 comprovada
  somente em staging. Nenhum acesso externo realizado nesta implementação.
- Modelo Sol médio. Handoff preparado para Luna alto em T10–T13; avisar e pausar
  antes da troca manual. Retomar Sol médio nos contratos R4 restantes e revisão final.

---

## Histórico de handoff preservado — supersedido pelo estado acima

# Handoff ativo — FOOD04 integrada; rollout produtivo bloqueado

Branch documental `docs/food04-rollout-1078`, base main `02a51be8` (#441).
Worktree `/workspace/octaclin/.worktrees/pos320-food04-planning`; checkout principal
com alteração preexistente preservado.

- Proprietário autorizou migrations e validações nesta sessão de24/10.
- CI final de b2da3799 e revisão corretiva concluídos; não reabrir FOOD04.
- Migration1078 aplicada e validada no staging principal, após ensaio/backup.
- Produção não alterada: Neon HTTP402/quota excedida confirmado em duas consultas
  read-only e logs do backend Render; último deploy automático update_failed.
- Sem alteração de plano/cobrança, flag, deploy, privilege grant ou dado clínico.
- Próximo item operacional: regularizar quota com o proprietário, reconciliar
  produção, backup/ensaio, aplicar somente migrations pendentes e verificar.
- Smokes HTTP deram timeout; jornada autenticada pós-aplicação não executada.
- [Relatório detalhado](../docs/governance/EVIDENCIAS_ROLLOUT_FOOD04_2026-10-24.md).
- FOOD05: explicar equivalência por um nutriente-alvo e colher decisões de
  indicadores, pontos de aplicação e atualização explícita. Não implementar antes
  do escopo aprovado. Consultar somente repositórios de referência dessa fase.
- Modelo: Sol médio para operações/planejamento; handoff para Luna alto quando
  implementação estiver suficientemente definida, avisando e pausando a troca.

---

## Handoff anterior preservado — supersedido pelo estado operacional acima

# Handoff ativo — FOOD04: PR #441 em validacao final

Base `origin/main` `9e1984a2` (merge #440), branch `docs/pos320-food04-planning`,
worktree `/workspace/octaclin/.worktrees/pos320-food04-planning`.

- Desenvolvimento autorizado pelo proprietário em “Pode seguir”. Uma única PR
  funcional: [#441](https://github.com/octanutri-clin/octaclin/pull/441), ainda
  Draft. Checkout principal/alteração preexistente preservados.
- [Plano e decisões D01–D08](plan-pos-320-food04.md),
  [T00–T14](todo-pos-320-food04.md), [evidências](execucao-pos-320-food04.md).
  Contratos e próxima ação exata no [handoff Luna](handoff-pos-320-food04-luna.md).
- Domínio/DTOs, biblioteca cifrada/HMAC, capacidades, migration1078, aplicação,
  snapshots, BFF, UI profissional/admin e testes de navegador implementados.
  Testes e limites exatos no ledger; não confundir checkpoint com fase concluída.
- Referências FOOD04 recomendam código interno; nenhuma dependência nova.
  Preservar CAS/autosave60s/posse PA07,20 alternativas/item e96KiB.
- Sol médio está fechando T13–T14. A revisão cruzada de 24/10 encontrou dois
  P2 adicionais (snapshot catálogo e cancelamento durante save); regressões RED
  confirmadas, correções e GREEN focais implementados. Faltam revisão do delta,
  regressões e CI do HEAD final. Não confundir checks de SHAs anteriores com aceite.
- Os gates Governança/Mobile foram corrigidos no checkpoint d3157af0; relatório
  em `docs/governance/REVISAO_SECURITY_QUALITY_2026-10-24.md`. Os alertas residuais
  do inventário continuam rastreados, sem dispensas ou encerramento de SQ-4.
- Administração tem consulta própria de fontes: não dar permissões de prontuário
  ao Client. Proveniência interna nunca é capability de cópia entre pacientes.
- Nenhuma migration externa, merge, deploy ou ativação autorizados por esta fase.
  FOOD04-C01/C02/C03 permanecem propostas complementares, FOOD05 não antecipada.

Os checkpoints abaixo são históricos e não substituem o estado ativo acima.

---

# Handoff atual — FOOD02: T01–T08 implementados; Draft PR #425 e CI em andamento

- Branch `feat/pos320-food02-planejamento`, base `95e9f33d` (merge424).
  Worktree isolada `.worktrees/pos320-food01-planejamento` reutilizada.
  Checkout principal com `next-env.d.ts` preexistente preservado.
- Desenvolvimento autorizado em “Pode seguir, sol médio” e retomado em Luna alto.
  D01–D03 fechadas; T01–T05 backend e T06–T07 Web/BFF implementados/testados
  localmente. Nenhuma dependência adicionada; checkout principal preservado.
- [Plano](plan-pos-320-food02.md), [checklist](todo-pos-320-food02.md),
  [ledger](execucao-pos-320-food02.md) e [handoff Luna](handoff-pos-320-food02-luna.md).
  Este último define contratos reais, exemplos sintéticos e limites da UI.
- Biblioteca cifrada/índice HMAC, origem custom separada de catálogo, CAS e
  idempotência, snapshots por intenção e medidas FOOD01 com pai XOR.
  Nova migration1076, sem editar1075, ensaiada somente em PG descartável.
- PASS backend:494 focados,3174 integrais/133 SKIPPED condicionais,34 PG/29
  filtrados, typecheck/build/artefato. Secrets/diff/matriz40 PASS; PG local omite
  Timescale/pgvector. Evidência no ledger.
- T06/T07: cadastro pessoal/clínica, busca paginada, CRUD com revisão esperada,
  aplicação explícita e cópia da base/composição na edição; rotas em
  `MAPA_ROTAS_PERMISSOES.md`. BFF52/52, helpers67/67, typecheck, origem BFF9/9,
  autorização de rotas30/30 e Playwright FOOD02/regressões desktop/mobile;
  evidências em `docs/governance/EVIDENCIAS_FOOD02_WEB_2026-10-17.md`.
- R4 independente examinou UI/BFF e achou três riscos Important; cada um foi
  reproduzido em teste RED e corrigido. Os três novos testes passaram em desktop
  e mobile, e a regressão PA07 desktop passou19/19. Typecheck PASS. R4 detalhada
  em `docs/governance/REVISAO_R4_FOOD02_2026-10-18.md`.
- `pnpm test:authz` (27 scripts), lint focal, Web build e typecheck passaram.
  Draft PR #425 está aberta; CI/scanners do HEAD `778b7906` estavam QUEUED na
  última consulta. Não inferir confirmação independente do patch, migration
  externa, merge, deploy ou ativação.
- Sem nova dependência ou pesquisa externa; referências FOOD02 já triadas.
  A única PR de FOOD02 é #425; sem merge/deploy/migration externa.

---

# Handoff anterior — FOOD01: integrada pela PR #424

Branch/worktree `feat/pos320-food01-planejamento`, base `d36b12e7`.
D01–D03 confirmadas; desenvolvimento autorizado em “Pode seguir”. T02–T06
backend/interface implementados com testes sintéticos. Migration1075 ensaiada somente em banco
PostgreSQL15 descartável, com28 PASS/29 filtrados; sem operação externa.

- Contratos, mapa cifrado/schema1 e projeção mínima para reabrir a medida
  histórica fechados. Backend continua autoritativo. Preservar PA02–PA07.
- Gates finais backend:407 focados,343 suítes/3086 testes integrais PASS
  (6 suítes/127 testes SKIPPED), typecheck/build/artefato PASS, governança24 PASS,
  secrets/diff e matriz40 referências PASS. PostgreSQL28 PASS/29 filtrados.
  UI FOOD01/PA07 desktop/mobile32 PASS na integração; backend407 e PostgreSQL28
  reconferidos. CI de extensões e revisão independente continuam separados.
- Plano/checklist [FOOD01](plan-pos-320-food01.md)/[T00–T08](todo-pos-320-food01.md).
  Evidências [backend](../docs/governance/EVIDENCIAS_FOOD01_BACKEND_2026-10-17.md).
- PR única Draft #424 aberta; HEAD de implementação `fd5299d1`. Backend, Web,
  governança e scanners passaram no run39028272706; Demo ainda em execução
  na conferência. A atualização documental de rollback exige CI do HEAD final.
  Próxima ação: acompanhar os checks da PR #424 e corrigir falhas, se houver.
  [Handoff de integração](handoff-pos-320-food01-sol.md); nenhuma troca de modelo
  pendente. Corrigida perda do cadastro da biblioteca no autosave, com RED/GREEN.
  Não atribuir revisão independente à revisão própria.
- Node22 em `/workspace/.toolchains/food01/node-v22.21.1-linux-x64/bin/node`.
  Lockfiles intactos, backend node_modules reutilizado. Não limpar trabalho de
  outras worktrees nem alterar next-env preexistente do checkout principal.
- R017 já examinado/pinado; sem copiar GPL, dependência nova ou outra pesquisa.
  Sem merge, deploy ou migration externa. A1075 deverá preceder o código novo
  e exigir verificação operacional da role/grants em alvo autorizado.

---

## Handoff anterior — PA07 (histórico, merge confirmado acima)

# Handoff atual — PA07: integração final Sol e PR única

Branch `feat/pos320-pa07-planejamento`, worktree isolada da base `62a50104`.
D01 confirmada e implementação autorizada em “Siga”. Núcleo/adaptadores/hook,
T04 de interface Luna e correções finais de integração Sol implementados.

**Próxima ação exata:** abrir/acompanhar a PR única da branch e seus gates do
HEAD; regressões locais finalizadas com retestes PASS. Sol6.1 médio;
nenhuma troca manual pendente. Não disponibilizar antes dos gates finais.

- Correções RED/GREEN: recarga em consulta, retomada sem rascunho e callback de
  cópia da geração anterior. Duas abas reais 16/16 PASS, backend 343/343 e
  PostgreSQL15 descartável 24 PASS/29 filtrados. Detalhes/comandos/limites em
  [relatório PA07](../docs/governance/RELATORIO_PA07_2026-10-16.md).
- Pendente: revisão cruzada e CI do HEAD. A revisão própria
  desta execução não é independente; nenhum gate herdado da PA06.
- Sem backend/schema/dependência nova, merge/deploy ou acesso externo.
  Node_modules reutilizado por symlink. Encerrar servidor de teste ao concluir.
  Não tocar checkout principal/next-env do usuário; limpar somente caches PA07.
- Plano/checklist [PA07](plan-pos-320-pa07.md)/[T00–T07](todo-pos-320-pa07.md).
  Preservar PA06 D01–D13, CAS/autorização e estado local em memória.

---

## Handoff anterior — histórico PA06, superado pelo fechamento acima

# Handoff atual — PA06 cálculo combinado: PR #422, correções R4 revisadas

## Branch, autorização e estado

- Worktree `/workspace/octaclin/.worktrees/pos320-pa06-calculo`, branch
  `feat/pos320-pa06-calculo`, base `011ea87d`. Planejamento em `10ebf9aa`;
  desenvolvimento autorizado pelo proprietário em “Pode seguir com sol médio”.
- T08c/T08d implementados na mesma branch e PR Draft
  <https://github.com/octanutri-clin/octaclin/pull/422>. O proprietário confirmou
  a troca de modelo e autorizou continuar em “Pode seguir com sol médio”.
  Runtime corrigido em `ddcea76c` e `2a4e87b0` após revisão separada da autoria.
- Sem migration nova;1072–1074 intocadas. Sem carga externa, merge ou deploy.
  Arquivos gerados pelo Next são excluídos do commit; checkout principal preservado.
- Estado deste checkpoint: BFF focado42/42; cópia8/8; edição/nutrição39/39;
  helpers de seleção3/3; `test:authz` PASS (26 recortes); Playwright desktop/
  mobile94/94 (inclui Axe do painel); lint Web sem erros/71 avisos; typecheck e
  build Web PASS; scanner local de secrets PASS. `git diff --check` PASS.
- CI de `bcf0825f` integral PASS, inclusive Testcontainers85/85 em Timescale HA,
  Web e Demo. Não confundir esse resultado com os commits de correção posteriores;
  repetir CI do HEAD corrigido na mesma PR. Banco remoto não consultado.
- R4 por outro agente, somente leitura e separado da autoria: cinco achados
  iniciais e uma borda adicional corrigidos e reexaminados. Sem bloqueadores
  concretos abertos em `2a4e87b0`. Não é revisão humana, clínica ou externa.
- Retestes das correções:343 testes backend,9 cópia,39 nutrição/edição e4
  helpers PASS; builds/typechecks backend/Web PASS. Playwright final sobre build
  de produção local34/34 desktop/mobile PASS; lint direcionado sem erros.
- Próxima etapa: enviar o HEAD à mesma PR e conferir os checks finais. Manter
  Draft até os gates finais passarem; estado operacional do CI na PR #422.
- Evidências: [checkpoint backend](../docs/governance/EVIDENCIAS_PA06_CALCULO_2026-10-16.md).
  Plano executável [T08c/T08d](plan-pos-320-pa06-calculo.md) e
  [checklist](todo-pos-320-pa06.md). Seções antigas abaixo são históricas.

## Backend fechado para implementar a interface

- `GET /pacientes/:pacienteId/planos-alimentares/:planoId/selecao-calculo`:
  `{planoId,ativoParaPaciente,ativacaoRevisao,versao:{id,numero,publicadaEm}|null,
  refeicoes:[{identidadeId,nome,ordem,ativa}]}`. Apenas publicação atual.
- `POST /pacientes/:pacienteId/planos-alimentares/calculo-combinado`:
  `{selecoes:[{planoId,versaoIdEsperada,ativacaoRevisaoEsperada,identidadesRefeicoes:[]}]}`.
  Nada de nutrientes/totais enviados pelo navegador. Máximos25/50/500/64KiB.
- Resposta: `{motorVersao:'pa06-combinado-v1',estado:'sem_selecao'|
  'sem_itens_incluidos'|'calculado',itensIncluidos,nutrientes,exclusoes,
  calculadoEm,publicacoes:[{planoId,versaoId,ativacaoRevisao}]}`.
  `nutrientes` é Record dos seis campos legados e22 micros, com
  `{codigo,unidade,estado:'completo'|'parcial'|'indisponivel',total?,
  quantidadeConhecida?,itensComValor,itensIncluidos}`. Só completo tem `total`;
  parcial tem `quantidadeConhecida`; indisponível não vira0. Exclusões:
  `{planoId,identidadeRefeicao?,motivo:'plano_desativado'|'refeicao_desativada'}`.
- Erros400/404/409/422 e autorização403; BFF deve conservar os status e limitar
  corpo antes do encaminhamento. Nenhuma resposta clínica entra em cache/log.
- Registro22/qualificadores em `octaclin-backend/src/modulos/planos-alimentares/
  dominio/micronutrientes.ts`, métodos novos no serviço/controlador existentes.
  Não duplicar motor de soma no navegador. Rótulos/unidades não são livres.
- Entrada manual irmã: `micronutrientesPor100g:Partial<Record<Codigo,number>>`.
  No documento de edição aceita `NumeroEdicao`. Vazio/ausente são opcionais;
  valor não vazio inválido deixa edição pendente, sem impedir autosave editorial.
  Snapshot novo em `composicaoSnapshot.micronutrientes`: schema1, mapeamento,
  base/porção, estados e `valorOrigem`/`por100g`/`porcao` quando conhecidos.
  Catálogo não admite override; cópias manuais preservam valores permitidos.

## Trabalho T08d entregue localmente

1. BFF GET/POST e cliente tipado usam o proxy existente, limite de corpo de
   64KiB, autorização de leitura, `private, no-store` inclusive nas respostas
   de erro e preservação de conflitos/status.
2. Editor manual, cópias, modelos e receitas conservam micronutrientes sem
   criar override em alimento de catálogo; validação de valor parcial impede
   materialização inválida e a mensagem permanece acessível.
3. O seletor mantém seleção vazia em memória do prontuário, atravessa planos e
   paginas; a instância é keyed por paciente, para limpar todo o estado ao trocar
   o paciente. Selecionar inclui refeições ativas naquele instante.
4. OFF mantém a identidade selecionada sem contribuir; ON mantém somente a
   seleção anterior. Totais e erros são vinculados à chave de contexto/versão;
   resposta tardia é descartada, debounce300ms, botão recalcula imediatamente,
   409 exige atualização explícita sem selecionar refeições novas.
5. O resumo mostra versão e data de publicação; tabela apresenta unidade,
   cobertura, parcial/indisponível e distingue ausência de zero. Portal/PDF não
   recebem a seleção nem micronutrientes fora dos contratos de snapshot.
6. Provas executadas estão em `docs/governance/EVIDENCIAS_PA06_CALCULO_2026-10-16.md`;
   a revisão separada encontrou e confirmou correções de catálogo, precisão,
   apresentação e estado obsoleto. CI do HEAD corrigido é requisito antes de
   retirar Draft.

## Ambiente e verificações

- Toolchain declarada já disponível: adicionar ao PATH
  `/tmp/octaclin-pa03-toolchain/bin` e
  `/tmp/octaclin-pa02-toolchain/node-v22.21.1-linux-x64/bin` antes dos comandos.
  Node22.21.1/pnpm11.25.0; não alterar lockfiles. Conferir espaço antes de Web/build.
- PASS:337 suítes/3016 testes backend (123 SKIPPED),23 suítes/339 testes do módulo
  no checkpoint final e97 testes focados de serviço
  com dois casos editoriais adicionais; typecheck/build backend;11 guardas;
  secrets/diff. Provas e comandos no documento de evidências.
- PASS:24 testes PostgreSQL15 reais, incluindo5 novos PA06c; TACO v1/v2
 583 registros por fonte, V1 intacta e segunda carga V2 idempotente. Harness:
  `node scripts/test-pa05-postgres-local.cjs --inventario --taco-micros`.
  A fixture omite Timescale/pgvector/hypertables explicitamente. Não declarar
  gate integral PASS por ela; full Testcontainers permanece no CI.
- Falha encontrada/corrigida: JSONB reordena chaves do bloco de micros. Hash
  TACO canoniza só esse bloco novo; v1 permanece byte a byte reproduzível.
- Revisão R4 por outro agente documentada no checkpoint T09.3 das evidências;
  IBGE vitamina D permanece sem mapping por falta de equivalência comprovada.
  Testcontainers completo comprovado no CI de `bcf0825f`; correções posteriores
  ainda precisam dos checks finais da PR.

---

# Handoff anterior — PA06 terceira entrega: planejamento

## Estado e próxima ação

PR #421 mergeada em `011ea87d`, confirmada por GitHub/main remota em
2026-10-16. Planejamento na branch `feat/pos320-pa06-calculo`, worktree
`/workspace/octaclin/.worktrees/pos320-pa06-calculo`, base `011ea87d`.
O pedido desta rodada é planejar; nenhum runtime, migration, carga ou ambiente
externo foi alterado. A alteração antiga em `next-env.d.ts` no checkout principal
foi preservada. Não criar PR documental separada da terceira entrega.

**Ler antes de implementar:**

- [Plano executável da entrega](plan-pos-320-pa06-calculo.md): contratos,
  limites, tarefas T08c.1a–T08c.5/T08d.1–T08d.4, testes e checkpoints.
- [Plano principal/D01–D13](plan-pos-320-pa06.md) e
  [checklist T08c/T08d/T09/T10](todo-pos-320-pa06.md).
- [Whitelist/fontes](../docs/product/FONTES_MICRONUTRIENTES_PA06.md):22 códigos,
  unidades, hashes oficiais, dados ausentes e nova versão TACO.

## Decisões e invariantes para o sucessor

- D11: seleção vazia inicialmente; plano inclui refeições ativas, com desmarcação
  individual. Seleção só em memória do prontuário, atravessa páginas/planos e
  limpa ao trocar paciente/sessão/sair do prontuário.
- D12: OFF mantém seleção, exclui contribuição; ON reinclui o que permanecia
  selecionado. Não ligar/desligar o portal por mudar a seleção de cálculo.
- D13: preparar TACO v2 com micros, sem sobrescrever v1 ou histórico. Nenhuma
  carga externa foi autorizada neste ciclo.
- D07/D10: só snapshots da publicação atual salva, planos E refeições ativos E
  selecionados. Não usar rascunhos, histórico, metas, substituições ou consumo.
- Resultados parciais por nutriente; não converter ausência/traço/LOQ em zero,
  misturar retinol/RE/RAE, niacina/NE ou folatos distintos. Sem IDR/UL/TBCA.
- Fonte USDA/IBGE já preserva metadados originais; TACO atual não preservou os
  micros. Novo snapshot pode usar adapter validado, leitura histórica não.
- Sem schema novo previsto: JSONB/cipher existentes suportam o contrato aditivo.
 1072–1074 intocadas. Estado operacional real da1074/deploy não foi consultado;
 verificar antes de rollout, sem inferir do merge/CI.
- POST de cálculo em lote reusa RLS/escopo/locks atuais; seleção não autorizada
  falha inteira. Versão/revisão obsoleta409, sem fallback para outra publicação.
- Resultado identifica instante/revisões. Invalidar por ações locais/respostas
  obsoletas e revalidar no foco; não prometer realtime ou introduzir polling.

## Modelo e sequência

GPT-6.1 Sol médio: T08c (fontes, snapshots, cálculo, DTOs, autorização, PG/RLS).
Depois do checkpoint backend GREEN, avisar **GPT-6 Luna alto** e pausar para
troca manual antes da UI/BFF T08d. Voltar ao Sol médio com nova pausa para
integração/revisão R4/regressões/PR. Execução sequencial na mesma worktree/PR.
Autorizações anteriores de outras entregas não substituem o escopo de
planejamento solicitado nesta rodada.

## Evidência desta rodada

PASS documental: Git/merge/base; contratos/migrations registradas; leitura
restrita das referências R013/R014 e dos cabeçalhos/IDs oficiais TACO/IBGE/USDA.
Hashes e limites registrados na ficha de fontes. Três decisões de produto
confirmadas pelo proprietário. Verificações finais documentais registradas no
plano executável. Testes de runtime, PostgreSQL, migrações/cargas externas,
lint/build/Playwright e CI da terceira entrega: SKIPPED, planejamento somente.

---

# Handoff anterior — PA06 segunda entrega: ativação backend + UI/BFF

## Estado e limites

Worktree `/workspace/octaclin/.worktrees/pos320-pa06-ativacao`, branch
`feat/pos320-pa06-ativacao`, HEAD `b2ae7d8b`, base `e2cb9cdd`. PR #421 Draft
aberta para a entrega PA06; em `9d2a8f68` o smoke visual corrigido passou e os
checks obrigatórios do HEAD passaram. A PR continua Draft para revisão humana.
PR420 mergeada
em `66df9053`. O proprietário relatou migrations anteriores aplicadas em
staging/produção; nenhum banco externo foi consultado neste ciclo. A nova1074
**não foi aplicada externamente**. O trabalho local T08a+T08b está concluído
para revisão. T08c/T08d (agregação/micronutrientes) seguem como entrega posterior.
Não executar merge/deploy/migrations externas. Evidências e comandos:
`docs/governance/EVIDENCIAS_PA06_ATIVACAO_2026-10-16.md`.

## Contrato backend entregue

- Migration1074 aditiva: flags/revisão no plano, raízes lógicas de refeições,
  vínculos físicos por versão e eventos append-only. FORCE RLS e escopo composto.
  Não reescreve publicada/filhos/hash. Backfill com contexto local por tenant;
  somente publicação mais recente inequívoca ativa. Empate mais recente: todas
  OFF, sem escolha UUID arbitrária. Down recusa perder estados/histórico.
- Primeira publicação ativa plano indefinido, incrementa revisão operacional e
  evento na mesma transação. OFF explícito anterior à publicação é preservado.
  Legacy writer sem identidade é recusado depois de revisão operacional positiva.
- Toggle sob locks paciente→plano→versão/raiz; tenant/carteira/papel/permissão
  revalidados. No-op não gera revisão/evento; primeira decisão OFF gera ambos.
  Revisão obsoleta409, inclusive capturada antes da primeira publicação.
- Identidade resiste a autosave/reorder/remoção/reinserção/clone dentro do plano.
  Raízes também existem para documento parcial. Mapa chave→UUID cifrado preserva
  tombstones internos, com limite4096/1MiB validado ANTES de persistir.
  Cópia para outro plano recebe raiz independente; não inferir pelo nome/posição.
- Plano OFF prevalece; ON não altera flags individuais. Draft protegido removido
  não autoriza toggle por linha física antiga. Só chave atual do documento ou
  refeição da publicação atual autoriza; histórico sozinho não autoriza operação.
- Portal/ações usam locks compartilhados do paciente, publicação atual e flags.
  Impressão paciente bloqueia plano OFF/publicação antiga e filtra refeições OFF.
  GET histórico profissional conserva conteúdo/hash. Nenhum PDF baixado é apagado.
- `totais`/resumos de versões salvas são históricos. `resumoRefeicoesAtivas` é a
  projeção atual por versão; `resumoNutricionalVigente` do plano aplica também
  plano OFF e somente current. Soma snapshots dos alimentos previstos, sem
  alternativas/consumo/catálogo novo. Lacuna por campo não vira zero.

## APIs para T08b

Profissional, prefixo `/pacientes/:pacienteId/planos-alimentares`:

- PUT `/:planoId/ativacao`
- PUT `/:planoId/refeicoes/:identidadeId/ativacao`

Corpo de ambos: `{ativo:boolean, ativacaoRevisaoEsperada:number}`. A revisão é
**compartilhada pelo plano e suas refeições**, separada de rascunhoRevisao e
apresentacaoRevisao. Requer planos_alimentares.gerenciar. Booleano literal;
revisão0..2147483646. Tenant/usuário vêm da sessão, nunca do corpo.
ACK `{planoId,ativoParaPaciente,ativacaoRevisao}`; refeição acrescenta
`{identidadeRefeicaoId,ativa}`. Sem confirmação extra/republicação para ON/OFF.
Plano sem publicação não pode ser ligado; pode receber OFF explícito antes dela.

GET detalhe/lista profissional inclui ativoParaPaciente/ativacaoRevisao.
Versão/save ACK inclui a mesma revisão/flag operacional. Nunca mesclar ACK de
revisão operacional anterior à já confirmada no cliente. Metadados da versão:

- `ativacaoRefeicoes:[{refeicaoId,identidadeId,ativa}]`: linhas materializadas.
- `ativacaoEdicao:[{chaveCliente,identidadeId,ativa}]`: só draft, somente chaves
  presentes no documento atual; permite operar também edição parcial salva.
- Linhas recém-digitadas sem ACK ainda não têm identidade: switch indisponível
  até salvar, sem inventar UUID nem atribuir pelo índice. Legado sem documento
  permite correspondência EXATA chave física→refeicaoId da própria versão;
  fora disso, salvar primeiro. Não expor tombstones/coluna cifrada ao cliente.

Paciente, já guardado por sessão Patient, sempre private/no-store:

- GET `/portal/paciente/planos-alimentares?pagina=1&limite=10`, limite máximo20,
  página máxima1000000. `{itens:[{id,titulo,numeroVersao,publicadoEm}],total,pagina,limite}`.
- GET `/portal/paciente/planos-alimentares/:planoId`: detalhe mínimo, refeições
  ativas e resumoNutricionalVigente. IDs OFF/arquivados/outro paciente404.
- Bootstrap singular antigo continua compatível; UI nova deve usar plural.
  Detalhe solicitado nunca cai em outra publicação/plano. Escolha existente
  revalida plano/refeição ativos mesmo com itemId conhecido.

## Implementação UI/BFF concluída localmente

1. Ler AGENTS da Web. Estender tipos/API em `lib/plano-alimentar-api.ts` e BFF
   sob `app/api/pacientes/[id]/planos-alimentares/[planoId]` + portal plural,
   reutilizando proxies/session/allowlist. Atualizar mapa de rotas e testes BFF.
   Preservar409/401/403/404 e no-store; não serializar entidade ORM.
2. Switch do plano no console e de refeições atuais em
   `components/pacientes/plano-alimentar-profissional.tsx` / `refeicao-ordenavel.tsx`.
   Usar identidade lógica, alvo explícito e revisão do plano; um toggle em voo
   por plano (desabilitar controles enquanto aguarda ACK é suficiente).
   Sem atualização otimista, retry silencioso ou dirty/save clínico só por toggle.
3. ACK de autosave não substitui texto/linhas/foco nem estados operacionais mais
   novos. Associar metadados só por chave atual; refeição removida não reaparece.
   Em409 reconciliar flags/revisão sem descartar documento local. Rede incerta
   deve mostrar estado não confirmado e permitir consultar backend; não afirmar
   que mudou nem desfazer commit hipotético. Sem localStorage/IndexedDB clínico.
4. Exibir distinção salvo/parcial/publicado/visível. Flags de uma versão histórica
   são operacionais atuais, não reconstituição do passado; não oferecer toggle
   em visualização histórica. Totais de planejamento atual usam projeção vigente,
   sem confundir metas e snapshots históricos. Plano OFF não muda flags das refeições.
5. `components/portal/plano-alimentar-paciente.tsx` / `app/portal/plano/page.tsx`:
   listar/paginar todos ativos, abrir detalhe autorizado e tratar retirada/404.
   Preservar preferências PA05, alternativas liberadas, macros como metas versus
   total previsto vigente, impressão filtrada e acesso por teclado/mobile.
6. Testes BFF/estado/Playwright (desktop/mobile/Axe): dois planos ativos, refeição
   OFF, plano OFF/ON preservando refeição OFF, nova versão em edição, parcial
   salvo com switch, dirty durante ACK, conflito/rede incerta, reload/retirada,
   paginação e IDs conhecidos negados. Regressões PA02/PA03/PA04/PA05/PA06.
7. Integrar nesta mesma branch/PR de ativação; não abrir PR documental separada.
   Antes de R4 final/CI, avisar se precisar voltar a Sol médio, conforme preferência
   do proprietário. Não reutilizar CI420 como evidência da segunda entrega.

Referências de UI: somente R013/R014 já fixadas no plano, sem nova dependência
ou nova auditoria de todos os repositórios. Backend não incorpora código externo.

## Gates da segunda entrega — estado local

- PASS: backfill owner NOBYPASSRLS e19 casos reais PA04–PA06/inventário;
  29 casos fora do filtro SKIPPED. Timescale/pgvector integrais continuam CI.
- PASS: revisão cruzada automatizada da autoria separada, achados corrigidos e
  reinspecionados. Não é revisão humana externa nem avaliação da UI.
- PASS: Jest integral332 suítes/2938 testes;6 suítes/118 testes SKIPPED.
  Typecheck/build e artefato dist/main.js; PostgreSQL19 PASS/29 fora do filtro.
  Secrets/diff locais PASS; commit de checkpoint registrado no Git ao final.
  Gates de governança proporcionais conferidos nesta rodada (ver evidências).
- PASS: BFF37/37; Playwright PA06 6/6 desktop+mobile; PA02 24/24 por projeto;
  PA05 desktop4/4 e mobile4/4 (ver registro de evidências).
- PASS: typecheck/build Web e lint direcionado sem erros; warnings estão listados
  no registro, inclusive dois warnings de hooks do componente de portal.
- PASS: revisão R4 independente confirmou fechamento dos dois achados e não
  encontrou riscos novos; uma leitura separada confirmou o delta de contexto do
  portal. RED/GREEN e testes dirigidos estão no ledger.
- PASS: `pnpm test:authz` integral (26 recortes concluídos, exit 0).
- PENDENTE: CI/governança do HEAD. A fixture PostgreSQL local cobre PA04–PA06,
  mas Timescale/pgvector integrais ficam para CI.
- NÃO EXECUTADO: qualquer operação externa, merge ou deploy.

---
## Checkpoint anterior preservado — primeira entrega

# Handoff atual — PA06: primeira entrega local validada, PR Draft/CI

## Estado do trabalho

Worktree `/workspace/octaclin/.worktrees/pos320-pa06-planejamento`, branch
`feat/pos320-pa06-autosave`, base `eae74b1e` (#419). T01–T06 backend/núcleo e
T07–T08 interface agora implementados localmente. A UI integra CAS e coordenador
de 60 s, preserva a edição local durante ACK, usa a materialização canônica para
totais após salvar, distingue conflito/incerteza/acesso negado e oferece
“Salvar e sair” sem flush no cleanup. Sem dependência nova, migration externa,
merge, deploy ou ativação. O escopo on/off/múltiplos planos/micronutrientes segue
nas entregas posteriores.

Plano: `tasks/plan-pos-320-pa06.md`; checklist: `tasks/todo-pos-320-pa06.md`.
Evidências: `docs/governance/EVIDENCIAS_PA06_NUCLEO_2026-10-15.md`.

## Implementação T01–T08

- Migration1073 aditiva na versão existente: contador geral, adesão protegida,
  snapshot editorial cifrado e revisão materializada.1072 não alterada. Down recusa
  apagar dados; rollback deve preservar backend compatível com proteção CAS.
- PUT `/pacientes/:id/planos-alimentares/:planoId/rascunho/edicao` com
  `{rascunhoIdEsperado, rascunhoRevisaoEsperada, documento}`. Geração/revisão
  obrigatórias; documento estruturalmente válido pode ter campos clínicos pendentes.
  Cap96KiB no documento; HTTP100KiB já existente. DTOs explícitos, sem PHI em log.
- Toda escrita/revisão/publicação avança contador geral; após adesão, clientes
  antigos sem CAS recebem409. Revisão PA05 de preferências preserva semântica própria.
- Retorno profissional de rascunho: `rascunhoRevisao`, `edicaoEstado` e
  `documentoEdicao`; quatro estados: legado,pendente,materializada,indisponivel.
  Pendência/ilegibilidade suprime materialização antiga e bloqueia revisão/publicação/
  prévia; publicada depende somente da materialização imutável, sem documento cru.
- Observações vazias gravam NULL real. GET de detalhe/rascunho/versão protege
  composição dos filhos com locks compartilhados de escopo; writers usam exclusivos.
- `lib/coordenador-edicao-plano.ts`:60s fixos, um request, última solicitação
  pendente; ACK confirma somente assinatura enviada sem substituir documento local.
  Manual e timer usam mesma fila. Off/IME/cópia suspendem; erros pausam sem retry.
  Cleanup encerra timer/aborta fetch, sem prometer desfazer commit no servidor.
- BFF de edição e API cliente prontos; revisão/publicação encaminham CAS.
  `lib/edicao-plano.ts` contém o contrato editorial de transporte, sem import do
  backend/Buffer no cliente.
- UI implementada no editor profissional e no guard de saída do prontuário. O
  último ACK confirmado é mostrado; totais usam a materialização retornada pelo
  servidor e não sobrescrevem valores/foco/caret/IME. Conflito/resultado incerto
  mantém a tela e exige reconciliação explícita. Nenhuma alteração de portal.

## Próxima ação e modelo — integração Sol autorizada

Troca manual para GPT-6.1 Sol médio já realizada. Integração em andamento:
revisão cruzada estática da UI, correções RED/GREEN, regressões, builds/gates e
preparação da PR Draft. Não solicitar novamente troca nem inferir CI verde.
Percentuais têm texto editorial cru opcional, cifrado no documento v1 e separado
da conversão para basis points; documentos anteriores continuam compatíveis.
Sem arredondamento para tornar prescrição inválida válida.

### T07/T08 — contrato de implementação executado por Luna

1. Ler Web AGENTS e guia Next instalado antes de editar. Reutilizar editor atual,
   sessão/BFF, chaves de PA02, subtotal/colapso PA03, lista PA04 e preferências PA05.
   Não implementar botões de ativação, soma combinada ou micros nesta PR.
2. Usar documentoEdicao como fonte do formulário ao reabrir se legível; mapear
   legado pelo formulário existente e gerar chaves uma única vez, sem zerar vazio.
   Guardar documento inteiro, inclusive linhas pendentes. Estado indisponivel exige
   erro/reconferência explícita, nunca restauração silenciosa de dados antigos.
3. Instanciar coordenador por contexto paciente/plano/geração; iniciar/cleanup em
   efeito com dependências estáveis. Atualizar documento por alterar(), sem recriar
   timer a cada tecla/ACK. Usar refs para envio/notificação atuais. StrictMode não
   pode duplicar timer ou causar save no cleanup. Sem localStorage/sessionStorage/
   IndexedDB/CacheStorage, logging do documento ou fetch em render.
4. Autosave default ON; cada tick60s checa dirty, não debounce; nenhum envio só por
   abrir, foco, blur, reconexão ou desmontagem. Exibir estados e último ACK de modo
   acessível. Dados pendentes salvos não significam cálculo/revisão/publicação aptos.
5. Manual deve chamar salvarManual() da mesma fila. Transport envia snapshot/CAS
   via salvarEdicaoPlanoAlimentar; devolve ao coordenador id+rascunhoRevisao do ACK.
   Não chamar caminho clínico antigo sem CAS nem resetar formulário com resposta A
   quando houve edição B. Não perder chaves, foco, seleção/caret ou composição IME.
   Pré-validar formato/cap96KiB, sem exigir metas/avaliação clínica para guardar.
6. Revisar/publicar: coordenar fila e bloquear edição durante transição explícita;
   usar CAS atual após ACK. Revisão incrementa contador: rebaselinar de forma
   explícita após sucesso, sem recriar ciclo em cada autosave; publicar encerra
   contexto do rascunho.409/resultado incerto exige reconferência, não retry/overwrite
   por simples avanço do baseline. Preservar edição local enquanto resolve erro.
7. Bloquear envios durante cópia/IME com configurar({suspenso:true}); liberação
   não faz flush imediato. Off cancela pedidos não iniciados, não desfaz request.
8. Saída interna dirty: salvar e sair / continuar / descartar com confirmação;
   falha ou conflito não permite sair como salvo. Fechar/refresh usa beforeunload
   nativo, sem prometer save. Guardar contexto até decisão; ignorar ACK após troca.
9. Ajustar fixtures sintéticas de api-demo-local e Playwright para novo contrato;
   não mexer no runtime backend além de defeito demonstrado. Cobrir59999/60000,
   dirty sem primeiro save, save A+edição B, manual simultâneo, off, cópia/IME,
   400/401/403/404/409/422/5xx/rede, troca de plano/paciente e saída. Desktop/mobile,
   teclado/aria-live, regressões PA02–PA05 e nenhuma mudança implícita no portal.
10. Não abrir outra PR. Manter mesma branch, atualizar evidências/checklist reais;
    finalização Sol inclui testes integrais, revisão R4 e CI do HEAD.

## Verificações locais e pendências

As contagens e os comandos realmente executados ficam no relatório de evidências.
Núcleo focado GREEN; PostgreSQL15 real com RLS/barreiras GREEN. Fixture alternativa
omite Timescale/pgvector e não substitui gate integral de CI. Núcleo: backend
238/238, PG12/12, BFF29/29, coordenador/nutrição33/33; backend/Web typecheck,
backend build e lint alvo sem erros. UI: proteção de saída4/4; Playwright focado
de saída/autosave2/2, PA02/PA03 cinco cenários em desktop/mobile10/10 e PA05
conflito/preferences2/2; Web typecheck PASS. ESLint encerra sem erro, com12 avisos
de hooks preexistentes nos componentes alterados. Um timeout inicial por servidor
Next local antigo foi corrigido reiniciando o servidor; uma divergência do subtotal
local versus ACK foi corrigida para usar o snapshot canônico e passou em desktop/
mobile. Web build, suíte visual/regressão integral, `test:authz` integral, revisão
R4 integrada e CI ainda pendentes. Não inferir estado de staging/produção ou
aplicação1072/1073 por merge.

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


## Fechamento da integração Sol

Commit de UI e correções `c7071d2d`; código local validado sem achados R4 estáticos
abertos. Web/backend builds e typecheck PASS; backend integral329 suítes/2907 testes
PASS (6 suítes/113 testes SKIPPED), DTO final22/22, PostgreSQL focado12 PASS/31
SKIPPED, BFF29/29, nutrição/coordenador38/38, saída4/4 e cópia7/7. Playwright final
82/82 em desktop/mobile no build de produção local. Governança/secrets PASS.

Próxima ação: publicar/acompanhar uma PR Draft da branch atual e os checks do HEAD.
Authz integral local em execução no checkpoint, sem PASS presumido. Banco integral
com extensões, Demo e scanners continuam gates do CI. Não marcar T09/T10 completos
antes do resultado final; não iniciar ativação/agregação dentro desta PR.
Detalhes/comandos/R4/limites nas evidências. Sem merge/deploy/migration externa.
