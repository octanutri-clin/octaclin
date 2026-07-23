# Fase 116 - Notificacoes do paciente

Data: 2026-07-23

## Objetivo

Dar transparencia ao paciente sobre comunicacoes geradas pelo OctaClin, separando notificacoes pendentes do historico recente para reduzir duvidas e mensagens perdidas.

## Entregas

- Resumo autenticado do portal passa a retornar `notificacoesPaciente`.
- Resumo autenticado do portal passa a retornar os contadores `notificacoesPendentes` e `notificacoesHistorico`.
- Notificacoes sao derivadas de `mensagens_notificacao`, mantendo tenant e paciente do usuario logado.
- Cada notificacao expoe canal, titulo, texto, status, evento, erro, data de criacao, envio e agendamento quando disponiveis.
- `mensagensRecentes` continua existindo para compatibilidade e mostra as ultimas mensagens do paciente.
- Portal web adiciona navegacao `Notificacoes`.
- Portal web exibe `Notificacoes do paciente` com coluna de pendentes e coluna de historico.
- Smoke visual cobre a nova area no desktop e mobile sem overflow horizontal.

## Decisoes

- A fase nao cria nova tabela; a fonte de verdade continua sendo `mensagens_notificacao`.
- A classificacao de pendencia considera status `pendente`, `agendada`, `processando` e `em_fila`.
- O canal vem preferencialmente do `payload.canal`, com fallback para canal configurado ou indefinido.
- O historico do portal limita exibicao visual aos itens mais recentes para manter a tela escaneavel.
- Campos novos no contrato web foram tratados como opcionais para preservar compatibilidade com respostas antigas durante transicao.

## Arquivos principais

- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.spec.ts`
- `octaclin-web/lib/portal-api.ts`
- `octaclin-web/components/portal/portal-paciente.tsx`
- `octaclin-web/tests/visual/portal-paciente.spec.mjs`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand servico-portal-paciente.spec.ts
cd octaclin-web; $env:E2E_WEB_URL='http://localhost:3105'; .\node_modules\.bin\playwright.cmd test tests/visual/portal-paciente.spec.mjs --reporter=list
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web build
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Permitir filtros por canal/status quando houver maior volume de comunicacoes.
- Avaliar confirmacao de leitura pelo paciente para atualizar o ciclo operacional da comunicacao.
- Unificar visualmente notificacoes com futuras preferencias avancadas de comunicacao e politica de silencio.
