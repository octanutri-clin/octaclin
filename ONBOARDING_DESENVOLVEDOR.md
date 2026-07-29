# OctaClin - Onboarding de desenvolvimento

Este guia prepara desenvolvedores e agentes para trabalhar no repositorio privado `octanutri-clin/octaclin` sem perder a cadeia de fases.

## Leitura inicial

1. `AGENTS.md`
2. `docs/handoffs/ESTADO_ATUAL_AGENTES.md`
3. `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
4. `RESUMO_FASES_CONCLUIDAS.md`
5. `STATUS_ATUAL_PROJETO.md`
6. O arquivo da fase que sera executada e os documentos de arquitetura ou operacao pertinentes.

## Entrada segura

1. Confirme a branch de trabalho e a cadeia de dependencias no handoff canonico.
2. Rode `git status --short` antes de editar.
3. Nao altere areas em que outro agente esteja trabalhando sem combinar o escopo.
4. Nao copie tokens, senhas, URLs de banco ou arquivos `.env` para commits, docs ou chat.

## Fechamento de fase

1. Implemente e valide o escopo proporcionalmente ao risco.
2. Crie ou atualize o arquivo `fase-XXX-*.md`.
3. Atualize checklist, resumo e status quando aplicavel.
4. Rode `git diff --check`, commite e envie a branch da fase.

Consulte `docs/handoffs/ESTADO_ATUAL_AGENTES.md` para o estado que pode mudar entre um agente e outro.
