# FOOD06 M04 — primeira integração do editor

## Checkpoint

PR455 Draft. Base remota a657e696/local54030c56 com árvore idêntica; commits
irmãos preservados após publicação por conector. CI41312592535 da base terminou
Backend/Web/Mobile/Demo/PRGate PASS; scanners e pesquisa PASS. Prova PG dedicada
138PASS/0SKIPPED, incluindo cinco cenários M04. Não inferir o resultado do delta.

R4: cliente de dados clínicos, modal e editor. Sem backend/migration/dependência,
provider, produção ou comparação DRI. Direitos/G06 BLOCKED.29,2% administrativos,
0/12 melhorias completas. M04 continua parcial: receitas/preparo e integrações
adicionais não foram retirados do escopo.

## Implementado

Ação por alimento no rascunho salvo/materializado; origem/refeição/revisão/porção
atual, proposta explícita emg ou catálogo autorizado com preparo/fonte. Prévia
não grava. Parser por allowlist reutiliza cobertura e verifica identidades,
revisões, deltas e percentuais, sem novo motor. Ausente não vira zero; percentuais
referem-se ao próprio estado anterior, não adequação. Composição parcial e
limitações permanecem explícitas. Campo editado invalida a confirmação anterior.

Confirmação por API existente, ACK da próxima revisão materializada, releitura
segura e manutenção da refeição expandida. Publicação separada. Autosave60s sobre
nova revisão; sem retry cego. Erros internos não são projetados. Modal compartilhado
com teclado/foco/Escape; consulta cancelada descarta resposta tardia. Comando já
confirmado pertence ao pai: desmontar modal não implica rollback/transporte abortado.

## TDD e provas

- Parser: RED2 funcionais contra stubs; GREEN45. HTTP adicional levou a47PASS.
  Testes HTTP adicionais foram escritos após o primeiro cliente, não são RED próprio.
- Browser: RED ação ausente; primeiros6 cenários desktop/mobile PASS.
- PA07: RED real com POST em barreira mostrou transferência antes do ACK.
  Correção registra promessa no dreno existente e separa transporte da consulta.
  GREEN desktop/mobile após correção. Respostas tardias conferem paciente, plano,
  geração, coordenador e sequência antes de modificar estado.
- R4 independente food06_m04_editor_r4:47PASS próprios e duas provas transitórias
  RED/GREEN com funções/classes reais. Contexto tardio foi simulado por closures;
  não foi demonstrada exposição clínica real no navegador. Sem edição/coautoria,
  nenhum achado reproduzível restante no escopo. Não é R4 integral FOOD06.
- Catálogo: label de Operação incluía opções no nome acessível. RED2 browser;
  associação explícita corrigida, sem reduzir assert. Última matriz12 novos
  cenários M04 passou. A primeira matriz ampliada teve49PASS/1falha de artefato
  ENOENT por execuções Playwright simultâneas no mesmo output. Repetição
  sequencial concluída: **50/50 PASS**, sem skipped (12 M04 +38 regressões
  contribuições/tabela/PA06, desktop e mobile). A falha de artefato permanece
  registrada; não foi falha funcional demonstrada nem justificativa para reduzir asserts.
- Build webpack194páginas/typecheck PASS Node22.23.4. Unitários47PASS. Microcopy
  e novos arquivos ESLint PASS sem warnings. Editor central conserva8warnings
  preexistentes, conferidos comparando lint do HEAD original por stdin; não
  houve supressão nem refatoração ampla para ocultá-los.

## Pendências e continuidade

Regressão legada PA07/FOOD01–04: **62/62 PASS**, sem skipped, nos dois
projetos. As duas matrizes somam112 execuções de navegador, não112 casos
independentes de projeto. Depois: commit/push
intencional e CI do novo HEAD. CLI Git perdeu credencial; conector permanece
acessível. Não reset/rebase para reconciliar commits irmãos: preservar os dois
históricos e conferir igualdade da árvore/base antes de publicar via API.

Avaliações UX B/C independentes textuais em docs/agents/ux/reports/FOOD06-M04-BC;
sem interação visual própria das personas. Novas hipóteses não viram escopo
automaticamente. Rollback só código, envelope/backend existentes preservados.
Sem merge/deploy/migrations externas, FOOD05-MDL ou ativação clínica.

## Comandos reproduzíveis do incremento

Com Node22 no PATH, a partir de octaclin-web, dependências já disponíveis:

```sh
node scripts/test-calculo-combinado-planos.mjs
node node_modules/next/dist/bin/next build --webpack
E2E_WEB_URL=http://localhost:3100 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/food06-previa-editor.spec.mjs tests/visual/food06-tabela-factual.spec.mjs tests/visual/pa06-calculo-combinado.spec.mjs --project=desktop-chromium --project=mobile-chromium
E2E_WEB_URL=http://localhost:3100 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/pa07-coordenacao-abas.spec.mjs --project=desktop-chromium --project=mobile-chromium
```

Usar servidor local da build conferida. As duas execuções Playwright são
sequenciais porque compartilham outputDir. No executor, a .next temporária
exigiu NODE_PATH apontando ao node_modules da Web; não houve alteração de
dependências, permissões, configuração versionada ou requisito de engines.
Logs locais: /tmp/food06-m04-ui-regressao-sequencial.log,
/tmp/food06-m04-pa07-final.log, /tmp/food06-m04-ui-unit-final.log e
/tmp/food06-m04-ui-build3.log. Logs em /tmp são transitórios; testes e resultados
resumidos ficam versionados. Nenhum CI do novo delta foi presumido.
