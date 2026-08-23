# Fase 146 - Gate de acessibilidade e navegacao por teclado do frontend

Status: entregue em 2026-07-27. A suite encontrou 1 achado real de
acessibilidade na agenda durante o desenvolvimento (fora do escopo permitido
para correcao nesta fase); apos o merge do trabalho paralelo do Codex na
Fase 144 (agendamento publico), o achado foi resolvido incidentalmente por
uma regra global de `:focus-visible` adicionada em `app/globals.css` - ver
"Resultado" abaixo para o historico completo.

## Objetivo

Criar uma suite automatizada de acessibilidade e interacao por teclado para as
telas criticas ja existentes do `octaclin-web`, sem alterar nenhuma
funcionalidade clinica, de agenda ou de backend.

## Escopo autorizado (e respeitado)

Arquivos criados/alterados nesta fase:

- `octaclin-web/tests/visual/acessibilidade.spec.mjs` (novo).
- `octaclin-web/package.json` (somente para adicionar o script `test:a11y`).
- `fase-146-gate-acessibilidade.md` (este arquivo).

Nenhum arquivo em `octaclin-backend/`, nenhum componente de agenda/agendamento
publico/Google Calendar/autenticacao/BFF/rotas de API, `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`,
`RESUMO_FASES_CONCLUIDAS.md`, `STATUS_ATUAL_PROJETO.md` ou lockfiles foram
tocados. Nenhuma dependencia nova foi adicionada - todos os checks usam APIs
nativas do Playwright (`page.evaluate`, `page.keyboard.press('Tab')`,
`toHaveAccessibleName`, `getComputedStyle`).

## Rotas cobertas

| Rota | Papel/sessao mockada | Como e mockada |
|---|---|---|
| `/login` | nenhuma (pagina publica) | sem mock de API; a propria pagina lida com sessao ausente |
| `/dashboard` | `Professional` | cookies falsos + `page.route` reaproveitando o padrao de `console-regression.spec.mjs` |
| `/agenda` | `Professional` | idem (mesmo mock de sessao/agenda) |
| `/portal` (portal do paciente) | `Patient` | cookies falsos + `page.route`, dados adaptados de `portal-paciente.spec.mjs` |
| `/cliente` (portal do cliente) | `Client` | cookies falsos + `page.route`, dados adaptados de `portal-cliente.spec.mjs` |

## Checks implementados por rota

Todos nativos do Playwright, sem dependencias novas:

1. **`main` unico e titulo/h1 visivel** - `page.locator('main')` tem exatamente
   1 ocorrencia e existe um `h1` visivel.
2. **Botoes sem nome acessivel** - todo `button`/`[role="button"]` visivel
   precisa ter `accessibleName` nao vazio (`expect(...).not.toHaveAccessibleName('')`).
3. **Campos de formulario com label acessivel** - todo `input` (exceto
   `hidden`/`submit`/`button`), `select` e `textarea` visiveis precisam ter
   `accessibleName` nao vazio.
4. **Navegacao por Tab sem foco perdido** - conta quantos elementos
   focalizaveis e visiveis existem na pagina (teto de 40, para paginas muito
   longas) e tabula exatamente essa quantidade de vezes, confirmando que o
   foco nunca cai para o `body`/e perdido antes do esperado. O teto e um
   corte deliberado de amostragem, nao uma tentativa de esconder falha (ver
   "Limitacoes" abaixo).
5. **Foco visivel em controles principais** - a cada passo da tabulacao
   acima, confirma que o elemento focado tem `outline` ou `box-shadow`
   diferente de `none` (indicador visual real de foco), reaproveitando a
   mesma varredura do item 4.
6. **Ausencia de overflow horizontal em desktop e mobile** - reaproveita
   literalmente o mesmo `assertSemOverflowHorizontal` ja usado em
   `console-regression.spec.mjs` e `portal-paciente.spec.mjs`. Como
   `playwright.config.mjs` ja define os projetos `desktop-chromium` (1366px)
   e `mobile-chromium` (Pixel 5) e o script `test:a11y` nao restringe projeto,
   toda a suite roda contra os dois automaticamente - cobrindo desktop e
   mobile sem codigo extra.

## TDD (passo executado antes da implementacao)

Antes de escrever os checks reais, foi criado um teste minimo e
propositalmente falho (`login expõe um heading que ainda não existe`) e
`pnpm --dir octaclin-web test:a11y` foi executado para confirmar 2 falhas (uma
por projeto) - validando que o script novo e o arquivo de teste estao
corretamente conectados antes de qualquer implementacao real.

