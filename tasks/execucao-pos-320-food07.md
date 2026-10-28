# FOOD07 — execução técnica

## T01 — PASS técnico local, 28/10/2026

Código: `bdb816f8`, base documental `ea2bd1d5`, PR Draft #452, branch `docs/pos320-food07-planning`. Nenhuma alteração de banco, endpoint HTTP, portal ou operação externa nesta tarefa. T02–T07 e G06 não foram aprovados por esta evidência.

### Ambiente e integridade

Node **22.23.4**, pnpm **11.25.0** (versão/integridade do `packageManager`), TypeScript **6.0.3** do lockfile. Node/pnpm obtidos das distribuições oficiais e conferidos por SHA256/SHA512, isolados em `/tmp/octaclin-food07-tools`, sem trocar runtime global ou engines. Backend instalado com `install --frozen-lockfile --prefer-offline`; zero mudanças de dependências/lockfiles/políticas. Sem symlink para outra worktree.

### RED observado e GREEN

1. Teste funcional chamou `contarItensReceita` com ingredientes válidos e base desconhecida: esperava rejeição sanitizada, mas **não lançou erro**. RED real, não falta de ferramenta.
2. Asserções dos novos contratos de normalização/leitura/porcionamento/DTOs falharam antes de seus exports existirem; testes deliberadamente não importaram módulos inexistentes nem aceitaram TypeError como validação. Isso verifica ausência da API, não é apresentado como divergência numérica calculada.
3. Testes adicionais reproduziram rejeição indevida da precisão de catálogo/notação exponencial e aceitação de etiqueta que ficava vazia na normalização HMAC. Corrigidos com RED/GREEN, preservando a restrição manual legada.
4. GREEN final: **270 testes T01** — 63 metadados/leitura, 176 porcionamento, 31 DTOs. Sem mocks do cálculo. Inclui grade de 120 combinações equivalentes entre bases, identidade/fator um, half-up, independência de prévias, limites anteriores ao arredondamento e ausência de resultado parcial.

### Oráculo independente

`scripts/research/food07/gerar-oraculo-porcionamento.py` usa `fractions.Fraction` e `decimal.Decimal` com `ROUND_HALF_UP`, não importa TypeScript. Fixture em `dominio/fixtures/porcionamento-receita-oraculo.json`: **21 casos sintéticos**, reproduzidos por `--check`, incluindo 1/1,5/2,5 porções, frações periódicas e empate half-up. SHA256 da fixture: `f24508220649e07cbda86047435c7f0302fc2bfc483589788c1a800329b242cc`. Hash identifica dados sintéticos, não comprova validação clínica.

### Comandos executados

Todos os comandos Node/pnpm abaixo foram executados com os binários isolados acima (não o fallback Node24/pnpm11.19 do host):

| Verificação | Comando lógico | Resultado |
| --- | --- | --- |
| Baseline anterior ao código | Jest receitas/modelos/medidas/micronutrientes | PASS, 133 testes |
| RED inicial | `pnpm --dir octaclin-backend exec jest --runInBand --runTestsByPath src/modulos/planos-alimentares/dominio/metadados-receita.spec.ts` | FAIL esperado: base inválida aceita |
| Domínio/DTO e regressões focadas intermediárias | `pnpm --dir octaclin-backend exec jest --runInBand --testPathPatterns='metadados-receita|porcionamento-receita|dtos-receitas-metadados|servico-receitas-nutricionais|modelos-plano-alimentar|medidas-caseiras|micronutrientes'` | PASS, 409 testes antes dos dois últimos casos de borda |
| Oráculo | `python3 scripts/research/food07/gerar-oraculo-porcionamento.py --check` | PASS, 21 casos reproduzidos |
| Suíte completa final | `pnpm --dir octaclin-backend test --runInBand --json --outputFile=<temporário local>` | PASS dos executados: 3.514 testes, zero falhas; 142 skipped |
| Typecheck final | `pnpm --dir octaclin-backend typecheck` | PASS |
| Build | `pnpm --dir octaclin-backend build` | PASS, artefato `dist/main.js` validado |
| Higiene | `git diff --check`; `node scripts/scan-secrets.mjs` | PASS |

