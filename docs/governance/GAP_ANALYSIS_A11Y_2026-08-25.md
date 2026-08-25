# Gap analysis de acessibilidade (a11y) — PR 13 da governança

Data: 2026-08-25
Escopo desta PR: **somente análise**. Conforme `DECISAO_FINAL_GOVERNANCA_AGENTES_OCTACLIN.md` §41,
`axe-core` é item "posterior ao gap analysis" — não faz parte desta PR. Nenhum código de produto foi
alterado; nenhuma ferramenta nova foi instalada.

## 1. O que já existe (verificado no código, não presumido)

- `octaclin-web/tests/visual/acessibilidade.spec.mjs`: suíte Playwright dedicada, com 5 checagens
  reutilizadas por rota (`main` único + `h1` visível, botões/campos com nome acessível, navegação por
  Tab preservando e exibindo foco, ausência de overflow horizontal).
- Cobre 5 rotas críticas: `/login`, `/dashboard`, `/agenda`, `/portal`, `/cliente`.
- Script dedicado `pnpm test:a11y` roda essa suíte isoladamente.
- **Confirmado via `playwright.config.mjs`**: `testDir: './tests/visual'` sem `testMatch`/`testIgnore`,
  2 projects (`desktop-chromium`, `mobile-chromium`). O step "Smoke visual Playwright" do CI
  (`pnpm smoke:visual` = `playwright test` sem filtro) varre todo `tests/visual/*.spec.mjs`, incluindo
  `acessibilidade.spec.mjs`, em ambos os projects. **Ou seja: essas 5 rotas já rodam a11y gate em CI
  a cada PR — não é um gap.**
- `octaclin-web/AGENTS.md:52` já documenta a expectativa de rodar `pnpm test:a11y` "quando aplicável".

## 2. Gaps reais encontrados

### 2.1 Cobertura de rotas (web)

Das rotas exercidas pela suíte visual completa (levantadas via `page.goto()` em todos os
`tests/visual/*.spec.mjs`), apenas 5 passam pelo gate de acessibilidade. Rotas de produto sem
nenhuma checagem de a11y:

`/agendar/token-publico`, `/automacoes`, `/comunicacoes`, `/esqueci-senha`,
`/formularios/token-publico`, `/formularios/token-pwa`, `/formularios/token-upload`, `/ia`,
`/operacoes`, `/pacientes`, `/pacientes/novo`, `/pacientes/{id}`, `/pacientes/{id}/editar`,
`/portal/agenda`, `/portal/checkins`, `/portal/mensagens`, `/portal/plano`, `/portal/privacidade`,
`/primeiro-acesso`, `/profissionais`, `/questionarios`, `/recuperar-senha`.

Duas rotas de alto risco de exclusão estão nessa lista sem cobertura: `/agendar/token-publico`
(agendamento público, usado por paciente externo sem suporte da equipe) e `/formularios/*`
(preenchimento de questionário clínico por paciente, possivelmente em dispositivo assistivo).

### 2.2 Dimensões de WCAG não cobertas pela suíte atual, nas 5 rotas que já têm gate

A suíte checa nome acessível, ordem/visibilidade de foco e overflow — não checa:

- Contraste de cor (WCAG 1.4.3/1.4.11);
- Hierarquia de headings além do `h1` único (H2+ fora de ordem não é detectado);
- Texto alternativo em imagens (`alt`);
- Validade semântica de ARIA (papéis inválidos, `aria-*` órfão) — a checagem atual valida só
  "tem nome acessível", não "o ARIA está correto";
- Associação de erro de formulário (`aria-describedby`/`aria-invalid` em campos inválidos);
- Regiões live / anúncio de mudanças assíncronas (notificações, toasts, contadores);
- `prefers-reduced-motion`;
- Reflow/zoom a 200% (WCAG 1.4.10).

Essas são exatamente as dimensões que uma ferramenta como `axe-core` cobre e que checagem manual via
Playwright não cobre bem — é o motivo pelo qual a decisão de governança já prevê `axe-core` como
próximo passo, não como parte desta análise.

### 2.3 Mobile (Expo/React Native)

Busca por `accessibilityLabel`, `accessibilityRole`, `accessible=`, `accessibilityHint` em
`octaclin-mobile/app` e `octaclin-mobile/src`: **0 ocorrências**. Não há suíte de teste de
acessibilidade no mobile. Gap total — não é "cobertura parcial", é ausência da camada de
acessibilidade nativa (leitores de tela como VoiceOver/TalkBack não têm rótulo para navegar o app).

## 3. Classificação de risco (não é R4/R5)

Esta análise não altera comportamento, não tolera regressão, não tem dado clínico/PHI envolvido e não
é migração/produção/RLS/crypto. É documentação. `Definition of Done` §44 aplicável: escopo
implementado (análise), sem alteração fora de escopo, sem secret/PHI introduzido, diff é só este
arquivo.

## 4. Recomendação (não implementada nesta PR)

Ordem sugerida para trabalho futuro, cada um como PR de governança separada, na linha já aprovada em
§41 ("axe-core após gap analysis"):

1. `axe-core` (via `@axe-core/playwright`) integrado à suíte `acessibilidade.spec.mjs` existente, nas
   mesmas 5 rotas — cobre 2.2 sem expandir rotas ainda.
2. Expandir `acessibilidade.spec.mjs` para as rotas listadas em 2.1, priorizando
   `/agendar/token-publico` e `/formularios/*` (uso por paciente/público externo, sem suporte).
3. Mobile: gap de acessibilidade nativa é um projeto à parte (instrumentação de
   `accessibilityLabel`/`accessibilityRole` nos componentes existentes), fora do escopo de "ferramenta
   de CI" desta lista — não tem ferramenta automatizada equivalente ao axe-core para RN sem dependência
   nova, então decisão de escopo/priorização fica com o dono do produto.

## 5. Fora de escopo desta PR

Nenhuma. Não foi instalada nenhuma dependência, não foi alterado nenhum workflow de CI, nenhum código
de produto foi tocado.
