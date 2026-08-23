# Fase 148 - Foco visivel proprio nos componentes compartilhados de formulario/botao

Status: entregue em 2026-07-27.

## Objetivo

Fechar a observacao deixada na Fase 147: os componentes compartilhados
`Campo`, `AreaTexto`, `Selecao` (em `components/ui/campo.tsx`) e `Botao`
(em `components/ui/botao.tsx`) nao tinham classe `focus-visible` propria,
dependendo apenas da regra global `:focus-visible` em `app/globals.css`.
Esses quatro componentes sao usados em 23 arquivos / 37 pontos de import
em todo o `octaclin-web`, entao a fragilidade de depender so da regra
global afetava praticamente todo o app, nao so a agenda.

## Escopo

Dois arquivos alterados:

- `octaclin-web/components/ui/campo.tsx`: `Campo`, `AreaTexto` e `Selecao`
  passam a incluir a classe `focus-visible:outline focus-visible:outline-2
  focus-visible:outline-offset-2 focus-visible:outline-primaria` (mesmo
  padrao ja usado em `portal-shell.tsx`/`modal.tsx` e aplicado na Fase 147
  aos inputs crus da agenda), via uma constante `focoVisivel` compartilhada
  entre os tres.
- `octaclin-web/components/ui/botao.tsx`: `Botao` recebe a mesma classe,
  antes das variantes de cor, para que `className` (prop) continue podendo
  sobrescrever se necessario.

Nenhuma prop, assinatura ou logica foi alterada — apenas `className`
adicional via `cn()`, que ja mesclava classes do chamador.

## Validacoes

```powershell
pnpm --dir octaclin-web typecheck   # limpo
pnpm --dir octaclin-web lint        # limpo
pnpm --dir octaclin-web build       # ok
pnpm --dir octaclin-web test:a11y   # 10 passed
pnpm --dir octaclin-web exec playwright test tests/visual/console-regression.spec.mjs --project=desktop-chromium --reporter=list   # 21 passed
```

## Resultado

Com esta fase, os quatro componentes de UI mais reutilizados do app
(`Campo`, `AreaTexto`, `Selecao`, `Botao`) tem foco visivel proprio,
independente da regra global do `globals.css`. A regra global continua
ativa e segue cobrindo qualquer elemento nativo isolado que nao passe por
esses componentes (ex.: um `<input>` cru futuro fora do padrao).
