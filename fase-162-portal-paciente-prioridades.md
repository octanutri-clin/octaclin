# Fase 162 - Portal do paciente orientado a prioridades

Status: concluida em 2026-07-30.

## Objetivo

Transformar o resumo inicial do portal do paciente em uma leitura objetiva:
o que fazer agora, quando sera a proxima consulta e como esta o plano de
acompanhamento.

## Entregue

- O antigo bloco de oito indicadores foi substituido por um cabecalho de
  acompanhamento e tres cartoes: Proxima acao, Proxima consulta e Plano em
  andamento.
- A proxima acao reaproveita o primeiro formulario pendente e direciona para
  a resposta; sem pendencia, comunica o estado vazio de forma simples.
- A proxima consulta reaproveita a consulta existente e oferece acesso a
  agenda Google somente quando o link ja estiver disponivel.
- O plano informa tarefas e materiais ativos e leva diretamente a secao
  detalhada do plano.
- A pagina continua sem score de risco clinico e sem novos endpoints,
  integracoes ou dados duplicados.

## Validacoes

```powershell
pnpm --dir octaclin-web exec playwright test tests/visual/portal-paciente.spec.mjs --project=desktop-chromium --project=mobile-chromium --reporter=list  # 4 passaram
pnpm --dir octaclin-web typecheck  # passou
pnpm --dir octaclin-web lint       # passou
pnpm --dir octaclin-web test:base-visual  # passou
```
