# FOOD01 — integração e revisão final

Branch `feat/pos320-food01-planejamento`, base PA07 `d36b12e7`. Desenvolvimento
e PR única autorizados pelo proprietário. Backend Sol, interface Luna e
integração/revisão Sol concluídos localmente; CI e operação externa separados.

## Entrega e revisão R4

Medidas pessoais/clínica vinculadas ao alimento exato, pessoal por padrão,
equivalência explícita em gramas e aplicação por ação do profissional. Biblioteca
e pedido original cifrados; edição/desativação só pelo criador, com CAS. Criação
idempotente conserva a mesma intenção em retry. Nenhuma dependência foi adicionada
nem código GPL foi incorporado da referência R017.

Revisão manual de todos os arquivos de runtime alterados: controlador, DTOs,
serviço, domínio, entidades, registro de módulo/TypeORM, migration, BFF, API e
editor. Foram seguidos os caminhos existentes de autorização, cópias, versões,
portal/PDF, auditoria e sessão. Não foi confirmada falha de autorização, RLS,
cifra ou projeção nesta análise. O backend valida tenant/profissional/fonte na
transação; snapshots anteriores são autoritativos somente para o mesmo vínculo
de item/alimento/nonce. Reaplicação e cópia não herdam autorização pessoal.

Esta revisão é própria, não independente. A skill de scan foi consultada, mas o
preflight/recurso e o mecanismo formal de scan não estavam disponíveis nesta
sessão; não foi produzido scan formal automatizado nem se atribui esse resultado
à ferramenta. Revisão humana e os controles da PR continuam necessários.

## Correções da integração com RED/GREEN

| Problema | RED observado | Correção e GREEN |
|---|---|---|
| Autosave apagava cadastro ainda não enviado da biblioteca | Após o primeiro PUT de 60s, campo “Nome da medida” desaparecia | Chave do seletor usa plano/rascunho/item/alimento, sem revisão volátil; testes desktop/mobile preservam o texto |
| Troca de edição durante PATCH descartava a nova entrada ao chegar o ACK | Botão Editar continuava habilitado enquanto o PATCH estava bloqueado pela fixture | Botão e handler impedem iniciar outra edição durante gravação; teste com resposta controlada passa |
| Descriptor antigo sem base não explicava a limitação | Revisão do contrato do handoff | Aviso explícito; fatos preservados, quantidade nova não infere base, peso manual envia `null`; testado no navegador |

Uma primeira tentativa do teste de autosave instalou o relógio depois dos timers
e não enviou PUT; não foi tratada como reprodução do defeito. Depois de instalar
o relógio antes da navegação, o RED reproduziu a perda do campo. Ao acrescentar
teclado, um seletor global encontrou o botão Aplicar de modelos durante o loading;
o teste foi corrigido para buscar a ação dentro do seletor de medidas.

## Gates executados

| Gate | Estado | Evidência/limite |
|---|---|---|
| Backend focado + migration1075 | PASS | 29 suítes, 407 testes, reconferidos na integração |
| PostgreSQL15 real descartável | PASS parcial | 28 PASS/29 filtrados; RLS sem tenant/cross-tenant, FK, escopos, CAS/criação concorrentes, transferência e aplicação/desativação |
| Timescale/pgvector/hypertable | SKIPPED local | Harness local declara as omissões; gate integral é do CI |
| Cópia de refeições Web | PASS | 10/10; fatos preservados sem descriptor/nonce/base em cópias e alternativas |
| BFF de planos e autorização Web | PASS T06 | 45/45 e agregado `test:authz`; BFF não mudou depois desse gate |
| Aritmética/editor Web | PASS T06 | 62/62; PA03–PA07 e conversão decimal exata |
| Playwright PA07 + FOOD01 | PASS | 32/32 desktop/mobile; inclui posse, revogação, BFCache, cópia em voo e novos casos FOOD01 |
| Playwright final FOOD01 + impressão | PASS | 10/10 após correção final; teclado, Axe focado, CRUD, revisão409 sem retry, paginação, parcial/null, referência ausente e resposta tardia |
| Portal plural | PASS | Cenário PA06 desktop/mobile, mantendo planos ativos e acesso ao detalhe sem cache |
| ESLint Web completo | PASS com avisos | Zero erros, 70 avisos em código existente; componente/helpers novos sem avisos |
| APIs dinâmicas | PASS | 151 arquivos verificados |
| Segurança operacional BFF | PASS | 10/10 |
| Guardas/migrations fora de banda | PASS | 24/24; matriz de confiabilidade40 referências válidas |
| Build/typecheck Web e segurança runtime | PASS | Build Webpack, `tsc --noEmit` e smoke de produção: CSP nonce, cache, CORS e proteção de origem |
| Backend integral/typecheck/build | PASS checkpoint backend | Mesmo código de produção, sem alteração backend após `03883570`;343 suítes/3086 testes PASS,6 suítes/127 SKIPPED. Ver evidência backend |
| PowerShell DocsOnly | SKIPPED local | `powershell`/`pwsh` ausentes; execução canônica fica no CI |
| Revisão independente | SKIPPED | Não executada; revisão própria identificada acima |
| CI da PR #424 | PENDING final | Run39028272706 de `fd5299d1`: Backend, Web, governança e scanners SUCCESS; Demo em execução na conferência. Follow-up documental exige reconferir HEAD final |
| Migration/deploy externos | SKIPPED | Não autorizados nesta execução |