## Resultado

`pnpm --dir octaclin-web test:a11y` roda 5 rotas x 2 projetos = 10 testes.

**Primeira execucao (antes do merge da Fase 144 do Codex): 8 passam, 2
falham** (ambos os projetos, mesma rota: `agenda interna`). Essa falha era um
achado real de acessibilidade no codigo entao existente da agenda, nao um
defeito do teste - por isso nao foi "consertada" alterando o teste para
deixa-lo verde, nem o componente para satisfaze-lo, ja que
`components/agenda/painel-agenda.tsx` estava fora do escopo autorizado desta
fase.

**Achado original:** os campos `<input>` nativos em
`components/agenda/painel-agenda.tsx` (checkbox "Enviar e-mail e mensagem ao
salvar"; "Nova data e hora"; "Nova duracao"; "Novo local"; "Motivo do
cancelamento") nao tinham nenhuma classe Tailwind de foco
(`focus-visible:outline...`), ao contrario de botoes e links do mesmo app
(ex.: os itens de navegacao em `components/app/portal-shell.tsx` usam
`focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria`).
O teste tabulou ate o campo "Novo local"/"Motivo do cancelamento" (2a
consulta mockada, posicao 29 de 30 elementos focalizaveis) e confirmou
`outlineStyle: 'none'` e `boxShadow: 'none'` no elemento focado.

**Segunda execucao (apos merge de `origin/main`, que trouxe a Fase 144 -
agendamento publico - concluida pelo Codex em paralelo): 10 passam, 0
falham.** O merge trouxe uma reescrita grande de `painel-agenda.tsx` (835
linhas alteradas) e uma nova regra global em `octaclin-web/app/globals.css`:

```css
:focus-visible {
  outline: 3px solid rgba(36, 123, 160, 0.35);
  outline-offset: 2px;
}
```

Essa regra cobre todo elemento focalizavel do site, incluindo os `<input>`
crus da agenda que antes nao tinham foco visivel algum (eles continuam sem
classe `focus-visible:outline` propria, mas agora herdam o indicador global).
O achado foi resolvido **incidentalmente** pelo trabalho paralelo do Codex,
nao por uma correcao feita nesta fase - nenhum arquivo de agenda foi tocado
por este commit, conforme o escopo autorizado. Mantendo o registro do achado
original acima para historico, ja que a causa raiz (inputs sem estilo de
foco proprio) ainda existe no componente; só passou a ser coberta por uma
regra global que poderia, em tese, ser removida ou sobrescrita no futuro sem
que ninguem perceba que a agenda dependia dela.

Login, dashboard, agenda interna, portal do paciente e portal do cliente
passam em todos os 6 checks, nos dois projetos (desktop e mobile), na
execucao final.

## Comandos executados

```powershell
pnpm --dir octaclin-web test:a11y   # 10 passed (apos merge da Fase 144; 8 passed/2 failed antes do merge, ver "Resultado")
pnpm --dir octaclin-web lint        # limpo
pnpm --dir octaclin-web typecheck   # limpo
```

O servidor web (`pnpm --dir octaclin-web dev`) foi iniciado localmente em
segundo plano para servir as paginas durante os testes; nenhum backend real
foi necessario, ja que toda chamada de API e interceptada via `page.route`
antes de sair do navegador.

## Limitacoes conhecidas

- A tabulacao por Tab tem um teto de 40 elementos por pagina (relevante para
  paginas muito longas, como o portal do cliente com dezenas de cartoes) -
  cobre uma amostra representativa do inicio da pagina, nao todo elemento.
- Os checks de "label acessivel"/"nome acessivel" usam
  `toHaveAccessibleName` do Playwright (calculo real de accessible name via
  arvore de acessibilidade do navegador), mas nao validam contraste de cor,
  ordem de leitura por leitor de tela, nem semantica ARIA alem do nome
  acessivel - isto e um gate de regressao basico, nao uma auditoria WCAG
  completa.
- `/login` nao testa o fluxo de autenticacao em si (isso ja e coberto por
  `console-regression.spec.mjs`); testa apenas a pagina de login como rota
  publica isolada.
- O achado original (foco invisivel em inputs crus da agenda) foi resolvido
  incidentalmente por uma regra global de CSS trazida pelo merge da Fase 144,
  nao por uma correcao desta fase - a causa raiz (inputs sem classe de foco
  propria) continua no componente e vale endereçar de forma explicita em uma
  fase futura, para nao depender apenas da regra global.
