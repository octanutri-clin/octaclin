# OctaClin - Retorno apos desenvolvedor

Use este checklist quando outro desenvolvedor/agente concluir fases antes de retomarmos aqui.

## Antes de continuar

- [ ] Rodar `git pull`.
- [ ] Conferir `git log --oneline --max-count=10`.
- [ ] Conferir `git status --short` limpo.
- [ ] Ler os novos arquivos `fase-*.md`.
- [ ] Ler as entradas novas em `DEVELOPMENT_LOG.md`.
- [ ] Conferir `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`.
- [ ] Conferir `RESUMO_FASES_CONCLUIDAS.md`.
- [ ] Conferir `STATUS_ATUAL_PROJETO.md`.
- [ ] Conferir migrations novas.
- [ ] Conferir mudancas em env, Render, Neon, Upstash, Google, Meta ou OpenAI.

## Validacao recomendada

```powershell
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
git diff --check
```

Se houve mudanca funcional ampla, rodar tambem:

```powershell
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web build
```

## Pontos de atencao

- Confirmar que cada fase teve commit proprio.
- Confirmar que nao houve secrets commitados.
- Confirmar que o roadmap avancou sem pular itens.
- Confirmar que rotas novas foram registradas em `MAPA_ROTAS_PERMISSOES.md`.
- Confirmar que migrations foram aplicadas ou documentadas para aplicar.
- Confirmar que qualquer dependencia externa pendente ficou registrada.