O smoke de runtime foi tentado antes de existir build de produção e falhou nessa
precondição; passou após o build. A compilação gerou avisos conhecidos de
middleware/Edge internos ao Next. O cache Webpack ocupou o espaço disponível;
após a compilação, foram removidos apenas arquivos `.pack` regeneráveis da
worktree FOOD01, preservando artefatos, código e outras worktrees. Build e
typecheck terminaram com sucesso. A tentativa inicial de limpeza por `rm -f`
foi rejeitada pelo ambiente e não executada.

## Reprodução

Node22.21.1 no PATH. Na raiz: `node scripts/scan-secrets.mjs`,
`node scripts/test-matriz-confiabilidade.mjs`, `git diff --check` e os testes
Node de guardas/migrations fora de banda. No backend:

```sh
node node_modules/jest/bin/jest.js --runInBand --testPathPatterns='modulos/planos-alimentares|1075-MedidasCaseiras.spec.ts'
node scripts/test-pa05-postgres-local.cjs --inventario
```

No Web:

```sh
pnpm test:copia-refeicoes
pnpm lint
pnpm build
pnpm typecheck
pnpm test:seguranca-operacional
pnpm test:seguranca-runtime
pnpm test:apis-dinamicas
pnpm exec playwright test tests/visual/pa07-coordenacao-abas.spec.mjs --reporter=list
pnpm exec playwright test tests/visual/pa07-coordenacao-abas.spec.mjs tests/visual/fase-320-pa05-apresentacao.spec.mjs --grep 'FOOD01|prévia do rascunho e impressão' --reporter=list
```

Playwright usou servidor Next local Webpack, necessário por causa do symlink de
dependências com lockfile idêntico, com `E2E_REUSE_EXISTING_SERVER=true` e
`E2E_WEB_URL=http://localhost:3000`. Fixtures exclusivamente sintéticas.

## Liberação operacional

A migration1075 deve preceder a publicação do backend; a coluna nova entra nas
consultas de versões. Confirmar alvo, autorização, owner/runtime, grants mínimos
e FORCE RLS conforme `RUNBOOK_PRODUCAO.md`. Não houve aplicação externa.
Rollback preserva tabela, coluna, snapshots cifrados e backend capaz de ler o
contrato FOOD01. Conferência do baseline `d36b12e7`: `camposAlimento` no domínio
`edicao-plano.ts` não inclui `medidaCaseira`, `objeto()` rejeita campos extras e
`ServicoPlanosAlimentares.lerEdicao()` converte a rejeição em `indisponivel`.
Portanto, após novas gravações, suspender entradas pela UI e corrigir o backend
mantendo o leitor compatível; não reimplantar cegamente o backend pré-FOOD01.
Não executar `down` destrutivo, remover contextos nem recalcular publicações. O checkout principal mantém sua alteração
preexistente em `next-env.d.ts`; gerados desta worktree ficam fora da entrega.

Próxima ação: CI do HEAD da PR e revisão humana, depois operação autorizada
com migration anterior ao deploy. A entrega não comprova disponibilidade em
staging/produção nem autoriza merge, deploy ou carga de catálogo.

## Limite da consulta de segurança no GitHub

Os checks CodeQL, Semgrep, Dependency Review e Trivy do HEAD `fd5299d1`
retornaram SUCCESS. A API de alertas detalhados de code-scanning respondeu403
(`Resource not accessible by integration`); não houve leitura direta dessa
listagem. Anotações consultadas de CodeQL JavaScript, Semgrep e Trivy continham
somente o aviso de migração da imagem `ubuntu-latest`, sem apontamento de código.
Isto não equivale a declarar ausência de alertas inacessíveis.
