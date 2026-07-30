# Fase 161 - Base visual e navegacao compartilhada

Status: concluida em 2026-07-30.

## Objetivo

Aplicar a primeira entrega de implementacao derivada da especificacao Penpot:
melhorar a navegacao compartilhada e os controles de maior reuso sem
reescrever cada fluxo de produto.

## Entregue

- `ConsoleShell` organiza os modulos em Clinica, Relacionamento e
  Administracao, respeitando as mesmas permissoes ja aplicadas antes da
  renderizacao.
- `PortalShell` aceita grupos de navegacao e os exibe na barra lateral em
  desktop; no mobile a navegacao continua horizontal, sem texto adicional que
  reduza o espaco dos atalhos.
- `Botao`, `Campo` e `Selecao` passaram a ter alvo minimo de toque de 44 px.
- O portal do paciente deixou de exibir score de risco clinico; o status de
  acompanhamento continua visivel com linguagem nao tecnica.
- Novo teste de contrato `pnpm --dir octaclin-web test:base-visual` protege
  essas decisoes compartilhadas.

## Escopo preservado

- Nenhuma permissao, endpoint, contrato BFF, dado clinico ou integracao foi
  alterado.
- A revisao profunda das telas do portal, agenda, formularios e console segue
  nas proximas fases de UX.

## Validacoes

```powershell
pnpm --dir octaclin-web test:base-visual  # passou
pnpm --dir octaclin-web typecheck         # passou
pnpm --dir octaclin-web lint              # passou
pnpm --dir octaclin-web test:authz        # 22 testes passaram
pnpm --dir octaclin-web test:a11y         # 10 testes passaram
pnpm --dir octaclin-web build             # passou
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs -g "painel clinico profissional" --project=desktop-chromium --project=mobile-chromium --reporter=list  # 6 testes passaram
```

## Observacao

A suite Playwright emite avisos conhecidos do shim sincrono de `cookies()` do
Next.js 15. Eles nao causaram falha nesta fase e continuam explicitamente
reservados para a migracao dedicada a Next.js 16/React 19.
