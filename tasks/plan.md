# Handoff — Fase 308 para GPT-6 Luna Alto

## Objetivo e contexto suficiente

Implementar exames fora da faixa informada na Leitura clínica do Resumo do
prontuário, consumindo PB-17. Planejamento e gaps estão fechados em
[`PLANO_FASE_308.md`](../docs/history/phases/PLANO_FASE_308.md); é a fonte
completa de algoritmo, DTO, segurança, estados e matriz de testes.
Lista executável: [`todo.md`](todo.md). Não refazer auditoria ou planejamento.

Branch `feature/fase-308-resumo-exames`, base `04e66efc` (PR #384 mergeada).
Worktree: `/workspace/octaclin/.worktrees/feature-fase-308-resumo-exames`.
Nenhuma PR 308 aberta; plano deve entrar na mesma PR da implementação.
Reconfirmar `git status`, log, diff e main antes de editar. Um escritor ativo.

## Decisões que não precisam ser perguntadas novamente

- Último resultado por grupo, antes de filtrar fora da faixa; novo resultado
  normal ou não classificável substitui o antigo.
- Catálogo por ID. Nomes livres por nome + unidade + método, ignorando caixa e
  whitespace apenas no nome/método. Grupos livres e catálogo separados.
- 100 coletas recentes, até 10 destaques e avisos dos limites.
- Duplicidade na última coleta impede escolher/classificar o grupo.
- Sem migration, provider, portal, `/v1`, alerta ou inferência clínica.

## Pendências e primeira ação

Somente documentos e ambiente preparados. Tarefas 1–8 pendentes. Node 22.23.2
e pnpm 11.25.0 conferidos; install congelado de backend/Web PASS, sem diff de
lockfile. O shell padrão continua Node 24.19.0/pnpm 11.19.0; envolver cada
comando na raiz do worktree com:

```bash
npm exec --yes --package=node@22.23.2 --package=pnpm@11.25.0 -- sh -c 'COMANDO_AQUI'
```

Ler regras e começar Tarefa 1 em TDD. Não compartilhar `.next`/node_modules
com 307. Executar gates de cada checkpoint sequencialmente. Binário Chromium
existe; lançamento não foi testado. Revalidar se o ambiente for recriado.

## Risco e modelo

R4: tenant/carteira/papel/permissão, projeção mínima e PHI fora de logs/cache.
O plano deve permitir implementar com GPT-6 Luna Alto. Se surgir decisão
arquitetural nova ou falha de segurança não coberta, avisar o usuário e pedir
troca manual para GPT-6.1 Sol Alto, pausando o item afetado.
O proprietário autoriza planejamento neste turno; iniciar código somente
depois da troca manual e da instrução de implementação.

## Evidências e limites

- PASS: decisões, base/PR/CI, runtime, installs congelados, links locais,
  `git diff --check` e scanner de secrets conferidos no ciclo.
- SKIPPED: código, testes funcionais, build e revisão independente, pois ainda
  é planejamento; banco/deploy não acessados.
- Main base: CI principal `SUCCESS` (run 37971450248).
- Monitor produção separado `FAIL` (run 37977323201); causa não diagnosticada.
- Migration 1064 integrada na 307; aplicação operacional não verificada.

Commits/documentos e gates editoriais: consultar histórico desta branch e
registro final da transferência na conversa. Ao terminar implementação,
atualizar esse handoff com PASS/FAIL/NA/SKIPPED, PR, commit e próxima ação.
