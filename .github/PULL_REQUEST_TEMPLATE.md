# Resumo

- Fase:
- Objetivo:
- Principais entregas:

# Validacoes executadas

- [ ] `pnpm --dir octaclin-backend typecheck`
- [ ] `pnpm --dir octaclin-web typecheck`
- [ ] `pnpm --dir octaclin-web test:authz`
- [ ] Specs backend relevantes:
- [ ] Playwright relevante:
- [ ] `pnpm --dir octaclin-backend build`
- [ ] `pnpm --dir octaclin-web build`
- [ ] `powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly`
- [ ] `git diff --check`
- [ ] Varredura de secrets

# Documentacao atualizada

- [ ] `fase-XXX-*.md`
- [ ] `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- [ ] `RESUMO_FASES_CONCLUIDAS.md`
- [ ] `STATUS_ATUAL_PROJETO.md`
- [ ] `MAPA_ROTAS_PERMISSOES.md`, se aplicavel
- [ ] `TESTES_E_VALIDACOES.md`, se aplicavel
- [ ] `VARIAVEIS_AMBIENTE.md` ou `RUNBOOK_PRODUCAO.md`, se aplicavel

# Seguranca

- [ ] Nao inclui `.env` real.
- [ ] Nao inclui tokens, senhas, dumps ou logs sensiveis.
- [ ] Nao quebra isolamento multi-tenant.
- [ ] Rotas novas usam permissoes adequadas.

# Observacoes

- Pendencias:
- Proxima fase sugerida:
