# OctaClin - Mensagem pronta para handoff ao desenvolvedor

Use esta mensagem ao passar o projeto para outro desenvolvedor ou agente de IA.

```text
Voce esta entrando no projeto OctaClin, repo privado octanutri-clin/octaclin.

Antes de alterar codigo, leia:
- AGENTS.md
- ONBOARDING_DESENVOLVEDOR.md
- COORDENACAO_DESENVOLVIMENTO_IA.md
- PACOTE_PROXIMAS_FASES_DESENVOLVEDOR.md
- CHECKLIST_FASES_FUTURAS_PRODUCAO.md
- RESUMO_FASES_CONCLUIDAS.md
- STATUS_ATUAL_PROJETO.md
- HANDOFF-TECNICO-OCTACLIN.md
- MAPA_ROTAS_PERMISSOES.md
- TESTES_E_VALIDACOES.md
- VARIAVEIS_AMBIENTE.md
- RUNBOOK_PRODUCAO.md

Ultima fase concluida: Fase 105 - Evolucoes/anotacoes clinicas.
Proxima fase: Fase 106 - Planos de acompanhamento e tarefas do paciente.

Voce pode avancar por varias fases em sequencia, mas uma fase por vez.
Ao finalizar cada fase:
1. Crie o arquivo fase-XXX-*.md.
2. Atualize CHECKLIST_FASES_FUTURAS_PRODUCAO.md.
3. Atualize RESUMO_FASES_CONCLUIDAS.md e STATUS_ATUAL_PROJETO.md.
4. Atualize MAPA_ROTAS_PERMISSOES.md se criar rota/permissao.
5. Rode testes/typecheck/build proporcionais.
6. Rode git diff --check e varredura de secrets.
7. Faca commit e push.
8. Garanta git status limpo antes de seguir para a proxima fase.

Nao commite .env, tokens, senhas, dumps, logs ou secrets.
Nao mude provedores externos sem pedir ao usuario.
Se precisar de Render, Neon, Upstash, Google, Meta ou OpenAI, solicite acesso ou peca que o usuario execute o passo manualmente.
```
