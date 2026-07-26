# OctaClin - Matriz de confiabilidade e regressao

Atualizada na Fase 140 em 2026-07-26. Esta matriz conecta os riscos de maior
impacto aos testes automatizados existentes. Ela nao substitui o preflight,
smoke real de integracoes ou validacao manual de go-live.

| Risco | Protecao e teste | Comando principal | Gate |
| --- | --- | --- | --- |
| Isolamento multi-tenant | Pacientes e comunicacoes rejeitam IDs de outro tenant; agenda restringe por tenant e profissional. Testes: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.spec.ts`, `octaclin-backend/src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts`, `octaclin-backend/src/modulos/agenda/aplicacao/servico-agenda.spec.ts`. | `pnpm --dir octaclin-backend test --runInBand` | Bloqueia deploy |
| Autenticacao e autorizacao | Login, lockout, recuperacao e permissoes negativas. Testes: `octaclin-backend/src/modulos/auth/aplicacao/servico-auth.spec.ts`, `octaclin-backend/src/modulos/auth/aplicacao/servico-protecao-abuso.spec.ts`, `octaclin-web/scripts/test-autorizacao-rotas.mjs`. | `pnpm --dir octaclin-web test:authz` | Bloqueia deploy |
| BFF e sessao | Cookies HttpOnly, API invalida, renovacao e rotas protegidas. Teste: `octaclin-web/scripts/smoke-e2e-bff.mjs`. | `pnpm --dir octaclin-web smoke:e2e:bff` | Smoke de staging/CI |
| Integracoes externas | Erro de email, Meta e Google Calendar tratado sem expor secrets; reprocessamento operacional. Testes: `octaclin-backend/src/modulos/comunicacoes/infraestrutura/adaptadores/adaptador-email-smtp.spec.ts`, `octaclin-backend/src/modulos/comunicacoes/infraestrutura/adaptadores/adaptador-whatsapp-meta.spec.ts`, `octaclin-backend/src/modulos/agenda/aplicacao/servico-sincronizacao-google-calendar.spec.ts`. | `pnpm --dir octaclin-backend test --runInBand` | Bloqueia deploy e exige teste real controlado |
| Dados clinicos e portal | Escopo por profissional, portal do paciente e LGPD. Teste: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.spec.ts`. | `pnpm --dir octaclin-backend test --runInBand` | Bloqueia deploy |
| Operacao e recuperacao | Outbox, alertas, auditoria, LGPD e reprocessamento. Teste: `octaclin-backend/src/modulos/operacoes/aplicacao/servico-operacoes.spec.ts`. | `pnpm --dir octaclin-backend test --runInBand` | Bloqueia deploy |

## Execucao minima

```powershell
pnpm test:confiabilidade
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
```

Antes de producao, executar tambem `pnpm test:e2e:criticas`, validar
`/health/detalhado` e realizar uma acao real controlada para cada integracao
habilitada.
