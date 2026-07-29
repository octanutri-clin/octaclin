# OctaClin - Estado Atual para Agentes

Atualizado na Fase 151 em 2026-07-28.

## Fonte de verdade

Este e o unico handoff operacional para Codex, Claude Code e outros agentes.
Leia tambem, nesta ordem: AGENTS.md, STATUS_ATUAL_PROJETO.md,
CHECKLIST_FASES_FUTURAS_PRODUCAO.md, RESUMO_FASES_CONCLUIDAS.md e os
arquivos de fase relacionados a tarefa.

Nao trate documentos historicos, logs antigos ou prompts de handoff anteriores
como estado atual.

## Estado de branches

- main e a branch de integracao final.
- Fase 150A: commit ca9e139, branch agent/fase-150a-escopo-mobile-ia, PR #6 aberta para revisao.
- Fase 150B: commit 8d86de7, branch agent/fase-150b-integracao-postgres, baseada na 150A.
- Fase 150C: commit 80cf5b5, branch agent/fase-150c-mobile-postgres, baseada na 150B.
- Fase 151: esta branch, agent/fase-151-continuity, baseada na 150C.

Nao faca merge em main fora da ordem das dependencias e nao faca deploy,
alteracao de Render, Neon, Upstash, Meta, Google ou secrets sem autorizacao
explicita do usuario.

## Fases recentes

- Fase 150A: hardening de escopo em Mobile e IA. IDs de DTO nao ampliam sessao.
- Fase 150B: prova PostgreSQL da IA preparada; falta execucao em banco descartavel exclusivo.
- Fase 150C: prova PostgreSQL do Mobile preparada; falta a mesma execucao de banco da 150B.
- Fase 151: handoff, governanca e documentacao de continuidade alinhados.

## Bloqueios externos reais

1. Criar um projeto Neon separado para testes, com banco octaclin_test_fase150b.
   Ele e apagado durante 150B/150C e nunca pode ser staging ou producao.
2. Fase 132 continua aguardando dominio oficial para DNS, SSL e identidade de envio.
3. Go-live assistido continua bloqueado ate os itens externos de dominio,
   revisao juridica e validacoes operacionais do checklist.

## Protocolo de trabalho

1. Sincronize a branch de trabalho, verifique git status --short e confirme
   se outro agente ja atua na mesma area.
2. Crie uma branch por fase; mantenha commits pequenos e valide antes de push.
3. Para mudanca funcional, escreva o teste antes do codigo.
4. Ao concluir uma fase, atualize checklist, status, resumo quando houver
   capacidade consolidada, arquivo fase-*.md e rotas/permissoes quando aplicavel.
5. Nunca commite secrets, .env, dumps, tokens, senhas, URLs de banco ou logs
   contendo credenciais.

## Validacoes usuais

    pnpm --dir octaclin-backend test --runInBand
    pnpm --dir octaclin-backend typecheck
    pnpm --dir octaclin-backend build
    pnpm --dir octaclin-web test:authz
    pnpm validate:docs
    pnpm test:handoff
    pnpm security:secrets
    git diff --check

Para 150B/150C, configure somente em um banco descartavel chamado
octaclin_test_fase150b e confirme OCTACLIN_POSTGRES_INTEGRACAO_CONFIRMAR=APAGAR.
