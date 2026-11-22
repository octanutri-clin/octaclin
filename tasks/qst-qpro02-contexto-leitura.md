# QPRO-02 — integridade do contexto na leitura de questionários

## Escopo e base

Autorizado pelo proprietário após o merge #571: investigar e corrigir respostas
tardias na leitura e matriz, com TDD. Branch
`fix/qst-leitura-contexto-tardio`, base `0023c12a08f7108eb0272090b8476018b681a1b6`.
Uma worktree própria; alterações alheias, main local e FOOD06 preservadas.
Nenhuma mudança em API, BFF, backend, RLS, permissões, CSV ou persistência.
Código validado: `fd25c4afeae841ad2d81d6dfecebdf2aef9f9ea2`.

Risco R4 por integridade de leitura clínica; escopo mínimo no estado de UI.
Rollback de código não exige migration: o incremento não grava conteúdo.
Não é nova proteção de autorização no backend; ela permanece obrigatória.

## Diagnóstico e RED

O workspace não invalidava leituras anteriores ao trocar filtros. Três cenários
sintéticos foram reproduzidos contra a base, no Next e Chromium reais com BFF
interceptado: não houve banco, sessão real ou paciente real.

1. Paciente A pendente → B concluído → chega A: texto de B desaparece e A o substitui.
2. A pendente → B concluído → erro de A: alerta antigo aparece sobre consulta atual.
3. Matriz A pendente → selecionar B → chega A: indicador exclusivo de A aparece sob filtro B.

RED inicial: 3 falhas. O teste de erro inicialmente incluía o anunciador vazio
do Next no contador de alertas (2 recebidos). Após inspeção, o seletor foi
delimitado a alertas com conteúdo; executado novamente na base, falhou por erro
real antigo (esperado 0, recebido 1). Não reduzir timeout ou severidade para passar.
A implementação corrigida foi preservada em arquivo temporário próprio e
restaurada após essa reprodução; nenhuma alteração de terceiro foi descartada.

## Correção mínima e contratos

`octaclin-web/components/questionarios/usar-workspace-questionarios.ts`:

- Sequências independentes para leitura de respostas e matriz, incrementadas a cada consulta.
- Invalidar e limpar leitura incompatível na troca de paciente/questionário; só após confirmação quando houver edições pendentes.
- Invalidar matriz ao mudar paciente, questionário, categoria, início ou fim; exigir nova consulta explícita, sem disparar chamadas automáticas.
- Somente a sequência vigente pode projetar resultado, registrar erro ou encerrar carregamento.
- Mudanças A→B→A não reabilitam a requisição antiga. Erros/finally antigos também são descartados.
- Sem cache clínico novo, persistência, novos campos/entidades ou alteração de cálculos.

`octaclin-web/tests/visual/questionarios-respostas.spec.mjs`: rede ordenada com
promessas controladas; componentes/workspace reais. Captura e resultados de
rede não são prova de banco ou autenticação. Quantidades/dados são sintéticos.

## Validação e revisão

- PASS: 54/54 testes de respostas (20 novos +34 existentes) desktop/mobile.
- PASS: 56/56 testes de editor/P05 e casos adicionais (50 regressões +6 novos) desktop/mobile.
- Total: 110 cenários distintos aprovados, dos quais26 novos. Navegação, leitura individual, busca, texto ampliado, axe/teclado e duplicação integram as regressões.
- Os adicionais comprovam troca de questionário com origem pendente, erro/finally tardios da matriz e loading da consulta nova. A fixture da troca foi ajustada para manter o mesmo paciente entre questionários e reexecutada2/2 PASS; não somar essa repetição como novos cenários.
- PASS: Node22.21.1, typecheck, lint dirigido final, build Next webpack com TypeScript integrado, scanner de segredos, hashes do manifesto e diff --check. Build mantém avisos da dependência local sobre middleware obsoleto/Edge; não foram suprimidos nem corrigidos fora do escopo.
- R4 independente estática `/root/qst_contexto_r4`: sem autoria e sem execução própria; nenhum bloqueador identificado. Não equivale a CI, SQL ou produção.
- A→B→A da matriz e reset para questionário nulo não têm prova dedicada nova; a invalidação correspondente foi inspecionada. Não atribuir execução a esses cenários. A→B→A das respostas e mudança de questionário possuem prova de navegador.
- Limitação preexistente observada pelo revisor: erro já exibido antes de trocar filtro pode continuar no alerta compartilhado após uma consulta válida. Não confundir com erro que chega tarde, corrigido aqui; avaliar separadamente a propriedade/limpeza dos erros do workspace.
- PostgreSQL/RLS e autorização ponta a ponta: NOT RUN nesta rodada, fronteiras de leitura e persistência não alteradas. Não atribuir PASS por mock.
- Leitor de tela manual e dispositivo físico: NOT RUN. Emulação/axe/teclado têm escopo próprio.
- Dependências locais reutilizadas sem instalação: Next16.3.8, diferente da versão16.4.5 do manifesto atual. CI com instalação congelada ainda é gate obrigatório; não alterar engines/lockfile para acomodar o ambiente.
- UX B/C do nutricionista favorável no escopo relatado; paciente N/A justificado (console somente). [Relatório e limitações](../docs/agents/ux/reports/QPRO-02-BC-2026-11-22/consolidado.md).
- CI do novo delta: PENDING após envio intencional único para PR Draft; conferir HEAD exato no GitHub. Não reutilizar checks da #571 como validação deste patch. Sem merge/deploy/migrations externas.

## Integração anterior

GitHub confirma #571 merged. No run de main `45020693667`, Backend/Web/Mobile/
governança passaram no checkpoint consultado; Demo local smoke ainda executando.
CodeQL, Semgrep e Trivy do merge concluíram success. Isso não comprova este patch
nem disponibilidade produtiva. Não confundir merge com rollout concluído.

## Reprodução das verificações

No pacote Web, Node22 e servidor local sintético compatível com o projeto:

```sh
E2E_WEB_URL=http://localhost:3033 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/questionarios-respostas.spec.mjs --reporter=list
E2E_WEB_URL=http://localhost:3033 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/questionarios-respostas.spec.mjs tests/visual/questionarios-editor.spec.mjs --grep 'QPRO-02 adicional|P05|Editor de questionarios' --reporter=list
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js components/questionarios/usar-workspace-questionarios.ts tests/visual/questionarios-respostas.spec.mjs
node node_modules/next/dist/bin/next build --webpack
```

Na raiz: `node scripts/scan-secrets.mjs` e `git diff --check`. Não rodar o build
simultaneamente ao dev na mesma pasta de saída. Não instalar dependências nem
alterar configuração para contornar o ambiente. Next dev usou `--webpack` por
compatibilidade com os node_modules reutilizados; sem mudança versionada.

## Próxima ação

Conferir CI e comentários do HEAD da PR Draft própria. Gates ainda pendentes
não são PASS. Sem autorização para merge/deploy.
QPRO-01 (escopo CSV) permanece tarefa separada, sem antecipar sua implementação.
