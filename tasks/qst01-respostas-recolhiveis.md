# QST01 — expandir/recolher respostas de questionários

## Entrega

Autorização: pedido do proprietário para implementar a primeira pequena melhoria
profissional do [plano](melhorias-profissionais-paralelas-food06.md).
Branch `feat/qst01-respostas-recolhiveis`, baseada na main `60bbe01f` e no preparo
documental `a4305b0b`. Código e testes no commit **`76609c16`**.
Risco R2: organização visual da leitura já autorizada, sem nova fronteira de dados.

O componente real `octaclin-web/components/questionarios/area-respostas.tsx`
agora oferece controles por envio e `Expandir tudo` / `Recolher tudo` nos resultados
exibidos. Inicia aberto; paciente, data e contagem permanecem no resumo.

Estado local por `respostaId`, mantido ao pesquisar inclusive sem resultados e
reiniciado ao mudar paciente/questionário ou remontar a área. Atualizar/reordenar
a lista preserva a identidade de cada envio; novos envios começam abertos.
Botões nativos, `aria-expanded`/`aria-controls` e conteúdo `hidden` reutilizam os
componentes existentes. Não há animação ou preferência persistente nova.

Somente esse componente foi alterado funcionalmente. API, BFF, workspace,
formatação, matriz longitudinal, CSV, portal, autorizações e FOOD06 preservados.
Recolher não é barreira de segurança: dados autorizados já carregados continuam
em memória/DOM; não houve ampliação de acesso nem retorno de novos dados.

## RED/GREEN e regressões

| Gate | Resultado e evidência |
| --- | --- |
| RED funcional | Teste `inicia aberto...` carregou página e respostas sintéticas, falhando em `aria-expanded` porque não havia botão `Recolher respostas` |
| GREEN QST01 | 12/12 Playwright: seis cenários em desktop/mobile, no mesmo run das regressões |
| Independência por envio/atualização | 2/2 adicionais em desktop/mobile: dois envios do mesmo paciente, dados/datas distintos, reordenação e IDs estáveis |
| Regressão editor | 10/10 Playwright existentes: alterações não salvas, recorrência, novo questionário, preview e versões |
| Acessibilidade automatizada | Teclado Tab/Enter/Espaço, foco visível pelo tema e axe sem violações na lista, nos dois projetos |
| Texto ampliado | Fonte raiz 200%, sem overflow horizontal do documento, controles operáveis em desktop/mobile |
| Efeitos colaterais | Sem novas requisições/gravações/URL/storage ao organizar; estado não persiste após reload |
| Preview de questionários | 3/3 pelo script existente |
| BFF revisão | 5/5 pelo script existente; warning esperado do stub `headers()` não equivale a prova de runtime |
| Typecheck | PASS Node 22.21.1, `tsc --noEmit --incremental false` |
| ESLint afetado | PASS componente e teste novo |
| Linguagem | PASS `scripts/test-linguagem-interface.mjs` |
| Build completo Web | PASS Node 22.21.1, `next build --webpack`; avisos de middleware legado e `process.cwd` no Edge Runtime originados do Next instalado; instalação local não canônica |
| CI/scanners remotos | PENDENTES no momento deste registro; não reutilizar CI da base como aprovação deste delta |
| PostgreSQL/RLS | N/A: sem mudança de consulta, autorização, API, persistência ou banco |
| Usuários reais/leitor de tela manual | SKIPPED: não executados; axe/teclado não comprovam avaliação humana com tecnologia assistiva |

Os 24 cenários de navegador foram executados em duas invocações: 22 no run
principal e 2 adicionais após a revisão. Nenhum foi skipped nesses runs.
Arquivo: `octaclin-web/tests/visual/questionarios-respostas.spec.mjs`.

Durante a construção das fixtures houve seletores ambíguos e uma asserção que
supunha que a inicialização inteira faria apenas GET. Corrigidos os seletores e
o isolamento da observação: os controles não acrescentam requests/gravações aos
já existentes no bootstrap. O teste de foco aceita outline ou o anel por sombra
previsto em `app/globals.css`. Sem reduzir o critério de foco visível.

Uma tentativa anterior de navegador foi interrompida por resolução de módulos
do cache fora do checkout. **Não conta como RED funcional nem PASS.** Resolvida
somente no comando local via `NODE_PATH`, sem alterar dependências, workflows,
segurança ou configuração versionada do produto.

## Ambiente e reprodução

Node 22.21.1. Dependências preexistentes reutilizadas por symlink somente de
leitura: Next 16.3.8, React 19.3.0, Playwright 1.63.0, TypeScript 6.0.3.
O manifesto da branch declara Next ^16.4.5, React ^19.3.1 e Playwright ^1.64.1:
**a instalação local não é a instalação canônica do lockfile**. Não foi modificada
nem reinstalada por escassez de disco e para preservar o trabalho paralelo.

Servidor local `next dev --webpack` em localhost:3027, browser Chromium do sistema.
Config temporária de Playwright importa a config do projeto e só ajusta servidor
preexistente, binário e diretórios de saída. Mesmos projetos, testes, timeouts e
asserts do repositório, sem alterações versionadas de setup. Fixtures interceptam
o BFF; testes de navegador não comprovam isolamento de banco.

Com instalação canônica, usar os comandos do pacote Web:

```sh
pnpm exec playwright test tests/visual/questionarios-respostas.spec.mjs tests/visual/questionarios-editor.spec.mjs --reporter=list
pnpm exec eslint components/questionarios/area-respostas.tsx tests/visual/questionarios-respostas.spec.mjs
pnpm typecheck
pnpm test:questionarios-preview
pnpm test:questionarios-revisao:bff
pnpm test:linguagem
pnpm build
```

O workflow existente `.github/workflows/ci.yml` executa `pnpm smoke:visual` no job
Demo local smoke, abrangendo o novo arquivo nos dois projetos; nenhum workflow
foi alterado para incluir ou dispensar o teste.

## Revisões e limites

Revisor `/root/qst01_revisao_tecnica`: independente do implementador, revisão
**estática somente leitura**, sem achado bloqueante; não executou testes próprios,
não é aprovação R4. Sugestão de testar dois envios do mesmo paciente incorporada,
2/2 PASS pelo coordenador. Nenhum código funcional mudou após a revisão.

UX A previamente realizada e aprovada com a autorização de execução. UX B/C:
[relatório e manifesto](../docs/agents/ux/reports/PROFISSIONAL-QST01-BC-2026-11-21/consolidado.md).
Coordenador executou o navegador e inspecionou imagens reais sintéticas; persona
avaliou evidências relatadas, sem interação/inspeção visual independente.
Paciente N/A: nenhuma mudança em sua jornada/conteúdo/envios/documentos.

Refinamento P3 observado: concordância legada `1 respostas`; deixado em backlog,
comunicado ao proprietário, sem ampliar esta entrega.

## Segurança, paralelo e rollback

Sem dependências novas, mudanças de lockfile, API, migrations, infra, dados reais
ou arquivos da FOOD06. Alteração preexistente `next-env.d.ts` no checkout raiz
intacta; arquivo gerado apenas nesta worktree excluído do commit.
Rollback somente do incremento de interface, sem conversão de dados.

Próxima ação: abrir/manter PR Draft e conferir CI do HEAD enviado. Sem merge,
deploy, migrations externas ou início automático de OPS03/OPS01/FOOD08.

Gates documentais finais: links relativos, hashes do manifesto, diff e scanner
local de segredos conferidos antes do envio. Não equivalem aos scanners remotos.
