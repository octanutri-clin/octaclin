# OctaClin - Coordenacao entre agentes

A fonte operacional unica e `docs/handoffs/ESTADO_ATUAL_AGENTES.md`. Ela registra a fase atual, branches, dependencias, bloqueios e a proxima acao.

## Regras

- Trabalhe uma fase por vez; varias fases podem ser feitas em sequencia somente quando cada uma for fechada e documentada.
- Antes de iniciar, leia `AGENTS.md`, o handoff canonico, o checklist e o status do Git.
- Nunca altere a mesma area de outro agente ativo sem coordenar o escopo.
- Use uma branch por fase e nao integre fases dependentes fora da ordem registrada.
- Preserve mudancas de terceiros, evite refatoracoes laterais e nao commite segredos.

## Protocolo

1. Declare a fase e a area afetada.
2. Implemente com testes e validacoes adequadas.
3. Atualize o documento da fase, `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `RESUMO_FASES_CONCLUIDAS.md` e `STATUS_ATUAL_PROJETO.md` quando aplicavel.
4. Rode `git diff --check`, commite e envie a branch.
5. Atualize `docs/handoffs/ESTADO_ATUAL_AGENTES.md` se o estado compartilhado tiver mudado.
