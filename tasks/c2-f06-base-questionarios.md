# C2-F06 — estabilização da base de questionários

## Escopo e origem

Branch `fix/c2-f06-base-questionarios`, base `b2ed05b2913ae041c71553ca6a41376bbb91aea9` (`feat/qst10-09-recorrencias`). Correção exclusiva de testes da cadeia #592 antes da busca histórica F06. Sem código funcional, dependências, workflows, migration externa ou integração à main. A auditoria própria `612dd9e3` foi preservada nesta branch pelo commit `9e90c597`.

Logs oficiais consultados: run `45614173895`, jobs `139206173376` (Backend) e `139213719633` (Demo). A falha agregada do PR Gate não é um terceiro defeito funcional.

## Diagnóstico e RED/GREEN

| Caso | RED funcional | Correção mínima | GREEN |
| --- | --- | --- | --- |
| Dois workers simultâneos | 1 falha, 23 aprovações: fixture de 24/11 esperava próximo disparo em 25/11, mas o serviço usa também `Date.now()` e a execução posterior avançava a data. | Fixar somente `Date.now()` no teste concorrente. O prazo da barreira usa `performance.now()`, preservando timeout real. `restoreAllMocks` já existente remove o spy. Sem alteração no serviço. | 24/24 na suíte e novamente na regressão conjunta. |
| Categorias QPRO-09 | 4 falhas desktop antes da correção: fixture não interceptava `/respostas/pagina`; não aparecia a primeira categoria. Os logs oficiais registraram os mesmos oito cenários desktop/mobile. | A fixture passa a cobrir paginação e endpoint anterior, inclui envelope paginado e deriva paciente/questionário da requisição. Asserções existentes preservadas. | 8/8 desktop/mobile na versão final do patch. |

Uma tentativa PostgreSQL anterior falhou no setup por disco cheio; outra execução direcionada dos workers excedeu o prazo. Nenhuma delas é o RED funcional acima. A recuperação removeu somente caches `.next` gerados de worktrees com servidores encerrados, preservando fontes e dependências.

## Provas reproduzíveis — Node 22.21.1

No backend:

```sh
QST_P05_POSTGRES=true RLS_TESTCONTAINERS=true node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/modulos/questionarios/aplicacao/copia-pergunta.integracao.spec.ts src/modulos/questionarios/aplicacao/controle-agendamentos.integracao.spec.ts
```

**PASS 87/87**, zero skipped. PostgreSQL 15-alpine descartável, dados sintéticos e role runtime/FORCE RLS conforme as fixtures. Inclui cópia, paginação/comparação e comandos/recorrências existentes. Não é prova de schema produtivo nem da futura busca.

No Web, com servidor local Node 22 em `localhost:3337`:

```sh
E2E_WEB_URL=http://localhost:3337 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/questionarios-respostas.spec.mjs --grep 'QPRO-09' --reporter=list
```

**PASS 8/8**, quatro cenários em cada projeto desktop/mobile. Sem aumentar timeouts, reduzir asserts ou mudar configuração de segurança.

Prova anterior reutilizável desta mesma base: **66/66** em `consulta-respostas.spec.ts`, `comparacao-retornos.spec.ts`, `controlador-respostas-paginadas.http.spec.ts`; nenhum arquivo funcional dessas suítes foi alterado nesta branch.

## Gates e limites

- PASS: typecheck backend, scanner local de segredos e `git diff --check`.
- PASS: typecheck Web e build backend com validação de `dist/main.js`. O typecheck Web usou os tipos gerados pelo servidor de teste; depois de encerrá-lo, as referências geradas de `next-env.d.ts` foram restauradas ao estado versionado, sem incluí-las no diff.
- SKIPPED local: build Web e smoke integral; esta alteração é de fixtures/testes, foram executados os oito cenários afetados. A confirmação global depende do CI do novo HEAD.
- N/A: revisão de produto UX B/C, pois não há nova interface ou mudança de produto. Não atribuir uma revisão R4 independente a esta inspeção própria do diff.
- CI do novo HEAD: pendente de push/execução; checks antigos não aprovam este delta.

## Handoff

Enviar a correção em PR Draft contra `feat/qst10-09-recorrencias`, mantendo a cadeia separada da main. Verificar o CI exato. Não mergear. A F06 continua no diagnóstico: decisão de alcance/semântica pendente e orçamento de busca ainda não medido. A próxima tarefa funcional é a prova de custo em PostgreSQL descartável após definir o modo de busca, reutilizando os contratos auditados.
