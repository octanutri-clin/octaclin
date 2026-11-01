# FOOD06 M04 — integração da prévia de receitas

## Estado e continuidade

PR455 Draft. Base local39257f78/remota373c1ddf, árvore idêntica, históricos
preservados. Backend do CI41355886047 PASS após registro de ReceitaNutricionalOrm
no DataSource do teste:4.041PASS/65SKIPPED na suíte completa e141/141 PASS,
zero skipped, no gate descartável de PostgreSQL/RLS, incluindo3novos casos de
receita. Web/Mobile/scanners PASS; Demo/global ainda em execução na última
consulta antes de preparar este delta. Não confundir essa evidência com novo CI.

Risco R4: cliente e confirmação clínica autorizada. Sem backend novo, migration,
dependência, alteração de fonte ou provider. DRI/direitos/G06 BLOCKED;29,2%
administrativos,0/12 melhorias encerradas. A integração factual não encerra
M04: comparação com referências e matriz global de aceite permanecem pendentes.
FOOD05-MDL/D18 não foi iniciada. Sem merge, deploy ou migrations externas.

## Fluxo implementado e contratos preservados

No modal FOOD07 de conferência de porções, rascunhos materializados oferecem a
nova ação opcional Calcular impacto no rascunho. Receita, versão, quantidade,
base, ingredientes e destino da conferência original permanecem. A nova seção
usa a API M04 sobre a revisão salva, sem reenviar ingredientes/composição pelo
browser. Fontes são conferidas no servidor, porcionamento feito uma vez.

A mesma tabela compartilhada de M04 mostra4macros/22micros, antes/depois/diferença,
cobertura e desconhecidos. Percentuais são variação sobre o próprio estado
anterior, não adequação DRI. Zero conhecido e subtotal parcial permanecem
explicitamente distintos. Não existe segundo motor na interface.

A ação legada Confirmar e inserir continua disponível antes da comparação e
após descarte explícito; durante a comparação fica bloqueada para não executar
os dois caminhos. Cancelar fecha sem gravar; descartar somente a comparação
preserva ingredientes/porções para o fluxo local existente. Rascunho pendente,
legado, sem posse ou com alterações não salvas não recebe confirmação M04.
Não remover o fluxo legado para obter testes verdes.

Confirmar impacto usa o callback pai existente, promessa no dreno PA07 e
writer/CAS/ACK/releitura atuais. Não chama aoInserir local em paralelo. Após ACK,
a biblioteca fecha a conferência e o autosave60s usa a nova revisão. A publicação
continua separada. Modal/cancelamento protegidos durante confirmação; desmontar
a consulta não aborta comando já recebido. Sem retries cegos ou promessa de
rollback após perda de transporte. Resposta tardia não reapresenta prévia após
cancelamento; erros internos não são expostos.

## TDD, testes e revisão

- RED1 funcional no cliente: corpo perdia ID/versão/porções;47PASS/1FAIL.
  União e allowlist por variante corrigidas:48/48GREEN.
- RED1 browser: ação Calcular impacto ausente na build anterior, com biblioteca
  e modal carregados. Teste de setup não foi utilizado como RED.
- Primeira bateria nova:6PASS/6FAIL. Foram corrigidas fixtures/expectativas:
  ausência total não é subtotal parcial (agora cálcio0 conhecido→parcial);
  refeição já expandida após inserção local; texto real da espera PA07.
  Nenhum timeout ampliado, assert removido ou controle de segurança enfraquecido.
- Matriz integrada sequencial:150/150PASS, sem skipped:12novos de receita,
  12M04 existentes,26FOOD07,62PA07/FOOD01–04 e38tabela/contribuições/PA06.
  Desktop e mobile; prévia sem gravação, cancelamento,409sem retry/vazamento,
  legado após descarte, ACK/autosave60s e barreira PA07 de confirmação em voo.
- Build webpack/typecheck Node22.23.4 PASS. Depois da matriz, a única alteração
  de código foi uma frase: scanner confundia verbo publica com adjetivo pública.
  Reformulada preservando o sentido, sem waiver. Build final PASS e2casos
  desktop/mobile repetidos: axe, Escape, fonte200%, ações acessíveis e rolagem
  horizontal pelo teclado no mobile. Esses2são reexecuções, não novos casos.
- Harness Web48PASS; microcopy PASS. Lint0erros, novos arquivos/biblioteca sem
  warnings; editor central mantém8warnings preexistentes, sem supressões.
- R4 independente food06_m04_editor_r4 favorável no delta funcional,48testes
  próprios/diff-check; sem browser/build/CI próprios. Revisor não editou código.
  Não é R4 integral FOOD06. Refinamento posterior foi só a frase descrita acima.
- UX B/C por duas instâncias independentes, com código e imagens sintéticas:
  [relatório, limites e backlog](../docs/agents/ux/reports/FOOD06-M04-RECEITAS-BC/consolidado.md).
  Sem usuários reais ou leitor de tela humano. Sugestões P2/P3 não viram escopo.

## Próximo passo e rollback

Conferir diff/segredos, publicar o delta intencional e validar CI do novo HEAD.
Depois harmonizar os critérios restantes M04/M03/M05/M06 e seguir as ondas
aprovadas; não declarar nenhuma melhoria inteira concluída por um subconjunto.
Rollback só código, mantendo API/envelopes e snapshots existentes. Não ativar
comparações DRI nem modificar Neon/Render/produção. Credencial CLI expirada:
publicar via Git Data API com igualdade de árvore, expected_sha e fast-forward;
sem reset, rebase ou force. SHA remoto/local e CI ficam na descrição da PR.

## Reprodução

Na Web, Node22 e dependências existentes, servidor local da build validada:

```sh
node scripts/test-calculo-combinado-planos.mjs
node node_modules/eslint/bin/eslint.js components/pacientes/previa-receita-plano.tsx components/pacientes/comparacao-previa-alimentar.tsx components/pacientes/previa-alteracao-alimentar.tsx lib/previa-micronutrientes-plano.ts components/pacientes/biblioteca-receitas-nutricionais.tsx components/pacientes/plano-alimentar-profissional.tsx
node node_modules/next/dist/bin/next build --webpack
node scripts/test-linguagem-interface.mjs
E2E_WEB_URL=http://localhost:3100 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/food06-receita-previa.spec.mjs tests/visual/food06-previa-editor.spec.mjs tests/visual/food07-metadados-receitas.spec.mjs tests/visual/pa07-coordenacao-abas.spec.mjs tests/visual/food06-tabela-factual.spec.mjs tests/visual/pa06-calculo-combinado.spec.mjs --project=desktop-chromium --project=mobile-chromium
```

Depois da frase, reexecutado o primeiro caso de receita nos2projetos com -g
'compara antes/depois'. Executar Playwright sequencialmente no mesmo outputDir.
No executor, NODE_PATH aponta ao node_modules Web devido à .next temporária;
nenhum ajuste versionado de dependências/segurança. Logs transitórios em
/tmp/food06-receita-ui-{unit-red,unit-green,browser-red,browser-green,browser-final,a11y-final,build-final,microcopy-final}.log.
