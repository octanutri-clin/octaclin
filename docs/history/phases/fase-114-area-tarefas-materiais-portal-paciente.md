# Fase 114 - Area de tarefas e materiais no portal do paciente

Data: 2026-07-22

## Objetivo

Permitir que o paciente acompanhe, dentro do portal, as tarefas/metas prescritas e os materiais educativos enviados pelo profissional.

## Entregas

- Resumo autenticado do portal passa a retornar tarefas ativas do paciente.
- Resumo autenticado do portal passa a retornar materiais enviados ao paciente.
- Novos contadores `tarefasPendentes` e `materiaisDisponiveis` no resumo do portal.
- Descricao de tarefas e observacao de materiais sao descriptografadas somente para o paciente vinculado.
- Portal web adiciona aba `Plano` na navegacao.
- Portal web exibe `Plano de acompanhamento` com categoria, prioridade, status, vencimento e descricao.
- Portal web exibe `Materiais do plano` com tipo, categoria, resumo, observacao, status e link externo quando existir.
- Linha do tempo do portal inclui eventos de tarefas e materiais.
- Smoke visual cobre a nova area do plano sem overflow horizontal.

## Decisoes

- A fase entrega leitura e acompanhamento do plano pelo paciente. Acoes de conclusao pelo paciente ficam para fase futura, pois exigem definicao de auditoria, impacto clinico e regras de quem pode mudar status.
- Foram reaproveitadas as entidades das fases 106 e 107: `acompanhamento_tarefas`, `materiais_educativos` e `envios_material_paciente`.
- O portal filtra apenas itens do paciente logado e materiais ativos do tenant.
- Campos novos no contrato web foram tratados como opcionais para manter compatibilidade com mocks e respostas antigas durante transicao.

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
cd octaclin-web; $env:E2E_WEB_URL='http://localhost:3103'; .\node_modules\.bin\playwright.cmd test tests/visual/portal-paciente.spec.mjs --reporter=list
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web build
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Definir se o paciente podera marcar tarefas como concluidas e qual trilha de auditoria sera exigida.
- Definir tracking de visualizacao de material para atualizar `visualizadoEm` quando o paciente abrir um item.
- Evoluir o plano com filtros por status/categoria quando houver maior volume de tarefas e materiais.