Relatórios brutos ficaram somente no diretório temporário da tarefa. Logs da suíte incluem avisos sintéticos deliberados de erros/antimalware; não são evidência de ClamAV ou de ambiente produtivo.

### Skips e limites — não converter em PASS

A suíte final teve 365 suítes aprovadas e 8 integralmente skipped; uma suíte de pesquisa também contém quatro testes skipped. Total **142**:

| Arquivo/superfície | Quantidade skipped | Motivo |
| --- | --- | --- |
| `rls-isolamento-tenant.integracao.spec.ts` | 67 | Gate PostgreSQL/Testcontainers não habilitado localmente |
| `piloto-gamificacao.integracao.spec.ts` | 32 | Gate PostgreSQL/Testcontainers não habilitado |
| `rascunhos318.integracao.spec.ts` | 14 | Gate PostgreSQL/Testcontainers não habilitado |
| `sessoes-rotacao.integracao.spec.ts` | 17 | Prova externa/descartável não configurada |
| `1720000001078-GruposSubstituicoes.integracao.spec.ts` | 4 | Gate específico PostgreSQL não habilitado |
| `1720000001077-FavoritosAlimentosProfissional.integracao.spec.ts` | 1 | Gate específico PostgreSQL não habilitado |
| `consulta-badges-pg.integracao.spec.ts` | 1 | Gate PostgreSQL não habilitado |
| `servico-protecao-abuso.redis.integracao.spec.ts` | 2 | Redis real não habilitado |
| `validacao-rev11-investigacao.spec.ts` | 4 | Grades/oráculos locais opcionais OMS não fornecidos; classificadores não ativados |

T01 é domínio puro e não necessita banco. Essas ausências não provam RLS, concorrência ou Redis e não encerram G02/G04. R4 final FOOD07, CI do novo HEAD e UX B/C permanecem pendentes; sem interface FOOD07 nesta tarefa.

### Contratos preservados / decisões de engenharia

- Legado sem metadados continua sem base/rendimento inferidos. Omissão preserva; `null` só remove campos permitidos na alteração.
- Aritmética BigInt racional, fator reduzido serializado em strings, único half-up final de três casas. Fonte não é mutada; valores fora do limite exato bloqueiam a operação inteira antes do arredondamento.
- Concentrações não são escaladas nem preenchidas com zero. Precisão do catálogo é preservada; cadastro manual mantém os quatro indicadores obrigatórios e precisão legada. Medidas/identidades/flags existentes e instruções não são reescritas pelo cálculo.
- Leitor validado e projeção pública são helpers ainda **não conectados às leituras HTTP**; conexão reader-first e testes de fronteira pertencem às tarefas seguintes. Não alegar que o portal atual já foi corrigido por existir helper.
- Os DTOs são definidos/reexportados, mas **não estendem os DTOs de criação/edição HTTP existentes nesta tarefa**. Conectar somente junto da persistência atômica em T02 evita aceitar metadados e descartá-los silenciosamente. Ajuste de sequência técnico documentado, sem retirar requisito.
- O domínio recebe conteúdo original explícito. A garantia server-side de resolver novamente receita/versão e não aceitar prévia como fonte depende de T03/T04; não inventar capability ou proveniência FOOD05.

## Continuidade

T02 passa a ser a próxima tarefa em execução: writer/reader cifrados, CAS, índice derivado HMAC, consulta antes de paginação e migration aditiva, com provas reais descartáveis. Conferir numeração livre acima da 1079 reservada pela #446 e permissões reais antes de implementar schema. Sem aplicação externa.

Correção Mobile isolada em `fix/mobile-deepmerge-prototype`, worktree própria; investigação e testes não pertencem a esta PR. Nenhum waiver ou gate global verde atribuído por esta entrega. Papéis UX seguem referência explícita #451/0d3382b6, B/C quando houver interface. #446/G06 preservados; sem FOOD05-MDL/FOOD08, merge, deploy ou operação produtiva.
